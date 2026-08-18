
async function showApp() {
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("app").style.display = "block";

  await loadOrders();
  showOrders();

  startRealtime();
}

let data = [];
let currentPage = 1;
let rowsPerPage = 50; // Change to 100 if prefer

function mapDBRow(row) {
  return {
    _id: row.id,

    "DShipper ID": row.dshipper_id || "",
    "Tr.Orig.No.": row.tr_orig_no || "",
    "Cust. PO No.": row.cust_po_no || "",

    "Item ID 1": row.item_id_1 || "",
    "Qty 1": row.qty_1 || "",
    "Price 1": row.price_1 || "",

    "Item ID 2": row.item_id_2 || "",
    "Qty 2": row.qty_2 || "",
    "Price 2": row.price_2 || "",

    "Item ID 3": row.item_id_3 || "",
    "Qty 3": row.qty_3 || "",
    "Price 3": row.price_3 || "",

    "Item ID 4": row.item_id_4 || "",
    "Qty 4": row.qty_4 || "",
    "Price 4": row.price_4 || "",

    "Item ID 5": row.item_id_5 || "",
    "Qty 5": row.qty_5 || "",
    "Price 5": row.price_5 || "",

    "Ship Name": cleanText(row.ship_name) || "",
    "Ship Addr1": cleanText(row.ship_addr1) || "",
    "Ship Addr2": row.ship_addr2 || "",
    "Ship City": row.ship_city || "",
    "Ship State": row.ship_state || "",
    "Ship Zip": row.ship_zip || "",
    "Ship Country": row.ship_country || "",
    "Ship Phone": row.ship_phone || "",
    "Ship Email": row.ship_email || "",
    "Ship Service": row.ship_service || "",
    "Ship Ins.": row.ship_ins || "",
    "Ship COD": row.ship_cod || "",
    "Ship Confirm.": row.ship_confirm || "",
    "Ship From": row.ship_from || "",
    "Ship Acct": row.ship_acct || "",

    _notes: row.notes || "",

    _meta: {
      updatedAt: row.updated_at
    }
  };
}

function mapRowToDB(row) {
  return {
    dshipper_id: row["DShipper ID"] || "",
    tr_orig_no: row["Tr.Orig.No."] || "",
    cust_po_no: row["Cust. PO No."] || "",

    item_id_1: row["Item ID 1"] || "",
    qty_1: row["Qty 1"] || "",
    price_1: row["Price 1"] || "",

    item_id_2: row["Item ID 2"] || "",
    qty_2: row["Qty 2"] || "",
    price_2: row["Price 2"] || "",

    item_id_3: row["Item ID 3"] || "",
    qty_3: row["Qty 3"] || "",
    price_3: row["Price 3"] || "",

    item_id_4: row["Item ID 4"] || "",
    qty_4: row["Qty 4"] || "",
    price_4: row["Price 4"] || "",

    item_id_5: row["Item ID 5"] || "",
    qty_5: row["Qty 5"] || "",
    price_5: row["Price 5"] || "",

    ship_name: row["Ship Name"] || "",
    ship_addr1: row["Ship Addr1"] || "",
    ship_addr2: row["Ship Addr2"] || "",
    ship_city: row["Ship City"] || "",
    ship_state: row["Ship State"] || "",
    ship_zip: row["Ship Zip"] || "",
    ship_country: row["Ship Country"] || "",
    ship_phone: row["Ship Phone"] || "",
    ship_email: row["Ship Email"] || "",
    ship_service: row["Ship Service"] || "",
    ship_ins: row["Ship Ins."] || "",
    ship_cod: row["Ship COD"] || "",
    ship_confirm: row["Ship Confirm."] || "",
    ship_from: row["Ship From"] || "",
    ship_acct: row["Ship Acct"] || "",

    notes: row._notes || "",
    updated_at: new Date().toISOString()
  };
}

let searchQuery = "";
let undoStack = [];
let redoStack = [];
let notesSortAsc = true;
let sortByUpdated = false;
let sortAsc = false;
let realtimeChannel = null;

