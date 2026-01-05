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
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  if (!confirm("Are you sure you want to logout?")) return;
  localStorage.clear();
  sessionStorage.clear();
  window.location.replace("index.html");
});

/* ================= IMPORT VIEWS ================= */
import loadCategoriesView from "./views/categories.js";
import loadInventoryItemsView from "./views/inventoryitems.js";
import loadDailyInventoryView from "./views/dailyinventory.js";
import loadProductsView from "./views/products.js";
import loadDailySalesView from "./views/dailySales.js";
import loadLocationsView from "./views/locations.js";
import loadStaffView from "./views/staff.js";

/* ================= SPA NAV ================= */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = () => {
    // Active state
    document
      .querySelectorAll(".nav-btn")
      .forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Reset UI
    const actionBar = document.getElementById("actionBar");
    const contentBox = document.getElementById("contentBox");
    actionBar.innerHTML = "";
    contentBox.innerHTML = "";

    // Route
    switch (btn.dataset.view) {
      case "categories":
        loadCategoriesView();
        break;

      case "products":
        loadProductsView();
        break;

      case "inventory":
        loadInventoryItemsView();
        break;

      case "dailyInventory":
        loadDailyInventoryView();
        break;

      case "dailySales":
        loadDailySalesView();
        break;

      case "locations":
        loadLocationsView();
        break;

      case "staff":
        loadStaffView();
        break;

      case "dashboard":
      default:
        contentBox.innerHTML = `
          <h2>Dashboard</h2>
          <p style="color:#666">
            Select a module from the sidebar.
          </p>
        `;
    }
  };
});

/* ================= SCROLL HELPER ================= */
export function bindDataBoxScroll(container) {
  const scrollArea = container.querySelector(".data-scroll");
  if (!scrollArea) return;
}

/* ================= MODAL CONTAINER ONLY ================= */
function ensureModal() {
  if (document.getElementById("modalOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "modalOverlay";
  overlay.className = "hidden";
  overlay.innerHTML = `<div id="modalBox"></div>`;

  document.body.appendChild(overlay);
}
ensureModal();

/* ================= LOAD DEFAULT VIEW ================= */
document
  .querySelector('.nav-btn[data-view="dashboard"]')
  ?.click();