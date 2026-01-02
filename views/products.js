import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* ================= API ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let productsCache = [];
let categoriesCache = [];

/* ================= JSONP ================= */
function jsonp(url, callbackName) {
  return new Promise(resolve => {
    window[callbackName] = data => resolve(data);
    const s = document.createElement("script");
    s.src = `${url}&callback=${callbackName}`;
    document.body.appendChild(s);
  });
}

/* ================= HELPERS ================= */
function normalizeDriveImageUrl(url) {
  if (!url) return "";
  if (url.includes("drive.google.com/uc?id=")) return url;

  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) return "";

  return `https://drive.google.com/uc?id=${m[1]}`;
}

/* ================= LOADERS ================= */
async function loadCategories() {
  categoriesCache = await jsonp(
    API_URL + "?type=categories",
    "cbCategories"
  );
}

async function loadProducts() {
  productsCache = await jsonp(
    API_URL + "?type=products",
    "cbProducts"
  );
  renderProducts();
}

/* ================= ENTRY ================= */
export default async function loadProductsView() {
  document.getElementById("actionBar").innerHTML =
    `<button class="category-action-btn" id="addProductBtn">+ Add Product</button>`;

  document.getElementById("addProductBtn").onclick = openAddProductModal;

  document.getElementById("contentBox").innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Image</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="productsBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));

  await loadCategories();
  await loadProducts();
}

/* ================= RENDER ================= */
function renderProducts() {
  const tbody = document.getElementById("productsBody");
  tbody.innerHTML = "";

  if (!productsCache.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:#888">
          No products yet
        </td>
      </tr>`;
    return;
  }

  productsCache.forEach((p, i) => {
    const cat = categoriesCache.find(c => c.category_id === p.category_id);
    const img = normalizeDriveImageUrl(p.image_url);

    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${p.product_code}</td>
        <td>${p.product_name}</td>
        <td>${cat ? cat.category_name : "-"}</td>
        <td>${Number(p.price).toFixed(2)}</td>
        <td>
          ${img ? `<a href="${img}" target="_blank" class="btn-preview">👁 Preview</a>` : "—"}
        </td>
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
  openProductModal();
}

/* ================= EDIT PRODUCT ================= */
window.editProduct = index => {
  const p = productsCache[index];
  openProductModal(p);
};

/* ================= DELETE PRODUCT ================= */
window.deleteProduct = index => {
  const p = productsCache[index];

  if (!confirm(`Delete "${p.product_name}"?`)) return;

  new Image().src =
    API_URL +
    `?action=deleteProduct` +
    `&rowIndex=${encodeURIComponent(p.rowIndex)}`;

  setTimeout(loadProducts, 500);
};

/* ================= PRODUCT MODAL (ADD + EDIT) ================= */
function openProductModal(product = null) {
  const categoryOptions = categoriesCache
    .map(
      c =>
        `<option value="${c.category_id}" ${
          product && product.category_id === c.category_id ? "selected" : ""
        }>${c.category_name}</option>`
    )
    .join("");

  openModal(`
    <div class="modal-header">
      ${product ? "Edit Product" : "Add Product"}
    </div>

    <label>Product Code</label>
    <input id="productCode" value="${product?.product_code || ""}">

    <label>Product Name</label>
    <input id="productName" value="${product?.product_name || ""}">

    <label>Category</label>
    <select id="productCategory">
      <option value="">-- Select --</option>
      ${categoryOptions}
    </select>

    <label>Price</label>
    <input id="productPrice" type="number" value="${product?.price || ""}">

    <label>Image URL</label>
    <input id="productImageUrl" value="${product?.image_url || ""}">

    <button id="previewBtn" class="btn-preview" style="display:none">
      👁 Preview Image
    </button>

    <div class="modal-actions">
      <button class="btn-danger" id="saveBtn">
        ${product ? "Update" : "Save"}
      </button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  const input = document.getElementById("productImageUrl");
  const btn = document.getElementById("previewBtn");
  const saveBtn = document.getElementById("saveBtn");

  input.oninput = () => {
    const url = normalizeDriveImageUrl(input.value.trim());
    if (!url) {
      btn.style.display = "none";
      return;
    }
    btn.style.display = "inline-flex";
    btn.onclick = () => window.open(url, "_blank");
  };

  saveBtn.onclick = () => saveProduct(product);
}

/* ================= SAVE ================= */
function saveProduct(product) {
  const img = normalizeDriveImageUrl(
    document.getElementById("productImageUrl").value.trim()
  );

  const base =
    API_URL +
    `?product_code=${encodeURIComponent(document.getElementById("productCode").value)}` +
    `&product_name=${encodeURIComponent(document.getElementById("productName").value)}` +
    `&category_id=${encodeURIComponent(document.getElementById("productCategory").value)}` +
    `&price=${encodeURIComponent(document.getElementById("productPrice").value)}` +
    `&image_url=${encodeURIComponent(img)}`;

  new Image().src = product
    ? `${base}&action=editProduct&rowIndex=${product.rowIndex}`
    : `${base}&action=addProduct`;

  closeModal();
  setTimeout(loadProducts, 500);
}