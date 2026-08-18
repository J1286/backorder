async function loadOrders() {
  const { data: rows, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at");

  if (error) {
    console.error(error);
    return;
  }

  data = rows.map(mapDBRow);

  updateDashboard();
  renderTable();
}

async function insertOrder(row) {
  const dbRow = mapRowToDB(row);

  const { data: inserted, error } = await supabaseClient
    .from("orders")
    .insert(dbRow)
    .select()
    .single();

  if (error) {
    console.error("Insert failed:", error);
    return null;
  }

  row._id = inserted.id;

  return inserted;
}

async function updateOrder(row) {
  const dbRow = mapRowToDB(row);

  const { error } = await supabaseClient
    .from("orders")
    .update(dbRow)
    .eq("id", row._id);

  if (error) {
    console.error("Update failed:", error);
  }
}

async function deleteOrderFromDB(id) {
  const { error } = await supabaseClient.from("orders").delete().eq("id", id);

  if (error) {
    console.error("Delete failed:", error);
  }
}

async function deleteOrdersFromDB(ids) {
  const { error } = await supabaseClient.from("orders").delete().in("id", ids);

  if (error) {
    console.error(error);
    return false;
  }

  return true;
}

// ======= Row Operations =======
async function addRow() {
  saveState();

  const newRow = createEmptyRow();

  const selectedDealer = dealerSelect ? dealerSelect.value : "all";
  if (selectedDealer !== "all") {
    newRow["DShipper ID"] = dealerMap[selectedDealer];
  }

  const inserted = await insertOrder(newRow);

  if (!inserted) {
    showToast("Failed to create order");
    return;
  }

  await addLog({
    orderId: inserted.id,
    action: "CREATE"
  });

  await loadOrders();
}

async function deleteRow(id) {
  if (!confirm("Delete this order?")) return;

  const row = data.find((r) => r._id === id);
  if (!row) return;

  // Save delete action for undo
  undoStack.push({
    action: "DELETE",
    orderId: id,
    oldData: structuredClone(row)
  });

  redoStack = [];

  await addLog({
    orderId: id,
    action: "DELETE"
  });

  data = data.filter((r) => r._id !== id);

  await deleteOrderFromDB(id);
  await loadOrders();
  updateUndoButtons();
}

function copyRow(id) {
  const row = data.find((r) => r._id === id);
  if (!row) return;

  const text = columns
    .map((col) =>
      String(row[col] || "")
        .replace(/\r?\n/g, " ")
        .trim()
    )
    .join("\t");

  navigator.clipboard
    .writeText(text)
    .then(() => {
      showToast("Copied!");
    })
    .catch((err) => {
      console.error("Copy failed:", err);
      alert("Copy failed");
    });
}

async function deleteMarkedRows() {
  const marked = data.filter((r) => r._marked);

  if (!marked.length) {
    showToast("No rows selected");
    return;
  }

  if (!confirm(`Delete ${marked.length} selected order(s)?`)) return;

  // Save undo action
  addUndoAction({
    action: "BULK_DELETE",
    rows: marked.map((row) => structuredClone(row))
  });

  // IDs to delete
  const ids = marked.map((row) => row._id);

  // Create all logs in ONE database request
  await addBulkLogs(
    marked.map((row) => ({
      orderId: row._id,
      action: "DELETE"
    }))
  );

  // Delete all orders in ONE database request
  const success = await deleteOrdersFromDB(ids);

  if (!success) {
    showToast("Delete failed");
    return;
  }

  // Refresh table
  await loadOrders();

  showToast(`${marked.length} orders deleted`);
}

function copyMarkedRows() {
  const marked = data.filter((r) => r._marked);

  if (!marked.length) {
    showToast("No rows selected");
    return;
  }

  const text = marked
    .map((r) =>
      columns
        .map((c) =>
          String(r[c] || "")
            .replace(/\r?\n/g, " ")
            .trim()
        )
        .join("\t")
    )
    .join("\n");

  navigator.clipboard
    .writeText(text)
    .then(() => {
      showToast("Selected copied!");
    })
    .catch(() => {
      showToast("Copy failed");
    });
}
