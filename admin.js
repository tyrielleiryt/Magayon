/* ================= AUTH GUARD ================= */
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

logoutBtn?.addEventListener("click", () => {
  if (!confirm("Are you sure you want to logout?")) return;
  localStorage.clear();
  sessionStorage.clear();
  window.location.replace("index.html");
});

/* ================= SPA NAVIGATION ================= */
import loadCategoriesView from "./views/categories.js";
import loadInventoryItemsView from "./views/inventoryitems.js";
import loadDailyInventoryView from "./views/dailyinventory.js";

const navButtons = document.querySelectorAll(".nav-btn");
const actionBar = document.getElementById("actionBar");
const contentBox = document.getElementById("contentBox");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    navButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    actionBar.innerHTML = "";
    contentBox.innerHTML = "";

    switch (btn.dataset.view) {
      case "dashboard":
        contentBox.innerHTML = `
          <h2>Dashboard</h2>
          <p>If you see this, JS is working.</p>
        `;
        break;

      case "categories":
        loadCategoriesView();
        break;

      case "inventory":
        loadInventoryItemsView();
        break;

      case "dailyInventory":
        loadDailyInventoryView();
        break;

      case "products":
        contentBox.innerHTML = `<h2>Products</h2><p>Coming next.</p>`;
        break;

      default:
        contentBox.innerHTML = `<h2>Coming soon…</h2>`;
    }
  });
});

/* ================= DEFAULT VIEW ================= */
document.querySelector('.nav-btn[data-view="dashboard"]')?.click();