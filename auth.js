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

async function logout() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("Logout failed:", error);
    return;
  }

  document.getElementById("loginBox").style.display = "block";
  document.getElementById("app").style.display = "none";
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
