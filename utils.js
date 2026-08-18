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
