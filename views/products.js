import { openModal, closeModal } from "./modal.js";

const API_URL = "YOUR_SCRIPT_URL_HERE";

let inventoryMap = {};
let recipeRows = [];

/* ================= OPEN MODAL ================= */
function openProductModal(product = {}) {
  openModal(`
    <div class="modal-header">Add Product</div>

    <label>Product Name</label>
    <input id="productName">

    <label>Category</label>
    <select id="category"></select>

    <label>Price</label>
    <input type="number" id="price">

    <label>Image URL</label>
    <input id="image">

    <div class="recipe-section">
      <h4>Product Recipe</h4>
      <div class="recipe-scroll" id="recipeList"></div>
      <button class="add-ingredient-btn" onclick="addRecipeRow()">➕ Add Ingredient</button>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveProduct()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  loadInventory();
}

/* ================= LOAD INVENTORY ================= */
async function loadInventory() {
  const res = await fetch(API_URL + "?type=inventoryItems");
  const items = await res.json();

  items.forEach(i => {
    inventoryMap[i.item_id] = {
      name: i.item_name,
      capital: i.capital,
      remaining: i.remaining,
      unit: i.unit
    };
  });

  addRecipeRow();
}

/* ================= ADD ROW ================= */
window.addRecipeRow = () => {
  const list = document.getElementById("recipeList");

  const row = document.createElement("div");
  row.className = "recipe-row";

  row.innerHTML = `
    <select class="recipe-item">
      ${Object.values(inventoryMap)
        .map(i => `<option value="${i.name}">${i.name}</option>`)
        .join("")}
    </select>

    <button class="recipe-btn minus">−</button>
    <input type="number" class="recipe-qty" value="1" min="1">
    <button class="recipe-btn plus">+</button>

    <div class="recipe-cost">₱0.00</div>
  `;

  const warning = document.createElement("div");
  warning.className = "recipe-warning";

  list.appendChild(row);
  list.appendChild(warning);

  bindRecipeEvents(row, warning);
};

/* ================= EVENTS ================= */
function bindRecipeEvents(row, warning) {
  const select = row.querySelector(".recipe-item");
  const qty = row.querySelector(".recipe-qty");
  const cost = row.querySelector(".recipe-cost");

  function update() {
    const item = inventoryMap[select.value];
    const q = Number(qty.value || 0);
    const total = q * item.capital;

    cost.textContent = `₱${total.toFixed(2)}`;

    if (item.remaining !== undefined && q > item.remaining) {
      warning.textContent = `⚠ Only ${item.remaining} ${item.unit} left`;
    } else {
      warning.textContent = "";
    }
  }

  row.querySelector(".plus").onclick = () => {
    qty.value++;
    update();
  };

  row.querySelector(".minus").onclick = () => {
    qty.value = Math.max(1, qty.value - 1);
    update();
  };

  qty.oninput = update;
  select.onchange = update;

  update();
}