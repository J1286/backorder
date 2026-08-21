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
    showtoast("No history found");
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
