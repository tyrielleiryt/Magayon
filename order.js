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

/* ================= LOADER ================= */
function showLoader(text = "Loading data…") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;
  loader.querySelector(".loader-text").textContent = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("globalLoader")?.classList.add("hidden");
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
    fetch(`${API_URL}?type=dailyInventoryItems&date=${today}&location=${LOCATION}`).then(r => r.json())
  ]);

  categories = categoriesData || [];
  products = productsData || [];
  recipes = recipesData || {};
  inventory = {};

  (inventoryRows || []).forEach(r => {
    inventory[r.item_id] = Number(r.remaining) || 0;
  });
}

/* =========================================================
   INVENTORY CHECK
========================================================= */
function canSell(product, qty = 1) {
  const recipe = recipes[product.product_id];
  if (!recipe) return false;

  return recipe.every(r => {
    const available = inventory[r.item_id] || 0;
    return available >= r.qty_used * qty;
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
    document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
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
    .filter(p => `${p.product_name} ${p.product_code}`.toLowerCase().includes(search))
    .forEach(p => {
      const disabled = !canSell(p);

      const card = document.createElement("div");
      card.className = "product-card" + (disabled ? " disabled" : "");

      card.innerHTML = `
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
   ✅ CHECKOUT — JSONP (CORS SAFE)
========================================================= */
function checkoutPOS() {
  if (!cart.length) {
    alert("No items in cart");
    return;
  }

  showLoader("Processing order…");

  const ref = "ORD-" + Date.now();
  const callback = "handleCheckoutResponse";

  delete window[callback];

  window[callback] = function (res) {
    hideLoader();

    if (!res || !res.success) {
      alert("❌ Checkout failed");
      console.error(res);
      return;
    }

    cart = [];
    loadAllData().then(() => {
      renderProducts();
      renderCart();
    });

    alert("✅ Order completed");
  };

  const qs = new URLSearchParams({
    action: "checkoutOrder",
    ref_id: ref,
    staff_id: STAFF_ID,
    location: LOCATION,
    items: JSON.stringify(cart),
    callback
  }).toString();

  const old = document.getElementById("checkoutJsonp");
  if (old) old.remove();

  const script = document.createElement("script");
  script.id = "checkoutJsonp";
  script.src = `${API_URL}?${qs}`;

  document.body.appendChild(script);
}