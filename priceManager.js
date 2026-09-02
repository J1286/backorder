// PRICE DATABASE MANAGER
const PRICE_PAGE_SIZE = 25;
const PRICE_DEALERS = [
  {
    field: "redline360",
    label: "Redline360"
  },
  {
    field: "aag",
    label: "AAG"
  },
  {
    field: "tdot",
    label: "TDOT"
  },
  {
    field: "pq",
    label: "PQ"
  },
  {
    field: "ntxglow",
    label: "NTX Glow"
  },
  {
    field: "omac",
    label: "OMAC"
  }
];

let priceRows = [];
let filteredPriceRows = [];
let priceCurrentPage = 1;
let editingPriceSKU = null;

// SUPABASE
function getPriceSupabase() {
  return supabaseClient;
}

// LOAD PRICE DATABASE
async function loadPriceDatabase() {
  const statusEl = document.getElementById("priceDatabaseStatus");

  if (statusEl) {
    statusEl.textContent = "🟡 Loading price database...";
  }

  try {
    const client = getPriceSupabase();

    if (!client) {
      throw new Error("Supabase client not available");
    }

    const { count, error } = await client.from("prices").select("sku", {
      count: "exact",
      head: true
    });

    if (error) {
      throw error;
    }

    if (statusEl) {
      statusEl.textContent = `🟢 ${count ?? 0} SKUs`;
    }
  } catch (error) {
    console.error("Failed to load price database:", error);

    if (statusEl) {
      statusEl.textContent = "🔴 Failed to load price database";
    }
  }
}

// SEARCH PRICES
async function searchPrices() {
  const input = document.getElementById("priceSearchInput");

  const search = (input?.value || "").trim().toUpperCase();

  const status = document.getElementById("priceSearchStatus");

  if (!search) {
    if (status) {
      status.textContent = "Enter an SKU to search.";
    }

    clearPriceResults();
    return;
  }

  if (status) {
    status.textContent = "🔎 Searching...";
  }

  try {
    const client = getPriceSupabase();

    const { data, error } = await client
      .from("prices")
      .select(
        `
        sku,
        redline360,
        aag,
        tdot,
        pq,
        ntxglow,
        omac
      `
      )
      .ilike("sku", `%${search}%`)
      .order("sku")
      .limit(50);

    if (error) {
      throw error;
    }

    priceRows = Array.isArray(data) ? data : [];

    filteredPriceRows = [...priceRows];

    priceCurrentPage = 1;

    renderPriceTable();

    if (status) {
      status.textContent = priceRows.length
        ? `🟢 ${priceRows.length} result${priceRows.length === 1 ? "" : "s"}`
        : "🟡 No matching SKUs found.";
    }
  } catch (error) {
    console.error("Price search failed:", error);

    if (status) {
      status.textContent = "🔴 Search failed";
    }
  }
}

// CLEAR RESULTS
function clearPriceResults() {
  priceRows = [];
  filteredPriceRows = [];
  priceCurrentPage = 1;
  editingPriceSKU = null;

  const body = document.getElementById("priceResultsBody");

  const pagination = document.getElementById("pricePagination");

  if (body) {
    body.innerHTML = "";
  }

  if (pagination) {
    pagination.innerHTML = "";
  }
}

// RENDER PRICE TABLE
function renderPriceTable() {
  const header = document.getElementById("priceResultsHeader");

  const body = document.getElementById("priceResultsBody");

  const pagination = document.getElementById("pricePagination");

  if (!body) {
    return;
  }

  // BUILD TABLE HEADER
  if (header) {
    header.innerHTML = "";

    // SKU header
    const skuTh = document.createElement("th");

    skuTh.textContent = "SKU";
    skuTh.className = "price-sku-column";

    header.appendChild(skuTh);

    // Dealer headers
    PRICE_DEALERS.forEach((dealer) => {
      const th = document.createElement("th");

      th.textContent = dealer.label;

      th.className = "price-dealer-column";

      header.appendChild(th);
    });

    // Actions header
    const actionTh = document.createElement("th");

    actionTh.textContent = "Actions";
    actionTh.className = "price-actions-column";

    header.appendChild(actionTh);
  }

  // BUILD TABLE BODY
  body.innerHTML = "";

  const start = (priceCurrentPage - 1) * PRICE_PAGE_SIZE;

  const end = start + PRICE_PAGE_SIZE;

  const rows = filteredPriceRows.slice(start, end);

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    if (editingPriceSKU === row.sku) {
      renderEditingPriceRow(tr, row);
    } else {
      renderNormalPriceRow(tr, row);
    }

    body.appendChild(tr);
  });

  renderPricePagination(pagination);
}

