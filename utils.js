// ======= Utility Functions =======
function normalizeData() {
  data = data.map((row) => {
    if (!row._id) row._id = crypto.randomUUID();
    return row;
  });
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

function cleanText(value) {
  return String(value || "")
    .replace(/\r?\n/g, " ")
    .trim();
}

function handleRealtimeUpdate(payload) {
  const eventType = payload.eventType;

  // DELETE uses payload.old
  // INSERT/UPDATE use payload.new
  const dbRow = eventType === "DELETE" ? payload.old : payload.new;

  if (!dbRow || !dbRow.id) {
    console.warn("Realtime event missing row ID:", payload);
    return;
  }

  const index = data.findIndex((row) => row._id === dbRow.id);

  if (eventType === "INSERT") {
    if (index === -1) {
      data.push(mapDBRow(dbRow));
    }
  } else if (eventType === "UPDATE") {
    const newRow = mapDBRow(dbRow);

    if (index !== -1) {
      // Preserve local UI-only properties
      newRow._marked = data[index]._marked;

      data[index] = newRow;
    } else {
      // Row doesn't exist locally for some reason
      data.push(newRow);
    }
  } else if (eventType === "DELETE") {
    if (index !== -1) {
      data.splice(index, 1);
    }
  }

  updateDashboard();
  renderTable();
}

function startRealtime() {
  if (realtimeChannel) {
    return;
  }

  realtimeChannel = supabaseClient
    .channel("orders-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders"
      },
      (payload) => {
        console.log("Realtime event:", payload.eventType);

        handleRealtimeUpdate(payload);

        showToast(
          payload.eventType === "INSERT"
            ? "New order added"
            : payload.eventType === "UPDATE"
            ? "Order updated"
            : "Order deleted"
        );
      }
    )
    .subscribe((status) => {
      console.log("Realtime status:", status);
    });
}

// ======= Export / Import =======
function exportCSV(marked = false) {
  const exportData = marked
    ? data.filter((r) => r._marked)
    : data;

  if (!exportData.length) {
    showToast(marked ? "No rows selected" : "No data to export");
    return;
  }

  // Find the columns we want to export
  const startColumn = columns.indexOf("DShipper ID");
  const endColumn = columns.indexOf("Ship Acct");

  if (startColumn === -1 || endColumn === -1) {
    showToast("DShipper ID or Ship Acct column not found");
    return;
  }

  if (startColumn > endColumn) {
    showToast("DShipper ID must come before Ship Acct");
    return;
  }

  // Include every column from DShipper ID through Ship Acct
  const exportColumns = columns.slice(startColumn, endColumn + 1);

  const wsData = [
    exportColumns,
    ...exportData.map((r) =>
      exportColumns.map((c) => r[c] ?? "")
    )
  ];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Convert worksheet directly to CSV
  const csv = XLSX.utils.sheet_to_csv(ws);

  // Create downloadable CSV blob
  const blob = new Blob(
    [csv],
    { type: "text/csv;charset=utf-8;" }
  );

  // Get today's date
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const year = today.getFullYear();

  const fileName = `${month}-${day}-${year} FC Batch1.csv`;

  // Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = fileName;

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
