import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let categories = [];

/* ================= ENTRY ================= */
export default function loadCategoriesView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addBtn">+ Add Category</button>
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
              <th>QTY</th>
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
  const res = await fetch(API_URL);
  categories = await res.json();
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("categoryTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  categories.forEach((cat, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${cat.category_name}</td>
      <td>${cat.description}</td>
      <td>${cat.qty || 0}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ================= ACTIONS ================= */
function bindActions() {
  document.getElementById("addBtn").onclick = openAddModal;
}

function openAddModal() {
  openModal(`
    <div class="modal-header">➕ Add Category</div>

    <label>Name</label>
    <input id="catName">

    <label>Description</label>
    <textarea id="catDesc"></textarea>

    <div class="modal-actions">
      <button class="btn-danger" id="saveCat">Save</button>
      <button class="btn-back" id="cancelCat">Cancel</button>
    </div>
  `);

  document.getElementById("cancelCat").onclick = closeModal;
  document.getElementById("saveCat").onclick = saveCategory;
}

/* ================= SAVE (JSON POST – CORRECT) ================= */
async function saveCategory() {
  const name = document.getElementById("catName").value.trim();
  const desc = document.getElementById("catDesc").value.trim();

  if (!name) {
    alert("Category name is required");
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addCategory",
        category_name: name,
        description: desc
      })
    });

    const result = await res.json();

    if (!result.success) {
      alert("Failed to save category");
      return;
    }

    closeModal();
    loadCategories();
  } catch (err) {
    console.error("Save category failed", err);
    alert("Network error while saving category");
  }
}