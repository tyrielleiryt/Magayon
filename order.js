const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let products = [];
let categories = [];
let cart = [];

let inventoryRemaining = {};
let recipeCache = {};
let reservedInventory = {};

let activeCategory = "ALL";
let isCheckingOut = false;

const LOCATION = "MAIN";
const LOW_STOCK_THRESHOLD = 5;

/* ================= SAFE DOM HELPER ================= */
function $(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`⚠ Missing element #${id}`);
  return el;
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  await loadCategories();
  await loadInventoryRemaining();
  await loadProductRecipes();
  await loadProducts();
});

/* ================= LOAD CATEGORIES ================= */
async function loadCategories() {
  categories = await fetch(API_URL + "?type=categories").then(r => r.json());
  renderCategories();
}

function renderCategories() {
  const box = $("categoryList");
  if (!box) return;

  box.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "category-btn active";
  allBtn.textContent = "All Categories";
  allBtn.onclick = () => setCategory("ALL");
  box.appendChild(allBtn);

  categories.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "category-btn";
    btn.textContent = c.category_name;
    btn.onclick = () => setCategory(c.category_id);
    box.appendChild(btn);
  });
}

function setCategory(id) {
  activeCategory = id;

  document.querySelectorAll(".category-btn").forEach(b =>
    b.classList.remove("active")
  );
  event.target.classList.add("active");

  renderProducts(products);
}

/* ================= INVENTORY ================= */
async function loadInventoryRemaining() {
  inventoryRemaining = {};
  reservedInventory = {};

  const data = await fetch(
    API_URL +
      "?type=dailyRemainingInventory" +
      "&date=" + encodeURIComponent(new Date()) +
      "&location=" + LOCATION
  ).then(r => r.json());

  data.forEach(i => {
    inventoryRemaining[i.item_id] = Number(i.remaining || 0);
  });
}

/* ================= RECIPES ================= */
async function loadProductRecipes() {
  const list = await fetch(API_URL + "?type=products").then(r => r.json());

  for (const p of list) {
    recipeCache[p.product_id] = await fetch(
      API_URL + `?type=productRecipes&product_id=${p.product_id}`
    ).then(r => r.json());
  }
}

/* ================= PRODUCTS ================= */
async function loadProducts() {
  products = await fetch(API_URL + "?type=products").then(r => r.json());
  renderProducts(products);
}

function renderProducts(list) {
  const grid = $("productGrid");
  if (!grid) return;

  grid.innerHTML = "";

  list
    .filter(p => activeCategory === "ALL" || p.category_id === activeCategory)
    .forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";

      card.innerHTML = `
        <div class="product-img">
          <img src="${p.image_url || "placeholder.png"}">
        </div>
        <div class="product-info">
          <div class="product-name">${p.product_name}</div>
          <div class="product-price">₱${Number(p.price).toFixed(2)}</div>
        </div>
      `;

      card.onclick = () => addToCart(p);
      grid.appendChild(card);
    });
}

/* ================= CART ================= */
function addToCart(product) {
  const row = cart.find(i => i.product_id === product.product_id);

  if (row) {
    row.qty++;
    row.total = row.qty * row.price;
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
}

function renderCart() {
  const tbody = $("orderTable");
  const sumEl = $("sumTotal");
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
      </tr>
    `;
  });

  sumEl.textContent = sum.toFixed(2);
}

/* ================= CLEAR ================= */
$("clearOrderBtn")?.addEventListener("click", () => {
  cart = [];
  renderCart();
});

/* ================= CHECKOUT ================= */
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
    }

    alert("Order completed");
    cart = [];
    renderCart();

  } catch (e) {
    alert("Checkout failed");
  }

  isCheckingOut = false;
}

document.querySelector(".checkout")?.addEventListener("click", checkoutPOS);