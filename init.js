// GLOBAL
let data = [];
let currentPage = 1;
let rowsPerPage = 50; 
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

async function showApp() {
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("app").style.display = "block";

  await loadOrders();
  showOrders();

  startRealtime();
}
