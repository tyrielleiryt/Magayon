import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let categories = [];
let selectedIndex = null;

export default function loadCategoriesView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addBtn">+ Add Category</button>
    <button id="editBtn">Edit</button>
    <button id="deleteBtn">Delete</button>
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
      document.querySelectorAll("#categoryTableBody tr")
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
  document.getElementById("saveCat").onclick = async () => {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        category_name: document.getElementById("catName").value,
        description: document.getElementById("catDesc").value
      })
    });
    closeModal();
    loadCategories();
  };
}