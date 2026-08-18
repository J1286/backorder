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
