/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

window.API_URL = API_URL;

let POS_LOCKED = true;
let PIN_ACTION = "unlock";
const MANAGER_PIN = "1234";

let relockTimer = null;

/* =========================================================
   LAYOUT
========================================================= */
function enforceBodyLayout() {
  document.body.style.display = "flex";
  document.body.style.flexDirection = "column";
  document.body.style.height = "100vh";
}

function getPHDate() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  ).toISOString().slice(0, 10);
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

let CHECKOUT_IN_PROGRESS = false;
let syncing = false;

/* =========================================================
   OFFLINE-SAFE CHECKOUT (ONLY PATH)
========================================================= */
async function checkoutOfflineSafe(cartItems) {
  const order = {
    id: "OFF-" + Date.now(),
    payload: {
      action: "checkoutOrder",
      ref_id: "POS-" + Date.now(),
      items: JSON.stringify(
        cartItems.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          qty: Number(i.qty),
          price: Number(i.price),
          total: Number(i.total)
        }))
      ),
      location: LOCATION,
      staff_id: STAFF_ID,
      cashier: CASHIER_NAME
    },
    retries: 0,
    created_at: Date.now()
  };

  await savePendingOrder(order);

  clearCart();
  showToast("✅ Order saved");

  CHECKOUT_IN_PROGRESS = false;

  setTimeout(syncPendingOrders, 500);
}

/* =========================================================
   DISABLE LEGACY CHECKOUT (CRITICAL)
========================================================= */
async function checkoutPOS() {
  alert("❌ Legacy checkout disabled. POS uses offline-safe checkout.");
  return;
}

async function updatePendingBadge() {
  const el = document.getElementById("pendingBadge");
  if (!el) return;

  const orders = await getPendingOrders();
  const todayOrders = orders.filter(o =>
    isSameBusinessDay(o.created_at)
  );

  el.textContent = todayOrders.length
    ? `⏳ ${todayOrders.length}`
    : "";
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
      console.log("✅ Synced:", order.payload.ref_id);
    } catch (err) {
      order.retries = (order.retries || 0) + 1;
      await savePendingOrder(order);
      console.error("❌ Sync failed:", err);
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

/* =========================================================
   UTILITIES
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
    zIndex: 9999,
    fontWeight: 600
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function clearCart() {
  cart = [];
  renderCart();
  renderProducts();
}

function isSameBusinessDay(ts) {
  const today = getPHDate();
  const d = new Date(ts)
    .toLocaleString("en-US", { timeZone: "Asia/Manila" })
    .slice(0, 10);
  return today === d;
}

async function purgeOldPendingOrders() {
  const orders = await getPendingOrders();
  for (const o of orders) {
    if (!isSameBusinessDay(o.created_at)) {
      await deletePendingOrder(o.id);
      console.log("🧹 Purged old offline order:", o.id);
    }
  }
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
    openPaymentModal(cart.reduce((s, i) => s + i.total, 0));
  });

  await purgeOldPendingOrders();
  await syncPendingOrders();
  updateStatusBadge();
  updatePendingBadge();

  await loadAllData();
  renderCategories();
  renderProducts();
  renderCart();
});

/* =========================================================
   ⬇⬇ EVERYTHING BELOW THIS IS UNCHANGED ⬇⬇
   (products, cart, payment, inventory, sales, etc.)
========================================================= */

/* 🔒 your remaining original functions stay EXACTLY as-is */