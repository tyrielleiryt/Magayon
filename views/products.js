import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let inventoryMap = {}; // key = item_id

/* ================= ENTRY ================= */
export default function loadProductsView() {
  // called by router — keep even if empty for now
}

/* ================= OPEN MODAL ================= */
window.openProductModal = function (product = {}) {
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

      <button class="add-ingredient-btn" onclick="addRecipeRow()">
        ➕ Add Ingredient
      </button>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveProduct()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  loadInventory();
};

/* ================= LOAD INVENTORY ================= */
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
      // remaining will be added later via low-stock API
    };
  });

  addRecipeRow();
}

/* ================= ADD RECIPE ROW ================= */
window.addRecipeRow = function () {
  const list = document.getElementById("recipeList");

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

  const warning = document.createElement("div");
  warning.className = "recipe-warning hidden";

  list.appendChild(row);
  list.appendChild(warning);

  bindRecipeEvents(row, warning);
};

/* ================= ROW EVENTS ================= */
function bindRecipeEvents(row, warning) {
  const select = row.querySelector(".recipe-item");
  const qtyInput = row.querySelector(".recipe-qty");
  const costEl = row.querySelector(".recipe-cost");

  function update() {
    const item = inventoryMap[select.value];
    if (!item) return;

    const qty = Math.max(1, Number(qtyInput.value || 1));
    qtyInput.value = qty;

    const total = qty * item.capital;
    costEl.textContent = `₱${total.toFixed(2)}`;

    // Low stock placeholder (safe)
    warning.classList.add("hidden");
    warning.textContent = "";
  }

  row.querySelector(".plus").onclick = () => {
    qtyInput.value = Number(qtyInput.value) + 1;
    update();
  };

  row.querySelector(".minus").onclick = () => {
    qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
    update();
  };

  qtyInput.oninput = update;
  select.onchange = update;

  update();
}

/* ================= SAVE PRODUCT ================= */
window.saveProduct = function () {
  const rows = document.querySelectorAll(".recipe-row");

  const recipe = Array.from(rows).map(r => ({
    item_id: r.querySelector(".recipe-item").value,
    qty_used: Number(r.querySelector(".recipe-qty").value || 0)
  }));

  console.log("Recipe to save:", recipe);

  // API save will be added after UI is stable
  closeModal();
};