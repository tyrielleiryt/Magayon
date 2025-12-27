const API_URL = "https://script.google.com/macros/s/AKfycbzVNXWlJ61HeqVQBb3eyjMb3-g-LU4QE9PCaYxNEauxpd0BF6HOyFoRwbKDTnvIkkt4/exec";

/* ELEMENTS */
const tableBody = document.getElementById("categoryTableBody");
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const addBtn = document.getElementById("addCategoryBtn");
const editBtn = document.getElementById("editCategoryBtn");

/* STATE */
let categories = [];

/* LOAD */
async function loadCategories() {
  const res = await fetch(API_URL);
  categories = await res.json();
  renderTable();
}
loadCategories();

/* DATE */
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

/* TABLE */
function renderTable() {
  tableBody.innerHTML = "";
  categories.forEach((c, i) => {
    tableBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${c.category_name}</td>
        <td>${c.description}</td>
        <td>—</td>
      </tr>
    `;
  });
}

/* ADD CATEGORY */
addBtn.onclick = () => {
  modalOverlay.classList.remove("hidden");
  modalBox.innerHTML = `
    <div class="modal-header"><h3>Add Category</h3></div>
    <div class="modal-body">
      <label>Category Name</label>
      <input id="catName">
      <label>Description</label>
      <textarea id="catDesc"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-confirm" id="saveAdd">Confirm</button>
      <button class="btn-back" id="closeModal">Back</button>
    </div>
  `;

  document.getElementById("closeModal").onclick = closeModal;
  document.getElementById("saveAdd").onclick = async () => {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        category_name: catName.value,
        description: catDesc.value
      })
    });
    closeModal();
    loadCategories();
  };
};

/* EDIT CATEGORY */
editBtn.onclick = () => {
  modalOverlay.classList.remove("hidden");
  modalBox.innerHTML = `
    <div class="modal-header"><h3>Edit Category</h3></div>
    <div class="modal-body">
      <label>Select Category</label>
      <select id="catSelect">
        ${categories.map(c =>
          `<option value="${c.category_id}">${c.category_name}</option>`
        ).join("")}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn-confirm" id="editNext">Edit</button>
      <button class="btn-back" id="closeModal">Back</button>
    </div>
  `;

  document.getElementById("closeModal").onclick = closeModal;
  document.getElementById("editNext").onclick = openEditForm;
};

function openEditForm() {
  const id = document.getElementById("catSelect").value;
  const cat = categories.find(c => c.category_id == id);

  modalBox.innerHTML = `
    <div class="modal-header"><h3>Edit Category</h3></div>
    <div class="modal-body">
      <label>Category Name</label>
      <input id="editName" value="${cat.category_name}">
      <label>Description</label>
      <textarea id="editDesc">${cat.description}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-confirm" id="saveEdit">Confirm</button>
      <button class="btn-back" id="closeModal">Back</button>
    </div>
  `;

  document.getElementById("closeModal").onclick = closeModal;
  document.getElementById("saveEdit").onclick = async () => {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "edit",
        category_id: cat.category_id,
        category_name: editName.value,
        description: editDesc.value
      })
    });
    closeModal();
    loadCategories();
  };
}

/* CLOSE */
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.innerHTML = "";
}