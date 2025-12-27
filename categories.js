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
const moveUpBtn = document.getElementById("moveUpBtn");
const moveDownBtn = document.getElementById("moveDownBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const tableBody = document.getElementById("categoryTableBody");

/* ===== STATE ===== */
let categories = [];
let selectedIndex = null;

/* ===== LOAD ===== */
async function loadCategories() {
  const res = await fetch(API_URL);
  categories = await res.json();
  selectedIndex = null;
  renderTable();
}
loadCategories();

/* ===== TABLE ===== */
function renderTable() {
  tableBody.innerHTML = "";

  categories.forEach((cat, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${cat.category_name}</td>
      <td>${cat.description}</td>
      <td>—</td>
    `;

    tr.onclick = () => {
      document.querySelectorAll("#categoryTableBody tr")
        .forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selectedIndex = i;
    };

    tableBody.appendChild(tr);
  });
}

/* ===== MODAL ===== */
function openModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.classList.remove("hidden");
}
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.innerHTML = "";
}

/* ===== ADD ===== */
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
    if (!addName.value.trim()) return alert("Category name required");

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

/* ===== EDIT ===== */
editBtn.onclick = () => {
  if (selectedIndex === null) {
    alert("Select a category first");
    return;
  }

  const cat = categories[selectedIndex];

  openModal(`
    <div class="modal-header">✏ Edit Category</div>

    <label>Category Name</label>
    <input id="editName" value="${cat.category_name}">

    <label>Description</label>
    <textarea id="editDesc">${cat.description}</textarea>

    <div class="modal-actions">
      <button class="btn-danger" id="saveEdit">Confirm</button>
      <button class="btn-back" id="cancelEdit">Back</button>
    </div>
  `);

  cancelEdit.onclick = closeModal;

  saveEdit.onclick = async () => {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "edit",
        rowIndex: selectedIndex,
        category_name: editName.value,
        description: editDesc.value
      })
    });

    closeModal();
    loadCategories();
  };
};

/* ===== DELETE ===== */
deleteBtn.onclick = () => {
  if (selectedIndex === null) {
    alert("Select a category first");
    return;
  }

  const cat = categories[selectedIndex];

  openModal(`
    <div class="modal-header danger">⚠ Delete Category</div>

    <p>Are you sure you want to delete:</p>
    <input value="${cat.category_name}" disabled>

    <div class="modal-actions">
      <button class="btn-danger" id="confirmDelete">Delete</button>
      <button class="btn-back" id="cancelDelete">Back</button>
    </div>
  `);

  cancelDelete.onclick = closeModal;

  confirmDelete.onclick = async () => {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "delete",
        rowIndex: selectedIndex
      })
    });

    closeModal();
    loadCategories();
  };
};

/* ===== MOVE UP ===== */
moveUpBtn.onclick = async () => {
  if (selectedIndex === null || selectedIndex === 0) return;

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "move",
      rowIndex: selectedIndex,
      direction: "up"
    })
  });

  loadCategories();
};

/* ===== MOVE DOWN ===== */
moveDownBtn.onclick = async () => {
  if (selectedIndex === null || selectedIndex === categories.length - 1) return;

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "move",
      rowIndex: selectedIndex,
      direction: "down"
    })
  });

  loadCategories();
};