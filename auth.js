const SUPABASE_URL = "https://adcjrkudofddvmcpmdzw.supabase.co";
const SUPABASE_KEY = "sb_publishable_AFiJPntz0_rjCbR_x-dUbw_29b05Pol";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("SCRIPT STARTED");

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