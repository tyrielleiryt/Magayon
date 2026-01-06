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

/* ================= JSONP ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

function jsonp(params) {
  const cb = "cb_" + Date.now();
  return new Promise(resolve => {
    window[cb] = data => {
      delete window[cb];
      resolve(data);
    };
    const qs = Object.entries({ ...params, callback: cb })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const s = document.createElement("script");
    s.src = `${API_URL}?${qs}`;
    document.body.appendChild(s);
  });
}

/* ================= LOGOUT ================= */
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to logout?")) return;

  const staffId = localStorage.getItem("staff_id");
  if (staffId) {
    await jsonp({ action: "endShift", staff_id: staffId });
  }

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
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const actionBar = document.getElementById("actionBar");
    const contentBox = document.getElementById("contentBox");
    actionBar.innerHTML = "";
    contentBox.innerHTML = "";

    switch (btn.dataset.view) {
      case "categories": loadCategoriesView(); break;
      case "products": loadProductsView(); break;
      case "inventory": loadInventoryItemsView(); break;
      case "dailyInventory": loadDailyInventoryView(); break;
      case "dailySales": loadDailySalesView(); break;
      case "locations": loadLocationsView(); break;
      case "staff": loadStaffView(); break;
      default:
        contentBox.innerHTML = `<h2>Dashboard</h2>`;
    }
  };
});

/* ================= MODAL ================= */
function ensureModal() {
  if (document.getElementById("modalOverlay")) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div id="modalOverlay" class="hidden"><div id="modalBox"></div></div>`
  );
}
ensureModal();

/* ================= LOAD DEFAULT ================= */
document.querySelector('.nav-btn[data-view="dashboard"]')?.click();