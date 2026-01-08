/* =========================================================
   LOADER HELPERS (LOCAL, SAFE)
========================================================= */
function showLoader(text = "Loading dashboard…") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.querySelector(".loader-text").textContent = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.classList.add("hidden");
}
 
/* =========================================================
   DASHBOARD VIEW
========================================================= */
export default async function loadDashboardView() {
  showLoader("Loading dashboard…");

  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = "";
  contentBox.innerHTML = `
    <h2>Dashboard</h2>
    <p>Charts and analytics will appear here.</p>
  `;

  // ⏱ Small delay for UX consistency (future-proof)
  requestAnimationFrame(() => hideLoader());
}