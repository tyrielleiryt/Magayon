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

  document.querySelector(".checkout").onclick = checkoutPOS;
  document.getElementById("clearOrderBtn").onclick = () => {
    cart = [];
    renderCart();
    renderProducts();
  };
  document.querySelector(".btn-print").onclick = () => window.print();

  document.getElementById("searchInput").oninput = e => {
    renderProducts(e.target.value.toLowerCase());
  };
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
  rows.forEach(r => inventory[r.item_id] = Number(r.remaining));
}

/* =========================================================
   INVENTORY CHECK
========================================================= */
function canSell(product, qty = 1) {
  const rec = recipes[product.product_id];
  if (!rec || !rec.length) return false;
  if (!Object.keys(inventory).length) return false;

  return rec.every(r => {
    const available = inventory[r.item_id] || 0;
    const needed = Number(r.qty_used) * qty;
    return available >= needed;
  });
}

/* =========================================================
   CATEGORIES
========================================================= */
function renderCategories() {
  const el = document.querySelector(".categories-panel");
  el.innerHTML = "";

  const allBtn = createCategoryBtn("All", null);
  allBtn.classList.add("active");
  el.appendChild(allBtn);

  categories.forEach(c => {
    el.appendChild(createCategoryBtn(c.category_name, c.category_id));
  });
}

function createCategoryBtn(name, id) {
  const btn = document.createElement("button");
  btn.className = "category-btn";
  btn.textContent = name;

  btn.onclick = () => {
    activeCategoryId = id;
    document
      .querySelectorAll(".category-btn")
      .forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderProducts();
  };
  return btn;
}

/* =========================================================
   PRODUCTS
========================================================= */
function renderProducts(search = "") {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  products
    .filter(p => p.active)
    .filter(p => !activeCategoryId || p.category_id === activeCategoryId)
    .filter(p =>
      `${p.product_name} ${p.product_code}`.toLowerCase().includes(search)
    )
    .forEach(p => {
      const disabled = !canSell(p);
      const img = p.image_url?.trim() || "images/placeholder.png";

      const card = document.createElement("div");
      card.className = "product-card" + (disabled ? " disabled" : "");

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

      if (!disabled) {
        card.onclick = () => addToCart(p);
      }

      grid.appendChild(card);
    });
}

/* =========================================================
   CART
========================================================= */
function addToCart(p) {
  const existing = cart.find(i => i.product_id === p.product_id);

  if (existing) {
    if (!canSell(p, existing.qty + 1)) {
      alert("❌ Not enough stock");
      return;
    }
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
  renderProducts();
}

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