// NORMAL ROW
function renderNormalPriceRow(tr, row) {
  // SKU
  const skuTd = document.createElement("td");

  skuTd.textContent = row.sku || "";

  skuTd.className = "price-sku-column";

  tr.appendChild(skuTd);

  // DEALER PRICES
  PRICE_DEALERS.forEach((dealer) => {
    const td = document.createElement("td");

    td.className = "price-dealer-column";

    td.textContent = formatPrice(row[dealer.field]);

    tr.appendChild(td);
  });

  // ACTIONS
  const actionTd = document.createElement("td");

  actionTd.className = "price-actions-column";

  const editBtn = document.createElement("button");

  editBtn.textContent = "✏️";

  editBtn.title = "Edit prices";

  editBtn.onclick = () => {
    editingPriceSKU = row.sku;

    renderPriceTable();
  };

  actionTd.appendChild(editBtn);

  tr.appendChild(actionTd);
}

// EDITING ROW
function renderEditingPriceRow(tr, row) {
  const skuTd = document.createElement("td");

  skuTd.textContent = row.sku || "";

  skuTd.className = "price-sku-column";

  tr.appendChild(skuTd);

  PRICE_DEALERS.forEach((dealer) => {
    const field = dealer.field;

    const td = document.createElement("td");

    const input = document.createElement("input");

    input.type = "number";
    input.step = "0.01";
    input.min = "0";

    input.value = row[field] ?? "";

    input.dataset.field = field;

    input.style.width = "90px";

    td.appendChild(input);

    tr.appendChild(td);
  });

  // Actions
  const actionTd = document.createElement("td");

  actionTd.className = "price-actions-column";

  const saveBtn = document.createElement("button");

  saveBtn.textContent = "💾";

  saveBtn.title = "Save prices";

  saveBtn.onclick = () => {
    savePriceRow(row, tr);
  };

  const cancelBtn = document.createElement("button");

  cancelBtn.textContent = "❌";

  cancelBtn.title = "Cancel";

  cancelBtn.onclick = () => {
    editingPriceSKU = null;

    renderPriceTable();
  };

  actionTd.appendChild(saveBtn);

  actionTd.appendChild(cancelBtn);

  tr.appendChild(actionTd);
}

// SAVE PRICE ROW
async function savePriceRow(row, tr) {
  const inputs = tr.querySelectorAll("input[data-field]");

  const updated = {};

  PRICE_DEALERS.forEach((dealer) => {
    updated[dealer.field] = null;
  });

  inputs.forEach((input) => {
    const field = input.dataset.field;

    const value = input.value.trim();

    updated[field] = value === "" ? null : Number(value);
  });

  try {
    const client = getPriceSupabase();

    if (!client) {
      throw new Error("Supabase client not available");
    }

    const { data, error } = await client
      .from("prices")
      .update(updated)
      .eq("sku", row.sku)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update local search result

    Object.assign(row, updated);

    editingPriceSKU = null;

    renderPriceTable();

    const status = document.getElementById("priceSearchStatus");

    if (status) {
      status.textContent = `✅ ${row.sku} updated`;
    }
  } catch (error) {
    console.error("Failed to save price:", error);

    alert("Failed to save price:\n\n" + error.message);
  }
}

// FORMAT PRICE
function formatPrice(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return value;
  }

  return "$" + number.toFixed(2);
}

// PAGINATION
function renderPricePagination(container) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  const totalPages = Math.ceil(filteredPriceRows.length / PRICE_PAGE_SIZE);

  if (totalPages <= 1) {
    return;
  }

  const previous = document.createElement("button");

  previous.textContent = "← Previous";

  previous.disabled = priceCurrentPage <= 1;

  previous.onclick = () => {
    if (priceCurrentPage > 1) {
      priceCurrentPage--;

      renderPriceTable();
    }
  };

  const pageLabel = document.createElement("span");

  pageLabel.textContent = ` Page ${priceCurrentPage} of ${totalPages} `;

  const next = document.createElement("button");

  next.textContent = "Next →";

  next.disabled = priceCurrentPage >= totalPages;

  next.onclick = () => {
    if (priceCurrentPage < totalPages) {
      priceCurrentPage++;

      renderPriceTable();
    }
  };

  container.appendChild(previous);

  container.appendChild(pageLabel);

  container.appendChild(next);
}