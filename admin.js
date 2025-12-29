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
import loadInventoryItemsView from "./views/inventoryItems.js";

const navButtons = document.querySelectorAll(".nav-btn");
const actionBar = document.getElementById("actionBar");
const contentBox = document.getElementById("contentBox");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    console.log("Clicked:", btn.dataset.view);

    navButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    actionBar.innerHTML = "";
    contentBox.innerHTML = "";

    const view = btn.dataset.view;

    if (view === "dashboard") {
      contentBox.innerHTML = `
        <h2>Dashboard</h2>
        <p>If you see this, JS is working.</p>
      `;
      return;
    }

    if (view === "categories") {
      console.log("Loading Categories View");
      loadCategoriesView();
      return;
    }

    if (view === "inventory") {
      console.log("Loading Inventory Items View");
      loadInventoryItemsView();
      return;
    }

    contentBox.innerHTML = `<h2>Coming soon…</h2>`;
  });
});

/* ================= LOAD DEFAULT VIEW ================= */
document.querySelector('.nav-btn[data-view="dashboard"]')?.click();