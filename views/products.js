import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* ================= API ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= FIX: EXPOSE MODAL CLOSE ================= */
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

/* ================= TABLE LAYOUT ================= */
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
  const res = await fetch(API_URL + "?type=categories");
  categories = await res.json();
}

async function loadProducts() {
  const res = await fetch(API_URL + "?type=products");
  products = await res.json();

  selected = null;
  document.getElementById("editBtn").disabled = true;
  document.getElementById("deleteBtn").disabled = true;

  renderTable();
}

/* ================= RENDER TABLE ================= */
function renderTable() {
  const tbody = document.getElementById("productBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!products.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#888">
          No products found
        </td>
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
      document.querySelectorAll("#productBody tr")
        .forEach(r => r.classList.remove("selected"));

      tr.classList.add("selected");
      selected = p;

      document.getElementById("editBtn").disabled = false;
      document.getElementById("deleteBtn").disabled = false;
    };

    tbody.appendChild(tr);
  });
}

/* ================= PRODUCT MODAL ================= */
async function openProductModal(product = {}) {
  openModal(`
    <div class="modal-header">${product.product_id ? "Edit" : "Add"} Product</div>

    <label>Product Name</label>
    <input id="productName" value="${product.product_name || ""}">

    <label>Category</label>
    <select id="category">
      ${categories.map(c =>
        `<option value="${c.category_id}" ${c.category_id === product.category_id ? "selected" : ""}>
          ${c.category_name}
        </option>`
      ).join("")}
    </select>

    <label>Price</label>
    <input type="number" id="price" value="${product.price || ""}">

    <label>Image URL</label>
    <input id="image" value="${product.image_url || ""}">

    <div class="recipe-section">
      <strong>Product Recipe</strong>
      <div class="recipe-scroll" id="recipeList"></div>
      <button class="add-ingredient-btn" onclick="addRecipeRow()">➕ Add Ingredient</button>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveProduct()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  await loadInventory();
  addRecipeRow();
}

/* ================= INVENTORY ================= */
async function loadInventory() {
  inventoryMap = {};
  const res = await fetch(API_URL + "?type=inventoryItems");
  const items = await res.json();

  items.forEach(i => {
    inventoryMap[i.item_id] = {
      item_id: i.item_id,
      name: i.item_name,
      capital: Number(i.capital) || 0,
      unit: i.unit || ""
    };
  });
}

/* ================= RECIPE ROW ================= */
window.addRecipeRow = function () {
  const list = document.getElementById("recipeList");
  if (!list) return;

  const row = document.createElement("div");
  row.className = "recipe-row";

  row.innerHTML = `
    <select class="recipe-item">
      ${Object.values(inventoryMap)
        .map(i => `<option value="${i.item_id}">${i.name}</option>`)
        .join("")}
    </select>

    <button type="button" class="recipe-btn minus">−</button>
    <input type="number" class="recipe-qty" value="1" min="1">
    <button type="button" class="recipe-btn plus">+</button>

    <div class="recipe-cost">₱0.00</div>
  `;

  list.appendChild(row);
  bindRecipeEvents(row);
};

function bindRecipeEvents(row) {
  const select = row.querySelector(".recipe-item");
  const qtyInput = row.querySelector(".recipe-qty");
  const costEl = row.querySelector(".recipe-cost");

  function update() {
    const item = inventoryMap[select.value];
    if (!item) return;

    const qty = Math.max(1, Number(qtyInput.value));
    qtyInput.value = qty;
    costEl.textContent = `₱${(qty * item.capital).toFixed(2)}`;
  }

  row.querySelector(".plus").onclick = () => {
    qtyInput.value++;
    update();
  };

  row.querySelector(".minus").onclick = () => {
    qtyInput.value = Math.max(1, qtyInput.value - 1);
    update();
  };

  qtyInput.oninput = update;
  select.onchange = update;

  update();
}

/* ================= SAVE PRODUCT ================= */
window.saveProduct = function () {
  const recipe = Array.from(document.querySelectorAll(".recipe-row")).map(r => ({
    item_id: r.querySelector(".recipe-item").value,
    qty_used: Number(r.querySelector(".recipe-qty").value)
  }));

  console.log("Saving product with recipe:", recipe);
  closeModal();
};

/* ================= DELETE ================= */
function deleteProduct() {
  if (!selected) return;
  if (!confirm(`Delete ${selected.product_name}?`)) return;

  new Image().src =
    API_URL + `?action=deleteProduct&rowIndex=${selected.rowIndex}`;

  setTimeout(loadProducts, 600);
}