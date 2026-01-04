/* =====================================================
   CONFIG
===================================================== */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

const LOCATION = "MAIN";
const LOW_STOCK_THRESHOLD = 5;
const INVENTORY_REFRESH_INTERVAL = 15000;

/* =====================================================
   STATE
===================================================== */
let products = [];
let categories = [];
let cart = [];

let recipeCache = {};           // product_id -> recipe[]
let inventoryRemaining = {};    // item_id -> remaining
let reservedInventory = {};     // item_id -> reserved in cart

let activeCategory = "ALL";
let isCheckingOut = false;

/* =====================================================
   INIT
===================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  await loadCategories();
  await loadInventoryRemaining();
  await loadProductRecipes();
  await loadProducts();

  document
    .getElementById("searchInput")
    .addEventListener("input", applyFilters);

  document
    .getElementById("clearOrderBtn")
    .addEventListener("click", clearOrder);

  document
    .querySelector(".checkout")
    .addEventListener("click", checkoutPOS);

  setInterval(refreshInventorySafely, INVENTORY_REFRESH_INTERVAL);
});

/* =====================================================
   LOAD DATA
===================================================== */
async function loadCategories() {
  categories = await fetch(API_URL + "?type=categories").then(r => r.json());
  renderCategories();
}

async function loadProducts() {
  products = await fetch(API_URL + "?type=products").then(r => r.json());
  renderProducts(products);
}

async function loadProductRecipes() {
  const list = await fetch(API_URL + "?type=products").then(r => r.json());

  for (const p of list) {
    recipeCache[p.product_id] = await fetch(
      API_URL + `?type=productRecipes&product_id=${p.product_id}`
    ).then(r => r.json());
  }
}

async function loadInventoryRemaining() {
  inventoryRemaining = {};

  const items = await fetch(
    API_URL + "?type=inventoryItems"
  ).then(r => r.json());

  items.forEach(i => inventoryRemaining[i.item_id] = 0);

  const today = new Date().toISOString().slice(0, 10);

  const movements = await fetch(
    API_URL +
      `?type=dailyRemainingInventory&date=${today}&location=${LOCATION}`
  ).then(r => r.json());

  movements.forEach(m => {
    inventoryRemaining[m.item_id] = Number(m.remaining || 0);
  });

  reservedInventory = {};
}

/* =====================================================
   SAFE AUTO REFRESH
===================================================== */
async function refreshInventorySafely() {
  try {
    await loadInventoryRemaining();
    renderProducts(products);
  } catch (e) {
    console.warn("Inventory refresh failed", e);
  }
}

/* =====================================================
   CATEGORY UI
===================================================== */
function renderCategories() {
  const panel = document.querySelector(".categories-panel");
  panel.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "category-btn active";
  allBtn.textContent = "All Categories";
  allBtn.onclick = () => selectCategory("ALL", allBtn);
  panel.appendChild(allBtn);

  categories.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "category-btn";
    btn.textContent = c.category_name;
    btn.onclick = () => selectCategory(c.category_id, btn);
    panel.appendChild(btn);
  });
}

function selectCategory(id, btn) {
  activeCategory = id;

  document
    .querySelectorAll(".category-btn")
    .forEach(b => b.classList.remove("active"));

  btn.classList.add("active");
  applyFilters();
}

/* =====================================================
   FILTERING
===================================================== */
function applyFilters() {
  const q = document.getElementById("searchInput").value.toLowerCase();

  const filtered = products.filter(p => {
    const matchesCategory =
      activeCategory === "ALL" || p.category_id === activeCategory;

    const matchesSearch =
      p.product_name.toLowerCase().includes(q) ||
      (p.product_code || "").toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  renderProducts(filtered);
}

/* =====================================================
   INVENTORY LOGIC
===================================================== */
function getIngredientWarnings(product, qty = 1) {
  const recipe = recipeCache[product.product_id];
  if (!recipe || !recipe.length) {
    return [{ type: "block", message: "No recipe set" }];
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
        message: `${r.item_name || r.item_id} needs ${needed}, only ${available}`
      });
    } else if (available <= LOW_STOCK_THRESHOLD) {
      warnings.push({
        type: "low",
        message: `${r.item_name || r.item_id} low (${available} left)`
      });
    }
  });

  return warnings;
}

function buildTooltipHTML(product) {
  const recipe = recipeCache[product.product_id];
  if (!recipe) return "";

  const lines = [];

  recipe.forEach(r => {
    const available =
      (inventoryRemaining[r.item_id] || 0) -
      (reservedInventory[r.item_id] || 0);

    const needed = Number(r.qty_used || 0);

    if (available < needed) {
      lines.push(`❌ ${r.item_name || r.item_id}: ${available} left`);
    } else if (available <= LOW_STOCK_THRESHOLD) {
      lines.push(`⚠️ ${r.item_name || r.item_id}: ${available} left`);
    }
  });

  return lines.join("<br>");
}

/* =====================================================
   PRODUCT GRID
===================================================== */
function renderProducts(list) {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  list.forEach(p => {
    const warnings = getIngredientWarnings(p, 1);
    const blocked = warnings.some(w => w.type === "block");
    const low = warnings.some(w => w.type === "low");

    const tooltip = buildTooltipHTML(p);

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

      ${
        tooltip
          ? `<div class="product-tooltip ${blocked ? "block" : "low"}">
              ${tooltip}
            </div>`
          : ""
      }
    `;

    if (!blocked) {
      card.onclick = () => addToCart(p);
    }

    grid.appendChild(card);
  });
}

/* =====================================================
   CART
===================================================== */
function addToCart(product) {
  const existing = cart.find(i => i.product_id === product.product_id);
  const newQty = (existing?.qty || 0) + 1;

  const warnings = getIngredientWarnings(product, newQty);
  const block = warnings.find(w => w.type === "block");
  if (block) {
    alert(block.message);
    return;
  }

  const recipe = recipeCache[product.product_id];
  recipe.forEach(r => {
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
  renderProducts(products);
}

function renderCart() {
  const tbody = document.getElementById("orderTable");
  const sumEl = document.getElementById("sumTotal");

  tbody.innerHTML = "";
  let sum = 0;

  cart.forEach((item, i) => {
    sum += item.total;
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${item.product_name}</td>
        <td>${item.qty}</td>
        <td>₱${item.price.toFixed(2)}</td>
        <td>₱${item.total.toFixed(2)}</td>
      </tr>
    `;
  });

  sumEl.textContent = sum.toFixed(2);
}

function clearOrder() {
  cart = [];
  reservedInventory = {};
  renderCart();
  renderProducts(products);
}

/* =====================================================
   CHECKOUT
===================================================== */
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

      const recipe = recipeCache[line.product_id];
      recipe.forEach(r => {
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
    await loadInventoryRemaining();

    renderCart();
    renderProducts(products);
  } catch (e) {
    alert("❌ Checkout failed");
    console.error(e);
  }

  isCheckingOut = false;
}