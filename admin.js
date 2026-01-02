/* ================= AUTH GUARD ================= */
if (localStorage.getItem("isLoggedIn") !== "true") {
  window.location.replace("index.html");
}

/* ================= JSONP HELPER ================= */
export function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).substring(2);
    window[cb] = data => {
      resolve(data);
      delete window[cb];
      script.remove();
    };

    const script = document.createElement("script");
    script.src = `${url}&callback=${cb}`;
    script.onerror = reject;
    document.body.appendChild(script);
  });
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

/* ================= SPA NAV ================= */
import loadCategoriesView from "./views/categories.js";
import loadInventoryItemsView from "./views/inventoryitems.js";
import loadDailyInventoryView from "./views/dailyinventory.js";
import loadProductsView from "./views/products.js";

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.getElementById("actionBar").innerHTML = "";
    document.getElementById("contentBox").innerHTML = "";

    if (btn.dataset.view === "categories") loadCategoriesView();
    else if (btn.dataset.view === "inventory") loadInventoryItemsView();
    else if (btn.dataset.view === "dailyInventory") loadDailyInventoryView();
    else if (btn.dataset.view === "products") loadProductsView();
    else document.getElementById("contentBox").innerHTML = "<h2>Dashboard</h2>";
  };
});

/* ================= SCROLL HELPER ================= */
export function bindDataBoxScroll(container) {
  const scrollArea = container.querySelector(".data-scroll");
  if (!scrollArea) return;
}

/* ================= MODAL ================= */
function ensureModal() {
  if (document.getElementById("modalOverlay")) return;
  const o = document.createElement("div");
  o.id = "modalOverlay";
  o.className = "hidden";
  o.innerHTML = `<div id="modalBox"></div>`;
  document.body.appendChild(o);
}

window.openModal = html => {
  ensureModal();
  document.getElementById("modalBox").innerHTML = html;
  document.getElementById("modalOverlay").classList.remove("hidden");
};

window.closeModal = () => {
  document.getElementById("modalOverlay").classList.add("hidden");
  document.getElementById("modalBox").innerHTML = "";
};

/* ================= LOAD DEFAULT ================= */
document.querySelector('.nav-btn[data-view="dashboard"]')?.click();