const API_URL = "https://script.google.com/macros/s/AKfycbzVNXWlJ61HeqVQBb3eyjMb3-g-LU4QE9PCaYxNEauxpd0BF6HOyFoRwbKDTnvIkkt4/exec";

/* ===== ELEMENTS ===== */
const addBtn = document.getElementById("addCategoryBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const tableBody = document.getElementById("categoryTableBody");

/* ===== STATE ===== */
let categories = [];
let pendingCategory = null;

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

/* ===== ADD CATEGORY MODAL ===== */
addBtn.addEventListener("click", () => {
  modalOverlay.classList.remove("hidden");

  modalBox.innerHTML = `
    <div class="modal-header">
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
      <h3>Confirm Add</h3>
    </div>

    <div class="modal-body">
      <p>Are you sure you want to add:</p>
      <input value="${pendingCategory.name}" disabled>
    </div>

    <div class="modal-actions">
      <button class="btn-confirm" id="finalConfirm">Confirm</button>
      <button class="btn-back" id="backEdit">Back</button>
    </div>
  `;

  document.getElementById("backEdit").onclick = () => addBtn.click();

  document.getElementById("finalConfirm").onclick = saveCategory;
}

/* ===== SAVE CATEGORY ===== */
async function saveCategory() {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(pendingCategory)
    });

    const result = await res.json();
    if (!result.success) throw new Error("Save failed");

    pendingCategory = null;
    closeModal();
    loadCategories();

  } catch (err) {
    alert("Failed to save category");
    console.error(err);
  }
}

/* ===== TABLE RENDER ===== */
function renderTable() {
  tableBody.innerHTML = "";
  categories.forEach((cat, index) => {
    tableBody.innerHTML += `
      <tr>
        <td>${index + 1}</td>
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