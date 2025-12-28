const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let categories = [];
let selectedIndex = null;

/* ================= ENTRY POINT ================= */
export default function loadCategoriesView() {
  // ACTION BAR (GLOBAL)
  document.getElementById("actionBar").innerHTML = `
    <button id="addBtn">+ Add Category</button>
    <button id="editBtn">Edit</button>
    <button id="deleteBtn">Delete</button>
    <button id="upBtn">⬆ Move Up</button>
    <button id="downBtn">⬇ Move Down</button>
  `;

  // MAIN CONTENT
  document.getElementById("contentBox").innerHTML = `
    <div class="view-body">
      <table class="category-table">
        <thead>
          <tr>
            <th style="width:50px">#</th>
            <th>Category Name</th>
            <th>Description</th>
            <th style="width:70px">QTY</th>
          </tr>
        </thead>
        <tbody id="categoryTableBody"></tbody>
      </table>
    </div>
  `;

  bindActions();
  loadCategories();
}

/* ================= BUTTON BINDING ================= */
function bindActions() {
  document.getElementById("addBtn").onclick = openAddModal;
  document.getElementById("editBtn").onclick = openEditModal;
  document.getElementById("deleteBtn").onclick = openDeleteModal;
  document.getElementById("upBtn").onclick = moveUp;
  document.getElementById("downBtn").onclick = moveDown;
}

/* ================= LOAD DATA ================= */
async function loadCategories() {
  const res = await fetch(API_URL);
  categories = await res.json();
  selectedIndex = null;
  renderTable();
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = document.getElementById("categoryTableBody");
  tbody.innerHTML = "";

  categories.forEach((cat, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${cat.category_name}</td>
      <td>${cat.description}</td>
      <td>—</td>
    `;

    tr.onclick = () => {
      document
        .querySelectorAll("#categoryTableBody tr")
        .forEach(r => r.classList.remove("selected"));

      tr.classList.add("selected");
      selectedIndex = i;
    };

    tbody.appendChild(tr);
  });
}

/* ================= MODAL CORE ================= */
function ensureModal() {
  if (document.getElementById("modalOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "modalOverlay";
  overlay.className = "hidden";
  overlay.innerHTML = `<div id="modalBox"></div>`;
  document.body.appendChild(overlay);
}

function openModal(html) {
  ensureModal();
  document.getElementById("modalBox").innerHTML = html;
  document.getElementById("modalOverlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.add("hidden");
  document.getElementById("modalBox").innerHTML = "";
}

/* ================= ADD ================= */
function openAddModal() {
  openModal(`
    <div class="modal-header">➕ Add Category</div>

    <label>Category Name</label>
    <input id="addName">

    <label>Description</label>
    <textarea id="addDesc"></textarea>

    <div class="modal-actions">
      <button class="btn-danger" id="confirmAdd">Confirm</button>
      <button class="btn-back" id="cancelAdd">Back</button>
    </div>
  `);

  document.getElementById("cancelAdd").onclick = closeModal;
  document.getElementById("confirmAdd").onclick = async () => {
    const name = document.getElementById("addName").value.trim();
    if (!name) return alert("Category name required");

    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        category_name: name,
        description: document.getElementById("addDesc").value
      })
    });

    closeModal();
    loadCategories();
  };
}

/* ================= EDIT ================= */
function openEditModal() {
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
      <button class="btn-danger" id="confirmEdit">Confirm</button>
      <button class="btn-back" id="cancelEdit">Back</button>
    </div>
  `);

  document.getElementById("cancelEdit").onclick = closeModal;
  document.getElementById("confirmEdit").onclick = async () => {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "edit",
        rowIndex: selectedIndex,
        category_name: document.getElementById("editName").value,
        description: document.getElementById("editDesc").value
      })
    });

    closeModal();
    loadCategories();
  };
}

/* ================= DELETE ================= */
function openDeleteModal() {
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
      <button class="btn-danger" id="confirmDelete">Confirm</button>
      <button class="btn-back" id="cancelDelete">Back</button>
    </div>
  `);

  document.getElementById("cancelDelete").onclick = closeModal;
  document.getElementById("confirmDelete").onclick = async () => {
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
}

/* ================= MOVE ================= */
async function moveUp() {
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
}

async function moveDown() {
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
}