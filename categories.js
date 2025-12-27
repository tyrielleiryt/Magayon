const addBtn = document.getElementById("addCategoryBtn");
const modal = document.getElementById("modalOverlay");
const saveBtn = document.getElementById("saveCategory");
const closeBtn = document.getElementById("closeModal");
const tableBody = document.getElementById("categoryTableBody");

let categories = [];

/* OPEN MODAL */
addBtn.onclick = () => {
  modal.style.display = "flex";
};

/* CLOSE MODAL */
closeBtn.onclick = () => {
  modal.style.display = "none";
};

/* SAVE CATEGORY */
saveBtn.onclick = () => {
  const name = document.getElementById("catName").value.trim();
  const desc = document.getElementById("catDesc").value.trim();

  if (!name) {
    alert("Category name required");
    return;
  }

  categories.push({ name, desc });
  renderTable();
  modal.style.display = "none";

  document.getElementById("catName").value = "";
  document.getElementById("catDesc").value = "";
};

/* RENDER TABLE */
function renderTable() {
  tableBody.innerHTML = "";

  categories.forEach((cat, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${cat.name}</td>
      <td>${cat.desc}</td>
      <td>—</td>
    `;
    tableBody.appendChild(row);
  });
}