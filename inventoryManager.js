// Inventory Database: dashboard counts and SKU search.

const INVENTORY_WAREHOUSES = [
  { field: "k2_wh", label: "K2 WH" },
  { field: "garcia", label: "Garcia" },
  { field: "ca2_best", label: "CA2 best" },
  { field: "cagl", label: "CAGL" },
  { field: "nj_best", label: "NJ BEST" },
  { field: "ga2", label: "GA2" }
];

const INVENTORY_SELECT_COLUMNS = "sku,k2_wh,eta,garcia,ca2_best,cagl,nj_best,ga2,updated_at";
const INVENTORY_PAGE_SIZE = 1000;

function getInventorySupabase() {
  return typeof supabaseClient !== "undefined" ? supabaseClient : null;
}

function normalizeInventorySku(value) {
  return String(value ?? "").trim().toUpperCase();
}

function isExcludedInventorySku(sku) {
  return normalizeInventorySku(sku).endsWith("-KS");
}

function inventoryQuantity(value) {
  if (value === null || value === undefined || String(value).trim() === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).trim().replace(/[$,]/g, "");
  if (!cleaned || cleaned === "—" || cleaned === "–" || cleaned === "-") return 0;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid inventory quantity: ${value}`);
  return parsed;
}

async function loadAllInventoryRows() {
  const client = getInventorySupabase();
  if (!client) throw new Error("Supabase client is not available.");

  const rows = [];
  for (let from = 0; ; from += INVENTORY_PAGE_SIZE) {
    const to = from + INVENTORY_PAGE_SIZE - 1;
    const { data, error } = await client
      .from("inventory")
      .select(INVENTORY_SELECT_COLUMNS)
      .order("sku", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < INVENTORY_PAGE_SIZE) break;
  }
  return rows;
}

function setInventoryCount(field, count) {
  const element = document.getElementById(`inventoryCount_${field}`);
  if (element) element.textContent = Number(count || 0).toLocaleString();
}

async function loadInventoryDatabase() {
  const status = document.getElementById("inventoryDatabaseStatus");
  if (status) status.textContent = "🟡 Loading inventory database...";

  try {
    const rows = await loadAllInventoryRows();
    const eligibleRows = rows.filter(row => !isExcludedInventorySku(row.sku));

    for (const warehouse of INVENTORY_WAREHOUSES) {
      const count = eligibleRows.reduce((total, row) => {
        let quantity = 0;
        try { quantity = inventoryQuantity(row[warehouse.field]); } catch (_) { quantity = 0; }
        return total + (quantity > 0 ? 1 : 0);
      }, 0);
      setInventoryCount(warehouse.field, count);
    }

    if (status) {
      status.textContent = `🟢 ${eligibleRows.length.toLocaleString()} inventory SKUs · counts show SKUs in stock`;
    }
  } catch (error) {
    console.error("Failed to load inventory database:", error);
    if (status) status.textContent = `🔴 Could not load inventory: ${error.message || error}`;
  }
}

function clearInventoryResults(message = "Enter a SKU to search inventory.") {
  const header = document.getElementById("inventoryResultsHeader");
  const body = document.getElementById("inventoryResultsBody");
  const status = document.getElementById("inventorySearchStatus");
  if (header) header.replaceChildren();
  if (body) body.replaceChildren();
  if (status) status.textContent = message;
}


function renderInventoryResults(rows) {
  const header = document.getElementById("inventoryResultsHeader");
  const body = document.getElementById("inventoryResultsBody");
  if (!header || !body) return;

  header.replaceChildren();
  body.replaceChildren();

  const headers = [
    "SKU",
    ...INVENTORY_WAREHOUSES.map(warehouse => warehouse.label),
    "ETA",
    "Stock Status"
  ];

  for (const label of headers) {
    const th = document.createElement("th");
    th.textContent = label;
    header.appendChild(th);
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
 
const skuCell = document.createElement("td");
const skuButton = document.createElement("button");

skuButton.type = "button";
skuButton.textContent = row.sku || "";
skuButton.title = "Click to copy SKU";
skuButton.style.cssText =
  "background:none;border:0;padding:0;color:inherit;" +
  "font:inherit;text-decoration:underline;cursor:pointer;";

skuButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(row.sku || "");
    const originalText = skuButton.textContent;
    skuButton.textContent = "Copied!";
    setTimeout(() => {
      skuButton.textContent = originalText;
    }, 1000);
  } catch (error) {
    // Fallback for browsers where Clipboard API is unavailable.
    window.prompt("Copy this SKU:", row.sku || "");
  }
});

skuCell.appendChild(skuButton);
tr.appendChild(skuCell);

    let hasStock = false;

    for (const warehouse of INVENTORY_WAREHOUSES) {
      const td = document.createElement("td");
      let quantity = 0;

      if (!row._notFound) {
        try {
          quantity = inventoryQuantity(row[warehouse.field]);
        } catch (_) {
          quantity = 0;
        }
      }

      if (quantity > 0) hasStock = true;

      td.textContent = quantity > 0 ? String(quantity) : "—";
      td.className = quantity > 0
        ? "inventory-in-stock"
        : "inventory-out-of-stock";

      tr.appendChild(td);
    }

    const etaCell = document.createElement("td");
    etaCell.textContent = row._notFound
    ? "—"
    : formatInventoryETA(row.eta);

    tr.appendChild(etaCell);

    const statusCell = document.createElement("td");

    if (row._notFound) {
      statusCell.textContent = "NOT FOUND";
      statusCell.className = "inventory-out-of-stock";
    } else if (hasStock) {
      statusCell.textContent = "IN STOCK";
      statusCell.className = "inventory-in-stock";
    } else {
      statusCell.textContent = "OUT OF STOCK";
      statusCell.className = "inventory-out-of-stock";
    }

    tr.appendChild(statusCell);
    body.appendChild(tr);
  }
}

async function searchInventory() {
  const input = document.getElementById("inventorySearchInput");
  const query = String(input?.value ?? "").trim();

  if (!query) {
    clearInventoryResults("Enter one or more SKUs to search.");
    return;
  }

  // Accept SKUs copied from Excel columns, including tabs and newlines.
  const skus = [
    ...new Set(
      query
        .split(/[\s,;]+/)
        .map(normalizeInventorySku)
        .filter(Boolean)
    )
  ];

  const excludedSkus = skus.filter(isExcludedInventorySku);
  const requestedSkus = skus.filter(
    sku => !isExcludedInventorySku(sku)
  );

  if (requestedSkus.length === 0) {
    clearInventoryResults(
      `${excludedSkus.length} -KS SKU(s) excluded from inventory search.`
    );
    return;
  }

  const status = document.getElementById("inventorySearchStatus");
  if (status) status.textContent = "🟡 Searching inventory...";

  try {
    const client = getInventorySupabase();
    if (!client) throw new Error("Supabase client is not available.");

    // Keep the original partial-match behavior for one SKU.
    if (skus.length === 1) {
      const { data, error } = await client
        .from("inventory")
        .select(INVENTORY_SELECT_COLUMNS)
        .ilike("sku", `%${requestedSkus[0].replace(/[%_]/g, "\\$&")}%`)
        .order("sku", { ascending: true })
        .limit(100);

      if (error) throw error;

      const rows = (data || []).filter(
        row => !isExcludedInventorySku(row.sku)
      );

      renderInventoryResults(rows);

      if (status) {
        status.textContent = rows.length
          ? `🟢 Found ${rows.length} matching SKU(s). Quantities above zero are in stock.`
          : "No matching inventory SKU found.";
      }

      return;
    }

    // Batch mode: exact SKU lookup in groups of 100.
    const foundRows = [];

    for (let i = 0; i < requestedSkus.length; i += 100) {
      const batch = requestedSkus.slice(i, i + 100);

      const { data, error } = await client
        .from("inventory")
        .select(INVENTORY_SELECT_COLUMNS)
        .in("sku", batch);

      if (error) throw error;

      foundRows.push(
        ...(data || []).filter(
          row => !isExcludedInventorySku(row.sku)
        )
      );
    }

    const rowsBySku = new Map(
      foundRows.map(row => [
        normalizeInventorySku(row.sku),
        row
      ])
    );

    // Keep the same order as the pasted list, including missing SKUs.
    const results = requestedSkus.map(sku => {
      return rowsBySku.get(sku) || {
        sku,
        k2_wh: 0,
        eta: null,
        garcia: 0,
        ca2_best: 0,
        cagl: 0,
        nj_best: 0,
        ga2: 0,
        _notFound: true
      };
    });

    renderInventoryResults(results);

    const foundCount = requestedSkus.filter(
      sku => rowsBySku.has(sku)
    ).length;

    const missingCount = requestedSkus.length - foundCount;

    if (status) {
      status.textContent =
        `🟢 ${foundCount} of ${requestedSkus.length} requested SKUs found.` +
        (missingCount ? ` ${missingCount} not found.` : "") +
        (excludedSkus.length
          ? ` ${excludedSkus.length} -KS SKU(s) excluded.`
          : "") +
        " Results follow your pasted order.";
    }
  } catch (error) {
    console.error("Inventory search failed:", error);
    clearInventoryResults(
      `🔴 Inventory search failed: ${error.message || error}`
    );
  }
}


// Allow Enter in the search field to trigger a search without changing existing UI code.
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("inventorySearchInput");
  if (input) input.addEventListener("keydown", event => {
    if (event.key === "Enter") searchInventory();
  });
});


/* ===== Temporary stock highlights in Orders ===== */

let inventoryStockSkuSet = new Set();
let inventoryStockHighlightUntil = 0;
let inventoryStockHighlightTimer = null;

async function highlightInStockOrderItemsOnLoad() {
  try {
    // Load inventory only after the user has logged in.
    const rows = await loadAllInventoryRows();
    const inStockSkus = new Set();

    for (const row of rows) {
      const sku = normalizeInventorySku(row.sku);

      if (!sku || isExcludedInventorySku(sku)) continue;

      // A SKU is in stock if ANY warehouse has quantity > 0.
      const inStock = INVENTORY_WAREHOUSES.some((warehouse) => {
        const quantity = inventoryQuantity(row[warehouse.field]);
        return quantity > 0;
      });

      if (inStock) inStockSkus.add(sku);
    }

    inventoryStockSkuSet = inStockSkus;

    // Start the five-second window after the inventory check completes.
    inventoryStockHighlightUntil = Date.now() + 5000;

    if (inventoryStockHighlightTimer) {
      clearTimeout(inventoryStockHighlightTimer);
    }

    // Re-render the order table with matching Item ID cells highlighted.
    renderTable();

    inventoryStockHighlightTimer = setTimeout(() => {
      inventoryStockHighlightUntil = 0;

      document
        .querySelectorAll("#tableBody td.inventory-stock-flash")
        .forEach((cell) => {
          cell.classList.remove("inventory-stock-flash");
        });
    }, 5000);

  } catch (error) {
    // An inventory lookup failure must not prevent the Orders page working.
    console.error("Could not check inventory for order highlights:", error);
    inventoryStockSkuSet = new Set();
    inventoryStockHighlightUntil = 0;
  }
}


function formatInventoryETA(value) {
  if (value == null || String(value).trim() === "") return "";

  const text = String(value).trim();

  // Remove a time portion such as "00:00:00" or "T12:34:56".
  const dateOnly = text.split(/[T ]/)[0];

  // Convert YYYY-MM-DD to "Oct 18 2026" without timezone shifts.
  const match = dateOnly.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (match) {
    const [, year, month, day] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      12
    );

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  // For values already formatted as "Oct 18 2026", keep them.
  return dateOnly;
}
