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

  // Already direct
  if (url.includes("drive.google.com/uc?id=")) return url;

  // Extract ID from common Drive links
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return "";

  return `https://drive.google.com/uc?id=${match[1]}`;
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
              <th>Product Code</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Description</th>
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

  if (!productsCache.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:#888">
          No products yet
        </td>
      </tr>
    `;
    return;
  }

  productsCache.forEach((p, i) => {
    const cat = categoriesCache.find(c => c.category_id === p.category_id);
    const imgUrl = normalizeDriveImageUrl(p.image_url);

    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${p.product_code || ""}</td>
        <td>${p.product_name}</td>
        <td>${cat ? cat.category_name : p.category_id}</td>
        <td>${p.description || ""}</td>
        <td>${Number(p.price).toFixed(2)}</td>
        <td>
          ${
            imgUrl
              ? `<img
                   src="${imgUrl}"
                   referrerpolicy="no-referrer"
                   style="height:40px;width:40px;object-fit:cover;border-radius:6px;"
                 >`
              : "-"
          }
        </td>
        <td>
          <button class="btn-edit">Edit</button>
          <button class="btn-delete">Delete</button>
        </td>
      </tr>
    `;
  });
}

/* ================= ADD PRODUCT MODAL ================= */
function openAddProductModal() {
  const categoryOptions = categoriesCache
    .map(c => `<option value="${c.category_id}">${c.category_name}</option>`)
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

    <label>Description</label>
    <textarea id="productDescription"></textarea>

    <label>Price</label>
    <input id="productPrice" type="number" step="0.01">

    <label>Image URL (Google Drive allowed)</label>
    <input id="productImageUrl" placeholder="Paste Google Drive link here">

    <img
      id="imagePreview"
      referrerpolicy="no-referrer"
      style="
        display:none;
        margin-top:12px;
        width:100%;
        max-height:180px;
        object-fit:contain;
        border-radius:8px;
        background:#f4f4f4;
      "
    >

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveProduct()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  /* LIVE IMAGE PREVIEW */
  document.getElementById("productImageUrl").addEventListener("input", e => {
    const img = document.getElementById("imagePreview");
    const normalized = normalizeDriveImageUrl(e.target.value.trim());

    if (!normalized) {
      img.style.display = "none";
      img.src = "";
      return;
    }

    img.style.display = "block";
    img.style.opacity = "0";
    img.src = "";

    setTimeout(() => {
      img.src = normalized;
      img.style.opacity = "1";
    }, 50);

    img.onerror = () => {
      img.style.display = "none";
    };
  });
}

/* ================= SAVE PRODUCT ================= */
window.saveProduct = () => {
  const code = document.getElementById("productCode").value.trim();
  const name = document.getElementById("productName").value.trim();
  const categoryId = document.getElementById("productCategory").value;
  const description = document.getElementById("productDescription").value.trim();
  const price = document.getElementById("productPrice").value;
  const imageUrl = normalizeDriveImageUrl(
    document.getElementById("productImageUrl").value.trim()
  );

  if (!name) return alert("Product name required");
  if (!categoryId) return alert("Please select a category");

  new Image().src =
    API_URL +
    `?action=addProduct` +
    `&product_code=${encodeURIComponent(code)}` +
    `&product_name=${encodeURIComponent(name)}` +
    `&category_id=${encodeURIComponent(categoryId)}` +
    `&description=${encodeURIComponent(description)}` +
    `&price=${encodeURIComponent(price)}` +
    `&image_url=${encodeURIComponent(imageUrl)}` +
    `&active=true`;

  closeModal();
  setTimeout(loadProducts, 600);
};