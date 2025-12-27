import loadCategoriesView from "./views/categories.js";

/* DATE & TIME */
function updateDateTime() {
  document.getElementById("datetime").textContent =
    new Date().toLocaleString("en-US", {
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

/* NAVIGATION */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const view = btn.dataset.view;
    if (view === "categories") loadCategoriesView();
    else document.getElementById("contentBox").innerHTML = `<p>Coming soon</p>`;
  };
});

/* DEFAULT VIEW */
loadCategoriesView();