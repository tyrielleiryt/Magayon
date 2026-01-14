/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

window.API_URL = API_URL;

let POS_LOCKED = true;
let PIN_ACTION = "unlock";
const MANAGER_PIN = "1234";
const LOW_STOCK_THRESHOLD = 5;

let relockTimer = null;

/* =========================================================
   DENSE MODE
========================================================= */
function autoDetectDenseMode() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (w < 900 || h < 600) {
    document.body.classList.add("ultra-dense");
  } else {
    document.body.classList.remove("ultra-dense");
  }
}

window.addEventListener("resize", autoDetectDenseMode);
document.addEventListener("DOMContentLoaded", autoDetectDenseMode);

/* =========================================================
   DATE
========================================================= */
function getPHDate() {
  const now = new Date();
  const ph = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  return ph.toISOString().slice(0, 10);
}

/* =========================================================
   SESSION
========================================================= */
const LOCATION = localStorage.getItem("userLocation");
const STAFF_ID = localStorage.getItem("staff_id");
const CASHIER_NAME = localStorage.getItem("userName") || "";
const CASHIER_POSITION = localStorage.getItem("userPosition") || "";

if (!LOCATION || !STAFF_ID) {
  alert("Unauthorized POS access");
  window.location.replace("index.html");
}

/* =========================================================
   LOADER
========================================================= */
function showLoader(text) {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;
  const t = loader.querySelector(".loader-text");
  if (t) t.textContent = text || "Loading…";
  loader.classList.remove("hidden");
}

function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (loader) loader.classList.add("hidden");
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

  const fsBtn = document.getElementById("fullscreenBtn");
  if (fsBtn) fsBtn.addEventListener("click", toggleFullscreen);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js");
  }

  showLoader("Loading POS data…");

  try {
    await loadAllData();
    renderCategories();
    renderProducts();
    renderCart();
  } catch (e) {
    console.error(e);
    alert("Failed to load POS data");
  } finally {
    hideLoader();
  }

  const clearBtn = document.getElementById("clearOrderBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      cart = [];
      renderCart();
      renderProducts();
    });
  }

  const checkoutBtn = document.querySelector(".checkout");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      if (!cart.length) {
        alert("No items in cart");
        return;
      }
      openPaymentModal(cart.reduce((s, i) => s + i.total, 0));
    });
  }

  const search = document.getElementById("searchInput");
  if (search) {
    search.addEventListener("input", e => {
      renderProducts(e.target.value.toLowerCase());
    });
  }
});

/* =========================================================
   LOAD DATA
========================================================= */
async function loadAllData() {
  const today = getPHDate();

  const res = await Promise.all([
    fetch(API_URL + "?type=categories").then(r => r.json()),
    fetch(API_URL + "?type=products").then(r => r.json()),
    fetch(API_URL + "?type=allProductRecipes").then(r => r.json()),
    fetch(
      API_URL +
        "?type=dailyInventoryItems&date=" +
        today +
        "&location=" +
        LOCATION
    ).then(r => r.json())
  ]);

  categories = Array.isArray(res[0]) ? res[0] : [];
  products = Array.isArray(res[1]) ? res[1] : [];
  recipes = res[2] || {};
  inventory = {};

  if (Array.isArray(res[3])) {
    res[3].forEach(r => {
      inventory[r.item_id] = Number(r.remaining) || 0;
    });
  }
}

/* =========================================================
   INVENTORY
========================================================= */
function canSell(product, qty) {
  if (!Object.keys(inventory).length) return true;

  const recipe = recipes[product.product_id];
  if (!recipe) return false;

  return recipe.every(r => {
    const have = inventory[r.item_id] || 0;
    return have >= Number(r.qty_used) * qty;
  });
}

function getLowStockItems(product, qty) {
  if (!Object.keys(inventory).length) return [];
  const recipe = recipes[product.product_id];
  if (!recipe) return [];

  return recipe.filter(r => {
    const have = inventory[r.item_id] || 0;
    return have - r.qty_used * qty <= LOW_STOCK_THRESHOLD;
  });
}

/* =========================================================
   CATEGORIES
========================================================= */
function renderCategories() {
  const el = document.getElementById("categoryList");
  if (!el) return;

  el.innerHTML = "";
  el.appendChild(createCategoryBtn("All", null, true));

  categories.forEach(c => {
    el.appendChild(createCategoryBtn(c.category_name, c.category_id));
  });
}

