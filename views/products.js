import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* ================= API ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let products = [];
let categories = [];
let selected = null;

/* ================= ENTRY ================= */
export default async function loadProductsView() {
  await loadCategories();
  renderActionBar();
  renderTableLayout();
  loadProducts();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addBtn" class="category-action-btn">➕ Add Product</button>
    <button id="editBtn" class="category-action-btn" disabled>✏️ Edit</button>
    <button id="deleteBtn" class="category-action-btn" disabled>🗑️ Delete</button>
  `;

  addBtn.onclick = openAddModal;
  editBtn.onclick = openEditModal;
  deleteBtn.onclick = openDeleteModal;
}

/* ================= TABLE ================= */
function renderTableLayout() {
  const box = document.getElementById("contentBox");

  box.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table product-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Qty / Serving</th>
              <th>Unit</th>
              <th>Image</th>
            </tr>
          </thead>
          <tbody id="productBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(box.querySelector(".data-box"));
}

/* ================= LOAD ================= */
async function loadCategories() {
  categories = await (await fetch(API_URL + "?type=categories")).json();
}

async function loadProducts() {
  products = await (await fetch(API_URL + "?type=products")).json();
  selected = null;
  editBtn.disabled = deleteBtn.disabled = true;
  renderTable();
}

function renderTable() {
  const body = document.getElementById("productBody");
  body.innerHTML = "";

  products.forEach((p, i) => {
    const cat = categories.find(c => c.category_id === p.category_id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${p.product_code}</td>
      <td>${p.product_name}</td>
      <td>${cat?.category_name || ""}</td>
      <td>${p.price}</td>
      <td>${p.quantity_per_serving}</td>
      <td>${p.unit}</td>
      <td>${p.image_url ? "✔" : "-"}</td>
    `;

    tr.onclick = () => {
      document.querySelectorAll("#productBody tr")
        .forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selected = p;
      editBtn.disabled = deleteBtn.disabled = false;
    };

    body.appendChild(tr);
  });
}

/* ================= ADD / EDIT MODAL ================= */
function openAddModal() {
  openProductModal();
}

function openEditModal() {
  if (!selected) return;
  openProductModal(selected);
}

function openProductModal(p = {}) {
  const catOptions = categories.map(c =>
    `<option value="${c.category_id}" ${p.category_id === c.category_id ? "selected" : ""}>
      ${c.category_name}
    </option>`
  ).join("");

  openModal(`
    <div class="modal-header">${p.rowIndex ? "Edit" : "Add"} Product</div>

    <label>Product Code</label>
    <input id="code" value="${p.product_code || ""}">

    <label>Product Name</label>
    <input id="name" value="${p.product_name || ""}">

    <label>Category</label>
    <select id="category">${catOptions}</select>

    <label>Description</label>
    <textarea id="desc">${p.description || ""}</textarea>

    <label>Price</label>
    <input type="number" id="price" value="${p.price || ""}">

    <label>Quantity per Serving</label>
    <input type="number" id="qtyServing" value="${p.quantity_per_serving || ""}">

    <label>Unit (e.g. g, ml, pcs)</label>
    <input id="unit" value="${p.unit || ""}">

    <label>Image URL</label>
    <input id="img" value="${p.image_url || ""}">

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveProduct(${p.rowIndex || 0})">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

/* ================= SAVE ================= */
window.saveProduct = rowIndex => {
  const url =
    API_URL +
    `?action=${rowIndex ? "editProduct" : "addProduct"}` +
    (rowIndex ? `&rowIndex=${rowIndex}` : "") +
    `&product_code=${encodeURIComponent(code.value)}` +
    `&product_name=${encodeURIComponent(name.value)}` +
    `&category_id=${category.value}` +
    `&description=${encodeURIComponent(desc.value)}` +
    `&price=${price.value}` +
    `&quantity_per_serving=${qtyServing.value}` +
    `&unit=${encodeURIComponent(unit.value)}` +
    `&image_url=${encodeURIComponent(img.value)}`;

  new Image().src = url;
  closeModal();
  setTimeout(loadProducts, 600);
};

/* ================= DELETE ================= */
function openDeleteModal() {
  if (!selected) return;

  if (!confirm(`Delete ${selected.product_name}?`)) return;

  new Image().src =
    API_URL + `?action=deleteProduct&rowIndex=${selected.rowIndex}`;

  setTimeout(loadProducts, 600);
}