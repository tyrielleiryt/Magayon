import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let categories = [];
let selected = null;

/* ================= ENTRY ================= */
export default function loadCategoriesView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addBtn">+ Add</button>
    <button id="editBtn" disabled>Edit</button>
    <button id="deleteBtn" disabled>Delete</button>
  `;

  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
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
  document.getElementById("deleteBtn").onclick = deleteCategory;
}

/* ================= ADD ================= */
function openAddModal() {
  openModal(`
    <div class="modal-header">Add Category</div>
    <label>Name</label>
    <input id="catName">
    <label>Description</label>
    <textarea id="catDesc"></textarea>
    <div class="modal-actions">
      <button id="saveCat">Save</button>
      <button onclick="closeModal()">Cancel</button>
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
    <div class="modal-header">Edit Category</div>
    <label>Name</label>
    <input id="catName" value="${selected.category_name}">
    <label>Description</label>
    <textarea id="catDesc">${selected.description}</textarea>
    <div class="modal-actions">
      <button id="saveEdit">Save</button>
      <button onclick="closeModal()">Cancel</button>
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
function deleteCategory() {
  if (!selected) return;
  if (!confirm("Delete this category?")) return;

  new Image().src =
    API_URL +
    `?action=deleteCategory&rowIndex=${selected.rowIndex}`;

  setTimeout(loadCategories, 500);
}