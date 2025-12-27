const API_URL = "https://script.google.com/macros/s/AKfycbzVNXWlJ61HeqVQBb3eyjMb3-g-LU4QE9PCaYxNEauxpd0BF6HOyFoRwbKDTnvIkkt4/exec";

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

/* ===== LOAD CATEGORIES ===== */
async function loadCategories() {
  try {
    const res = await fetch(API_URL);
    categories = await res.json();
    renderTable();
  } catch (err) {
    alert("Failed to load categories");
    console.error(err);
  }
}
loadCategories();

/* ===== TABLE RENDER ===== */
function renderTable() {
  tableBody.innerHTML = "";
  categories.forEach((cat, index) => {
    tableBody.innerHTML += `
      <tr>
        <td>${index + 1}</td>
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

/* ================= DELETE CATEGORY ================= */

deleteBtn.onclick = () => {
  openModal(`
    <div class="modal-header danger">🗑 Delete Category</div>

    <div class="modal-body">
      <label>Select Category</label>
      <select id="deleteSelect">
        ${categories
          .map(
            c =>
              `<option value="${c.category_id}">${c.category_name}</option>`
          )
          .join("")}
      </select>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" id="confirmDelete">Delete</button>
      <button class="btn-back" id="cancelDelete">Back</button>
    </div>
  `);

  document.getElementById("cancelDelete").onclick = closeModal;

  document.getElementById("confirmDelete").onclick = () => {
    const select = document.getElementById("deleteSelect");
    const id = select.value;

    selectedCategory = categories.find(
      c => String(c.category_id) === String(id)
    );

    openDeleteConfirm();
  };
};

/* ===== DELETE CONFIRM ===== */
function openDeleteConfirm() {
  openModal(`
    <div class="modal-header danger">⚠ Confirm Delete</div>

    <div class="modal-body">
      <p>Are you sure you want to delete:</p>
      <input value="${selectedCategory.category_name}" disabled>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" id="finalDelete">Confirm</button>
      <button class="btn-back" id="backDelete">Back</button>
    </div>
  `);

  document.getElementById("backDelete").onclick = deleteBtn.onclick;

  document.getElementById("finalDelete").onclick = async () => {
    try {
      await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "delete",
          category_id: selectedCategory.category_id
        })
      });

      closeModal();
      loadCategories();
    } catch (err) {
      alert("Failed to delete category");
      console.error(err);
    }
  };
}