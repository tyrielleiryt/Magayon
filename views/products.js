import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* ================= API ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let productsCache = [];
let categoriesCache = [];

let currentPage = 1;
const PAGE_SIZE = 10;
let searchQuery = "";

/* ================= HELPERS ================= */
function normalizeDriveImageUrl(url) {
  if (!url) return "";

  if (url.includes("drive.google.com/uc?id=")) return url;

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
    <input
      type="text"
      id="productSearch"
      placeholder="Search product..."
    />
    <button id="addProductBtn" class="category-action-btn">
      + Add Product
    </button>
  `;

  document.getElementById("addProductBtn").onclick = openAddProductModal;
  document.getElementById("productSearch").oninput = e => {
    searchQuery = e.target.value.toLowerCase();
    currentPage = 1;
    renderProducts();
  };

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
      <div id="pagination" class="pagination"></div>
    </div>
  `;

  bindDataBoxScroll(contentBox.querySelector(".data-box"));

  await loadCategories();
  await loadProducts();
}

/* ================= LOAD PRODUCTS ================= */
async function loadProducts() {
  const res = await fetch(API_URL + "?type=products");
  productsCache = await res.json();
  renderProducts();
}

/* ================= RENDER ================= */
function renderProducts() {
  const tbody = document.getElementById("productsBody");
  const pagination = document.getElementById("pagination");
  tbody.innerHTML = "";
  pagination.innerHTML = "";

  const filtered = productsCache.filter(p =>
    (
      p.product_name +
      p.product_code +
      p.description
    ).toLowerCase().includes(searchQuery)
  );

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;color:#888">
          No products found
        </td>
      </tr>
    `;
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  pageItems.forEach((p, i) => {
    const cat = categoriesCache.find(c => c.category_id === p.category_id);
    const imgUrl = normalizeDriveImageUrl(p.image_url);

    tbody.innerHTML += `
      <tr>
        <td>${start + i + 1}</td>
        <td>${p.product_code || ""}</td>
        <td>${p.product_name}</td>
        <td>${cat ? cat.category_name : ""}</td>
        <td>${p.description || ""}</td>
        <td>${Number(p.price).toFixed(2)}</td>
        <td>
          ${
            imgUrl
              ? `<a href="${imgUrl}" target="_blank" class="btn-preview">👁 Preview</a>`
              : `<span style="color:#aaa">No image</span>`
          }
        </td>
        <td>
          <button class="btn-edit" onclick="editProduct(${p.rowIndex})">Edit</button>
          <button class="btn-delete" onclick="deleteProduct(${p.rowIndex})">Delete</button>
        </td>
      </tr>
    `;
  });

  /* Pagination */
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.classList.add("active-page");
    btn.onclick = () => {
      currentPage = i;
      renderProducts();
    };
    pagination.appendChild(btn);
  }
}

/* ================= ADD PRODUCT ================= */
function openAddProductModal() {
  openProductModal("Add Product", {});
}

/* ================= EDIT PRODUCT ================= */
window.editProduct = rowIndex => {
  const product = productsCache.find(p => p.rowIndex === rowIndex);
  if (!product) return;

  openProductModal("Edit Product", product);
};

/* ================= DELETE PRODUCT ================= */
window.deleteProduct = rowIndex => {
  if (!confirm("Delete this product?")) return;

  fetch(API_URL + `?action=deleteProduct&rowIndex=${rowIndex}`)
    .then(() => loadProducts());
};

/* ================= PRODUCT MODAL ================= */
function openProductModal(title, data) {
  const categoryOptions = categoriesCache
    .map(c =>
      `<option value="${c.category_id}" ${
        data.category_id === c.category_id ? "selected" : ""
      }>${c.category_name}</option>`
    )
    .join("");

  openModal(`
    <div class="modal-header">${title}</div>

    <label>Product Code</label>
    <input id="productCode" value="${data.product_code || ""}">

    <label>Product Name</label>
    <input id="productName" value="${data.product_name || ""}">

    <label>Category</label>
    <select id="productCategory">
      <option value="">-- Select Category --</option>
      ${categoryOptions}
    </select>

    <label>Description</label>
    <textarea id="productDescription">${data.description || ""}</textarea>

    <label>Price</label>
    <input id="productPrice" type="number" value="${data.price || 0}">

    <label>Image URL</label>
    <input id="productImageUrl" value="${data.image_url || ""}">

    <button id="previewBtn" class="btn-preview" style="margin-top:10px;">
      👁 Preview Image
    </button>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveProduct(${data.rowIndex || 0})">
        Save
      </button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("previewBtn").onclick = () => {
    const url = normalizeDriveImageUrl(
      document.getElementById("productImageUrl").value.trim()
    );
    if (url) window.open(url, "_blank");
  };
}

/* ================= SAVE PRODUCT ================= */
window.saveProduct = rowIndex => {
  const code = document.getElementById("productCode").value.trim();
  const name = document.getElementById("productName").value.trim();
  const categoryId = document.getElementById("productCategory").value;
  const description = document.getElementById("productDescription").value.trim();
  const price = document.getElementById("productPrice").value;
  const imageUrl = normalizeDriveImageUrl(
    document.getElementById("productImageUrl").value.trim()
  );

  if (!name) return alert("Product name required");

  const action = rowIndex ? "editProduct" : "addProduct";

  fetch(
    API_URL +
      `?action=${action}` +
      (rowIndex ? `&rowIndex=${rowIndex}` : "") +
      `&product_code=${encodeURIComponent(code)}` +
      `&product_name=${encodeURIComponent(name)}` +
      `&category_id=${encodeURIComponent(categoryId)}` +
      `&description=${encodeURIComponent(description)}` +
      `&price=${encodeURIComponent(price)}` +
      `&image_url=${encodeURIComponent(imageUrl)}`
  ).then(() => {
    closeModal();
    loadProducts();
  });
};