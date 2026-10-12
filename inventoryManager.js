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

  const headers = ["SKU", ...INVENTORY_WAREHOUSES.map(warehouse => warehouse.label), "ETA"];
  for (const label of headers) {
    const th = document.createElement("th");
    th.textContent = label;
    header.appendChild(th);
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    const skuCell = document.createElement("td");
    skuCell.textContent = row.sku || "";
    tr.appendChild(skuCell);

    for (const warehouse of INVENTORY_WAREHOUSES) {
      const td = document.createElement("td");
      let quantity = 0;
      try { quantity = inventoryQuantity(row[warehouse.field]); } catch (_) { quantity = 0; }
      td.textContent = quantity > 0 ? String(quantity) : "—";
      td.className = quantity > 0 ? "inventory-in-stock" : "inventory-out-of-stock";
      tr.appendChild(td);
    }

    const etaCell = document.createElement("td");
    etaCell.textContent = row.eta == null ? "" : String(row.eta);
    tr.appendChild(etaCell);
    body.appendChild(tr);
  }
}

async function searchInventory() {
  const input = document.getElementById("inventorySearchInput");
  const query = String(input?.value ?? "").trim();
  if (!query) {
    clearInventoryResults("Enter a SKU to search inventory.");
    return;
  }

  if (isExcludedInventorySku(query)) {
    clearInventoryResults("SKUs ending in -KS are excluded from inventory.");
    return;
  }

  const status = document.getElementById("inventorySearchStatus");
  if (status) status.textContent = "🟡 Searching...";

  try {
    const client = getInventorySupabase();
    if (!client) throw new Error("Supabase client is not available.");
    const { data, error } = await client
      .from("inventory")
      .select(INVENTORY_SELECT_COLUMNS)
      .ilike("sku", `%${query.replace(/[%_]/g, "\\$&")}%`)
      .order("sku", { ascending: true })
      .limit(100);
    if (error) throw error;

    const rows = (data || []).filter(row => !isExcludedInventorySku(row.sku));
    renderInventoryResults(rows);
    if (status) {
      status.textContent = rows.length
        ? `🟢 Found ${rows.length} matching SKU${rows.length === 1 ? "" : "s"}${rows.length === 100 ? " (showing up to 100)" : ""}. Quantities above zero are in stock.`
        : "No matching inventory SKU found.";
    }
  } catch (error) {
    console.error("Inventory search failed:", error);
    clearInventoryResults(`🔴 Inventory search failed: ${error.message || error}`);
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
