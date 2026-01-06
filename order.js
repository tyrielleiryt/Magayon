const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

const LOCATION = localStorage.getItem("userLocation");
const STAFF_ID = localStorage.getItem("staff_id");
const CASHIER_NAME = localStorage.getItem("userName");
const CASHIER_POSITION = localStorage.getItem("userPosition");
const LOW_STOCK_THRESHOLD = 5;

/* ================= ACCESS GUARD ================= */
if (!LOCATION || !STAFF_ID) {
  alert("Unauthorized POS access");
  window.location.replace("index.html");
}

/* ================= JSONP ================= */
function jsonp(params) {
  const cb = "cb_" + Date.now();
  return new Promise(resolve => {
    window[cb] = data => {
      delete window[cb];
      resolve(data);
    };
    const qs = Object.entries({ ...params, callback: cb })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    const s = document.createElement("script");
    s.src = `${API_URL}?${qs}`;
    document.body.appendChild(s);
  });
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("cashierName").textContent = CASHIER_NAME;
  document.getElementById("cashierPosition").textContent = CASHIER_POSITION;
  document.getElementById("cashierLocation").textContent = LOCATION;

  await loadAllData();
  renderCategories();
  renderProducts();
});

/* ================= DATA ================= */
let products = [], categories = [], recipes = {}, inventory = {}, cart = [];
let activeCategoryId = null, keyword = "";

/* ================= LOADERS ================= */
async function loadAllData() {
  categories = await fetch(`${API_URL}?type=categories`).then(r => r.json());
  products = await fetch(`${API_URL}?type=products`).then(r => r.json());

  for (const p of products) {
    recipes[p.product_id] = await fetch(
      `${API_URL}?type=productRecipes&product_id=${p.product_id}`
    ).then(r => r.json());
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = await fetch(
    `${API_URL}?type=dailyRemainingInventory&date=${today}&location=${LOCATION}`
  ).then(r => r.json());

  inventory = {};
  rows.forEach(r => inventory[r.item_id] = r.remaining);
}

/* ================= STOCK ================= */
function canSell(product, qty = 1) {
  const rec = recipes[product.product_id];
  if (!rec?.length) return false;

  return rec.every(r =>
    (inventory[r.item_id] || 0) >= r.qty_used * qty
  );
}

/* ================= UI ================= */
function renderCategories() {
  const el = document.querySelector(".categories-panel");
  el.innerHTML = `<button class="category-btn active">All</button>`;
  categories.forEach(c => {
    const b = document.createElement("button");
    b.className = "category-btn";
    b.textContent = c.category_name;
    b.onclick = () => {
      activeCategoryId = c.category_id;
      renderProducts();
    };
    el.appendChild(b);
  });
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  products
    .filter(p => p.active)
    .filter(p => !activeCategoryId || p.category_id === activeCategoryId)
    .forEach(p => {
      const disabled = !canSell(p);
      const d = document.createElement("div");
      d.className = "product-card" + (disabled ? " disabled" : "");
      d.innerHTML = `
        <div class="product-info">
          <div class="product-code">${p.product_code}</div>
          <div class="product-name">${p.product_name}</div>
          <div class="product-price">₱${p.price}</div>
        </div>`;
      if (!disabled) d.onclick = () => addToCart(p);
      grid.appendChild(d);
    });
}

/* ================= CART ================= */
function addToCart(p) {
  const item = cart.find(i => i.product_id === p.product_id);
  if (item) item.qty++;
  else cart.push({ ...p, qty: 1, total: p.price });
}

/* ================= CHECKOUT ================= */
async function checkoutPOS() {
  const ref = "ORD-" + Date.now();

  for (const l of cart) {
    new Image().src =
      `${API_URL}?action=recordPosOrderItem` +
      `&product_id=${l.product_id}` +
      `&qty=${l.qty}` +
      `&price=${l.price}` +
      `&total=${l.qty * l.price}` +
      `&ref_id=${ref}` +
      `&location=${LOCATION}` +
      `&staff_id=${STAFF_ID}`;
  }

  alert("Order complete");
  cart = [];
}