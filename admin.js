/* ================= AUTH GUARD ================= */
// Block access if not logged in
if (localStorage.getItem("isLoggedIn") !== "true") {
  window.location.href = "index.html"; // login page
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

    // Clear login state
    localStorage.removeItem("isLoggedIn");

    // Redirect to LOGIN (index.html)
    window.location.href = "index.html";
  });
}

/* ================= SPA NAVIGATION ================= */
import loadCategoriesView from "./views/categories.js";

const navButtons = document.querySelectorAll(".nav-btn");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    navButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const view = btn.dataset.view;

    // Clear previous UI
    document.getElementById("actionBar").innerHTML = "";
    document.getElementById("contentBox").innerHTML = "";

    // Load selected view
    switch (view) {
      case "categories":
        loadCategoriesView();
        break;

      case "dashboard":
        document.getElementById("contentBox").innerHTML = `
          <h2>Dashboard</h2>
          <p>Welcome to the admin panel.</p>
        `;
        break;

      default:
        document.getElementById("contentBox").innerHTML =
          "<h2>Coming soon…</h2>";
    }
  });
});