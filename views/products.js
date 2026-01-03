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
  renderActionBar();
  renderTableLayout();

  await loadCategories();
  await loadProducts();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  const bar = document.getElementById("actionBar");

  bar.innerHTML = `
    <button id="addBtn" class="category-action-btn">➕ Add Product</button>
    <button id="editBtn" class="category-action-btn" disabled>✏️ Edit</button>
    <button id="deleteBtn" class="category-action-btn" disabled>🗑️ Delete</button>
  `;

  document.getElementById("addBtn").onclick = openAddModal;
  document.getElementById("editBtn").onclick = openEditModal;
  document.getElementById("deleteBtn").onclick = deleteProduct;
}

/* ================= TABLE LAYOUT ================= */
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

/* ================= LOAD DATA ================= */
async function loadCategories() {
  const res = await fetch(API_URL + "?type=categories");
  categories = await res.json();
}

async function loadProducts() {
  const res = await fetch(API_URL + "?type=products");
  products = await res.json();

  selected = null;
  document.getElementById("editBtn").disabled = true;
  document.getElementById("deleteBtn").disabled = true;

  renderTable();
}

/* ================= RENDER TABLE ================= */
function renderTable() {
  const body = document.getElementById("productBody");
  body.innerHTML = "";

  if (!products.length) {
    body.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:#888">
          No products found
        </td>
      </tr>
    `;
    return;
  }

  products.forEach((p, i) => {
    const cat = categories.find(c => c.category_id === p.category_id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${p.product_code || ""}</td>
      <td>${p.product_name}</td>
      <td>${cat ? cat.category_name : ""}</td>
      <td>${Number(p.price).toFixed(2)}</td>
      <td>${p.quantity_per_serving || ""}</td>
      <td>${p.unit || ""}</td>
      <td>${p.image_url ? "✔" : "-"}</td>
    `;

    tr.onclick = () => {
      document.querySelectorAll("#productBody tr")
        .forEach(r => r.classList.remove("selected"));

      tr.classList.add("selected");
      selected = p;

      document.getElementById("editBtn").disabled = false;
      document.getElementById("deleteBtn").disabled = false;
    };

    body.appendChild(tr);
  });
}

/* ================= ADD / EDIT ================= */
function openAddModal() {
  openProductModal();
}

function openEditModal() {
  if (!selected) return;
  openProductModal(selected);
}

function openProductModal(p = {}) {
  const categoryOptions = categories.map(c => `
    <option value="${c.category_id}" ${p.category_id === c.category_id ? "selected" : ""}>
      ${c.category_name}
    </option>
  `).join("");

  openModal(`
    <div class="modal-header">${p.rowIndex ? "Edit Product" : "Add Product"}</div>

    <label>Product Code</label>
    <input id="code" value="${p.product_code || ""}">

    <label>Product Name</label>
    <input id="productName" value="${p.product_name || ""}">

    <label>Category</label>
    <select id="category">
      <option value="">-- Select --</option>
      ${categoryOptions}
    </select>

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
    `&category_id=${encodeURIComponent(category.value)}` +
    `&description=${encodeURIComponent(desc.value)}` +
    `&price=${encodeURIComponent(price.value)}` +
    `&quantity_per_serving=${encodeURIComponent(qtyServing.value)}` +
    `&unit=${encodeURIComponent(unit.value)}` +
    `&image_url=${encodeURIComponent(img.value)}`;

  new Image().src = url;
  closeModal();
  setTimeout(loadProducts, 600);
};

/* ================= DELETE ================= */
function deleteProduct() {
  if (!selected) return;
  if (!confirm(`Delete ${selected.product_name}?`)) return;

  new Image().src =
    API_URL + `?action=deleteProduct&rowIndex=${selected.rowIndex}`;

  setTimeout(loadProducts, 600);
}