// ======= Undo / Redo =======
async function undo() {
  const action = undoStack.pop();

  if (!action) {
    showToast("Nothing to undo");
    return;
  }

  // BULK DELETE UNDO
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

  // DELETE UNDO
  if (action.action === "DELETE") {
    const restoreRow = structuredClone(action.oldData);

    delete restoreRow._id;
    delete restoreRow._meta;

    const inserted = await insertOrder(restoreRow);

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

  // NORMAL FIELD UNDO
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

function saveState() {
  undoStack.push(JSON.stringify(data));
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
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
