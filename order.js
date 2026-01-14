/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

window.API_URL = API_URL;

/* =========================================================
   SESSION
========================================================= */
const LOCATION = localStorage.getItem("userLocation");
const STAFF_ID = localStorage.getItem("staff_id");
const CASHIER_NAME = localStorage.getItem("userName") || "";
const CASHIER_POSITION = localStorage.getItem("userPosition") || "";

if (!LOCATION || !STAFF_ID) {
  alert("Unauthorized POS access");
  location.replace("index.html");
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

let syncing = false;
let CHECKOUT_IN_PROGRESS = false;

/* =========================================================
   DATE HELPERS
========================================================= */
function getPHDate() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  ).toISOString().slice(0, 10);
}

function isSameBusinessDay(ts) {
  const today = getPHDate();
  const d = new Date(ts)
    .toLocaleString("en-US", { timeZone: "Asia/Manila" })
    .slice(0, 10);
  return today === d;
}

/* =========================================================
   OFFLINE STORAGE (IndexedDB WRAPPER)
========================================================= */
const DB_NAME = "pos_offline";
const STORE = "orders";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePendingOrder(order) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(order);
  return tx.complete;
}

async function getPendingOrders() {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  return new Promise(resolve => {
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function deletePendingOrder(id) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  return tx.complete;
}

async function purgeOldPendingOrders() {
  const orders = await getPendingOrders();
  for (const o of orders) {
    if (!isSameBusinessDay(o.created_at)) {
      await deletePendingOrder(o.id);
    }
  }
}

/* =========================================================
   OFFLINE-FIRST CHECKOUT (ONLY PATH)
========================================================= */
async function checkoutOfflineSafe(cartItems) {
  const order = {
    id: "OFF-" + Date.now(),
    created_at: Date.now(),
    retries: 0,
    payload: {
      action: "checkoutOrder",
      ref_id: "POS-" + Date.now(),
      location: LOCATION,
      staff_id: STAFF_ID,
      items: JSON.stringify(
        cartItems.map(i => ({
          product_id: i.product_id,
          qty: i.qty,
          price: i.price,
          total: i.total
        }))
      )
    }
  };

  await savePendingOrder(order);
  clearCart();
  showToast("✅ Order saved");
  setTimeout(syncPendingOrders, 500);
}

/* =========================================================
   SYNC ENGINE
========================================================= */
async function syncPendingOrders() {
  if (!navigator.onLine || syncing) return;

  const orders = await getPendingOrders();
  const todayOrders = orders.filter(o => isSameBusinessDay(o.created_at));
  if (!todayOrders.length) {
    updateStatusBadge();
    updatePendingBadge();
    return;
  }

  syncing = true;
  updateStatusBadge();

  for (const order of todayOrders) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: new URLSearchParams(order.payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      await deletePendingOrder(order.id);
    } catch (err) {
      order.retries++;
      await savePendingOrder(order);
    }
  }

  syncing = false;
  updateStatusBadge();
  updatePendingBadge();
}

/* =========================================================
   STATUS BADGE
========================================================= */
async function updateStatusBadge() {
  const el = document.getElementById("statusBadge");
  if (!el) return;

  const orders = await getPendingOrders();
  const pending = orders.filter(o => isSameBusinessDay(o.created_at)).length;

  let status = "online";
  if (!navigator.onLine) status = "offline";
  if (pending && syncing) status = "syncing";

  el.className = `status ${status}`;
  el.textContent =
    status === "offline"
      ? "Offline – Orders saved"
      : status === "syncing"
      ? `Syncing ${pending} orders`
      : "Online";
}

async function updatePendingBadge() {
  const el = document.getElementById("pendingBadge");
  if (!el) return;

  const orders = await getPendingOrders();
  const count = orders.filter(o => isSameBusinessDay(o.created_at)).length;
  el.textContent = count ? `⏳ ${count}` : "";
}

/* =========================================================
   LOAD DATA
========================================================= */
async function loadAllData() {
  const today = getPHDate();

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
   UI — CATEGORIES
========================================================= */
function renderCategories() {
  const el = document.querySelector(".categories-top");
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
   UI — PRODUCTS
========================================================= */
function renderProducts(search = "") {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  products
    .filter(p => p.active)
    .filter(p => !activeCategoryId || p.category_id === activeCategoryId)
    .filter(p => `${p.product_name} ${p.product_code}`.toLowerCase().includes(search))
    .forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="product-name">${p.product_name}</div>
        <div class="product-price">₱${Number(p.price).toFixed(2)}</div>
      `;
      card.onclick = () => addToCart(p);
      grid.appendChild(card);
    });
}

/* =========================================================
   UI — CART
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

function clearCart() {
  cart = [];
  renderCart();
  renderProducts();
}

/* =========================================================
   UTIL
========================================================= */
function showToast(msg, ms = 2000) {
  const t = document.createElement("div");
  t.textContent = msg;
  Object.assign(t.style, {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#2ecc71",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: "8px",
    zIndex: 9999
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("cashierName").textContent = CASHIER_NAME;
  document.getElementById("cashierPosition").textContent = CASHIER_POSITION;
  document.getElementById("cashierLocation").textContent = LOCATION;

  document.querySelector(".checkout")?.addEventListener("click", () => {
    if (!cart.length) return alert("No items in cart");
    checkoutOfflineSafe([...cart]);
  });

  await purgeOldPendingOrders();
  await loadAllData();
  renderCategories();
  renderProducts();
  renderCart();

  syncPendingOrders();
  updateStatusBadge();
  updatePendingBadge();
});