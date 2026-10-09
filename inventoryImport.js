// Inventory Excel import. Requires XLSX, supabaseClient, and inventoryManager.js.

function normalizeInventoryHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getInventoryExcelValue(row, aliases) {
  const wanted = new Set(aliases.map(normalizeInventoryHeader));
  const key = Object.keys(row).find(header => wanted.has(normalizeInventoryHeader(header)));
  return key === undefined ? undefined : row[key];
}

function normalizeInventoryEta(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  if (typeof value === "number" && typeof XLSX !== "undefined" && XLSX.SSF?.parse_date_code) {
    const date = XLSX.SSF.parse_date_code(value);
    if (date && date.y && date.m && date.d) {
      return `${String(date.y).padStart(4, "0")}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }
  }
  return String(value).trim();
}

function parseInventoryExcelRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("The first worksheet is empty.");
  }

  const warehouseAliases = [
    { field: "k2_wh", aliases: ["K2 WH", "K2WH"] },
    { field: "garcia", aliases: ["Garcia"] },
    { field: "ca2_best", aliases: ["CA2 best", "CA2best"] },
    { field: "cagl", aliases: ["CAGL"] },
    { field: "nj_best", aliases: ["NJ BEST", "NJBEST"] },
    { field: "ga2", aliases: ["GA2"] }
  ];

  const firstRow = rows[0];
  const skuHeader = Object.keys(firstRow).find(header => normalizeInventoryHeader(header) === "sku");
  if (!skuHeader) throw new Error('Could not find a "SKU" column.');

  // Validate warehouse columns before importing so a renamed/missing header cannot zero out a warehouse.
  for (const warehouse of warehouseAliases) {
    const exists = Object.keys(firstRow).some(header =>
      warehouse.aliases.map(normalizeInventoryHeader).includes(normalizeInventoryHeader(header))
    );
    if (!exists) throw new Error(`Could not find the "${warehouse.aliases[0]}" column.`);
  }

  const seen = new Set();
  const payload = [];
  let excludedKs = 0;
  let skippedBlankSku = 0;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const sku = normalizeInventorySku(getInventoryExcelValue(row, ["SKU"]));
    if (!sku) {
      skippedBlankSku++;
      continue;
    }
    if (isExcludedInventorySku(sku)) {
      excludedKs++;
      continue;
    }
    if (seen.has(sku)) {
      throw new Error(`Duplicate SKU "${sku}" found in the Excel file (around data row ${index + 2}). Please remove duplicates and upload again.`);
    }
    seen.add(sku);

    const item = {
      sku,
      eta: normalizeInventoryEta(getInventoryExcelValue(row, ["ETA"])),
      updated_at: new Date().toISOString()
    };
    for (const warehouse of warehouseAliases) {
      const raw = getInventoryExcelValue(row, warehouse.aliases);
      try {
        item[warehouse.field] = inventoryQuantity(raw);
      } catch (error) {
        throw new Error(`SKU ${sku}: ${error.message}`);
      }
    }
    payload.push(item);
  }

  if (!payload.length) throw new Error("No eligible inventory SKUs were found. Check the SKU column and -KS exclusions.");
  return { payload, excludedKs, skippedBlankSku };
}

async function handleInventoryExcelUpload(event) {
  const input = event?.target || document.getElementById("inventoryExcelInput");
  const file = input?.files?.[0];
  if (!file) return;

  const status = document.getElementById("inventoryDatabaseStatus");
  if (status) status.textContent = "🟡 Reading inventory Excel...";

  try {
    if (typeof XLSX === "undefined") throw new Error("Excel reader (XLSX) is not loaded.");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) throw new Error("The workbook has no worksheets.");
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const parsed = parseInventoryExcelRows(rows);

    if (status) status.textContent = "🟡 Checking current inventory...";
    const existingRows = await loadAllInventoryRows();
    const incomingSkus = new Set(parsed.payload.map(item => item.sku));
    const staleSkus = existingRows
      .map(row => normalizeInventorySku(row.sku))
      .filter(sku => sku && !incomingSkus.has(sku));

    const preview = [
      `File: ${file.name}`,
      `Eligible SKUs to import: ${parsed.payload.length.toLocaleString()}`,
      `SKUs ending in -KS excluded: ${parsed.excludedKs.toLocaleString()}`,
      `Rows with blank SKU skipped: ${parsed.skippedBlankSku.toLocaleString()}`,
      `Existing SKUs absent from this file (will be removed): ${staleSkus.length.toLocaleString()}`,
      "",
      "Continue with this full inventory replacement?"
    ].join("\n");

    if (!window.confirm(preview)) {
      if (status) status.textContent = "Import cancelled; inventory was not changed.";
      return;
    }

    const client = getInventorySupabase();
    if (!client) throw new Error("Supabase client is not available.");

    // Upsert first. If any batch fails, do not delete old rows.
    const batchSize = 500;
    for (let start = 0; start < parsed.payload.length; start += batchSize) {
      if (status) {
        const completed = Math.min(start, parsed.payload.length);
        status.textContent = `🟡 Uploading inventory... ${completed.toLocaleString()} / ${parsed.payload.length.toLocaleString()}`;
      }
      const batch = parsed.payload.slice(start, start + batchSize);
      const { error } = await client.from("inventory").upsert(batch, { onConflict: "sku" });
      if (error) throw new Error(`Upload failed before cleanup: ${error.message || error}`);
    }

    // Remove stale SKUs only after every upsert batch succeeded.
    for (let start = 0; start < staleSkus.length; start += 100) {
      const batch = staleSkus.slice(start, start + 100);
      const { error } = await client.from("inventory").delete().in("sku", batch);
      if (error) {
        throw new Error(`Inventory was uploaded, but cleanup of old SKUs failed: ${error.message || error}. Refresh and check the table before retrying.`);
      }
    }

    await loadInventoryDatabase();
    const searchInput = document.getElementById("inventorySearchInput");
    if (searchInput?.value?.trim()) await searchInventory();
    if (status) status.textContent = `🟢 Inventory updated: ${parsed.payload.length.toLocaleString()} SKUs imported; ${staleSkus.length.toLocaleString()} old SKUs removed; ${parsed.excludedKs.toLocaleString()} -KS SKUs excluded.`;
    window.alert(`Inventory import complete.\n\nImported: ${parsed.payload.length.toLocaleString()} SKUs\nRemoved old SKUs: ${staleSkus.length.toLocaleString()}\nExcluded -KS SKUs: ${parsed.excludedKs.toLocaleString()}`);
  } catch (error) {
    console.error("Inventory Excel import failed:", error);
    if (status) status.textContent = `🔴 Inventory import failed: ${error.message || error}`;
    window.alert(`Inventory import failed:\n${error.message || error}\n\nCheck the Inventory Database status before retrying.`);
  } finally {
    if (input) input.value = "";
  }
}
