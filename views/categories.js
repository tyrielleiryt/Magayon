import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* ================= API ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let categories = [];
let selected = null;

let currentPage = 1;
const PAGE_SIZE = 10;
let searchQuery = "";

/* ================= ENTRY ================= */
export default function loadCategoriesView() {
  renderActionBar();
  renderTableLayout();
  loadCategories();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  const actionBar = document.getElementById("actionBar");

  actionBar.innerHTML = `
    <input
      type="text"
      id="categorySearch"
      placeholder="Search categories..."
      style="padding:8px;border-radius:6px;border:1px solid #bbb"
    />

    <button id="addBtn" class="category-action-btn">➕ Add Category</button>
    <button id="editBtn" class="category-action-btn" disabled>✏️ Edit</button>
    <button id="deleteBtn" class="category-action-btn" disabled>🗑️ Delete</button>
  `;

  document.getElementById("addBtn").onclick = openAddModal;
  document.getElementById("editBtn").onclick = openEditModal;
  document.getElementById("deleteBtn").onclick = openDeleteModal;

  document.getElementById("categorySearch").oninput = e => {
    searchQuery = e.target.value.toLowerCase();
    currentPage = 1;
    clearSelection();
    renderTable();
  };
}

/* ================= TABLE LAYOUT ================= */
function renderTableLayout() {
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
      <div id="pagination" style="padding-top:10px;text-align:center;"></div>
    </div>
  `;

  bindDataBoxScroll(contentBox.querySelector(".data-box"));
}

/* ================= LOAD DATA ================= */
async function loadCategories() {
  const res = await fetch(API_URL + "?type=categories");
  categories = await res.json();

  clearSelection();
  renderTable();
}

/* ================= HELPERS ================= */
function clearSelection() {
  selected = null;
  const editBtn = document.getElementById("editBtn");
  const deleteBtn = document.getElementById("deleteBtn");
  if (editBtn) editBtn.disabled = true;
  if (deleteBtn) deleteBtn.disabled = true;
}

/* ================= RENDER TABLE ================= */
function renderTable() {
  const tbody = document.getElementById("categoryTableBody");
  const pagination = document.getElementById("pagination");

  tbody.innerHTML = "";
  pagination.innerHTML = "";

  const filtered = categories.filter(c =>
    `${c.category_name} ${c.description || ""}`
      .toLowerCase()
      .includes(searchQuery)
  );

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:#888">
          No categories found
        </td>
      </tr>
    `;
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  pageItems.forEach((c, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${start + i + 1}</td>
      <td>${c.category_name}</td>
      <td>${c.description || ""}</td>
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

  /* Pagination buttons */
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = "btn-view";
    if (i === currentPage) btn.style.background = "#f3c84b";

    btn.onclick = () => {
      currentPage = i;
      clearSelection();
      renderTable();
    };

    pagination.appendChild(btn);
  }
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
      <button class="btn-danger" id="saveCat">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
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
    <textarea id="catDesc">${selected.description || ""}</textarea>

    <div class="modal-actions">
      <button class="btn-danger" id="saveEdit">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
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
      <button class="btn-danger" id="confirmDelete">Delete</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
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