import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let productsCache = [];
let categoriesCache = [];

/* ================= HELPERS ================= */
function normalizeDriveImageUrl(url) {
  if (!url) return "";
  if (url.includes("drive.google.com/uc?id=")) return url;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/uc?id=${m[1]}` : "";
}

/* ================= LOAD ================= */
async function loadCategories() {
  const r = await fetch(API_URL + "?type=categories");
  categoriesCache = await r.json();
}

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
              <th>#</th><th>Code</th><th>Name</th><th>Category</th>
              <th>Description</th><th>Price</th><th>Image</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="productsBody"></tbody>
        </table>
      </div>
    </div>`;
  bindDataBoxScroll(document.querySelector(".data-box"));

  await loadCategories();
  loadProducts();
}

async function loadProducts() {
  const r = await fetch(API_URL + "?type=products");
  productsCache = await r.json();
  const tb = document.getElementById("productsBody");
  tb.innerHTML = "";

  productsCache.forEach((p, i) => {
    const cat = categoriesCache.find(c => c.category_id === p.category_id);
    const img = normalizeDriveImageUrl(p.image_url);

    tb.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${p.product_code}</td>
        <td>${p.product_name}</td>
        <td>${cat ? cat.category_name : ""}</td>
        <td>${p.description || ""}</td>
        <td>${p.price.toFixed(2)}</td>
        <td>${img ? `<a href="${img}" target="_blank">👁 Preview</a>` : "-"}</td>
        <td>
          <button onclick="editProduct(${i})">Edit</button>
          <button onclick="deleteProduct(${i})">Delete</button>
        </td>
      </tr>`;
  });
}

/* ================= ADD / EDIT ================= */
function openAddProductModal(p = {}) {
  const opts = categoriesCache.map(c =>
    `<option value="${c.category_id}" ${p.category_id === c.category_id ? "selected" : ""}>
      ${c.category_name}</option>`).join("");

  openModal(`
    <div class="modal-header">${p.rowIndex ? "Edit" : "Add"} Product</div>

    <input id="productCode" placeholder="Code" value="${p.product_code || ""}">
    <input id="productName" placeholder="Name" value="${p.product_name || ""}">
    <select id="productCategory"><option value="">Category</option>${opts}</select>
    <textarea id="productDescription">${p.description || ""}</textarea>
    <input id="productPrice" type="number" value="${p.price || ""}">
    <input id="productImageUrl" placeholder="Image URL" value="${p.image_url || ""}">

    <button class="btn-danger" onclick="saveProduct(${p.rowIndex || ""})">Save</button>
    <button class="btn-back" onclick="closeModal()">Cancel</button>
  `);
}

window.saveProduct = rowIndex => {
  const q = new URLSearchParams({
    action: rowIndex ? "editProduct" : "addProduct",
    rowIndex,
    product_code: productCode.value,
    product_name: productName.value,
    category_id: productCategory.value,
    description: productDescription.value,
    price: productPrice.value,
    image_url: normalizeDriveImageUrl(productImageUrl.value)
  });
  new Image().src = API_URL + "?" + q.toString();
  closeModal();
  setTimeout(loadProducts, 600);
};

window.editProduct = i => openAddProductModal(productsCache[i]);

window.deleteProduct = i => {
  if (!confirm("Delete this product?")) return;
  new Image().src =
    API_URL + `?action=deleteProduct&rowIndex=${productsCache[i].rowIndex}`;
  setTimeout(loadProducts, 600);
};