function createCategoryBtn(name, id, active) {
  const btn = document.createElement("button");
  btn.className = "category-btn" + (active ? " active" : "");
  btn.textContent = name;

  btn.onclick = () => {
    activeCategoryId = id;
    const all = document.querySelectorAll(".category-btn");
    for (let i = 0; i < all.length; i++) {
      all[i].classList.remove("active");
    }
    btn.classList.add("active");
    renderProducts();
  };

  return btn;
}

/* =========================================================
   PRODUCTS
========================================================= */
function renderProducts(search) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  grid.innerHTML = "";

  products
    .filter(p => p.active === true || p.active === "TRUE")
    .filter(p => !activeCategoryId || p.category_id === activeCategoryId)
    .filter(p =>
      (p.product_name + " " + p.product_code)
        .toLowerCase()
        .includes(search || "")
    )
    .forEach(p => {
      const disabled = !canSell(p, 1);
      const card = document.createElement("div");
      card.className =
        "product-card" + (disabled ? " disabled" : "");

      card.innerHTML =
        '<div class="product-img"><img src="' +
        (p.image_url || "images/placeholder.png") +
        '"></div>' +
        '<div class="product-info">' +
        '<div class="product-code">' +
        p.product_code +
        "</div>" +
        '<div class="product-name">' +
        p.product_name +
        "</div>" +
        '<div class="product-price">₱' +
        Number(p.price).toFixed(2) +
        "</div></div>";

      if (!disabled) {
        card.onclick = function () {
          addToCart(p);
        };
      }

      grid.appendChild(card);
    });
}

/* =========================================================
   CART
========================================================= */
function addToCart(p) {
  const found = cart.find(i => i.product_id === p.product_id);
  const nextQty = found ? found.qty + 1 : 1;

  if (!canSell(p, nextQty)) {
    alert("Not enough stock");
    return;
  }

  if (found) {
    found.qty++;
    found.total = found.qty * found.price;
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
  if (!tbody || !sumEl) return;

  tbody.innerHTML = "";
  let sum = 0;

  cart.forEach((i, idx) => {
    sum += i.total;
    tbody.innerHTML +=
      "<tr><td>" +
      (idx + 1) +
      "</td><td>" +
      i.product_name +
      "</td><td>" +
      i.qty +
      "</td><td>₱" +
      i.price.toFixed(2) +
      "</td><td>₱" +
      i.total.toFixed(2) +
      "</td></tr>";
  });

  sumEl.textContent = sum.toFixed(2);
}

/* =========================================================
   PAYMENT
========================================================= */
let pendingPayment = null;
let paidValue = "0";

function openPaymentModal(total) {
  pendingPayment = { total: total };
  paidValue = "0";

  document.getElementById("payTotal").textContent =
    "₱" + total.toFixed(2);
  document.getElementById("paidDisplay").textContent = "₱0.00";
  document.getElementById("changeAmount").textContent = "₱0.00";

  const btn = document.getElementById("confirmPaymentBtn");
  btn.disabled = true;
  btn.classList.remove("enabled");

  document.getElementById("paymentModal").classList.remove("hidden");
}

function closePaymentModal() {
  document.getElementById("paymentModal").classList.add("hidden");
}

function keypadInput(v) {
  if (v === "." && paidValue.indexOf(".") !== -1) return;
  if (paidValue === "0" && v !== ".") paidValue = v;
  else paidValue += v;
  updatePaid();
}

function keypadBackspace() {
  paidValue = paidValue.slice(0, -1) || "0";
  updatePaid();
}

function updatePaid() {
  const paid = Number(paidValue) || 0;
  const total = pendingPayment ? pendingPayment.total : 0;

  document.getElementById("paidDisplay").textContent =
    "₱" + paid.toFixed(2);

  const change = Math.max(paid - total, 0);
  document.getElementById("changeAmount").textContent =
    "₱" + change.toFixed(2);

  const btn = document.getElementById("confirmPaymentBtn");
  btn.disabled = paid < total;
  btn.classList.toggle("enabled", paid >= total);
}

function confirmPayment() {
  if (!pendingPayment) return;
  if (Number(paidValue) < pendingPayment.total) return;

  window.__lastPayment = true;
  closePaymentModal();
  checkoutPOS();
}

/* =========================================================
   FULLSCREEN
========================================================= */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

/* =========================================================
   EXPOSE
========================================================= */
window.keypadInput = keypadInput;
window.keypadBackspace = keypadBackspace;
window.confirmPayment = confirmPayment;
window.closePaymentModal = closePaymentModal;