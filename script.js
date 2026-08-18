
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

function saveState() {
  undoStack.push(JSON.stringify(data));
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
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
