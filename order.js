/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

const LOCATION = localStorage.getItem("userLocation");
const STAFF_ID = localStorage.getItem("staff_id");
const CASHIER_NAME = localStorage.getItem("userName");
const CASHIER_POSITION = localStorage.getItem("userPosition");

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

/* =========================================================
   STATE
========================================================= */
let products = [];
let categories = [];
let recipes = {};
let inventory = {};
let cart = [];
let activeCategoryId = null;

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("cashierName").textContent = CASHIER_NAME;
  document.getElementById("cashierPosition").textContent = CASHIER_POSITION;
  document.getElementById("cashierLocation").textContent = LOCATION;

  await loadAllData();
  renderCategories();
  renderProducts();
  renderCart();

  /* 🔗 BUTTON WIRING (CRITICAL FIX) */
  document.querySelector(".checkout")?.addEventListener("click", checkoutPOS);

  document.getElementById("clearOrderBtn")?.addEventListener("click", () => {
    cart = [];
    renderCart();
  });

  document.querySelector(".btn-print")?.addEventListener("click", () => {
    window.print();
  });

  document.getElementById("searchInput")?.addEventListener("input", e => {
    const k = e.target.value.toLowerCase();
    renderProducts(k);
  });
});

/* =========================================================
   LOADERS
========================================================= */
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
  rows.forEach(r => (inventory[r.item_id] = Number(r.remaining)));
}

/* =========================================================
   STOCK CHECK
========================================================= */
function canSell(product, qty = 1) {
  const rec = recipes[product.product_id];
  if (!rec || !rec.length) return true; // allow click even without inventory
  return rec.every(r =>
    (inventory[r.item_id] || 0) >= Number(r.qty_used) * qty
  );
}

/* =========================================================
   CATEGORIES
========================================================= */
function renderCategories() {
  const el = document.querySelector(".categories-panel");
  el.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "category-btn active";
  allBtn.textContent = "All";
  allBtn.onclick = () => {
    activeCategoryId = null;
    renderProducts();
  };
  el.appendChild(allBtn);

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

/* =========================================================
   PRODUCTS (CLICKABLE FIX)
========================================================= */
function renderProducts(search = "") {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  products
    .filter(p => p.active)
    .filter(p => !activeCategoryId || p.category_id === activeCategoryId)
    .filter(p =>
      `${p.product_name} ${p.product_code}`
        .toLowerCase()
        .includes(search)
    )
    .forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.style.cursor = "pointer";

      const img =
        p.image_url && p.image_url.trim()
          ? p.image_url
          : "images/placeholder.png";

      card.innerHTML = `
        <div class="product-img">
          <img src="${img}" onerror="this.src='images/placeholder.png'">
        </div>
        <div class="product-info">
          <div class="product-code">${p.product_code}</div>
          <div class="product-name">${p.product_name}</div>
          <div class="product-price">₱${Number(p.price).toFixed(2)}</div>
        </div>
      `;

      card.onclick = () => addToCart(p);
      grid.appendChild(card);
    });
}

/* =========================================================
   CART
========================================================= */
function addToCart(p) {
  const existing = cart.find(i => i.product_id === p.product_id);

  if (existing) {
    existing.qty++;
    existing.total = existing.qty * existing.price;
  } else {
    cart.push({
      product_id: p.product_id,
      product_name: p.product_name,
      price: Number(p.price),
      qty: 1,
      total: Number(p.price)
    });
  }

  renderCart();
}

/* =========================================================
   CART UI
========================================================= */
function renderCart() {
  const tbody = document.getElementById("orderTable");
  const sumEl = document.getElementById("sumTotal");

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

/* =========================================================
   CHECKOUT
========================================================= */
async function checkoutPOS() {
  if (!cart.length) return alert("No items in cart");

  const ref = "ORD-" + Date.now();

  for (const l of cart) {
    new Image().src =
      `${API_URL}?action=recordPosOrderItem` +
      `&product_id=${l.product_id}` +
      `&qty=${l.qty}` +
      `&price=${l.price}` +
      `&total=${l.total}` +
      `&ref_id=${ref}` +
      `&location=${LOCATION}` +
      `&staff_id=${STAFF_ID}`;
  }

  alert("✅ Order completed");
  cart = [];
  await loadAllData();
  renderProducts();
  renderCart();
}