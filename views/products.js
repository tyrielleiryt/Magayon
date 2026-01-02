import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* ================= API ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let productsCache = [];
let categoriesCache = [];

/* ================= HELPERS ================= */
function normalizeDriveImageUrl(url) {
  if (!url) return "";
  if (url.includes("drive.google.com/uc?id=")) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? `https://drive.google.com/uc?id=${match[1]}` : "";
}

/* ================= LOAD CATEGORIES ================= */
async function loadCategories() {
  const res = await fetch(API_URL + "?type=categories");
  categoriesCache = await res.json();
}

/* ================= ENTRY ================= */
export default async function loadProductsView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addProductBtn" class="category-action-btn">+ Add Product</button>
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

  bindDataBoxScroll(contentBox.querySelector(".data-box"));
  await loadCategories();
  loadProducts();
}

/* ================= LOAD PRODUCTS ================= */
async function loadProducts() {
  const res = await fetch(API_URL + "?type=products");
  productsCache = await res.json();

  const tbody = document.getElementById("productsBody");
  tbody.innerHTML = "";

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
          ${
            img
              ? `<a href="${img}" target="_blank" class="btn-preview">👁 Preview</a>`
              : `<span style="color:#aaa">No image</span>`
          }
        </td>
        <td>
          <button class="btn-edit" onclick="editProduct(${i})">Edit</button>
        </td>
      </tr>
    `;
  });
}

/* ================= ADD PRODUCT ================= */
function openAddProductModal() {
  openProductModal("Add Product", {}, saveProduct);
}

/* ================= EDIT PRODUCT ================= */
window.editProduct = index => {
  openProductModal("Edit Product", productsCache[index], updateProduct);
};

/* ================= MODAL SHARED ================= */
function openProductModal(title, p, onSave) {
  const options = categoriesCache
    .map(c =>
      `<option value="${c.category_id}" ${c.category_id === p.category_id ? "selected" : ""}>
        ${c.category_name}
      </option>`
    ).join("");

  openModal(`
    <div class="modal-header">${title}</div>

    <label>Code</label>
    <input id="code" value="${p.product_code || ""}">

    <label>Name</label>
    <input id="name" value="${p.product_name || ""}">

    <label>Category</label>
    <select id="category">${options}</select>

    <label>Description</label>
    <textarea id="desc">${p.description || ""}</textarea>

    <label>Price</label>
    <input id="price" type="number" step="0.01" value="${p.price || 0}">

    <label>Image URL</label>
    <input id="image" value="${p.image_url || ""}">

    <button id="previewBtn" class="btn-preview" style="display:none">👁 Preview Image</button>

    <div class="modal-actions">
      <button class="btn-danger" id="saveBtn">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  const imgInput = document.getElementById("image");
  const previewBtn = document.getElementById("previewBtn");

  const refresh = () => {
    const url = normalizeDriveImageUrl(imgInput.value);
    if (!url) return (previewBtn.style.display = "none");
    previewBtn.style.display = "inline-flex";
    previewBtn.onclick = () => window.open(url, "_blank");
  };

  imgInput.addEventListener("input", refresh);
  refresh();

  document.getElementById("saveBtn").onclick = () => onSave(p?.rowIndex);
}

/* ================= SAVE ================= */
function saveProduct() {
  submitProduct("addProduct");
}

function updateProduct(rowIndex) {
  submitProduct("editProduct", rowIndex);
}

function submitProduct(action, rowIndex) {
  const params = new URLSearchParams({
    action,
    rowIndex,
    product_code: document.getElementById("code").value,
    product_name: document.getElementById("name").value,
    category_id: document.getElementById("category").value,
    description: document.getElementById("desc").value,
    price: document.getElementById("price").value,
    image_url: normalizeDriveImageUrl(document.getElementById("image").value)
  });

  new Image().src = `${API_URL}?${params.toString()}`;
  closeModal();
  setTimeout(loadProducts, 500);
}