/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

const LOCATION = localStorage.getItem("userLocation");
const STAFF_ID = localStorage.getItem("staff_id");
const CASHIER_NAME = localStorage.getItem("userName") || "";
const CASHIER_POSITION = localStorage.getItem("userPosition") || "";

/* ================= ACCESS GUARD ================= */
if (!LOCATION || !STAFF_ID) {
  alert("Unauthorized POS access");
  window.location.replace("index.html");
}

/* ================= LOADER HELPERS ================= */
function showLoader(text = "Loading data…") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;
  loader.querySelector(".loader-text").textContent = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;
  loader.classList.add("hidden");
}

/* =========================================================
   STATE
========================================================= */
let products = [];
let categories = [];
let recipes = {};        // product_id → recipe[]
let inventory = {};      // item_id → remaining qty
let cart = [];
let activeCategoryId = null;

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("cashierName").textContent = CASHIER_NAME;
  document.getElementById("cashierPosition").textContent = CASHIER_POSITION;
  document.getElementById("cashierLocation").textContent = LOCATION;

  showLoader("Loading POS data…");

  try {
    await loadAllData();
    renderCategories();
    renderProducts();
    renderCart();
  } catch (err) {
    console.error(err);
    alert("Failed to load POS data.");
  } finally {
    hideLoader();
  }

  document.querySelector(".checkout")?.addEventListener("click", checkoutPOS);

  document.getElementById("clearOrderBtn")?.addEventListener("click", () => {
    cart = [];
    renderCart();
    renderProducts();
  });

  document.querySelector(".btn-print")?.addEventListener("click", () => {
    window.print();
  });

  document.getElementById("searchInput")?.addEventListener("input", e => {
    renderProducts(e.target.value.toLowerCase());
  });
});

/* =========================================================
   LOAD ALL DATA
========================================================= */
async function loadAllData() {
  const today = new Date().toISOString().slice(0, 10);

  const [
    categoriesData,
    productsData,
    recipesData,
    inventoryRows
  ] = await Promise.all([
    fetch(`${API_URL}?type=categories`).then(r => r.json()),
    fetch(`${API_URL}?type=products`).then(r => r.json()),
    fetch(`${API_URL}?type=allProductRecipes`).then(r => r.json()),
    fetch(
      `${API_URL}?type=dailyRemainingInventory&date=${today}&location=${LOCATION}`
    ).then(r => r.json())
  ]);

  categories = categoriesData || [];
  products = productsData || [];
  recipes = recipesData || {};

  inventory = {};

if (!Array.isArray(inventoryRows)) {
  console.error("Invalid inventory response:", inventoryRows);
  return;
}

inventoryRows.forEach(r => {
  inventory[r.item_id] = Number(r.remaining) || 0;
});

/* =========================================================
   INVENTORY CHECK
========================================================= */
function canSell(product, qty = 1) {
  const recipe = recipes[product.product_id];
  if (!recipe || !recipe.length) return false;

  return recipe.every(r => {
    const available = inventory[r.item_id];
    if (available === undefined) return false;

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

  el.appendChild(createCategoryBtn("All", null, true));

  categories.forEach(c => {
    el.appendChild(createCategoryBtn(c.category_name, c.category_id));
  });
}

function createCategoryBtn(name, id, active = false) {
  const btn = document.createElement("button");
  btn.className = "category-btn" + (active ? " active" : "");
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
      const img =
        p.image_url && p.image_url.trim()
          ? p.image_url
          : "images/placeholder.png";

      const card = document.createElement("div");
      card.className = "product-card" + (disabled ? " disabled" : "");

      card.innerHTML = `
        <div class="product-img">
          <img src="${img}" loading="lazy"
               onerror="this.src='images/placeholder.png'">
        </div>
        <div class="product-info">
          <div class="product-code">${p.product_code}</div>
          <div class="product-name">${p.product_name}</div>
          <div class="product-price">₱${Number(p.price).toFixed(2)}</div>
        </div>
      `;

      if (!disabled) card.onclick = () => addToCart(p);
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
   FINAL CHECKOUT
========================================================= */
async function checkoutPOS() {
  if (!cart.length) {
    alert("No items in cart");
    return;
  }

  showLoader("Processing order…");

  const ref = "ORD-" + Date.now();

  try {
    const payload = {
      action: "checkoutOrder",
      ref_id: ref,
      staff_id: STAFF_ID,
      location: LOCATION,
      items: JSON.stringify(
        cart.map(i => ({
          product_id: i.product_id,
          qty: i.qty,
          price: i.price,
          total: i.total
        }))
      )
    };

    const qs = Object.entries(payload)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const res = await fetch(`${API_URL}?${qs}`);
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || "Checkout failed");
    }

    /* ✅ IMMEDIATE LOCAL DEDUCTION (CRITICAL FIX) */
    cart.forEach(item => {
      const recipe = recipes[item.product_id] || [];
      recipe.forEach(r => {
        inventory[r.item_id] -= Number(r.qty_used) * Number(item.qty);
      });
    });

    cart = [];
    renderProducts();
    renderCart();

    // Background refresh (safe)
    loadAllData();

    alert("✅ Order completed");

  } catch (err) {
    console.error(err);
    alert("❌ Checkout failed. Please retry.");
  } finally {
    hideLoader();
  }
}