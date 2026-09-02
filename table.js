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
