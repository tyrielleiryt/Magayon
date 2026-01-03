import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let inventoryMap = {}; // key = item_id

/* ================= ENTRY (REQUIRED BY ROUTER) ================= */
export default function loadProductsView() {
  // This must exist for admin.js import
  // UI rendering handled elsewhere
  console.log("Products view loaded");
}

/* ================= OPEN MODAL ================= */
window.openProductModal = function (product = {}) {
  openModal(`
    <div class="modal-header">
      ${product.product_id ? "Edit Product" : "Add Product"}
    </div>

    <label>Product Name</label>
    <input id="productName" value="${product.product_name || ""}">

    <label>Category</label>
    <select id="category"></select>

    <label>Price</label>
    <input type="number" id="price" value="${product.price || ""}">

    <label>Image URL</label>
    <input id="image" value="${product.image_url || ""}">

    <div class="recipe-section">
      <h4>Product Recipe</h4>

      <div class="recipe-scroll" id="recipeList"></div>

      <button
        type="button"
        class="add-ingredient-btn"
        onclick="addRecipeRow()">
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

  try {
    const res = await fetch(API_URL + "?type=inventoryItems");
    const items = await res.json();

    items.forEach(i => {
      inventoryMap[i.item_id] = {
        item_id: i.item_id,
        name: i.item_name,
        capital: Number(i.capital) || 0,
        unit: i.unit || "",
        remaining: i.remaining // optional / future
      };
    });

    // Always start with one row
    addRecipeRow();
  } catch (err) {
    console.error("Failed to load inventory items", err);
  }
}

/* ================= ADD RECIPE ROW ================= */
window.addRecipeRow = function () {
  const list = document.getElementById("recipeList");
  if (!list) return;

  const row = document.createElement("div");
  row.className = "recipe-row";

  row.innerHTML = `
    <select class="recipe-item">
      ${Object.values(inventoryMap)
        .map(
          i => `<option value="${i.item_id}">${i.name}</option>`
        )
        .join("")}
    </select>

    <button type="button" class="recipe-btn minus">−</button>

    <input
      type="number"
      class="recipe-qty"
      value="1"
      min="1"
      step="1"
    >

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

    let qty = Number(qtyInput.value || 1);
    qty = Math.max(1, qty);
    qtyInput.value = qty;

    const total = qty * item.capital;
    costEl.textContent = `₱${total.toFixed(2)}`;

    // Low-stock warning (safe / optional)
    if (
      item.remaining !== undefined &&
      qty > item.remaining
    ) {
      warning.textContent = `⚠ Only ${item.remaining} ${item.unit} left`;
      warning.classList.remove("hidden");
    } else {
      warning.textContent = "";
      warning.classList.add("hidden");
    }
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

/* ================= SAVE PRODUCT (UI ONLY FOR NOW) ================= */
window.saveProduct = function () {
  const rows = document.querySelectorAll(".recipe-row");

  const recipe = Array.from(rows).map(r => ({
    item_id: r.querySelector(".recipe-item").value,
    qty_used: Number(
      r.querySelector(".recipe-qty").value || 0
    )
  }));

  console.log("Recipe to save:", recipe);

  // API wiring will come next (product + recipe save)
  closeModal();
};