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
      showtoast("Copy failed");
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

function createEmptyRow() {
  const now = new Date().toISOString();

  return {
    _meta: {
      createdAt: now,
      updatedAt: now
    }
  };
}

function findRowIndexById(id) {
  return data.findIndex((r) => r._id === id);
}
