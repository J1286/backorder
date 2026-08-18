console.log("SCRIPT STARTED");

const SUPABASE_URL = "https://adcjrkudofddvmcpmdzw.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkY2pya3Vkb2ZkZHZtY3BtZHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTk5MjAsImV4cCI6MjA5ODkzNTkyMH0.PBRsj25fzx6nz9fdDQb47pLQvJ5xPzQ74tcHPdcfDLI";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    document.getElementById("loginError").innerText = error.message;
    return;
  }

  await showApp();
}

async function checkLogin() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    showApp();
  } else {
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("app").style.display = "none";
  }
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("Logout failed:", error);
    return;
  }

  document.getElementById("loginBox").style.display = "block";
  document.getElementById("app").style.display = "none";
}

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

async function addLog({
  orderId,
  action,
  fieldName = null,
  oldValue = null,
  newValue = null
}) {
  const {
    data: userData,
    error: userError
  } = await supabaseClient.auth.getUser();

  const user = userData.user;

  if (!user) {
    console.warn("No logged in user, cannot create log");
    return;
  }

  const { data, error } = await supabaseClient
    .from("order_logs")
    .insert({
      order_id: orderId,
      user_id: user.id,
      user_name: user.user_metadata.full_name || user.email,
      user_email: user.email,
      action,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue
    })
    .select();

  if (error) {
    console.error("Log failed:", error);
  } else {
    console.log("Log inserted successfully");
  }
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

function getDuplicateMap() {
  const map = {};
  data.forEach((row) => {
    const key = (row["Tr.Orig.No."] || "").trim().toLowerCase();
    if (!key) return;
    map[key] = (map[key] || 0) + 1;
  });
  return map;
}

function getNoteClass(note) {
  if (!note) return null;

  const n = note.toUpperCase();

  if (n === "IN STOCK") return "note-instock";
  if (n === "HOLD") return "note-hold";
  if (n === "WAIT TO RECEIVE") return "note-wait";
  if (n === "STOCK ORDER") return "note-wait";

  return null;
}

// ======= Rendering =======
function renderHeaders() {
  const headerRow = document.getElementById("headerRow");

  headerRow.innerHTML =
    "<th>#</th>" +
    `<th>
      <label style="
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        white-space: nowrap;
      ">
        <input
          type="checkbox"
          id="selectAllCheckbox"
          title="Select all rows on this page"
        >
        <span>Actions</span>
      </label>
    </th>` +
    "<th>Notes</th>" +
    columns.map((col) => `<th>${col}</th>`).join("") +
    `<th id="updatedHeader" style="cursor:pointer;">Updated</th>`;

  document.getElementById("updatedHeader").addEventListener("click", () => {
    sortByUpdated = true;
    sortAsc = !sortAsc;
    loadOrders();
  });

  const selectAllCheckbox = document.getElementById("selectAllCheckbox");

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", () => {
      const checked = selectAllCheckbox.checked;

      document.querySelectorAll("#tableBody tr").forEach((tr) => {
        const id = tr.dataset.id;

        const row = data.find((r) => r._id === id);

        if (row) {
          row._marked = checked;
        }

        const checkbox = tr.querySelector(
          ".actions-column input[type='checkbox']"
        );

        if (checkbox) {
          checkbox.checked = checked;
        }
      });
    });
  }
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

