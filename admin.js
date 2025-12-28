console.log("✅ admin.js LOADED");

const actionBar = document.getElementById("actionBar");
const contentBox = document.getElementById("contentBox");

contentBox.innerHTML = `
  <h2>Dashboard</h2>
  <p>If you see this, JS is working.</p>
`;

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    contentBox.innerHTML = `<h2>${btn.dataset.view}</h2>`;
  });
});