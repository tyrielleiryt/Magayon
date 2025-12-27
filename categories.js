const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

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
const editBtn = document.getElementById("editCategoryBtn");
const deleteBtn = document.getElementById("deleteCategoryBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const tableBody = document.getElementById("categoryTableBody");

/* ===== STATE ===== */
let categories = [];
let selectedCategory = null;

/* ===== LOAD ===== */
async function loadCategories() {
  const res = await fetch(API_URL);
  categories = await res.json();
  renderTable();
}
loadCategories();

/* ===== TABLE ===== */
function renderTable() {
  tableBody.innerHTML = "";
  categories.forEach((cat, i) => {
    tableBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${cat.category_name}</td>
        <td>${cat.description}</td>
        <td>—</td>
      </tr>
    `;
  });
}

/* ===== MODAL HELPERS ===== */
function openModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.innerHTML = "";
}

/* ===== ADD CATEGORY ===== */
addBtn.onclick = () => {
  openModal(`
    <div class="modal-header">➕ Add Category</div>

    <label>Category Name</label>
    <input id="addName">

    <label>Description</label>
    <textarea id="addDesc"></textarea>

    <div class="modal-actions">
      <button class="btn-danger" id="saveAdd">Confirm</button>
      <button class="btn-back" id="cancelAdd">Back</button>
    </div>
  `);

  cancelAdd.onclick = closeModal;

  saveAdd.onclick = async () => {
    if (!addName.value.trim()) return alert("Required");

    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        category_name: addName.value,
        description: addDesc.value
      })
    });

    closeModal();
    loadCategories();
  };
};

/* ===== EDIT CATEGORY ===== */
editBtn.onclick = () => {
  openModal(`
    <div class="modal-header">✏ Edit Category</div>

    <label>Select Category</label>
    <select id="editSelect">
      ${categories.map(c =>
        `<option value="${c.category_id}">${c.category_name}</option>`
      ).join("")}
    </select>

    <div class="modal-actions">
      <button class="btn-danger" id="editNext">Edit</button>
      <button class="btn-back" id="cancelEdit">Back</button>
    </div>
  `);

  cancelEdit.onclick = closeModal;

  editNext.onclick = () => {
    selectedCategory = categories.find(
      c => String(c.category_id) === editSelect.value
    );

    openModal(`
      <div class="modal-header">✏ Edit Category</div>

      <label>Category Name</label>
      <input id="editName" value="${selectedCategory.category_name}">

      <label>Description</label>
      <textarea id="editDesc">${selectedCategory.description}</textarea>

      <div class="modal-actions">
        <button class="btn-danger" id="saveEdit">Confirm</button>
        <button class="btn-back" id="cancelEdit2">Back</button>
      </div>
    `);

    cancelEdit2.onclick = closeModal;

    saveEdit.onclick = async () => {
      await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "edit",
          category_id: selectedCategory.category_id,
          category_name: editName.value,
          description: editDesc.value
        })
      });

      closeModal();
      loadCategories();
    };
  };
};

/* ===== DELETE CATEGORY ===== */
deleteBtn.onclick = () => {
  openModal(`
    <div class="modal-header danger">🗑 Delete Category</div>

    <label>Select Category</label>
    <select id="deleteSelect">
      ${categories.map(c =>
        `<option value="${c.category_id}">${c.category_name}</option>`
      ).join("")}
    </select>

    <div class="modal-actions">
      <button class="btn-danger" id="confirmDelete">Delete</button>
      <button class="btn-back" id="cancelDelete">Back</button>
    </div>
  `);

  cancelDelete.onclick = closeModal;

  confirmDelete.onclick = () => {
    selectedCategory = categories.find(
      c => String(c.category_id) === deleteSelect.value
    );

    openModal(`
      <div class="modal-header danger">⚠ Confirm Delete</div>
      <input value="${selectedCategory.category_name}" disabled>

      <div class="modal-actions">
        <button class="btn-danger" id="finalDelete">Confirm</button>
        <button class="btn-back" id="cancelFinal">Back</button>
      </div>
    `);

    cancelFinal.onclick = closeModal;

 finalDelete.onclick = async () => {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "delete",
        category_id: selectedCategory.category_id
      })
    });

    const result = await res.json();

    if (!result.success) {
      alert("Delete failed: category not found.");
      return;
    }

    closeModal();
    loadCategories();
  } catch (err) {
    alert("Delete failed. Check console.");
    console.error(err);
  }
};
  };
};