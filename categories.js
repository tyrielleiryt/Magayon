/* ================= API ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbxx2r8mzm9wfGa5J8pGKeQkNJTpsMzBcDzEgpTSMRTgPKipu8W2adiUetS0leY9JEQ0/exec";

/* ================= STATE ================= */
let categories = [];
let pendingCategory = null;

/* ================= ELEMENTS ================= */
const addBtn = document.getElementById("addCategoryBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const tableBody = document.getElementById("categoryTableBody");

/* ================= DATE & TIME ================= */
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

/* ================= LOAD FROM DATABASE ================= */
async function loadCategories() {
  try {
    const res = await fetch(API_URL);
    categories = await res.json();
    renderTable();
  } catch (err) {
    console.error("Failed to load categories", err);
  }
}
loadCategories();

/* ================= ADD CATEGORY MODAL ================= */
addBtn.addEventListener("click", () => {
  modalOverlay.classList.remove("hidden");

  modalBox.innerHTML = `
    <div class="modal-header">
      <span class="modal-icon">➕</span>
      <h3>Add Category</h3>
    </div>

    <div class="modal-body">
      <label>Category Name</label>
      <input id="catName" />

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

/* ================= CONFIRM MODAL ================= */
function openConfirmModal() {
  modalBox.innerHTML = `
    <div class="modal-header">
      <span class="modal-icon">⚠️</span>
      <h3>Confirm Add</h3>
    </div>

    <div class="modal-body">
      <p><strong>Are you sure you want to add:</strong></p>
      <input value="${pendingCategory.name}" disabled />
    </div>

    <div class="modal-actions">
      <button class="btn-confirm" id="finalConfirm">Confirm</button>
      <button class="btn-back" id="backEdit">Back</button>
    </div>
  `;

  document.getElementById("backEdit").onclick = () => addBtn.click();

  document.getElementById("finalConfirm").onclick = saveCategoryToDB;
}

/* ================= SAVE TO GOOGLE SHEETS ================= */
async function saveCategoryToDB() {
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingCategory)
    });

    pendingCategory = null;
    closeModal();
    loadCategories(); // reload table from DB
  } catch (err) {
    alert("Failed to save category");
    console.error(err);
  }
}

/* ================= RENDER TABLE ================= */
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

/* ================= CLOSE MODAL ================= */
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.innerHTML = "";
}