const addBtn = document.getElementById("addCategoryBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalContent = document.getElementById("modalContent");
const tableBody = document.getElementById("categoryTableBody");

let categories = [];
let tempCategory = null;

/* OPEN ADD CATEGORY MODAL */
addBtn.addEventListener("click", () => {
  modalContent.innerHTML = `
    <h3>➕ Add Category</h3>

    <label>Category Name</label>
    <input id="catName">

    <label>Description</label>
    <textarea id="catDesc"></textarea>

    <div class="modal-actions">
      <button id="confirmAdd">Confirm</button>
      <button id="closeModal">Back</button>
    </div>
  `;
  modalOverlay.classList.remove("hidden");

  document.getElementById("closeModal").onclick = closeModal;

  document.getElementById("confirmAdd").onclick = () => {
    const name = document.getElementById("catName").value.trim();
    const desc = document.getElementById("catDesc").value.trim();

    if (!name) {
      alert("Category name required");
      return;
    }

    tempCategory = { name, desc };
    openConfirmModal();
  };
});

/* CONFIRMATION MODAL */
function openConfirmModal() {
  modalContent.innerHTML = `
    <h3>⚠️ Confirm Add</h3>

    <p>Are you sure you want to add:</p>
    <strong>${tempCategory.name}</strong>

    <div class="modal-actions">
      <button id="finalConfirm">Confirm</button>
      <button id="backToForm">Back</button>
    </div>
  `;

  document.getElementById("backToForm").onclick = () => addBtn.click();

  document.getElementById("finalConfirm").onclick = () => {
    categories.push(tempCategory);
    tempCategory = null;
    closeModal();
    renderTable();
  };
}

/* RENDER TABLE */
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

/* CLOSE MODAL */
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalContent.innerHTML = "";
}