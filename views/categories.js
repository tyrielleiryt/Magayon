import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let categories = [];
let selected = null;

/* ================= ENTRY ================= */
export default function loadCategoriesView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addBtn" class="category-action-btn">➕ Add Category</button>
    <button id="editBtn" class="category-action-btn" disabled>✏️ Edit Category</button>
    <button id="deleteBtn" class="category-action-btn" disabled>🗑️ Delete Category</button>
  `;

  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Category Name</th>
              <th>Description</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody id="categoryTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindActions();
  bindDataBoxScroll(contentBox.querySelector(".data-box"));
  loadCategories();
}

/* ================= DATA ================= */
async function loadCategories() {
  const res = await fetch(API_URL + "?type=categories");
  categories = await res.json();
  selected = null;
  renderTable();

  document.getElementById("editBtn").disabled = true;
  document.getElementById("deleteBtn").disabled = true;
}

function renderTable() {
  const tbody = document.getElementById("categoryTableBody");
  tbody.innerHTML = "";

  categories.forEach((c, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${c.category_name}</td>
      <td>${c.description}</td>
      <td>${c.qty}</td>
    `;

    tr.onclick = () => {
      document
        .querySelectorAll("#categoryTableBody tr")
        .forEach(r => r.classList.remove("selected"));

      tr.classList.add("selected");
      selected = c;

      document.getElementById("editBtn").disabled = false;
      document.getElementById("deleteBtn").disabled = false;
    };

    tbody.appendChild(tr);
  });
}

/* ================= ACTIONS ================= */
function bindActions() {
  document.getElementById("addBtn").onclick = openAddModal;
  document.getElementById("editBtn").onclick = openEditModal;
  document.getElementById("deleteBtn").onclick = openDeleteModal;
}

/* ================= ADD ================= */
function openAddModal() {
  openModal(`
    <div class="modal-header">➕ Add Category</div>

    <label>Category Name</label>
    <input id="catName">

    <label>Description</label>
    <textarea id="catDesc"></textarea>

    <div class="modal-actions">
      <button class="btn-confirm" id="saveCat">Confirm</button>
      <button class="btn-back" onclick="closeModal()">Back</button>
    </div>
  `);

  document.getElementById("saveCat").onclick = () => {
    new Image().src =
      API_URL +
      `?action=addCategory` +
      `&category_name=${encodeURIComponent(catName.value)}` +
      `&description=${encodeURIComponent(catDesc.value)}`;

    closeModal();
    setTimeout(loadCategories, 500);
  };
}

/* ================= EDIT ================= */
function openEditModal() {
  if (!selected) return;

  openModal(`
    <div class="modal-header">✏️ Edit Category</div>

    <label>Category Name</label>
    <input id="catName" value="${selected.category_name}">

    <label>Description</label>
    <textarea id="catDesc">${selected.description}</textarea>

    <div class="modal-actions">
      <button class="btn-confirm" id="saveEdit">Edit</button>
      <button class="btn-back" onclick="closeModal()">Back</button>
    </div>
  `);

  document.getElementById("saveEdit").onclick = () => {
    new Image().src =
      API_URL +
      `?action=editCategory` +
      `&rowIndex=${selected.rowIndex}` +
      `&category_name=${encodeURIComponent(catName.value)}` +
      `&description=${encodeURIComponent(catDesc.value)}`;

    closeModal();
    setTimeout(loadCategories, 500);
  };
}

/* ================= DELETE ================= */
function openDeleteModal() {
  if (!selected) return;

  openModal(`
    <div class="modal-header danger">🗑️ Delete Category</div>

    <p>Are you sure you want to delete <b>${selected.category_name}</b>?</p>

    <div class="modal-actions">
      <button class="btn-confirm" id="confirmDelete">Confirm</button>
      <button class="btn-back" onclick="closeModal()">Back</button>
    </div>
  `);

  document.getElementById("confirmDelete").onclick = () => {
    new Image().src =
      API_URL +
      `?action=deleteCategory&rowIndex=${selected.rowIndex}`;

    closeModal();
    setTimeout(loadCategories, 500);
  };
}