// Columns definition
const columns = [
  "DShipper ID",
  "Tr.Orig.No.",
  "Cust. PO No.",
  "Item ID 1",
  "Qty 1",
  "Price 1",
  "Item ID 2",
  "Qty 2",
  "Price 2",
  "Item ID 3",
  "Qty 3",
  "Price 3",
  "Item ID 4",
  "Qty 4",
  "Price 4",
  "Item ID 5",
  "Qty 5",
  "Price 5",
  "Ship Name",
  "Ship Addr1",
  "Ship Addr2",
  "Ship City",
  "Ship State",
  "Ship Zip",
  "Ship Country",
  "Ship Phone",
  "Ship Email",
  "Ship Service",
  "Ship Ins.",
  "Ship COD",
  "Ship Confirm.",
  "Ship From",
  "Ship Acct"
];

const dealerMap = {
  redline360: "W7232",
  ecs: "W6938",
  tdot: "W7290",
  others: "OTHERS"
};

const noteOptions = [
  "IN STOCK",
  "WAIT TO RECEIVE",
  "ETA 6-8 Weeks",
  "ETA ",
  "HOLD",
  "NO ETA",
  "DISCONTINUED",
  "STOCK ORDER"
];

let dealerSelect;
let debounceTimeout;

// ======= Initialization =======
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("closeProfile").onclick = () => {
    document.getElementById("profileModal").style.display = "none";
  };

  document.getElementById("closeHistory").onclick = () => {
    document.getElementById("historyModal").style.display = "none";
  };

  document.getElementById("closeReadme").onclick = () => {
    document.getElementById("readmeModal").style.display = "none";
  };

  window.addEventListener("click", (e) => {
    const modal = document.getElementById("historyModal");

    if (e.target === modal) modal.style.display = "none";
  });

  const rowsPerPageSelect = document.getElementById("rowsPerPage");

  if (rowsPerPageSelect) {
    rowsPerPageSelect.value = rowsPerPage;

    rowsPerPageSelect.addEventListener("change", () => {
      rowsPerPage = parseInt(rowsPerPageSelect.value, 10);

      currentPage = 1;

      renderTable();
    });
  }

  document.getElementById("loginBox").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      login();
    }
  });

  dealerSelect = document.getElementById("dealerSelect");

  if (dealerSelect) dealerSelect.addEventListener("change", renderTable);

  const searchBox = document.getElementById("searchBox");

  if (searchBox) {
    searchBox.addEventListener("input", (e) => {
      clearTimeout(debounceTimeout);

      debounceTimeout = setTimeout(() => {
        searchQuery = e.target.value.toLowerCase();
        renderTable();
      }, 150);
    });
  }

  renderHeaders();

  await checkLogin();
});

// ======= Utility Functions =======
function normalizeData() {
  data = data.map((row) => {
    if (!row._id) row._id = crypto.randomUUID();
    return row;
  });
}

