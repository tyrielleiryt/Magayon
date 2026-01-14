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
  if (window.innerWidth < 900 || window.innerHeight < 600) {
    document.body.classList.add("ultra-dense");
  } else {
    document.body.classList.remove("ultra-dense");
  }
}

window.addEventListener("resize", autoDetectDenseMode);
document.addEventListener("DOMContentLoaded", autoDetectDenseMode);

/* =========================================================
   DATE (PH)
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
  loader.querySelector(".loader-text").textContent = text || "Loading…";
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
document.addEventListener("DOMContentLoaded", async function () {
  const n = document.getElementById("cashierName");
  const p = document.getElementById("cashierPosition");
  const l = document.getElementById("cashierLocation");
  if (n) n.textContent = CASHIER_NAME;
  if (p) p.textContent = CASHIER_POSITION;
  if (l) l.textContent = LOCATION;

  const fsBtn = document.getElementById("fullscreenBtn");
  if (fsBtn) fsBtn.addEventListener("click", toggleFullscreen);

  const search = document.getElementById("searchInput");
  if (search) {
    search.addEventListener("input", function (e) {
      renderProducts(e.target.value.toLowerCase());
    });
  }

  const clearBtn = document.getElementById("clearOrderBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      cart = [];
      renderCart();
      renderProducts();
    });
  }

  const checkoutBtn = document.querySelector(".checkout");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", function () {
      if (!cart.length) {
        alert("No items in cart");
        return;
      }
      openPaymentModal(
        cart.reduce(function (s, i) {
          return s + i.total;
        }, 0)
      );
    });
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
    res[3].forEach(function (r) {
      inventory[r.item_id] = Number(r.remaining) || 0;
    });
  }
}

/* =========================================================
   INVENTORY CHECK
========================================================= */
function canSell(product, qty) {
  if (!Object.keys(inventory).length) return true;
  const recipe = recipes[product.product_id];
  if (!recipe) return false;

  return recipe.every(function (r) {
    const available = inventory[r.item_id] || 0;
    return available >= Number(r.qty_used) * qty;
  });
}

/* =========================================================
   CATEGORIES
========================================================= */
function createCategoryBtn(name, id, active) {
  const btn = document.createElement("button");
  btn.className = "category-btn" + (active ? " active" : "");
  btn.textContent = name;

  btn.onclick = function () {
    activeCategoryId = id;
    const all = document.querySelectorAll("#categoryList .category-btn");
    for (let i = 0; i < all.length; i++) {
      all[i].classList.remove("active");
    }
    btn.classList.add("active");
    renderProducts();
  };

  return btn;
}

function renderCategories() {
  const el = document.getElementById("categoryList");
  if (!el) return;

  el.innerHTML = "";
  el.appendChild(createCategoryBtn("All", null, true));

  categories.forEach(function (c) {
    el.appendChild(
      createCategoryBtn(c.category_name, c.category_id, false)
    );
  });
}

/* =========================================================
   PRODUCTS
========================================================= */
function renderProducts(search) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  grid.innerHTML = "";
  search = search || "";

  products
    .filter(function (p) {
      return p.active === true || p.active === "TRUE";
    })
    .filter(function (p) {
      return !activeCategoryId || p.category_id === activeCategoryId;
    })
    .filter(function (p) {
      return (
        (p.product_name + " " + p.product_code)
          .toLowerCase()
          .indexOf(search) !== -1
      );
    })
    .forEach(function (p) {
      const disabled = !canSell(p, 1);

      const card = document.createElement("div");
      card.className = "product-card" + (disabled ? " disabled" : "");

      card.innerHTML =
        '<div class="product-img">' +
        '<img src="' +
        (p.image_url || "images/placeholder.png") +
        '">' +
        "</div>" +
        '<div class="product-info">' +
        '<div class="product-code">' +
        p.product_code +
        "</div>" +
        '<div class="product-name">' +
        p.product_name +
        "</div>" +
        '<div class="product-price">₱' +
        Number(p.price).toFixed(2) +
        "</div>" +
        "</div>";

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
  if (found) {
    found.qty++;
    found.total = found.qty * found.price;
  } else {
    cart.push({
      product_id: p.product_id,
      product_name: p.product_name,
      qty: 1,
      price: Number(p.price),
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

  cart.forEach(function (i, idx) {
    sum += i.total;
    tbody.innerHTML +=
      "<tr>" +
      "<td>" +
      (idx + 1) +
      "</td>" +
      "<td>" +
      i.product_name +
      "</td>" +
      "<td>" +
      i.qty +
      "</td>" +
      "<td>₱" +
      i.price.toFixed(2) +
      "</td>" +
      "<td>₱" +
      i.total.toFixed(2) +
      "</td>" +
      "</tr>";
  });

  sumEl.textContent = sum.toFixed(2);
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
   DEBUG
========================================================= */
window.__products = function () {
  return products;
};
window.__categories = function () {
  return categories;
};
window.__inventory = function () {
  return inventory;
};