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

    // Prevent back navigation
    window.location.replace("index.html");
  });
}

/* ================= SPA NAVIGATION ================= */
import loadCategoriesView from "./views/categories.js";
// future imports:
// import loadProductsView from "./views/products.js";
// import loadInventoryItemsView from "./views/inventoryItems.js";

const navButtons = document.querySelectorAll(".nav-btn");
const actionBar = document.getElementById("actionBar");
const contentBox = document.getElementById("contentBox");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    // Sidebar UI state
    navButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Clear previous view
    actionBar.innerHTML = "";
    contentBox.innerHTML = "";

    const view = btn.dataset.view;

    switch (view) {
      case "dashboard":
        contentBox.innerHTML = `
          <h2>Dashboard</h2>
          <p>If you see this, JS is working.</p>
        `;
        break;

      case "categories":
        loadCategoriesView();
        break;

      case "products":
        contentBox.innerHTML = `
          <h2>Products</h2>
          <p>Products UI coming next.</p>
        `;
        break;

      case "inventory":
        contentBox.innerHTML = `
          <h2>Inventory</h2>
          <p>Inventory UI coming next.</p>
        `;
        break;

      default:
        contentBox.innerHTML = `<h2>Coming soon…</h2>`;
    }
  });
});

/* ================= LOAD DEFAULT VIEW ================= */
// Load Dashboard on first open
document.querySelector('.nav-btn[data-view="dashboard"]')?.click();