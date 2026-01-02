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

/* ================= MODAL CORE ================= */
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
  const overlay = document.getElementById("modalOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
  document.getElementById("modalBox").innerHTML = "";
};

/* ================= GLOBAL SCROLL HELPER ================= */
export function bindDataBoxScroll(container) {
  if (!container) return;

  const scrollArea = container.querySelector(".data-scroll");
  if (!scrollArea) return;

  // keep scroll INSIDE content box
  scrollArea.style.overflowY = "auto";
  scrollArea.style.maxHeight = "100%";
}

/* ================= SPA VIEWS ================= */
import loadCategoriesView from "./views/categories.js";
import loadInventoryItemsView from "./views/inventoryitems.js";
import loadDailyInventoryView from "./views/dailyinventory.js";
import loadProductsView from "./views/products.js";

/* ================= SPA NAVIGATION ================= */
const navButtons = document.querySelectorAll(".nav-btn");

function clearView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  if (!actionBar || !contentBox) {
    console.error("Missing #actionBar or #contentBox in DOM");
    return false;
  }

  actionBar.innerHTML = "";
  contentBox.innerHTML = "";
  return true;
}

navButtons.forEach(btn => {
  btn.addEventListener("click", async () => {
    navButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (!clearView()) return;

    const view = btn.dataset.view;

    switch (view) {
      case "dashboard":
        document.getElementById("contentBox").innerHTML = `
          <h2>Dashboard</h2>
          <p>If you see this, JS routing works.</p>
        `;
        break;

      case "categories":
        await loadCategoriesView();
        break;

      case "inventory":
        await loadInventoryItemsView();
        break;

      case "dailyInventory":
        await loadDailyInventoryView();
        break;

      case "products":
        await loadProductsView();
        break;

      default:
        document.getElementById("contentBox").innerHTML =
          "<h2>Coming soon…</h2>";
    }
  });
});

/* ================= LOAD DEFAULT VIEW ================= */
document
  .querySelector('.nav-btn[data-view="dashboard"]')
  ?.click();