import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let productsCache = [];
let selectedProduct = null;

/* ================= ENTRY ================= */
export default function loadProductsView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addProductBtn" class="category-action-btn">+ Add Product</button>
    <button id="editProductBtn" class="category-action-btn" disabled>✏️ Edit Product</button>
    <button id="deleteProductBtn" class="category-action-btn" disabled>🗑 Delete Product</button>
  `;

  document.getElementById("addProductBtn").onclick = openAddProductModal;
  document.getElementById("editProductBtn").onclick = () =>
    openEditProductModal(selectedProduct);
  document.getElementById("deleteProductBtn").onclick = () =>
    openDeleteProductModal(selectedProduct);

  const contentBox = document.getElementById("contentBox");
  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table product-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Code</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Description</th>
              <th>Price</th>
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
        <td colspan="6" style="text-align:center;color:#888;">
          No products yet
        </td>
      </tr>
    `;
    return;
  }

  productsCache.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.dataset.id = p.product_id;

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${p.code}</td>
      <td>${p.product_name}</td>
      <td>${p.category}</td>
      <td>${p.description}</td>
      <td>${p.price}</td>
    `;

    tr.onclick = () => selectProduct(tr);
    tbody.appendChild(tr);
  });
}

/* ================= ROW SELECT ================= */
function selectProduct(tr) {
  document
    .querySelectorAll("#productsBody tr")
    .forEach(r => r.classList.remove("selected"));

  tr.classList.add("selected");
  selectedProduct = tr.dataset.id;

  document.getElementById("editProductBtn").disabled = false;
  document.getElementById("deleteProductBtn").disabled = false;
}

/* ================= ADD ================= */
function openAddProductModal() {
  openModal(`
    <div class="modal-header">➕ Add Product</div>

    <label>Product Code</label>
    <input id="prodCode">

    <label>Product Name</label>
    <input id="prodName">

    <label>Category</label>
    <input id="prodCategory">

    <label>Description</label>
    <textarea id="prodDesc"></textarea>

    <label>Price</label>
    <input id="prodPrice" type="number">

    <div class="modal-actions">
      <button class="btn-danger" id="saveAdd">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("saveAdd").onclick = () => {
    const img = new Image();
    img.src =
      API_URL +
      `?action=addProduct` +
      `&code=${encodeURIComponent(prodCode.value)}` +
      `&product_name=${encodeURIComponent(prodName.value)}` +
      `&category=${encodeURIComponent(prodCategory.value)}` +
      `&description=${encodeURIComponent(prodDesc.value)}` +
      `&price=${encodeURIComponent(prodPrice.value)}`;

    closeModal();
    setTimeout(loadProducts, 600);
  };
}

/* ================= EDIT ================= */
function openEditProductModal(productId) {
  const p = productsCache.find(x => x.product_id === productId);
  if (!p) return;

  openModal(`
    <div class="modal-header">✏️ Edit Product</div>

    <label>Product Code</label>
    <input id="prodCode" value="${p.code}">

    <label>Product Name</label>
    <input id="prodName" value="${p.product_name}">

    <label>Category</label>
    <input id="prodCategory" value="${p.category}">

    <label>Description</label>
    <textarea id="prodDesc">${p.description}</textarea>

    <label>Price</label>
    <input id="prodPrice" type="number" value="${p.price}">

    <div class="modal-actions">
      <button class="btn-danger" id="saveEdit">Save Changes</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("saveEdit").onclick = () => {
    const img = new Image();
    img.src =
      API_URL +
      `?action=editProduct` +
      `&product_id=${productId}` +
      `&code=${encodeURIComponent(prodCode.value)}` +
      `&product_name=${encodeURIComponent(prodName.value)}` +
      `&category=${encodeURIComponent(prodCategory.value)}` +
      `&description=${encodeURIComponent(prodDesc.value)}` +
      `&price=${encodeURIComponent(prodPrice.value)}`;

    closeModal();
    setTimeout(loadProducts, 600);
  };
}

/* ================= DELETE ================= */
function openDeleteProductModal(productId) {
  const p = productsCache.find(x => x.product_id === productId);
  if (!p) return;

  openModal(`
    <div class="modal-header danger">🗑 Delete Product</div>

    <p>
      Are you sure you want to delete
      <strong>${p.product_name}</strong>?
    </p>

    <div class="modal-actions">
      <button class="btn-danger" id="confirmDelete">Delete</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("confirmDelete").onclick = () => {
    const img = new Image();
    img.src =
      API_URL +
      `?action=deleteProduct&product_id=${productId}`;

    closeModal();
    setTimeout(loadProducts, 600);
  };
}