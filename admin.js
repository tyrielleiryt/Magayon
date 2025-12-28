/* ================= IMPORTS (MUST BE AT TOP) ================= */
import loadCategoriesView from "./views/categories.js";
import loadInventoryItemsView from "./views/inventoryItems.js";

/* ================= AUTH GUARD ================= */
// Block access if not logged in
if (localStorage.getItem("isLoggedIn") !== "true") {
  window.location.replace("index.html");
}

/* ================= DATE & TIME ================= */
function updateDateTime() {
  const el = document.getElementById("datetime");
  if (!el) return;

  el.textContent = new Date().toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
updateDateTime();
setInterval(updateDateTime, 60000);

/* ================= LOGOUT ================= */
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    const confirmLogout = confirm("Are you sure you want to logout?");
    if (!confirmLogout) return;

    // Clear ALL session data
    localStorage.clear();
    sessionStorage.clear();

    // Redirect to login
    window.location.replace("index.html");
  });
}

/* ================= SPA NAVIGATION ================= */
const navButtons = document.querySelectorAll(".nav-btn");
const actionBar = document.getElementById("actionBar");
const contentBox = document.getElementById("contentBox");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    // UI active state
    navButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Clear previous content
    actionBar.innerHTML = "";
    contentBox.innerHTML = "";

    const view = btn.dataset.view;

    switch (view) {
      case "dashboard":
        contentBox.innerHTML = `
          <h2>Dashboard</h2>
          <p>Welcome to the admin panel.</p>
        `;
        break;

      case "categories":
        loadCategoriesView();
        break;

      case "inventory":
        loadInventoryItemsView();
        break;

      default:
        contentBox.innerHTML = `<h2>Coming soon…</h2>`;
    }
  });
});

// ================= LOAD DEFAULT VIEW =================
(function loadDefaultView() {
  const dashboardBtn = document.querySelector('.nav-btn[data-view="dashboard"]');
  if (dashboardBtn) {
    dashboardBtn.classList.add("active");
  }

  // Render dashboard content manually
  document.getElementById("actionBar").innerHTML = "";
  document.getElementById("contentBox").innerHTML = `
    <h2>Dashboard</h2>
    <p>Welcome to the admin panel.</p>
  `;
})();