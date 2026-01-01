import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* ================= URLs ================= */

// GET / ADD PRODUCT (JSON)
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

// 🔴 POST IMAGE UPLOAD (googleusercontent URL ONLY)
const UPLOAD_URL =
  "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLgbj-4SCbTpGgcBPUY9ylZXh-clicaeS8DA4CihicRSwKDNigUqQXYlkWi4Dkr1iKMHsYRmAvfK8hqOJDrLwOQ0jU-E2F1bApTnp-mWD1K_15f9zg3bOnEoSqfpBq6_1FkgsvQMgqM5pGAZ2X6hUe1h0y1wC1tbjf_kdt61dCcv0fuIjEJbZ_EBRSOWu4pO9nI_QvtjVruGnEMz0oq6Yb7Td315bIlF45u4jUJre666Vlp3VMZV9gzc9qqbrOiqpjYf6qC8A_4T07xNMaj3BK-F7tpvtg&lib=MJrHeO5UOtvZjUj-Ywv-pGGXl3gJVnX-m";

/* ================= STATE ================= */
let productsCache = [];
let categoriesCache = [];
let uploadedImageUrl = "";

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
        <td colspan="8" style="text-align:center;color:#888;">
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
        <td>${p.product_code || ""}</td>
        <td>${p.product_name}</td>
        <td>${cat ? cat.category_name : p.category_id}</td>
        <td>${p.description || ""}</td>
        <td>${Number(p.price).toFixed(2)}</td>
        <td>
          ${
            p.image_url
              ? `<img src="${p.image_url}" style="height:40px;border-radius:6px;">`
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

/* ================= ADD PRODUCT ================= */
function openAddProductModal() {
  uploadedImageUrl = "";

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

    <label>Image</label>
    <input type="file" id="imageInput" accept="image/*">
    <img id="imagePreview"
         style="margin-top:10px;max-width:100%;display:none;border-radius:6px;">

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveProduct()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("imageInput").onchange = uploadImage;
}

/* ================= IMAGE UPLOAD (FINAL) ================= */
async function uploadImage(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(UPLOAD_URL, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!data.success) {
      alert("Image upload failed");
      console.error(data.error);
      return;
    }

    uploadedImageUrl = data.image_url;

    const img = document.getElementById("imagePreview");
    img.src = uploadedImageUrl;
    img.style.display = "block";

  } catch (err) {
    alert("Upload error");
    console.error(err);
  }
}

/* ================= SAVE PRODUCT ================= */
window.saveProduct = () => {
  const code = document.getElementById("productCode").value.trim();
  const name = document.getElementById("productName").value.trim();
  const categoryId = document.getElementById("productCategory").value;
  const description = document.getElementById("productDescription").value.trim();
  const price = document.getElementById("productPrice").value;

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
    `&image_url=${encodeURIComponent(uploadedImageUrl)}` +
    `&active=true`;

  closeModal();
  setTimeout(loadProducts, 600);
};