import { bindDataBoxScroll } from "../admin.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let categories = [];
let selectedIndex = null;

export default function loadCategoriesView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addBtn">+ Add Category</button>
    <button id="editBtn">Edit</button>
    <button id="deleteBtn">Delete</button>
    <button id="upBtn">⬆</button>
    <button id="downBtn">⬇</button>
  `;

  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table" style="min-width:800px">
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

      <div class="data-scroll-controls">
        <button class="scroll-left">◀</button>
        <button class="scroll-right">▶</button>
      </div>
    </div>
  `;

  bindActions();
  loadCategories();
  bindDataBoxScroll(contentBox.querySelector(".data-box"));
}

/* ===== DATA ===== */
async function loadCategories() {
  const res = await fetch(API_URL);
  categories = await res.json();
  selectedIndex = null;
  renderTable();
}

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

/* ===== ACTIONS ===== */
function bindActions() {
  document.getElementById("addBtn").onclick = openAddModal;
  document.getElementById("editBtn").onclick = openEditModal;
  document.getElementById("deleteBtn").onclick = openDeleteModal;
}

function openAddModal() {
  openModal(`
    <div class="modal-header">➕ Add Category</div>
    <label>Name</label>
    <input id="catName">
    <label>Description</label>
    <textarea id="catDesc"></textarea>
    <div class="modal-actions">
      <button class="btn-danger" onclick="closeModal()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

function openEditModal() {
  if (selectedIndex === null) return alert("Select a category first");
  openModal(`<div class="modal-header">✏ Edit Category</div>`);
}

function openDeleteModal() {
  if (selectedIndex === null) return alert("Select a category first");
  openModal(`<div class="modal-header danger">🗑 Delete Category</div>`);
}