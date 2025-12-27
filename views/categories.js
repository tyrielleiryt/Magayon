const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let categories = [];
let selectedIndex = null;

/* ENTRY */
export default function loadCategoriesView() {
  document.getElementById("actionBar").innerHTML = `
    <div class="action-bar">
      <button onclick="addCategory()">+ Add Category</button>
      <button onclick="editCategory()">Edit</button>
      <button onclick="deleteCategory()">Delete</button>
      <button onclick="moveUp()">⬆ Move Up</button>
      <button onclick="moveDown()">⬇ Move Down</button>
    </div>
  `;

  document.getElementById("contentBox").innerHTML = `
    <div class="view-body">
      <table class="category-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Category Name</th>
            <th>Description</th>
            <th>QTY</th>
          </tr>
        </thead>
        <tbody id="categoryTableBody"></tbody>
      </table>
    </div>

    <div id="modalOverlay" class="hidden">
      <div id="modalBox"></div>
    </div>
  `;

  loadCategories();
}

/* LOAD */
async function loadCategories() {
  const res = await fetch(API_URL);
  categories = await res.json();
  selectedIndex = null;
  renderTable();
}

/* TABLE */
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
      document.querySelectorAll("#categoryTableBody tr")
        .forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selectedIndex = i;
    };

    tbody.appendChild(tr);
  });
}

/* MODAL HELPERS */
function openModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.classList.remove("hidden");
}
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.innerHTML = "";
}

/* ADD */
window.addCategory = () => {
  openModal(`
    <div class="modal-header">➕ Add category</div>
    <label>Category Name</label>
    <input id="addName">
    <label>Description</label>
    <input id="addDesc">
    <div class="modal-actions">
      <button class="btn-danger" id="confirmAdd">Confirm</button>
      <button class="btn-back" onclick="closeModal()">Back</button>
    </div>
  `);

  confirmAdd.onclick = async () => {
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

/* EDIT */
window.editCategory = () => {
  if (selectedIndex === null) return alert("Select a category first");

  const cat = categories[selectedIndex];
  openModal(`
    <div class="modal-header">✏ Edit category</div>
    <label>Category Name</label>
    <input id="editName" value="${cat.category_name}">
    <label>Description</label>
    <input id="editDesc" value="${cat.description}">
    <div class="modal-actions">
      <button class="btn-danger" id="confirmEdit">Edit</button>
      <button class="btn-back" onclick="closeModal()">Back</button>
    </div>
  `);

  confirmEdit.onclick = async () => {
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

/* DELETE */
window.deleteCategory = () => {
  if (selectedIndex === null) return alert("Select a category first");

  const cat = categories[selectedIndex];
  openModal(`
    <div class="modal-header danger">🗑 Delete category</div>
    <label>Category Name</label>
    <input value="${cat.category_name}" disabled>
    <div class="modal-actions">
      <button class="btn-danger" id="confirmDel">Confirm</button>
      <button class="btn-back" onclick="closeModal()">Back</button>
    </div>
  `);

  confirmDel.onclick = async () => {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "delete", rowIndex: selectedIndex })
    });
    closeModal();
    loadCategories();
  };
};

/* MOVE */
window.moveUp = async () => {
  if (selectedIndex === null || selectedIndex === 0) return;
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "move", rowIndex: selectedIndex, direction: "up" })
  });
  loadCategories();
};

window.moveDown = async () => {
  if (selectedIndex === null || selectedIndex === categories.length - 1) return;
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "move", rowIndex: selectedIndex, direction: "down" })
  });
  loadCategories();
};