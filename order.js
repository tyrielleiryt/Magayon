const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= CONFIG ================= */
const LOCATION = "MAIN";
const LOW_STOCK_THRESHOLD = 5;
const INVENTORY_REFRESH_INTERVAL = 15000;

/* ================= STATE ================= */
let products = [];
let categories = [];
let cart = [];

let inventoryRemaining = {};   // item_id → remaining
let recipeCache = {};          // product_id → recipe[]
let reservedInventory = {};    // item_id → reserved in cart

let activeCategory = null;
let isCheckingOut = false;

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  await loadCategories();
  await loadInventoryRemaining();
  await loadRecipes();
  await loadProducts();

  setInterval(refreshInventorySafely, INVENTORY_REFRESH_INTERVAL);
});

/* ================= LOADERS ================= */
async function loadCategories() {
  categories = await fetch(API_URL + "?type=categories").then(r => r.json());
  renderCategories();
}

async function loadProducts() {
  products = await fetch(API_URL + "?type=products").then(r => r.json());
  renderProducts();
}

async function loadRecipes() {
  const list = await fetch(API_URL + "?type=products").then(r => r.json());
  for (const p of list) {
    recipeCache[p.product_id] = await fetch(
      API_URL + `?type=productRecipes&product_id=${p.product_id}`
    ).then(r => r.json());
  }
}

async function loadInventoryRemaining() {
  const inv = await fetch(API_URL + "?type=inventoryItems").then(r => r.json());
  inventoryRemaining = {};
  inv.forEach(i => inventoryRemaining[i.item_id] = 0);

  reservedInventory = {};
}

async function refreshInventorySafely() {
  try {
    const res = await fetch(
      API_URL +
      `?type=dailyRemainingInventory&date=${new Date().toISOString()}&location=${LOCATION}`
    );
    const data = await res.json();

    inventoryRemaining = {};
    data.forEach(i => inventoryRemaining[i.item_id] = Number(i.remaining || 0));

    renderProducts();
  } catch (e) {
    console.warn("Inventory refresh failed");
  }
}

/* ================= CATEGORY UI ================= */
function renderCategories() {
  const panel = document.querySelector(".categories-panel");
  if (!panel) return;

  panel.innerHTML = `
    <button class="category-btn ${!activeCategory ? "active" : ""}"
      onclick="filterCategory(null)">
      All Categories
    </button>
  `;

  categories.forEach(c => {
    panel.innerHTML += `
      <button class="category-btn ${activeCategory === c.category_id ? "active" : ""}"
        onclick="filterCategory('${c.category_id}')">
        ${c.category_name}
      </button>
    `;
  });
}

window.filterCategory = function (catId) {
  activeCategory = catId;
  renderCategories();
  renderProducts();
};

/* ================= STOCK LOGIC ================= */
function getWarnings(product, qty = 1) {
  const recipe = recipeCache[product.product_id];
  if (!recipe || !recipe.length) {
    return [{ type: "block", text: "No recipe set" }];
  }

  const warnings = [];

  recipe.forEach(r => {
    const needed = qty * Number(r.qty_used || 0);
    const available =
      (inventoryRemaining[r.item_id] || 0) -
      (reservedInventory[r.item_id] || 0);

    if (available < needed) {
      warnings.push({
        type: "block",
        text: `${r.item_id} insufficient (${available})`
      });
    } else if (available <= LOW_STOCK_THRESHOLD) {
      warnings.push({
        type: "low",
        text: `${r.item_id} low (${available})`
      });
    }
  });

  return warnings;
}

/* ================= PRODUCTS GRID ================= */
function renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  grid.innerHTML = "";

  products
    .filter(p => !activeCategory || p.category_id === activeCategory)
    .forEach(p => {
      const warnings = getWarnings(p, 1);
      const blocked = warnings.some(w => w.type === "block");
      const low = warnings.some(w => w.type === "low");

      const tooltip = warnings.map(w => w.text).join("<br>");

      const card = document.createElement("div");
      card.className = "product-card";
      if (blocked) card.classList.add("disabled");
      if (low) card.classList.add("low-stock");

      card.innerHTML = `
        <div class="product-img">
          <img src="${p.image_url || "placeholder.png"}">
          ${blocked ? `<div class="sold-out">OUT OF STOCK</div>` : ""}
        </div>

        <div class="product-info">
          <div class="product-code">${p.product_code || ""}</div>
          <div class="product-name">${p.product_name}</div>
          <div class="product-price">₱${Number(p.price).toFixed(2)}</div>
        </div>

        ${tooltip ? `<div class="product-tooltip ${blocked ? "block" : "low"}">${tooltip}</div>` : ""}
      `;

      if (!blocked) {
        card.onclick = () => addToCart(p);
      }

      grid.appendChild(card);
    });
}

/* ================= CART ================= */
function addToCart(product) {
  const existing = cart.find(i => i.product_id === product.product_id);
  const newQty = (existing?.qty || 0) + 1;

  const warnings = getWarnings(product, newQty);
  const block = warnings.find(w => w.type === "block");

  if (block) {
    alert(`❌ ${block.text}`);
    return;
  }

  recipeCache[product.product_id].forEach(r => {
    reservedInventory[r.item_id] =
      (reservedInventory[r.item_id] || 0) + Number(r.qty_used || 0);
  });

  if (existing) {
    existing.qty++;
    existing.total = existing.qty * existing.price;
  } else {
    cart.push({
      product_id: product.product_id,
      product_name: product.product_name,
      price: Number(product.price),
      qty: 1,
      total: Number(product.price)
    });
  }

  renderCart();
  renderProducts();
}

function renderCart() {
  const tbody = document.getElementById("orderTable");
  const sumEl = document.getElementById("sumTotal");
  if (!tbody || !sumEl) return;

  tbody.innerHTML = "";
  let sum = 0;

  cart.forEach((i, idx) => {
    sum += i.total;
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td>${i.product_name}</td>
        <td>${i.qty}</td>
        <td>₱${i.price.toFixed(2)}</td>
        <td>₱${i.total.toFixed(2)}</td>
      </tr>
    `;
  });

  sumEl.textContent = sum.toFixed(2);
}

/* ================= CLEAR ================= */
document.getElementById("clearOrderBtn")?.addEventListener("click", () => {
  if (!cart.length) return;
  if (!confirm("Clear order?")) return;

  cart = [];
  reservedInventory = {};
  renderCart();
  renderProducts();
});

/* ================= CHECKOUT ================= */
async function checkoutPOS() {
  if (!cart.length || isCheckingOut) return;
  isCheckingOut = true;

  const refId = "ORD-" + Date.now();

  try {
    for (const line of cart) {
      new Image().src =
        API_URL +
        `?action=recordPosOrderItem` +
        `&product_id=${line.product_id}` +
        `&qty=${line.qty}` +
        `&price=${line.price}` +
        `&total=${line.total}` +
        `&ref_id=${refId}` +
        `&location=${LOCATION}`;

      recipeCache[line.product_id].forEach(r => {
        new Image().src =
          API_URL +
          `?action=stockOut` +
          `&item_id=${r.item_id}` +
          `&qty=${r.qty_used * line.qty}` +
          `&location=${LOCATION}` +
          `&source=POS` +
          `&ref_id=${refId}`;
      });
    }

    alert("✅ Order completed");
    cart = [];
    reservedInventory = {};
    await refreshInventorySafely();
    renderCart();
    renderProducts();

  } catch (e) {
    alert("❌ Checkout failed");
  }

  isCheckingOut = false;
}

document.querySelector(".checkout")?.addEventListener("click", checkoutPOS);