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

/* ================= JSONP HELPER (🔥 FIXES CORS) ================= */
export function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    window[cb] = data => {
      delete window[cb];
      script.remove();
      resolve(data);
    };

    const script = document.createElement("script");
    script.src = `${url}&callback=${cb}`;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

/* ================= SPA NAV ================= */
import loadCategoriesView from "./views/categories.js";
import loadInventoryItemsView from "./views/inventoryitems.js";
import loadDailyInventoryView from "./views/dailyinventory.js";
import loadProductsView from "./views/products.js";

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
      case "categories": loadCategoriesView(); break;
      case "inventory": loadInventoryItemsView(); break;
      case "dailyInventory": loadDailyInventoryView(); break;
      case "products": loadProductsView(); break;
      default:
        contentBox.innerHTML = `<h2>Dashboard</h2>`;
    }
  });
});

/* ================= SCROLL HELPER ================= */
export function bindDataBoxScroll(container) {
  const scrollArea = container.querySelector(".data-scroll");
  if (!scrollArea) return;
}