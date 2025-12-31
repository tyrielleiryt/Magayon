import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let productsCache = [];

export default function loadProductsView() {
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
              <th>Category ID</th>
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
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${p.product_name}</td>
        <td>${p.category_id}</td>
        <td>${p.price}</td>
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
  openModal(`
    <div class="modal-header">Add Product</div>

    <label>Product Code</label>
    <input id="productCode">

    <label>Product Name</label>
    <input id="productName">

    <label>Category ID</label>
    <input id="productCategory">

    <label>Price</label>
    <input id="productPrice" type="number">

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
  const categoryId = document.getElementById("productCategory").value.trim();
  const price = document.getElementById("productPrice").value;
  const image = document.getElementById("productImage").value.trim();

  if (!name) return alert("Product name required");

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