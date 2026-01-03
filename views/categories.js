import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

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
  document.getElementById("actionBar").innerHTML = `
    <input id="categorySearch" placeholder="Search categories..." />

    <button class="category-action-btn" id="addBtn">➕ Add Category</button>
    <button class="category-action-btn" id="editBtn" disabled>✏️ Edit</button>
    <button class="category-action-btn" id="deleteBtn" disabled>🗑️ Delete</button>
  `;

  document.getElementById("addBtn").onclick = () => openCategoryModal();
  document.getElementById("editBtn").onclick = () => openCategoryModal(selected);
  document.getElementById("deleteBtn").onclick = openDeleteModal;

  document.getElementById("categorySearch").oninput = e => {
    searchQuery = e.target.value.toLowerCase();
    currentPage = 1;
    clearSelection();
    renderTable();
  };
}

/* ================= TABLE ================= */
function renderTableLayout() {
  const box = document.getElementById("contentBox");

  box.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody id="categoryTableBody"></tbody>
        </table>
      </div>
      <div id="pagination"></div>
    </div>
  `;

  bindDataBoxScroll(box.querySelector(".data-box"));
}

/* ================= LOAD ================= */
async function loadCategories() {
  const res = await fetch(API_URL + "?type=categories");
  categories = await res.json();
  clearSelection();
  renderTable();
}

/* ================= HELPERS ================= */
function clearSelection() {
  selected = null;
  document.getElementById("editBtn").disabled = true;
  document.getElementById("deleteBtn").disabled = true;
}

/* ================= RENDER ================= */
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
      <tr><td colspan="3" style="text-align:center;color:#888">No categories</td></tr>
    `;
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;

  filtered.slice(start, start + PAGE_SIZE).forEach((c, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${start + i + 1}</td>
      <td>${c.category_name}</td>
      <td>${c.description || ""}</td>
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

/* ================= ADD / EDIT ================= */
function openCategoryModal(c = null) {
  openModal(`
    <div class="modal-header">${c ? "Edit Category" : "Add Category"}</div>

    <label>Category Name</label>
    <input id="catName" value="${c?.category_name || ""}">

    <label>Description</label>
    <textarea id="catDesc">${c?.description || ""}</textarea>

    <div class="modal-actions">
      <button class="btn-danger" id="saveBtn">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("saveBtn").onclick = () => {
    const name = document.getElementById("catName").value.trim();
    const desc = document.getElementById("catDesc").value;

    if (!name) return alert("Category name required");

    new Image().src =
      API_URL +
      `?action=${c ? "editCategory" : "addCategory"}` +
      (c ? `&rowIndex=${c.rowIndex}` : "") +
      `&category_name=${encodeURIComponent(name)}` +
      `&description=${encodeURIComponent(desc)}`;

    closeModal();
    setTimeout(loadCategories, 500);
  };
}

/* ================= DELETE ================= */
function openDeleteModal() {
  if (!selected) return;

  openModal(`
    <div class="modal-header">Delete Category</div>
    <p>Delete <b>${selected.category_name}</b>?</p>
    <div class="modal-actions">
      <button class="btn-danger" id="confirmDelete">Delete</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("confirmDelete").onclick = () => {
    new Image().src =
      API_URL + `?action=deleteCategory&rowIndex=${selected.rowIndex}`;

    closeModal();
    setTimeout(loadCategories, 500);
  };
}