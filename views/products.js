import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* ================= API ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let products = [];
let categories = [];
let inventoryItems = [];
let selected = null;

/* ================= ENTRY ================= */
export default async function loadProductsView() {
  renderActionBar();
  renderTableLayout();

  await loadCategories();
  await loadInventoryItems();
  await loadProducts();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addBtn" class="category-action-btn">➕ Add Product</button>
    <button id="editBtn" class="category-action-btn" disabled>✏️ Edit</button>
    <button id="deleteBtn" class="category-action-btn" disabled>🗑️ Delete</button>
  `;

  addBtn.onclick = () => openProductModal();
  editBtn.onclick = () => selected && openProductModal(selected);
  deleteBtn.onclick = deleteProduct;
}

/* ================= TABLE ================= */
function renderTableLayout() {
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
            </tr>
          </thead>
          <tbody id="productBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
}

/* ================= LOAD DATA ================= */
async function loadCategories() {
  categories = await fetch(API_URL + "?type=categories").then(r => r.json());
}

async function loadInventoryItems() {
  inventoryItems = await fetch(API_URL + "?type=inventoryItems").then(r => r.json());
}

async function loadProducts() {
  products = await fetch(API_URL + "?type=products").then(r => r.json());
  selected = null;
  editBtn.disabled = true;
  deleteBtn.disabled = true;
  renderTable();
}

/* ================= RENDER TABLE ================= */
function renderTable() {
  const body = document.getElementById("productBody");
  body.innerHTML = "";

  if (!products.length) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888">No products</td></tr>`;
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
      <td>₱${Number(p.price).toFixed(2)}</td>
      <td>${p.image_url ? "✔" : "-"}</td>
    `;

    tr.onclick = () => {
      document.querySelectorAll("#productBody tr").forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selected = p;
      editBtn.disabled = false;
      deleteBtn.disabled = false;
    };

    body.appendChild(tr);
  });
}

/* ================= PRODUCT MODAL ================= */
function openProductModal(p = {}) {
  const catOptions = categories.map(c =>
    `<option value="${c.category_id}" ${p.category_id === c.category_id ? "selected" : ""}>
      ${c.category_name}
    </option>`
  ).join("");

  openModal(`
    <div class="modal-header">${p.product_id ? "Edit Product" : "Add Product"}</div>

    <label>Product Name</label>
    <input id="prodName" value="${p.product_name || ""}">

    <label>Category</label>
    <select id="prodCategory">${catOptions}</select>

    <label>Price</label>
    <input type="number" id="prodPrice" value="${p.price || ""}">

    <label>Image URL</label>
    <input id="prodImage" value="${p.image_url || ""}">

    <hr>
    <h4>Product Recipe</h4>

    <table class="category-table">
      <thead>
        <tr>
          <th>Inventory Item</th>
          <th>Qty Used</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="recipeBody"></tbody>
    </table>

    <button class="category-action-btn" onclick="addRecipeRow()">+ Add Ingredient</button>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveProductWithRecipe('${p.product_id || ""}')">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  if (p.product_id) loadExistingRecipe(p.product_id);
  else addRecipeRow();
}

/* ================= RECIPE ================= */
window.addRecipeRow = (itemId = "", qty = 1) => {
  const rowId = "r" + Date.now();

  document.getElementById("recipeBody").insertAdjacentHTML("beforeend", `
    <tr id="${rowId}">
      <td>
        <select class="recipe-item">
          ${inventoryItems.map(i =>
            `<option value="${i.item_id}" ${i.item_id === itemId ? "selected" : ""}>
              ${i.item_name}
            </option>`
          ).join("")}
        </select>
      </td>
      <td><input type="number" class="recipe-qty" value="${qty}" min="0.01" step="0.01"></td>
      <td><button onclick="document.getElementById('${rowId}').remove()">✕</button></td>
    </tr>
  `);
};

async function loadExistingRecipe(productId) {
  const recipes = await fetch(API_URL + `?type=productRecipes&product_id=${productId}`)
    .then(r => r.json());

  document.getElementById("recipeBody").innerHTML = "";
  recipes.forEach(r => addRecipeRow(r.item_id, r.qty_used));
}

/* ================= SAVE ================= */
window.saveProductWithRecipe = async productId => {
  const name = prodName.value.trim();
  if (!name) return alert("Product name required");

  const productParams = new URLSearchParams({
    product_name: name,
    category_id: prodCategory.value,
    price: prodPrice.value,
    image_url: prodImage.value
  });

  let res;
  if (productId) {
    productParams.append("product_id", productId);
    res = await fetch(API_URL + `?action=editProduct&${productParams}`);
  } else {
    res = await fetch(API_URL + `?action=addProduct&${productParams}`);
  }

  const data = await res.json();
  const pid = productId || data.product_id;

  const recipes = [...document.querySelectorAll("#recipeBody tr")].map(tr => ({
    item_id: tr.querySelector(".recipe-item").value,
    qty_used: tr.querySelector(".recipe-qty").value
  }));

  await fetch(
    API_URL +
    `?action=saveProductRecipes` +
    `&product_id=${pid}` +
    `&recipes=${encodeURIComponent(JSON.stringify(recipes))}`
  );

  closeModal();
  setTimeout(loadProducts, 600);
};

/* ================= DELETE ================= */
function deleteProduct() {
  if (!selected) return;
  if (!confirm(`Delete ${selected.product_name}?`)) return;

  fetch(API_URL + `?action=deleteProduct&rowIndex=${selected.rowIndex}`);
  setTimeout(loadProducts, 600);
}