// Sort by Notes if requested
function renderTable() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";
  const duplicateMap = getDuplicateMap();
  const fragment = document.createDocumentFragment();
  const selectedDealer = dealerSelect ? dealerSelect.value : "all";

  let filteredData = data
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const matchSearch =
        !searchQuery ||
        columns.some((col) =>
          String(row[col] || "")
            .toLowerCase()
            .includes(searchQuery)
        );

      const id = (row["DShipper ID"] || "").trim().toUpperCase();

      const knownDealers = Object.entries(dealerMap)
        .filter(([k]) => k !== "others")
        .map(([, v]) => v.toUpperCase());

      const matchDealer =
        selectedDealer === "all" ||
        (dealerMap[selectedDealer] &&
          id === dealerMap[selectedDealer].toUpperCase()) ||
        (selectedDealer === "others" && !knownDealers.includes(id));

      return matchSearch && matchDealer;
    });

  if (sortByUpdated) {
    filteredData.sort((a, b) => {
      const timeA = new Date(a.row._meta?.updatedAt || 0).getTime();
      const timeB = new Date(b.row._meta?.updatedAt || 0).getTime();

      return sortAsc ? timeA - timeB : timeB - timeA;
    });
  }

  // ===== Pagination =====
  const totalRows = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));

  // Keep current page valid
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  const pageData = filteredData.slice(startIndex, endIndex);

  pageData.forEach(({ row, index }, rowIndex) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row._id;

    const updatedAt = row._meta?.updatedAt;
    if (updatedAt) {
      const diff = Date.now() - new Date(updatedAt).getTime();

      if (diff < 5 * 60 * 1000) {
        tr.classList.add("recent");
      }
    }

    // Row number
    const numberTd = document.createElement("td");
    numberTd.innerText = startIndex + rowIndex + 1;
    tr.appendChild(numberTd);

    // Actions column
    const actionTd = document.createElement("td");
    actionTd.className = "actions-column";

    const actionBox = document.createElement("div");
    actionBox.className = "action-box";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!row._marked;

    checkbox.addEventListener("change", () => {
      row._marked = checkbox.checked;
    });

    actionBox.appendChild(checkbox);

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.title = "Copy";

    copyBtn.addEventListener("click", () => copyRow(row._id));

    actionBox.appendChild(copyBtn);

    const historyBtn = document.createElement("button");
    historyBtn.textContent = "📜";
    historyBtn.title = "View History";

    historyBtn.addEventListener("click", () => {
      showHistory(row._id);
    });

    actionBox.appendChild(historyBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "Delete";

    deleteBtn.addEventListener("click", () => deleteRow(row._id));

    actionBox.appendChild(deleteBtn);

    actionTd.appendChild(actionBox);

    tr.appendChild(actionTd);

    // Notes column
    const notesTd = document.createElement("td");
    notesTd.classList.add("notes");
    notesTd.classList.add(getNoteClass(row._notes));

    // text span
    const textSpan = document.createElement("span");
    textSpan.contentEditable = true;
    textSpan.innerText = row._notes || "";

    // save before edit
    textSpan.addEventListener("focus", () => {
      textSpan.dataset.before = textSpan.innerText;
    });

    // save on blur
    textSpan.addEventListener("blur", async () => {
      if (textSpan.dataset.before !== textSpan.innerText) {
        const oldValue = textSpan.dataset.before;
        const newValue = textSpan.innerText;

        addUndoAction({
          action: "UPDATE",
          orderId: row._id,
          field: "_notes",
          oldValue,
          newValue
        });

        row._notes = newValue;
        const cls = getNoteClass(newValue);
        notesTd.className = cls ? `notes ${cls}` : "notes";

        row._meta = row._meta || {};
        row._meta.updatedAt = new Date().toISOString();

        await addLog({
          orderId: row._id,
          action: "UPDATE",
          fieldName: "Notes",
          oldValue,
          newValue
        });

        await updateOrder(row);
      }
    });

    notesTd.appendChild(textSpan);

    // Dropdown button inside cell
    const dropdownBtn = document.createElement("button");
    dropdownBtn.textContent = "▼";
    dropdownBtn.style.marginLeft = "4px";
    dropdownBtn.style.fontSize = "0.7em";
    dropdownBtn.style.cursor = "pointer";
    notesTd.appendChild(dropdownBtn);

    dropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // prevent focus issues

      const select = document.createElement("select");
      select.style.position = "absolute";
      select.style.zIndex = 1000;

      // Add blank option for free text
      const blank = document.createElement("option");
      blank.value = "";
      blank.innerText = "";
      select.appendChild(blank);

      noteOptions.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.innerText = opt;
        select.appendChild(option);
      });

      select.value = row._notes || "";
      document.body.appendChild(select);

      // Position near button
      const rect = dropdownBtn.getBoundingClientRect();
      select.style.left = rect.left + window.scrollX + "px";
      select.style.top = rect.bottom + window.scrollY + "px";

      select.focus();

      select.addEventListener("change", async () => {
        const oldValue = row._notes || "";
        const newValue = select.value;

        addUndoAction({
          action: "UPDATE",
          orderId: row._id,
          field: "_notes",
          oldValue,
          newValue
        });

        row._notes = newValue;

        row._meta = row._meta || {};
        row._meta.updatedAt = new Date().toISOString();

        // Update visible text immediately
        textSpan.innerText = newValue;

        // Update color immediately
        const cls = getNoteClass(newValue);
        notesTd.className = cls ? `notes ${cls}` : "notes";

        // Remove dropdown immediately
        safeRemove(select);

        // Save in background
        await Promise.all([
          updateOrder(row),
          addLog({
            orderId: row._id,
            action: "UPDATE",
            fieldName: "Notes",
            oldValue,
            newValue
          })
        ]);
      });

      select.addEventListener("blur", () => {
        setTimeout(() => {
          safeRemove(select);
        }, 100);
      });
    });

    tr.appendChild(notesTd);

    // Data columns
    columns.forEach((col, colIndex) => {
      const td = document.createElement("td");
      td.contentEditable = true;
      td.innerText = row[col] || "";
      td.dataset.row = index;
      td.dataset.id = row._id;
      td.dataset.col = colIndex;

      // Highlight duplicates only in Tr.Orig.No.
      if (col === "Tr.Orig.No.") {
        const key = (row[col] || "").trim().toLowerCase();
        if (key && duplicateMap[key] > 1) td.classList.add("duplicate");
      }

      td.addEventListener("focus", () => {
        td.dataset.before = td.innerText;
      });

      td.addEventListener("blur", async () => {
        console.log("CELL BLUR", col);

        if (td.dataset.before !== td.innerText) {
          const id = td.dataset.id;
          const rowIndex = findRowIndexById(id);

          if (rowIndex !== -1) {
            const oldValue = td.dataset.before;
            const newValue = td.innerText;

            addUndoAction({
              action: "UPDATE",
              orderId: data[rowIndex]._id,
              field: col,
              oldValue,
              newValue
            });
            data[rowIndex][col] = newValue;

            data[rowIndex]._meta = data[rowIndex]._meta || {};
            data[rowIndex]._meta.updatedAt = new Date().toISOString();

            await addLog({
              orderId: data[rowIndex]._id,
              action: "UPDATE",
              fieldName: col,
              oldValue,
              newValue
            });
            await updateOrder(data[rowIndex]);
          }
        }
      });
      td.addEventListener("keydown", handleNavigation);
      tr.appendChild(td);
    });

    const timeTd = document.createElement("td");
    timeTd.innerText = formatTime(row._meta?.updatedAt);
    tr.appendChild(timeTd);
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);

  renderPagination(totalRows, totalPages);
}

