/* ================= DATE & TIME ================= */
function updateDateTime() {
  const el = document.getElementById("datetime");
  const now = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  };
  el.textContent = now.toLocaleString("en-US", options);
}
updateDateTime();
setInterval(updateDateTime, 60000);

/* ================= MODAL LOGIC ================= */
const addBtn = document.getElementById("addCategoryBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalContent = document.getElementById("modalContent");
const tableBody = document.getElementById("categoryTableBody");

let categories = [];
let pendingCategory = null;

addBtn.addEventListener("click", openAddCategoryModal);

function openAddCategoryModal() {
  modalContent.innerHTML = `
    <h3>➕ Add Category</h3>

    <label>Category Name</label>
    <input id="catName" />

    <label>Description</label>
    <textarea id="catDesc"></textarea>

    <div class="modal-actions">
      <button id="confirmAdd">Confirm</button>
      <button id="closeModal">Back</button>
    </div>
  `;

  modalOverlay.style.display = "flex";

  document.getElementById("closeModal").onclick = closeModal;

  document.getElementById("confirmAdd").onclick = () => {
    const name = document.getElementById("catName").value.trim();
    const desc = document.getElementById("catDesc").value.trim();

    if (!name) {
      alert("Category name is required.");
      return;
    }

    pendingCategory = { name, desc };
    openConfirmModal();
  };
}

function openConfirmModal() {
  modalContent.innerHTML = `
    <h3>➕ Add Category</h3>

    <p><strong>⚠ Are you sure you want to add:</strong></p>

    <label>Category Name</label>
    <input value="${pendingCategory.name}" disabled />

    <div class="modal-actions">
      <button id="finalConfirm">Confirm</button>
      <button id="backToEdit">Back</button>
    </div>
  `;

  document.getElementById("backToEdit").onclick = openAddCategoryModal;

  document.getElementById("finalConfirm").onclick = () => {
    categories.push(pendingCategory);
    pendingCategory = null;
    closeModal();
    renderTable();
  };
}

function closeModal() {
  modalOverlay.style.display = "none";
  modalContent.innerHTML = "";
}

/* ================= TABLE ================= */
function renderTable() {
  tableBody.innerHTML = "";

  categories.forEach((cat, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${cat.name}</td>
      <td>${cat.desc}</td>
      <td>—</td>
    `;
    tableBody.appendChild(row);
  });
}