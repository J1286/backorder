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
<li>✅ Select All/li>
<li>✅ Rows per page</li>
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

function openDropShip() {
  window.open("https://j1286.github.io/dshiper/", "_blank");
}
