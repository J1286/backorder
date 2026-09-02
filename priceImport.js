// EXCEL UPLOAD
async function handlePriceExcelUpload(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  const status = document.getElementById("priceSearchStatus");

  try {
    if (status) {
      status.textContent = "🟡 Reading Excel file...";
    }

    // READ EXCEL
    const arrayBuffer = await file.arrayBuffer();

    const workbook = XLSX.read(arrayBuffer, {
      type: "array"
    });

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    const excelRows = XLSX.utils.sheet_to_json(firstSheet, {
      defval: ""
    });

    if (!excelRows.length) {
      throw new Error("The Excel file does not contain any data.");
    }

    console.log("Excel price rows:", excelRows.length);

    // NORMALIZE EXCEL DATA
    const normalizedExcel = normalizeExcelPriceRows(excelRows);

    if (!normalizedExcel.length) {
      throw new Error("No valid SKU rows were found in the Excel file.");
    }

    // LOAD CURRENT DATABASE
    if (status) {
      status.textContent = "🟡 Loading current prices...";
    }

    const databaseRows = await loadAllPriceRows();

    console.log("Database price rows:", databaseRows.length);

    // COMPARE
    if (status) {
      status.textContent = "🟡 Comparing prices...";
    }

    const comparison = comparePriceData(normalizedExcel, databaseRows);

    console.log("PRICE COMPARISON:", comparison);

    // SHOW PREVIEW
    showPriceImportPreview(file.name, comparison);

    if (status) {
      status.textContent = `🟢 ${comparison.changed.length} price changes found`;
    }
  } catch (error) {
    console.error("Price Excel comparison failed:", error);

    alert("Failed to compare price Excel:\n\n" + error.message);

    if (status) {
      status.textContent = "🔴 Price Excel comparison failed";
    }
  } finally {
    // Allow selecting the same file again
    event.target.value = "";
  }
}

// NORMALIZE EXCEL PRICE ROWS
function normalizeExcelPriceRows(rows) {
  return rows
    .map((rawRow) => {
      const row = {};

      // SKU
      row.sku = getExcelValue(rawRow, [
        "sku",
        "SKU",
        "Sku",
        "part number",
        "Part Number",
        "partnumber"
      ])
        .toString()
        .trim()
        .toUpperCase();

      if (!row.sku) {
        return null;
      }

      // DEALER PRICES
      PRICE_DEALERS.forEach((dealer) => {
        const value = getExcelValue(rawRow, [dealer.field, dealer.label]);

        row[dealer.field] = normalizePriceValue(value);
      });

      return row;
    })
    .filter(Boolean);
}

// GET EXCEL VALUE
function getExcelValue(row, possibleNames) {
  const keys = Object.keys(row);

  for (const name of possibleNames) {
    const exactKey = keys.find(
      (key) => key.trim().toLowerCase() === name.trim().toLowerCase()
    );

    if (exactKey !== undefined) {
      return row[exactKey];
    }
  }

  return "";
}

