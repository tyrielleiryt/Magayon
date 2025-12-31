import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let productsCache = [];
let categoriesCache = [];

/* ================= LOAD CATEGORIES ================= */
async function loadCategories() {
  const res = await fetch(API_URL + "?type=categories");
  categoriesCache = await res.json();
}

/* ================= ENTRY ================= */
export default async function loadProductsView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addProductBtn" class="category-action-btn">
      + Add Product
    </button>
  `;

  document.getElementById("addProductBtn").onclick = openAddProductModal;

  const contentBox = document.getElementById("contentBox");
  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table product-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="productsBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(contentBox.querySelector(".data-box"));

  await loadCategories();   // ✅ REQUIRED
  loadProducts();
}

/* ================= LOAD PRODUCTS ================= */
async function loadProducts() {
  const res = await fetch(API_URL + "?type=products");
  productsCache = await res.json();

  const tbody = document.getElementById("productsBody");
  tbody.innerHTML = "";

  if (!productsCache.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="color:#888;text-align:center;">
          No products yet
        </td>
      </tr>
    `;
    return;
  }

  productsCache.forEach((p, i) => {
    const cat = categoriesCache.find(c => c.category_id === p.category_id);

    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${p.product_name}</td>
        <td>${cat ? cat.category_name : p.category_id}</td>
        <td>${Number(p.price).toFixed(2)}</td>
        <td>
          <button class="btn-edit" onclick="editProduct(${i})">Edit</button>
          <button class="btn-delete" onclick="deleteProduct(${i})">Delete</button>
        </td>
      </tr>
    `;
  });
}

/* ================= ADD PRODUCT ================= */
function openAddProductModal() {
  const categoryOptions = categoriesCache
    .map(
      c => `<option value="${c.category_id}">${c.category_name}</option>`
    )
    .join("");

  openModal(`
    <div class="modal-header">Add Product</div>

    <label>Product Code</label>
    <input id="productCode">

    <label>Product Name</label>
    <input id="productName">

    <label>Category</label>
    <select id="productCategory">
      <option value="">-- Select Category --</option>
      ${categoryOptions}
    </select>

    <label>Price</label>
    <input id="productPrice" type="number" step="0.01">

    <label>Image URL</label>
    <input id="productImage">

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveProduct()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

/* ================= SAVE PRODUCT ================= */
window.saveProduct = () => {
  const code = document.getElementById("productCode").value.trim();
  const name = document.getElementById("productName").value.trim();
  const categoryId = document.getElementById("productCategory").value;
  const price = document.getElementById("productPrice").value;
  const image = document.getElementById("productImage").value.trim();

  if (!name) return alert("Product name required");
  if (!categoryId) return alert("Please select a category");

  new Image().src =
    API_URL +
    `?action=addProduct` +
    `&product_code=${encodeURIComponent(code)}` +
    `&product_name=${encodeURIComponent(name)}` +
    `&category_id=${encodeURIComponent(categoryId)}` +
    `&price=${encodeURIComponent(price)}` +
    `&image_url=${encodeURIComponent(image)}` +
    `&active=true`;

  closeModal();
  setTimeout(loadProducts, 600);
};

/* ================= PLACEHOLDERS ================= */
window.editProduct = i => {
  alert("Edit product — next step");
};

window.deleteProduct = i => {
  alert("Delete product — next step");
};