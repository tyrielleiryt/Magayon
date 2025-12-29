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
      default:
        contentBox.innerHTML = `<h2>Coming soon…</h2>`;
    }
  });
});

/* ================= GLOBAL SCROLL HELPER ================= */
export function bindDataBoxScroll(container) {
  const scrollArea = container.querySelector(".data-scroll");
  const leftBtn = container.querySelector(".scroll-left");
  const rightBtn = container.querySelector(".scroll-right");

  if (!scrollArea || !leftBtn || !rightBtn) return;

  leftBtn.onclick = () => (scrollArea.scrollLeft -= 300);
  rightBtn.onclick = () => (scrollArea.scrollLeft += 300);
}

/* ================= GLOBAL MODAL CORE ================= */
function ensureModal() {
  if (document.getElementById("modalOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "modalOverlay";
  overlay.className = "hidden";
  overlay.innerHTML = `<div id="modalBox"></div>`;
  document.body.appendChild(overlay);
}

window.openModal = function (html) {
  ensureModal();
  document.getElementById("modalBox").innerHTML = html;
  document.getElementById("modalOverlay").classList.remove("hidden");
};

window.closeModal = function () {
  document.getElementById("modalOverlay").classList.add("hidden");
  document.getElementById("modalBox").innerHTML = "";
};

/* ================= LOAD DEFAULT ================= */
document.querySelector('.nav-btn[data-view="dashboard"]')?.click();