// NORMALIZE PRICE
function normalizePriceValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value)
    .replace(/[$,\s]/g, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

// LOAD ALL PRICE ROWS
async function loadAllPriceRows() {
  const client = getPriceSupabase();

  if (!client) {
    throw new Error("Supabase client not available");
  }

  const allRows = [];

  const pageSize = 1000;

  let from = 0;

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await client
      .from("prices")
      .select(
        `
        sku,
        redline360,
        aag,
        tdot,
        pq,
        ntxglow,
        omac
      `
      )
      .order("sku")
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}

// COMPARE EXCEL AGAINST DATABASE
function comparePriceData(excelRows, databaseRows) {
  const databaseMap = new Map();

  databaseRows.forEach((row) => {
    const sku = String(row.sku || "")
      .trim()
      .toUpperCase();

    if (sku) {
      databaseMap.set(sku, row);
    }
  });

  const changed = [];
  const unchanged = [];
  const newSkus = [];

  const excelSkuSet = new Set();

  excelRows.forEach((excelRow) => {
    const sku = excelRow.sku;

    excelSkuSet.add(sku);

    const existing = databaseMap.get(sku);

    // NEW SKU
    if (!existing) {
      newSkus.push(excelRow);

      return;
    }

    // EXISTING SKU
    const changes = [];

    PRICE_DEALERS.forEach((dealer) => {
      const oldValue = normalizePriceValue(existing[dealer.field]);

      const newValue = normalizePriceValue(excelRow[dealer.field]);

      if (!pricesEqual(oldValue, newValue)) {
        changes.push({
          field: dealer.field,

          dealer: dealer.label,

          oldValue,
          newValue
        });
      }
    });

    if (changes.length) {
      changed.push({
        sku,
        changes,
        row: excelRow
      });
    } else {
      unchanged.push(excelRow);
    }
  });

  // SKUS IN DATABASE BUT NOT EXCEL
  const missingFromExcel = [];

  databaseRows.forEach((row) => {
    const sku = String(row.sku || "")
      .trim()
      .toUpperCase();

    if (sku && !excelSkuSet.has(sku)) {
      missingFromExcel.push(row);
    }
  });

  return {
    excelCount: excelRows.length,

    databaseCount: databaseRows.length,

    newSkus,

    changed,

    unchanged,

    missingFromExcel
  };
}

// COMPARE NUMBERS SAFELY
function pricesEqual(a, b) {
  if (a === null && b === null) {
    return true;
  }

  if (a === null || b === null) {
    return false;
  }

  return Math.abs(a - b) < 0.00001;
}

// SHOW IMPORT PREVIEW
function showPriceImportPreview(fileName, comparison) {
  const existing = document.getElementById("priceImportPreview");

  if (existing) {
    existing.remove();
  }

  const modal = document.createElement("div");

  modal.id = "priceImportPreview";

  modal.className = "modal";

  const content = document.createElement("div");

  content.className = "modal-content price-import-modal";

  content.innerHTML = `
    <span
      class="price-import-close"
      id="closePriceImportPreview"
    >
      &times;
    </span>

    <h2>
      📊 Price Import Preview
    </h2>

    <p>
      <strong>File:</strong>
      ${escapeHtml(fileName)}
    </p>

    <div class="price-import-summary">

      <div class="import-stat">
        <strong>
          ${comparison.excelCount}
        </strong>
        <span>SKUs in Excel</span>
      </div>

      <div class="import-stat new">
        <strong>
          ${comparison.newSkus.length}
        </strong>
        <span>New SKUs</span>
      </div>

      <div class="import-stat changed">
        <strong>
          ${comparison.changed.length}
        </strong>
        <span>SKUs Changed</span>
      </div>

      <div class="import-stat">
        <strong>
          ${comparison.unchanged.length}
        </strong>
        <span>Unchanged</span>
      </div>

      <div class="import-stat missing">
        <strong>
          ${comparison.missingFromExcel.length}
        </strong>
        <span>Missing From Excel</span>
      </div>

    </div>

    <hr>

    <div id="priceImportChanges"></div>

    <div class="price-import-actions">

      <button
        id="cancelPriceImport"
      >
        Cancel
      </button>

      <button
        id="applyPriceImport"
        class="apply-price-button"
        ${
          comparison.changed.length === 0 && comparison.newSkus.length === 0
            ? "disabled"
            : ""
        }
      >
        💾 Apply Changes
      </button>

    </div>
  `;

  modal.appendChild(content);

  document.body.appendChild(modal);

  modal.style.display = "block";

  // RENDER CHANGES
  renderPriceImportChanges(comparison);

  // CLOSE
  document.getElementById("closePriceImportPreview").onclick = () =>
    modal.remove();

  document.getElementById("cancelPriceImport").onclick = () => modal.remove();

  // APPLY
  document.getElementById("applyPriceImport").onclick = () => {
    applyPriceImport(comparison, modal);
  };
}

// RENDER IMPORT CHANGES
function renderPriceImportChanges(comparison) {
  const container = document.getElementById("priceImportChanges");

  if (!container) {
    return;
  }

  let html = "";

  // PRICE CHANGES
  if (comparison.changed.length) {
    html += `
      <h3>
        🟡 Price Changes
      </h3>

      <div class="price-change-table-wrapper">

        <table class="price-change-table">

          <thead>
            <tr>
              <th>SKU</th>
              <th>Dealer</th>
              <th>Old Price</th>
              <th>New Price</th>
            </tr>
          </thead>

          <tbody>
    `;

    comparison.changed.forEach((item) => {
      item.changes.forEach((change) => {
        html += `
              <tr>

                <td>
                  ${escapeHtml(item.sku)}
                </td>

                <td>
                  ${escapeHtml(change.dealer)}
                </td>

                <td>
                  ${formatPrice(change.oldValue) || "—"}
                </td>

                <td class="${getPriceChangeClass(
                  change.oldValue,
                  change.newValue
                )}">
                  ${formatPrice(change.newValue) || "—"}
                </td>

              </tr>
            `;
      });
    });

    html += `
          </tbody>

        </table>

      </div>
    `;
  }

  // NEW SKUS
  if (comparison.newSkus.length) {
    html += `
      <h3>
        🟢 New SKUs
      </h3>

      <div class="new-sku-list">
    `;

    comparison.newSkus.slice(0, 100).forEach((row) => {
      html += `
            <div class="new-sku-row">

              <strong>
                ${escapeHtml(row.sku)}
              </strong>

              <span>
                New SKU
              </span>

            </div>
          `;
    });

    if (comparison.newSkus.length > 100) {
      html += `
        <p>
          Showing first 100 new SKUs.
        </p>
      `;
    }

    html += `
      </div>
    `;
  }

  // MISSING FROM EXCEL
  if (comparison.missingFromExcel.length) {
    html += `
      <h3>
        🔴 Missing From Excel
      </h3>

      <p class="warning-text">
        ${comparison.missingFromExcel.length}
        SKUs exist in the database but
        were not found in this Excel file.
        They will <strong>NOT</strong> be deleted.
      </p>
    `;
  }

  // NOTHING CHANGED
  if (comparison.changed.length === 0 && comparison.newSkus.length === 0) {
    html += `
      <div class="no-price-changes">
        ✅ Everything already matches.
        No database changes are required.
      </div>
    `;
  }

  container.innerHTML = html;
}

function getPriceChangeClass(oldValue, newValue) {
  if (oldValue === null && newValue !== null) {
    return "price-increase";
  }

  if (oldValue !== null && newValue === null) {
    return "price-removed";
  }

  if (newValue > oldValue) {
    return "price-increase";
  }

  if (newValue < oldValue) {
    return "price-decrease";
  }

  return "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// APPLY PRICE IMPORT
async function applyPriceImport(comparison, modal) {
  const changes = [
    ...comparison.changed.map((item) => item.row),
    ...comparison.newSkus
  ];

  if (!changes.length) {
    return;
  }

  const confirmed = confirm(
    `Apply ${changes.length} SKU changes to the price database?\n\n` +
      `${comparison.changed.length} existing SKUs changed\n` +
      `${comparison.newSkus.length} new SKUs\n\n` +
      `SKUs missing from Excel will NOT be deleted.`
  );

  if (!confirmed) {
    return;
  }

  const button = document.getElementById("applyPriceImport");

  if (button) {
    button.disabled = true;

    button.textContent = "🟡 Updating...";
  }

  try {
    const client = getPriceSupabase();

    if (!client) {
      throw new Error("Supabase client not available");
    }

    // BATCH UPSERT
    const batchSize = 500;

    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);

      const payload = batch.map((row) => {
        const clean = {
          sku: row.sku
        };

        PRICE_DEALERS.forEach((dealer) => {
          clean[dealer.field] = normalizePriceValue(row[dealer.field]);
        });

        return clean;
      });

      const { error } = await client.from("prices").upsert(payload, {
        onConflict: "sku"
      });

      if (error) {
        throw error;
      }

      if (button) {
        button.textContent = `🟡 Updating ${Math.min(
          i + batch.length,
          changes.length
        )} / ${changes.length}...`;
      }
    }

    // SUCCESS
    if (modal) {
      modal.remove();
    }

    const status = document.getElementById("priceSearchStatus");

    if (status) {
      status.textContent =
        `🟢 Price database updated: ` + `${changes.length} SKUs`;
    }

    // Refresh count
    loadPriceDatabase();

    // Refresh currently displayed search
    const searchInput = document.getElementById("priceSearchInput");

    if (searchInput && searchInput.value.trim()) {
      await searchPrices();
    }

    alert(
      `✅ Price database updated successfully.\n\n` +
        `${comparison.changed.length} existing SKUs changed\n` +
        `${comparison.newSkus.length} new SKUs added`
    );
  } catch (error) {
    console.error("Price import failed:", error);

    if (button) {
      button.disabled = false;

      button.textContent = "💾 Apply Changes";
    }

    alert("❌ Failed to update price database:\n\n" + error.message);
  }
}