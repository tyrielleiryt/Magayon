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

/* ================= ELEMENTS ================= */
const addBtn = document.getElementById("addCategoryBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const tableBody = document.getElementById("categoryTableBody");

/* ================= STATE ================= */
let categories = [];
let pendingCategory = null;

/* ================= ADD CATEGORY ================= */
addBtn.onclick = () => {
  openAddModal();
};

function openAddModal() {
  modalBox.innerHTML = `
    <h3>➕ Add Category</h3>

    <label>Category Name</label>
    <input id="catName">

    <label>Description</label>
    <textarea id="catDesc"></textarea>

    <div class="modal-actions">
      <button id="confirmAdd">Confirm</button>
      <button id="cancelAdd">Back</button>
    </div>
  `;

  modalOverlay.style.display = "flex";

  document.getElementById("cancelAdd").onclick = closeModal;

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

/* ================= CONFIRM MODAL ================= */
function openConfirmModal() {
  modalBox.innerHTML = `
    <h3>➕ Add Category</h3>

    <p><strong>Are you sure you want to add:</strong></p>

    <label>Category Name</label>
    <input value="${pendingCategory.name}" disabled>

    <div class="modal-actions">
      <button id="finalConfirm">Confirm</button>
      <button id="backEdit">Back</button>
    </div>
  `;

  document.getElementById("backEdit").onclick = openAddModal;

  document.getElementById("finalConfirm").onclick = () => {
    categories.push(pendingCategory);
    pendingCategory = null;
    closeModal();
    renderTable();
  };
}

/* ================= TABLE ================= */
function renderTable() {
  tableBody.innerHTML = "";

  categories.forEach((cat, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${cat.name}</td>
      <td>${cat.desc}</td>
      <td>—</td>
    `;
    tableBody.appendChild(tr);
  });
}

/* ================= CLOSE MODAL ================= */
function closeModal() {
  modalOverlay.style.display = "none";
  modalBox.innerHTML = "";
}