function saveState() {
  undoStack.push(JSON.stringify(data));
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);

  return d.toLocaleString([], {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function safeRemove(el) {
  if (!el) return;

  if (el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

function createEmptyRow() {
  const now = new Date().toISOString();

  return {
    _meta: {
      createdAt: now,
      updatedAt: now
    }
  };
}

function cleanText(value) {
  return String(value || "")
    .replace(/\r?\n/g, " ")
    .trim();
}

function showToast(msg) {
  let toast = document.createElement("div");
  toast.innerText = msg;

  const container = document.getElementById("tableContainer");
  if (!container) return;
  const rect = container.getBoundingClientRect();

  Object.assign(toast.style, {
    position: "fixed",
    top: rect.top + 10 + "px",
    left: rect.right - 120 + "px",
    background: "#333",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "14px",
    zIndex: 9999,
    opacity: 0.9
  });

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 1000);
}

// ======= Undo / Redo =======
async function undo() {
  const action = undoStack.pop();
  console.log("UNDO ACTION:", action);

  if (!action) {
    showToast("Nothing to undo");
    return;
  }

  // =========================
  // BULK DELETE UNDO
  // =========================
  if (action.action === "BULK_DELETE") {
    for (const oldRow of action.rows) {
      const restoreRow = structuredClone(oldRow);

      delete restoreRow._id;
      delete restoreRow._meta;

      const inserted = await insertOrder(restoreRow);

      if (inserted) {
        await addLog({
          orderId: inserted.id,
          action: "RESTORE"
        });
      }
    }

    await loadOrders();
    showToast(`${action.rows.length} orders restored`);
    updateUndoButtons();
    return;
  }

  // =========================
  // DELETE UNDO
  // =========================
  if (action.action === "DELETE") {
    const restoreRow = structuredClone(action.oldData);

    delete restoreRow._id;
    delete restoreRow._meta;

    console.log("RESTORING:", restoreRow);

    const inserted = await insertOrder(restoreRow);

    console.log("INSERT RESULT:", inserted);

    if (inserted) {
      redoStack.push({
        ...action,
        orderId: inserted.id
      });

      await addLog({
        orderId: inserted.id,
        action: "RESTORE"
      });

      await loadOrders();
      updateUndoButtons();
      showToast("Order restored");
    }

    return;
  }

  // =========================
  // NORMAL FIELD UNDO
  // =========================
  const row = data.find((r) => r._id === action.orderId);

  if (!row) {
    showToast("Order no longer exists");
    return;
  }

  redoStack.push(action);

  row[action.field] = action.oldValue;

  await updateOrder(row);
  await loadOrders();

  showToast("Undo completed");
  updateUndoButtons();
}

async function redo() {
  const action = redoStack.pop();
  if (!action) {
    showToast("Nothing to redo");
    return;
  }

  if (action.action === "DELETE") {
    await deleteOrderFromDB(action.orderId);
    await addLog({
      orderId: action.orderId,
      action: "DELETE"
    });

    undoStack.push(action);
    await loadOrders();
    updateUndoButtons();
    showToast("Order deleted again");
    return;
  }
  const row = data.find((r) => r._id === action.orderId);
  if (!row) {
    return;
  }

  undoStack.push(action);
  row[action.field] = action.newValue;

  await updateOrder(row);
  await loadOrders();
  showToast("Redo completed");
  updateUndoButtons();
}

function addUndoAction(action) {
  undoStack.push(action);

  if (undoStack.length > 100) {
    undoStack.shift();
  }

  redoStack = [];
  updateUndoButtons();
}

function updateUndoButtons() {
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");

  if (undoBtn) undoBtn.disabled = undoStack.length === 0;

  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function findRowIndexById(id) {
  return data.findIndex((r) => r._id === id);
}

// ======= Navigation =======
function handleNavigation(e) {
  const td = e.target;
  if (td.tagName !== "TD") return;
  let { row, col } = td.dataset;
  row = parseInt(row);
  col = parseInt(col);
  let next;

  switch (e.key) {
    case "ArrowRight":
      next = getCell(row, col + 1);
      break;
    case "ArrowLeft":
      next = getCell(row, col - 1);
      break;
    case "ArrowDown":
      next = getCell(row + 1, col);
      break;
    case "ArrowUp":
      next = getCell(row - 1, col);
      break;
    case "Enter":
      e.preventDefault();
      next = getCell(row + 1, col);
      break;
    case "Tab":
      e.preventDefault();
      next = getCell(row, col + 1);
      break;
  }

  if (next) next.focus();
  if (row === data.length - 1 && e.key === "Enter") addRow();
}

function getCell(r, c) {
  const rows = document.querySelectorAll("#tableBody tr");
  const row = rows[r];
  if (!row) return null;
  return row.querySelector(`td[data-col='${c}']`);
}

// ======= Paste Handling =======
document.addEventListener("paste", async (e) => {
  const active = document.activeElement;
  if (!active || active.tagName !== "TD") return;
  if (!active.dataset.col) return;

  e.preventDefault();

  const clipboard = e.clipboardData.getData("text/plain");
  if (!clipboard) return;

  const rows = clipboard
    .split(/\r?\n/)
    .filter((r) => r.trim() !== "")
    .map((r) => r.split("\t"));

  const startId = active.dataset.id;
  const startIndex = data.findIndex((r) => r._id === startId);

  const startCol = parseInt(active.dataset.col);
  if (startIndex === -1 || isNaN(startCol)) return;

  saveState();

  const changedRows = new Set();

  for (const [rIndex, r] of rows.entries()) {
    const targetIndex = startIndex + rIndex;

    if (targetIndex >= data.length) {
      const newRow = createEmptyRow();
      data.push(newRow);
      await insertOrder(newRow);
    }

    const row = data[targetIndex];

    r.forEach((val, cIndex) => {
      const colIndex = startCol + cIndex;

      if (colIndex < columns.length) {
        row[columns[colIndex]] = val;
      }
    });

    row._meta = row._meta || {};
    row._meta.updatedAt = new Date().toISOString();

    changedRows.add(row);
  }

  for (const row of changedRows) {
    await updateOrder(row);
  }

  await loadOrders();
});

// ======= Export / Import =======
function exportCSV(marked = false) {
  const exportData = marked ? data.filter((r) => r._marked) : data;
  if (!exportData.length) {
    showToast(marked ? "No rows selected" : "No data to export");
    return;
  }

  const exportColumns = ["Notes", ...columns];

  const wsData = [
    exportColumns,
    ...exportData.map((r) =>
      exportColumns.map((c) => (c === "Notes" ? r._notes || "" : r[c] || ""))
    )
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!views"] = [{ state: "frozen", ySplit: 1 }];
  ws["!cols"] = columns.map((col) => {
    const maxLen = Math.max(
      col.length,
      ...exportData.map((r) => (r[col] || "").toString().length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, marked ? "Marked Orders" : "Orders");
  XLSX.writeFile(wb, marked ? "Marked_Backorders.xlsx" : "Backorders.xlsx");
}

function importExcel() {
  const input = document.getElementById("excelInput");
  input.value = "";
  input.click();

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    await processExcel(file);
  };
}

async function processExcel(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1
  });

  if (rows.length < 2) {
    showToast("No data found");
    return;
  }
  const headers = rows[0];
  const importedRows = rows.slice(1).map((row) => {
    const newRow = createEmptyRow();

    headers.forEach((header, index) => {
      if (columns.includes(header)) {
        newRow[header] = row[index] ?? "";
      }

      if (header === "Notes") {
        newRow._notes = row[index] ?? "";
      }
    });
    return newRow;
  });

  await insertImportedOrders(importedRows);
}

async function insertImportedOrders(rows) {
  const dbRows = rows.map(mapRowToDB);

  const { data: inserted, error } = await supabaseClient
    .from("orders")
    .insert(dbRows)
    .select();

  if (error) {
    console.error(error);
    showToast("Import failed");
    return;
  }

  // restore ids back into JS objects
  inserted.forEach((dbRow, index) => {
    rows[index]._id = dbRow.id;
  });

  // one import log per order (temporary)
  for (const row of rows) {
    await addLog({
      orderId: row._id,
      action: "IMPORT"
    });
  }

  await loadOrders();
  showToast(`${rows.length} orders imported`);
}

function showDashboard() {
  document.getElementById("dashboardPage").style.display = "block";
  document.getElementById("ordersPage").style.display = "none";

  updateDashboard();
}

function showOrders() {
  document.getElementById("dashboardPage").style.display = "none";
  document.getElementById("ordersPage").style.display = "block";
}

function updateDashboard() {
  const total = data.length;

  let redline = 0;
  let ecs = 0;
  let tdot = 0;
  let others = 0;

  data.forEach((row) => {
    const dealer = (row["DShipper ID"] || "").trim().toUpperCase();

    switch (dealer) {
      case "W7232":
        redline++;
        break;

      case "W6938":
        ecs++;
        break;

      case "W7290":
        tdot++;
        break;

      default:
        others++;
    }
  });

  document.getElementById("totalOrders").innerText = total;
  document.getElementById("redlineOrders").innerText = redline;
  document.getElementById("ecsOrders").innerText = ecs;
  document.getElementById("tdotOrders").innerText = tdot;
  document.getElementById("otherOrders").innerText = others;
}

function showReadme() {
  const body = document.getElementById("readmeBody");

  body.innerHTML = `
<h3>Active Development</h3>
<ul>
<li>✅ CRUD Orders</li>
<li>✅ Dealer Filtering</li>
<li>✅ Search</li>
<li>✅ Export/Import Excel</li>
<li>✅ Copy/Paste From Excel</li>
<li>✅ User Authentication</li>
<li>✅ Audit History</li>
<li>✅ User Profiles</li>
<li>✅ Update Timestamps</li>
<li>✅ Login/Logout</li>
<li>✅ Dashboard (Layout)</li>
<li>✅ Readme</li>
<li>✅ Realtime Synchronization</li>
<li>✅ Undo/Redo</li>
<li>✅ Delete logs</li>
<li>✅ Bulk Delete</li>
<li>✅ Select All/li>
<li>✅ Rows per page</li>
</ul>

<h3>Planned Features</h3>
<ul>
<li>⬜ Dashboard updates</li>
<li>⬜ Select All</li>
<li>⬜ Readme in a separate HTML or markdown file</li>
<li>⬜ Separate loading from rendering</li>
</ul>

`;
  document.getElementById("readmeModal").style.display = "block";
}

function openDropShip() {
  window.open("https://j1286.github.io/dshiper/", "_blank");
}
