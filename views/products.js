import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

window.closeModal = closeModal;

/* ================= STATE ================= */
let products = [];
let categories = [];
let inventoryMap = {};
let selected = null;

/* ================= ENTRY ================= */
export default async function loadProductsView() {
  renderActionBar();
  renderTableLayout();
  await loadCategories();
  await loadProducts();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  const bar = document.getElementById("actionBar");

  bar.innerHTML = `
    <button id="addBtn" class="category-action-btn">➕ Add Product</button>
    <button id="editBtn" class="category-action-btn" disabled>✏️ Edit</button>
    <button id="deleteBtn" class="category-action-btn" disabled>🗑️ Delete</button>
  `;

  document.getElementById("addBtn").onclick = () => openProductModal();
  document.getElementById("editBtn").onclick = () => selected && openProductModal(selected);
  document.getElementById("deleteBtn").onclick = deleteProduct;
}

/* ================= TABLE ================= */
function renderTableLayout() {
  const box = document.getElementById("contentBox");

  box.innerHTML = `
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
            </tr>
          </thead>
          <tbody id="productBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(box.querySelector(".data-box"));
}

/* ================= LOAD DATA ================= */
async function loadCategories() {
  categories = await fetch(API_URL + "?type=categories").then(r => r.json());
}

async function loadProducts() {
  products = await fetch(API_URL + "?type=products").then(r => r.json());
  selected = null;
  document.getElementById("editBtn").disabled = true;
  document.getElementById("deleteBtn").disabled = true;
  renderTable();
}

/* ================= RENDER ================= */
function renderTable() {
  const tbody = document.getElementById("productBody");
  tbody.innerHTML = "";

  if (!products.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#888">No products found</td>
      </tr>
    `;
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
      document.getElementById("editBtn").disabled = false;
      document.getElementById("deleteBtn").disabled = false;
    };

    tbody.appendChild(tr);
  });
}

/* ================= MODAL ================= */
async function openProductModal(product = {}) {
  openModal(`
    <div class="modal-header">${product.product_id ? "Edit" : "Add"} Product</div>

    <label>Product Code</label>
    <input id="productCode" value="${product.product_code || ""}">

    <label>Product Name</label>
    <input id="productName" value="${product.product_name || ""}">

    <label>Category</label>
    <select id="categorySelect">
      ${categories.map(c =>
        `<option value="${c.category_id}" ${c.category_id === product.category_id ? "selected" : ""}>
          ${c.category_name}
        </option>`
      ).join("")}
    </select>

    <label>Price</label>
    <input type="number" id="priceInput" value="${product.price || ""}">

    <label>Image URL</label>
    <input id="imageInput" value="${product.image_url || ""}">

    <div class="recipe-section">
      <strong>Product Recipe</strong>
      <div class="recipe-scroll" id="recipeList"></div>
      <button type="button" class="add-ingredient-btn" id="addIngredientBtn">
        ➕ Add Ingredient
      </button>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" id="saveProductBtn">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  await loadInventory();

  document.getElementById("addIngredientBtn").onclick = addRecipeRow;
  document.getElementById("saveProductBtn").onclick = saveProduct;

  addRecipeRow();
}

/* ================= INVENTORY ================= */
async function loadInventory() {
  inventoryMap = {};
  const items = await fetch(API_URL + "?type=inventoryItems").then(r => r.json());

  items.forEach(i => {
    inventoryMap[i.item_id] = {
      name: i.item_name,
      capital: Number(i.capital) || 0
    };
  });
}

/* ================= RECIPE ================= */
function addRecipeRow() {
  const list = document.getElementById("recipeList");
  if (!list) return;

  const row = document.createElement("div");
  row.className = "recipe-row";

  row.innerHTML = `
    <select class="recipe-item">
      ${Object.entries(inventoryMap)
        .map(([id, i]) => `<option value="${id}">${i.name}</option>`)
        .join("")}
    </select>
    <button class="recipe-btn minus">−</button>
    <input class="recipe-qty" type="number" value="1" min="1">
    <button class="recipe-btn plus">+</button>
    <div class="recipe-cost">₱0.00</div>
  `;

  list.appendChild(row);
  bindRecipeEvents(row);
}

function bindRecipeEvents(row) {
  const select = row.querySelector(".recipe-item");
  const qty = row.querySelector(".recipe-qty");
  const cost = row.querySelector(".recipe-cost");

  function update() {
    const item = inventoryMap[select.value];
    cost.textContent = `₱${(item.capital * Number(qty.value)).toFixed(2)}`;
  }

  row.querySelector(".plus").onclick = () => { qty.value++; update(); };
  row.querySelector(".minus").onclick = () => { qty.value = Math.max(1, qty.value - 1); update(); };
  qty.oninput = update;
  select.onchange = update;

  update();
}

/* ================= SAVE ================= */
function saveProduct() {
  const code = document.getElementById("productCode").value.trim();
  const name = document.getElementById("productName").value.trim();
  const category = document.getElementById("categorySelect").value;
  const price = Number(document.getElementById("priceInput").value);
  const image = document.getElementById("imageInput").value.trim();

  if (!code || !name || !price) {
    alert("Product Code, Name, and Price are required.");
    return;
  }

  const recipe = Array.from(document.querySelectorAll(".recipe-row")).map(r => ({
    item_id: r.querySelector(".recipe-item").value,
    qty_used: Number(r.querySelector(".recipe-qty").value)
  }));

  let url =
    API_URL +
    `?action=saveProduct` +
    `&product_code=${encodeURIComponent(code)}` +
    `&product_name=${encodeURIComponent(name)}` +
    `&category_id=${category}` +
    `&price=${price}` +
    `&image_url=${encodeURIComponent(image)}` +
    `&recipe=${encodeURIComponent(JSON.stringify(recipe))}`;

  if (selected?.product_id) url += `&product_id=${selected.product_id}`;

  fetch(url)
    .then(r => r.json())
    .then(res => {
      if (!res.success && res.error === "DUPLICATE_CODE") {
        alert("❌ Product code already exists.");
        return;
      }
      closeModal();
      setTimeout(loadProducts, 500);
    });
}

/* ================= DELETE ================= */
function deleteProduct() {
  if (!selected) return;
  if (!confirm(`Delete ${selected.product_name}?`)) return;

  fetch(API_URL + `?action=deleteProduct&product_id=${selected.product_id}`);
  setTimeout(loadProducts, 500);
}