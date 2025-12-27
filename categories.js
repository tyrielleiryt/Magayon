const API_URL = "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

/* ================= ELEMENTS ================= */
const tableBody = document.getElementById("categoryTableBody");
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const addBtn = document.getElementById("addCategoryBtn");
const editBtn = document.getElementById("editCategoryBtn");

/* ================= STATE ================= */
let categories = [];

/* ================= LOAD CATEGORIES ================= */
async function loadCategories() {
  try {
    const res = await fetch(API_URL);
    const raw = await res.json();

    // 🔥 NORMALIZE API RESPONSE (PREVENTS undefined)
    categories = raw.map(item => ({
      category_id: item.category_id ?? item.id,
      category_name: item.category_name ?? item.name,
      description: item.description ?? item.desc,
      qty: item.qty ?? ""
    }));

    renderTable();
  } catch (err) {
    alert("Failed to load categories");
    console.error(err);
  }
}

loadCategories();

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

/* ================= RENDER TABLE ================= */
function renderTable() {
  tableBody.innerHTML = "";

  categories.forEach((c, i) => {
    tableBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${c.category_name || ""}</td>
        <td>${c.description || ""}</td>
        <td>—</td>
      </tr>
    `;
  });
}

/* ================= ADD CATEGORY ================= */
addBtn.onclick = () => {
  modalOverlay.classList.remove("hidden");

  modalBox.innerHTML = `
    <div class="modal-header">
      <h3>➕ Add Category</h3>
    </div>

    <div class="modal-body">
      <label>Category Name</label>
      <input id="catName">

      <label>Description</label>
      <textarea id="catDesc"></textarea>
    </div>

    <div class="modal-actions">
      <button class="btn-confirm" id="confirmAdd">Confirm</button>
      <button class="btn-back" id="closeModal">Back</button>
    </div>
  `;

  document.getElementById("closeModal").onclick = closeModal;

  document.getElementById("confirmAdd").onclick = async () => {
    const name = document.getElementById("catName").value.trim();
    const desc = document.getElementById("catDesc").value.trim();

    if (!name) {
      alert("Category name is required");
      return;
    }

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

/* ================= EDIT CATEGORY (STEP 1) ================= */
editBtn.onclick = () => {
  if (!categories.length) {
    alert("No categories to edit");
    return;
  }

  modalOverlay.classList.remove("hidden");

  modalBox.innerHTML = `
    <div class="modal-header">
      <h3>✏ Edit Category</h3>
    </div>

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

/* ================= EDIT CATEGORY (STEP 2) ================= */
function openEditForm() {
  const id = document.getElementById("catSelect").value;
  const cat = categories.find(c => String(c.category_id) === String(id));

  modalBox.innerHTML = `
    <div class="modal-header">
      <h3>✏ Edit Category</h3>
    </div>

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
    const newName = document.getElementById("editName").value.trim();
    const newDesc = document.getElementById("editDesc").value.trim();

    if (!newName) {
      alert("Category name is required");
      return;
    }

    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "edit",
        category_id: cat.category_id,
        category_name: newName,
        description: newDesc
      })
    });

    closeModal();
    loadCategories();
  };
}

/* ================= CLOSE MODAL ================= */
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.innerHTML = "";
}