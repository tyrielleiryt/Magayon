const API_URL = "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

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
let pendingCategory = null;

/* ===== LOAD ===== */
async function loadCategories() {
  try {
    const res = await fetch(API_URL);
    categories = await res.json();
    renderTable();
  } catch {
    alert("Failed to load categories");
  }
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

/* ===== MODAL UTILS ===== */
function openModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.innerHTML = "";
}

/* ======================================================
   ADD CATEGORY (already working – unchanged)
====================================================== */
addBtn.onclick = () => {
  openModal(`
    <div class="modal-header">➕ Add Category</div>
    <label>Category Name</label>
    <input id="catName">
    <label>Description</label>
    <textarea id="catDesc"></textarea>
    <div class="modal-actions">
      <button id="confirmAdd">Confirm</button>
      <button id="cancel">Back</button>
    </div>
  `);

  document.getElementById("cancel").onclick = closeModal;

  document.getElementById("confirmAdd").onclick = async () => {
    const name = catName.value.trim();
    const desc = catDesc.value.trim();
    if (!name) return alert("Required");

    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        category_name: name,
        description: desc
      })
    });

    closeModal();
    loadCategories();
  };
};

/* ======================================================
   DELETE CATEGORY – STEP 1 (SELECT)
====================================================== */
deleteBtn.onclick = () => {
  if (!categories.length) return alert("No categories");

  openModal(`
    <div class="modal-header">🗑 Delete Category</div>
    <label>Select Category</label>
    <select id="deleteSelect">
      ${categories.map(c =>
        `<option value="${c.category_id}">${c.category_name}</option>`
      ).join("")}
    </select>
    <div class="modal-actions">
      <button id="nextDelete">Delete</button>
      <button id="cancel">Back</button>
    </div>
  `);

  document.getElementById("cancel").onclick = closeModal;

  document.getElementById("nextDelete").onclick = () => {
    const id = deleteSelect.value;
    pendingCategory = categories.find(c => c.category_id == id);
    openDeleteConfirm();
  };
};

/* ======================================================
   DELETE CATEGORY – STEP 2 (CONFIRM)
====================================================== */
function openDeleteConfirm() {
  openModal(`
    <div class="modal-header">⚠ Confirm Delete</div>
    <p>Are you sure you want to delete:</p>
    <input value="${pendingCategory.category_name}" disabled>
    <div class="modal-actions">
      <button id="finalDelete">Confirm</button>
      <button id="back">Back</button>
    </div>
  `);

  document.getElementById("back").onclick = deleteBtn.onclick;

  document.getElementById("finalDelete").onclick = async () => {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "delete",
        category_id: pendingCategory.category_id
      })
    });

    pendingCategory = null;
    closeModal();
    loadCategories();
  };
}