function renderPagination(totalRows, totalPages) {
  const container = document.getElementById("pagination");

  if (!container) return;

  container.innerHTML = "";

  const start = totalRows === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;

  const end = Math.min(currentPage * rowsPerPage, totalRows);

  // Row information
  const info = document.createElement("span");
  info.innerText = `Showing ${start}-${end} of ${totalRows}`;
  info.style.marginRight = "15px";

  // Previous button
  const prevBtn = document.createElement("button");
  prevBtn.innerText = "Previous";
  prevBtn.disabled = currentPage === 1;

  prevBtn.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  };

  // Page number
  const pageInfo = document.createElement("span");
  pageInfo.innerText = ` Page ${currentPage} of ${totalPages} `;
  pageInfo.style.margin = "0 10px";

  // Next button
  const nextBtn = document.createElement("button");
  nextBtn.innerText = "Next";
  nextBtn.disabled = currentPage === totalPages;

  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  };

  container.appendChild(info);
  container.appendChild(prevBtn);
  container.appendChild(pageInfo);
  container.appendChild(nextBtn);
}

async function showHistory(orderId) {
  const { data: logs, error } = await supabaseClient
    .from("order_logs")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    showToast("Failed to load history");
    return;
  }

  if (!logs.length) {
    alert("No history found");
    return;
  }

  const body = document.getElementById("historyBody");

  body.innerHTML = "";

  logs.forEach((log) => {
    const div = document.createElement("div");

    div.className = "history-entry";

    div.innerHTML = `

        <div class="history-time">
            ${formatTime(log.created_at)}
        </div>

        <div class="history-user">
            ${log.user_name || log.user_email}
        </div>
        <div class="history-action">
            ${log.action}
        </div>

        ${
          log.field_name
            ? `<div class="history-change">
                <b>${log.field_name}</b><br>
                ${log.old_value || ""} → ${log.new_value || ""}
            </div>`
            : ""
        }

    `;

    body.appendChild(div);
  });

  document.getElementById("historyModal").style.display = "block";
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

  // Save one undo action
  addUndoAction({
    action: "BULK_DELETE",
    rows: marked.map((row) => structuredClone(row))
  });

  // Create history logs
  for (const row of marked) {
    await addLog({
      orderId: row._id,
      action: "DELETE"
    });
  }

  // Delete from database
  const ids = marked.map((row) => row._id);

  const success = await deleteOrdersFromDB(ids);
  if (!success) {
    showToast("Delete failed");
    return;
  }

  // Refresh table
  await loadOrders();
  showToast(`${marked.length} orders deleted`);
}

async function deleteOrdersFromDB(ids) {
  const { error } = await supabaseClient.from("orders").delete().in("id", ids);

  if (error) {
    console.error(error);
    return false;
  }

  return true;
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

async function addBulkLogs(logs) {
  const { data: userData } = await supabaseClient.auth.getUser();

  const user = userData.user;
  if (!user) return;

  const rows = logs.map((log) => ({
    order_id: log.orderId,
    user_id: user.id,
    user_name: user.user_metadata.full_name || user.email,
    user_email: user.email,
    action: log.action
  }));

  const { error } = await supabaseClient.from("order_logs").insert(rows);

  if (error) console.error(error);
}

// ======= Display Name =======
function showProfile() {
  document.getElementById("profileModal").style.display = "block";
  loadProfile();
}

async function loadProfile() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error(error);
    return;
  }

  const user = data.user;
  document.getElementById("currentEmail").innerText = user.email;
  document.getElementById("displayNameInput").value =
    user.user_metadata.full_name || "";
}

async function saveProfileName() {
  const name = document.getElementById("displayNameInput").value.trim();

  const { error } = await supabaseClient.auth.updateUser({
    data: {
      full_name: name
    }
  });

  if (error) {
    console.error(error);
    showToast("Update failed");
    return;
  }

  showToast("Name updated");
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

function openDropShip() {
  window.open("https://j1286.github.io/dshiper/", "_blank");
}
