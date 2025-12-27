/* ===== DATE & TIME ===== */
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

/* ===== ELEMENTS ===== */
const addBtn = document.getElementById("addCategoryBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const tableBody = document.getElementById("categoryTableBody");

/* ===== STATE ===== */
let categories = [];
let pendingCategory = null;

/* ===== OPEN ADD MODAL ===== */
addBtn.addEventListener("click", () => {
  modalOverlay.classList.remove("hidden");

  modalBox.innerHTML = `
    <div class="modal-header">
      <span class="modal-icon">➕</span>
      <h3>Add Category</h3>
    </div>

    <div class="modal-body">
      <label>Category Name</label>
      <input id="catName">

      <label>Description</label>
      <textarea id="catDesc"></textarea>
    </div>

    <div class="modal-actions">
      <button class="btn-confirm" id="confirmAdd">Confirm</button>
      <button class="btn-back" id="cancelAdd">Back</button>
    </div>
  `;

  document.getElementById("cancelAdd").onclick = closeModal;

  document.getElementById("confirmAdd").onclick = () => {
    const name = document.getElementById("catName").value.trim();
    const desc = document.getElementById("catDesc").value.trim();

    if (!name) {
      alert("Category name is required");
      return;
    }

    pendingCategory = { name, desc };
    openConfirmModal();
  };
});

/* ===== CONFIRM MODAL ===== */
function openConfirmModal() {
  modalBox.innerHTML = `
    <div class="modal-header">
      <span class="modal-icon">⚠️</span>
      <h3>Confirm Add</h3>
    </div>

    <div class="modal-body">
      <p><strong>Are you sure you want to add:</strong></p>
      <input value="${pendingCategory.name}" disabled>
    </div>

    <div class="modal-actions">
      <button class="btn-confirm" id="finalConfirm">Confirm</button>
      <button class="btn-back" id="backEdit">Back</button>
    </div>
  `;

  document.getElementById("backEdit").onclick = () => addBtn.click();

  document.getElementById("finalConfirm").onclick = () => {
    categories.push(pendingCategory);
    pendingCategory = null;
    closeModal();
    renderTable();
  };
}

/* ===== TABLE ===== */
function renderTable() {
  tableBody.innerHTML = "";
  categories.forEach((cat, i) => {
    tableBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${cat.name}</td>
        <td>${cat.desc}</td>
        <td>—</td>
      </tr>
    `;
  });
}

/* ===== CLOSE MODAL ===== */
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.innerHTML = "";
}