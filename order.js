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

/* =========================================================
   STATE
========================================================= */
let products = [];
let categories = [];
let recipes = {};
let inventory = {};
let cart = [];
let activeCategoryId = null;

let lastInventorySnapshot = null;
let pendingPayment = null;
let paidValue = "0";

/* =========================================================
   LOADER
========================================================= */
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
   STOCK UPDATE BANNER
========================================================= */
function showStockBanner() {
  const banner = document.getElementById("stockBanner");
  if (!banner) return;

  banner.classList.remove("hidden");
  clearTimeout(showStockBanner._timer);

  showStockBanner._timer = setTimeout(() => {
    banner.classList.add("hidden");
  }, 3000);
}

/* =========================================================
   WAKE LOCK (TABLET ANTI-SLEEP)
========================================================= */
let wakeLock = null;

async function enableWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (err) {
    console.warn("Wake Lock failed:", err.message);
  }
}

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("cashierName").textContent = CASHIER_NAME;
  document.getElementById("cashierPosition").textContent = CASHIER_POSITION;
  document.getElementById("cashierLocation").textContent = LOCATION;

  document.getElementById("fullscreenBtn")
    ?.addEventListener("click", toggleFullscreen);

  document.getElementById("clearOrderBtn")
    ?.addEventListener("click", () => {
      cart = [];
      renderCart();
      renderProducts();
    });

  document.querySelector(".checkout")
    ?.addEventListener("click", () => {
      if (!cart.length) return alert("No items in cart");
      openPaymentModal(cart.reduce((s, i) => s + i.total, 0));
    });

  document.getElementById("searchInput")
    ?.addEventListener("input", e => {
      renderProducts(e.target.value.toLowerCase());
    });

  document.getElementById("stocksBtn")
    ?.addEventListener("click", openStocks);

  document.getElementById("salesBtn")
    ?.addEventListener("click", openSales);

  enableWakeLock();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") enableWakeLock();
  });

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

  setInterval(refreshInventoryOnly, 30000);
});

/* =========================================================
   DATA LOADING
========================================================= */
async function loadAllData() {
  const today = new Date().toISOString().slice(0, 10);

  const [
    cat, prod, rec, inv
  ] = await Promise.all([
    fetch(`${API_URL}?type=categories`).then(r => r.json()),
    fetch(`${API_URL}?type=products`).then(r => r.json()),
    fetch(`${API_URL}?type=allProductRecipes`).then(r => r.json()),
    fetch(`${API_URL}?type=dailyInventoryItems&date=${today}&location=${LOCATION}`).then(r => r.json())
  ]);

  categories = Array.isArray(cat) ? cat : [];
  products = Array.isArray(prod) ? prod : [];
  recipes = rec || {};

  inventory = {};
  inv.forEach(r => inventory[r.item_id] = Number(r.remaining) || 0);

  lastInventorySnapshot = JSON.parse(JSON.stringify(inventory));
}

/* =========================================================
   INVENTORY REFRESH (SAFE)
========================================================= */
async function refreshInventoryOnly() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `${API_URL}?type=dailyInventoryItems&date=${today}&location=${LOCATION}`
    );
    const rows = await res.json();
    if (!Array.isArray(rows)) return;

    const fresh = {};
    rows.forEach(r => fresh[r.item_id] = Number(r.remaining) || 0);

    if (JSON.stringify(fresh) !== JSON.stringify(lastInventorySnapshot)) {
      inventory = fresh;
      lastInventorySnapshot = JSON.parse(JSON.stringify(fresh));

      cart = cart.filter(i => {
        const p = products.find(p => p.product_id === i.product_id);
        return p && canSell(p, i.qty);
      });

      renderProducts();
      renderCart();
      showStockBanner();
    }
  } catch (e) {
    console.warn("Inventory refresh failed", e.message);
  }
}

/* =========================================================
   INVENTORY CHECK
========================================================= */
function canSell(product, qty = 1) {
  const recipe = recipes[product.product_id];
  if (!recipe?.length) return false;

  return recipe.every(r => {
    return (inventory[r.item_id] || 0) >= Number(r.qty_used) * qty;
  });
}

/* =========================================================
   UI RENDERING
========================================================= */
function renderCategories() {
  const el = document.querySelector(".categories-panel");
  el.innerHTML = "";
  el.appendChild(createCategoryBtn("All", null, true));

  categories.forEach(c =>
    el.appendChild(createCategoryBtn(c.category_name, c.category_id))
  );
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
        <div class="product-img">
          <img src="${p.image_url || "images/placeholder.png"}">
        </div>
        <div class="product-info">
          <div class="product-code">${p.product_code}</div>
          <div class="product-name">${p.product_name}</div>
          <div class="product-price">₱${Number(p.price).toFixed(2)}</div>
        </div>`;
      if (!disabled) card.onclick = () => addToCart(p);
      grid.appendChild(card);
    });
}

/* =========================================================
   CART
========================================================= */
function addToCart(p) {
  const e = cart.find(i => i.product_id === p.product_id);
  const next = e ? e.qty + 1 : 1;

  if (!canSell(p, next)) return alert("❌ Not enough stock");

  if (e) {
    e.qty = next;
    e.total = e.qty * e.price;
  } else {
    cart.push({
      product_id: p.product_id,
      product_name: p.product_name,
      price: Number(p.price),
      qty: 1,
      total: Number(p.price)
    });
  }

  setTimeout(renderCart, 0);
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
      </tr>`;
  });

  sumEl.textContent = sum.toFixed(2);
}

/* =========================================================
   FULLSCREEN
========================================================= */
function toggleFullscreen() {
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

document.addEventListener("fullscreenchange", () => {
  const btn = document.getElementById("fullscreenBtn");
  if (btn) btn.textContent = document.fullscreenElement ? "⛶ Exit" : "⛶";
});

/* =========================================================
   EXPOSE FUNCTIONS
========================================================= */
window.keypadInput = keypadInput;
window.keypadBackspace = keypadBackspace;
window.confirmPayment = confirmPayment;
window.closePaymentModal = closePaymentModal;