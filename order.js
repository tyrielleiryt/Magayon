/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

const LOCATION = "MAIN";
const LOW_STOCK_THRESHOLD = 5;

/* =========================================================
   STATE
========================================================= */
let products = [];
let categories = [];
let recipesByProduct = {};
let inventoryRemaining = {};
let reservedInventory = {};
let cart = [];

let activeCategoryId = null; // null = ALL
let searchKeyword = "";

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([
    loadCategories(),
    loadProducts(),
    loadProductRecipes(),
    loadInventoryRemaining()
  ]);

  renderCategories();
  renderProducts();

  document.getElementById("searchInput").addEventListener("input", e => {
    searchKeyword = e.target.value.toLowerCase();
    renderProducts();
  });

  document.getElementById("clearOrderBtn").onclick = clearCart;
  document.querySelector(".checkout").onclick = checkoutPOS;
});

/* =========================================================
   LOADERS
========================================================= */
async function loadCategories() {
  categories = await fetch(API_URL + "?type=categories").then(r => r.json());
}

async function loadProducts() {
  products = await fetch(API_URL + "?type=products").then(r => r.json());
}

async function loadProductRecipes() {
  const list = await fetch(API_URL + "?type=products").then(r => r.json());

  for (const p of list) {
    recipesByProduct[p.product_id] = await fetch(
      API_URL + `?type=productRecipes&product_id=${p.product_id}`
    ).then(r => r.json());
  }
}

async function loadInventoryRemaining() {
  const inventory = await fetch(API_URL + "?type=inventoryItems").then(r => r.json());

  inventoryRemaining = {};
  inventory.forEach(i => {
    inventoryRemaining[i.item_id] = Number(i.remaining || 0);
  });

  reservedInventory = {};
}

/* =========================================================
   CATEGORY RENDERING
========================================================= */
function renderCategories() {
  const panel = document.querySelector(".categories-panel");
  panel.innerHTML = "";

  // ALL CATEGORIES
  const allBtn = document.createElement("button");
  allBtn.className = "category-btn" + (activeCategoryId === null ? " active" : "");
  allBtn.textContent = "All Categories";
  allBtn.onclick = () => {
    activeCategoryId = null;
    renderCategories();
    renderProducts();
  };
  panel.appendChild(allBtn);

  // OTHER CATEGORIES
  categories.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "category-btn" + (activeCategoryId === c.category_id ? " active" : "");
    btn.textContent = c.category_name;
    btn.onclick = () => {
      activeCategoryId = c.category_id;
      renderCategories();
      renderProducts();
    };
    panel.appendChild(btn);
  });
}

/* =========================================================
   STOCK LOGIC
========================================================= */
function getProductStockStatus(product, qty = 1) {
  const recipe = recipesByProduct[product.product_id];
  if (!recipe || !recipe.length) {
    return { status: "block", message: "No recipe" };
  }

  let isLow = false;

  for (const r of recipe) {
    const needed = qty * Number(r.qty_used || 0);
    const available =
      (inventoryRemaining[r.item_id] || 0) -
      (reservedInventory[r.item_id] || 0);

    if (available < needed) {
      return {
        status: "block",
        message: `${r.item_name || r.item_id} insufficient`
      };
    }

    if (available <= LOW_STOCK_THRESHOLD) {
      isLow = true;
    }
  }

  return { status: isLow ? "low" : "ok" };
}

/* =========================================================
   PRODUCT RENDERING
========================================================= */
function renderProducts() {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  let filtered = products.filter(p => p.active);

  // CATEGORY FILTER
  if (activeCategoryId) {
    filtered = filtered.filter(p => p.category_id === activeCategoryId);
  }

  // SEARCH FILTER
  if (searchKeyword) {
    filtered = filtered.filter(p =>
      p.product_name.toLowerCase().includes(searchKeyword) ||
      p.product_code.toLowerCase().includes(searchKeyword)
    );
  }

  filtered.forEach(p => {
    const stock = getProductStockStatus(p, 1);

    const card = document.createElement("div");
    card.className = "product-card";

    if (stock.status === "block") card.classList.add("disabled");
    if (stock.status === "low") card.classList.add("low-stock");

    card.innerHTML = `
      <div class="product-img">
        <img src="${p.image_url || "placeholder.png"}" />
        ${stock.status === "block" ? `<div class="sold-out">OUT OF STOCK</div>` : ""}
      </div>

      <div class="product-info">
        <div class="product-code">${p.product_code}</div>
        <div class="product-name">${p.product_name}</div>
        <div class="product-price">₱${Number(p.price).toFixed(2)}</div>
      </div>
    `;

    if (stock.status !== "block") {
      card.onclick = () => addToCart(p);
    }

    grid.appendChild(card);
  });
}

/* =========================================================
   CART
========================================================= */
function addToCart(product) {
  const existing = cart.find(i => i.product_id === product.product_id);
  const newQty = (existing?.qty || 0) + 1;

  const stock = getProductStockStatus(product, newQty);
  if (stock.status === "block") {
    alert("❌ Not enough inventory");
    return;
  }

  const recipe = recipesByProduct[product.product_id];
  recipe.forEach(r => {
    reservedInventory[r.item_id] =
      (reservedInventory[r.item_id] || 0) +
      Number(r.qty_used || 0);
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

function clearCart() {
  cart = [];
  reservedInventory = {};
  renderCart();
  renderProducts();
}

/* =========================================================
   CHECKOUT
========================================================= */
async function checkoutPOS() {
  if (!cart.length) return;

  const refId = "ORD-" + Date.now();

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

    const recipe = recipesByProduct[line.product_id];
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
  clearCart();
  await loadInventoryRemaining();
}