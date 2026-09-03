
/* =========================================================
   CONFIG
========================================================= */
import { API_URL } from "./firebase-config.js";
import { ROLES, requireRole, logout, authFetch } from "./auth-guard.js";

window.API_URL = API_URL; // kept for any legacy code expecting a global

const LOW_STOCK_THRESHOLD = 5; // fallback only, for items with no reorder_level set
let SYNC_IN_PROGRESS = false;

// Auto-detect very small usable screens
function autoDetectDenseMode() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (w < 900 || h < 600) {
    document.body.classList.add("ultra-dense");
  } else {
    document.body.classList.remove("ultra-dense");
  }
}

let POS_CLOSED = false;
let chatBox = null;
let POS_CHAT_ENABLED = true; // 🔒 admin can disable POS chat

function getStaffId() {
  return localStorage.getItem("staff_id") || "kiosk";
}

function getLocation() {
  return localStorage.getItem("userLocation") || "DEFAULT_LOC";
}

function getLowStockThreshold(itemId) {
  const level = inventoryReorderLevels[itemId];
  return level === undefined ? LOW_STOCK_THRESHOLD : level;
}

Object.defineProperty(window, "STAFF_ID", {
  get: () => getStaffId()
});

Object.defineProperty(window, "LOCATION", {
  get: () => getLocation()
});

function exitSalesOnlyMode() {
  POS_CLOSED = false;

  document.body.classList.remove("sales-only");

  // Enable checkout
  const checkoutBtn = document.querySelector(".checkout");
  if (checkoutBtn) checkoutBtn.disabled = false;


   // 🔁 Re-render products to restore click handlers
  renderProducts();


  // Re-enable product clicks
  document.querySelectorAll(".product-card").forEach(card => {
    card.classList.remove("disabled");
  });

  // Remove banner
  document.getElementById("salesOnlyBanner")?.remove();
}

function enterSalesOnlyMode() {
  document.body.classList.add("sales-only");

  // Disable checkout
  const checkoutBtn = document.querySelector(".checkout");
  if (checkoutBtn) checkoutBtn.disabled = true;

  // Disable product clicks
  document.querySelectorAll(".product-card").forEach(card => {
    card.classList.add("disabled");
    card.onclick = null;
  });

  // Show banner
  showSalesOnlyBanner();
}

function ensurePOSSession() {
  if (!localStorage.getItem("staff_id")) {
    console.warn("Healing POS session");

    localStorage.setItem("staff_id", "kiosk");
    localStorage.setItem("userLocation", "DEFAULT_LOC");
    localStorage.setItem("userName", "POS Kiosk");
    localStorage.setItem("userPosition", "cashier");
  }
}

function applyInventoryGate(inventoryRows) {
  if (!Array.isArray(inventoryRows) || inventoryRows.length === 0) {
    POS_CLOSED = true;
    enterSalesOnlyMode();
    return;
  }

  POS_CLOSED = false;
  exitSalesOnlyMode();
}

function showSalesOnlyBanner() {
  if (document.getElementById("salesOnlyBanner")) return;

  const banner = document.createElement("div");
  banner.id = "salesOnlyBanner";
  banner.innerHTML = `
    🔒 Inventory Closed<br>
    Automatically closed at end of day.<br>
    Please wait for admin to start a new day.
  `;
  document.body.prepend(banner);
}

window.addEventListener("resize", autoDetectDenseMode);
document.addEventListener("DOMContentLoaded", autoDetectDenseMode);

function getPHDate() {
  const now = new Date();
  const ph = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  return ph.toISOString().slice(0, 10);
}

document.addEventListener("fullscreenchange", () => {
});


const CASHIER_NAME = localStorage.getItem("userName") || "";
const CASHIER_POSITION = localStorage.getItem("userPosition") || "";

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

/* ================= TOAST ================= */

let inventoryToastTimer = null;

function showInventoryToast(text) {
  const el = document.getElementById("inventoryToast");
  if (!el) return;

  el.textContent = text;
  el.classList.add("show");

  clearTimeout(inventoryToastTimer);
  inventoryToastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2000);
}

/* =========================================================
   STATE
========================================================= */
let products = [];
let categories = [];
let recipes = {};        // product_id → recipe[]
let inventory = {};      // item_id → remaining
let inventoryNames = {};  // item_id → item_name ✅ ADD THIS
let inventoryReorderLevels = {}; // item_id → reorder_level (per-item low-stock threshold)
let cart = [];
let activeCategoryId = null;

window.showRecipeInfo = function (productId, event) {
  event.stopPropagation();

  const recipe = recipes[productId];

  if (!recipe || !recipe.length) {
    alert("🧪 No recipe assigned for this product");
    return;
  }

  const lines = recipe.map(r => {
    const available = inventory[r.item_id] ?? 0;
    const needed = Number(r.qty_used);
const itemName =
  inventoryNames[r.item_id] ||
  r.item_name ||
  r.item_id;

    let status = "✅ OK";
    if (available === 0) status = "❌ OUT";
    else if (available <= getLowStockThreshold(r.item_id)) status = "⚠️ LOW";

    return `• ${itemName}: ${available} left (uses ${needed}) ${status}`;
  });

  alert("🧪 Recipe & Inventory\n\n" + lines.join("\n"));
};

/* =========================================================
   WAKE LOCK (TABLET ANTI-SLEEP)
========================================================= */
let wakeLock = null;

async function enableWakeLock() {
  try {
    if (!("wakeLock" in navigator)) return;
    if (wakeLock) return; // ⛔ already active

    wakeLock = await navigator.wakeLock.request("screen");
    console.log("🔒 Wake Lock enabled");

    wakeLock.addEventListener("release", () => {
      console.log("🔓 Wake Lock released");
      wakeLock = null;
    });
  } catch (err) {
    console.warn("Wake Lock failed:", err.message);
  }
}

function disableWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}



/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  // Real login/role check — replaces the removed no-login "kiosk" fallback.
  // Redirects to index.html and never resolves if not signed in / inactive.
  await requireRole([ROLES.CASHIER, ROLES.ADMIN, ROLES.IT_ADMIN, ROLES.OWNER]);

  
  document.getElementById("cashierName").textContent = CASHIER_NAME;
  document.getElementById("cashierPosition").textContent = CASHIER_POSITION;
  document.getElementById("cashierLocation").textContent = LOCATION;
  document.getElementById("fullscreenBtn")
  ?.addEventListener("click", toggleFullscreen);
  document.getElementById("productTrackerBtn")
  ?.addEventListener("click", loadPOSProductSaleTracker);
enableWakeLock();



  /* ================= CHAT INIT ================= */

   chatBox = document.getElementById("chatBox");
  const chatToggle = document.getElementById("posChatToggle");

  if (chatBox && chatToggle) {
    initChatUI();

chatToggle.addEventListener("click", () => {
  if (!POS_CHAT_ENABLED) {
    alert("💬 Chat is currently disabled by admin");
    return;
  }

  chatBox.classList.toggle("hidden");

  // ✅ CLEAR unread badge when opening chat
  if (!chatBox.classList.contains("hidden")) {
    const badge = document.getElementById("chatUnreadBadge");
    if (badge) {
      badge.textContent = "";
      badge.classList.add("hidden");
    }

    loadPOSChat();
    document.getElementById("chatInput")?.focus();
  }
});
  }

if ("serviceWorker" in navigator) {
  // Was commented out — meaning offline mode never actually activated,
  // on top of the broken precache list fixed in service-worker.js.
  navigator.serviceWorker
    .register("./service-worker.js")
    .catch(err => console.warn("Service worker registration failed:", err));
}

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

  document
  .getElementById("syncInventoryBtn")
  ?.addEventListener("click", () => {
    refreshInventoryOnly();
  });


  

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (!confirm("Log out?")) return;
    logout();
  });

  document.querySelector(".checkout")?.addEventListener("click", () => {
  if (!cart.length) {
    alert("No items in cart");
    return;
  }
  openPaymentModal(cart.reduce((sum, i) => sum + i.total, 0));
});

  document.getElementById("clearOrderBtn")?.addEventListener("click", () => {
    cart = [];
    renderCart();
    renderProducts();
  });

  document.getElementById("searchInput")?.addEventListener("input", e => {
    renderProducts(e.target.value.toLowerCase());
  });

    updateSyncCounter(); // 👈 ADD THIS
    chatBox?.classList.add("hidden");

});

/* =========================================================
   LOAD ALL DATA
========================================================= */
async function loadAllData() {
  const today = getPHDate();

  const [
    categoriesData,
    productsData,
    recipesData,
    inventoryResponse,
    inventoryItemsData
  ] = await Promise.all([
    fetch(`${API_URL}?type=categories`).then(r => r.json()),
    fetch(`${API_URL}?type=products`).then(r => r.json()),
    fetch(`${API_URL}?type=allProductRecipes`).then(r => r.json()),
    fetch(`${API_URL}?type=dailyInventoryItems&date=${today}&location=${LOCATION}`)
      .then(r => r.json()),
    fetch(`${API_URL}?type=inventoryItems`).then(r => r.json())
  ]);

  inventoryReorderLevels = {};
  (Array.isArray(inventoryItemsData) ? inventoryItemsData : []).forEach(i => {
    if (i.reorder_level !== undefined && i.reorder_level !== "") {
      inventoryReorderLevels[i.item_id] = Number(i.reorder_level);
    }
  });

  // 🔒 INVENTORY GATE
if (inventoryResponse.status !== "OPEN") {
  POS_CLOSED = true;
  enterSalesOnlyMode();
}
// continue loading products anyway

  const inventoryRows = inventoryResponse.items || [];

  applyInventoryGate(inventoryRows);

  inventory = {};
  inventoryNames = {};

  inventoryRows.forEach(r => {
    inventory[r.item_id] = Number(r.remaining) || 0;
    inventoryNames[r.item_id] = r.item_name;
  });

  categories = Array.isArray(categoriesData) ? categoriesData : [];
  products = Array.isArray(productsData) ? productsData : [];
  recipes = recipesData || {};

  localStorage.setItem("categories", JSON.stringify(categories));
  localStorage.setItem("products", JSON.stringify(products));
  localStorage.setItem("recipes", JSON.stringify(recipes));

}

async function loadProductSales(date, location) {
  const res = await fetch(
    `${API_URL}?type=productSalesTracker&date=${date}&location=${location}`
  );
  const data = await res.json();

  const tbody = document.getElementById("productSalesBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4">No sales</td></tr>`;
    return;
  }

  data.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td><b>${p.product_code || "-"}</b></td>
        <td>${p.product_name}</td>
        <td><strong>${p.qty_sold}</strong></td>
        <td>₱${Number(p.total_sales || 0).toFixed(2)}</td>
      </tr>
    `;
  });
}

/* =========================================================
   loadProductSales
========================================================= */

async function loadInventoryReconciliation(date, location) {
  const res = await fetch(
    `${API_URL}?type=inventoryReconciliation&date=${date}&location=${location}&_=${Date.now()}`
  );
  const data = await res.json();

  const tbody = document.getElementById("inventoryReconBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4">No inventory</td></tr>`;
    return;
  }

  data.forEach(i => {
    let rowClass = "";

    if (i.remaining < 0) rowClass = "danger-row";
    else if (i.remaining <= 5) rowClass = "warning-row";

    tbody.innerHTML += `
  <tr class="${rowClass}">
    <td>${i.item_name}</td>
    <td>${i.added}</td>
    <td>${i.consumed}</td>
    <td><strong>${i.remaining}</strong></td>
    <td>
      <strong>${i.quantity_left_display || "0"}</strong>
    </td>
  </tr>
`;
  });
}

/* =========================================================
   BELOW HELPERS Auto Inventory Refresh
========================================================= */

async function refreshInventoryOnly({ silent = false } = {}) {
  if (!navigator.onLine) return;
  if (document.getElementById("paymentModal")?.classList.contains("hidden") === false) return;

  const today = getPHDate();

  try {
    if (!silent) {
      showInventoryToast("🔄 Syncing inventory…");
    }

   const data = await fetch(
  `${API_URL}?type=dailyInventoryItems&date=${today}&location=${LOCATION}`
).then(r => r.json());

if (data.status !== "OPEN") {
  POS_CLOSED = true;
  enterSalesOnlyMode();
  return;
}

const rows = data.items || [];

inventory = {};
inventoryNames = {};

rows.forEach(r => {
  inventory[r.item_id] = Number(r.remaining) || 0;
  inventoryNames[r.item_id] = r.item_name;
});

applyInventoryGate(rows);
renderProducts(); // 🔥 update grid, LOW badges, disabled states
    window.__lastInventorySync = new Date();
    if (!silent) {
      showInventoryToast("✅ Inventory updated");
    }

  } catch (err) {
    console.warn("Inventory refresh failed", err);
    if (!silent) {
      showInventoryToast("⚠️ Inventory sync failed");
    }
  }
}


/* =========================================================
   INVENTORY CHECK
========================================================= */
function canSell(product, qty = 1) {
// 🚫 block selling if inventory not loaded yet
  if (!Object.keys(inventory).length) return false;
  
  const recipe = recipes[product.product_id];
  if (!recipe || !recipe.length) return false;

  return recipe.every(r => {
    const available = inventory[r.item_id] || 0;
    const needed = Number(r.qty_used) * qty;
    return available >= needed;
  });
}

/* =========================================================
   FOR LOCAL INVENTORY DEDUCTIONS
========================================================= */

function deductLocalInventory(cartItems) {
  cartItems.forEach(item => {
    const recipe = recipes[item.product_id];
    if (!recipe) return;

    recipe.forEach(r => {
inventory[r.item_id] = Math.max(
  0,
  (inventory[r.item_id] || 0) - r.qty_used * item.qty
);
    });
  });
}

function getLowStockItems(product, qty = 1) {
  const recipe = recipes[product.product_id];
  if (!recipe || !Object.keys(inventory).length) return [];

  return recipe
    .map(r => {
      const available = inventory[r.item_id] || 0;
      const needed = Number(r.qty_used) * qty;

      return {
        ...r,
        available,
        needed,
        // ✅ GUARANTEED name (fallback-safe)
        item_name: r.item_name || r.item_id
      };
    })
    .filter(r => r.available - r.needed <= getLowStockThreshold(r.item_id));
}

function createCategoryBtn(name, id, active = false) {
  const btn = document.createElement("button");
  btn.className = "category-btn" + (active ? " active" : "");
  btn.textContent = name;

  btn.onclick = () => {
    activeCategoryId = id;

    // remove active state from all category buttons
    document
      .querySelectorAll("#categoryList .category-btn")
      .forEach(b => b.classList.remove("active"));

    btn.classList.add("active");
    renderProducts();
  };

  return btn;
}

/* =========================================================
   CATEGORIES
========================================================= */
function renderCategories() {
  const el = document.getElementById("categoryList"); // ✅ CORRECT ELEMENT

  if (!el) {
    console.warn("⚠️ categoryList not found in DOM");
    return;
  }

  el.innerHTML = "";

  // ALL button
  el.appendChild(createCategoryBtn("All", null, true));

  categories.forEach(c => {
    el.appendChild(createCategoryBtn(c.category_name, c.category_id));
  });
}

/* =========================================================
   PRODUCTS
========================================================= */
function renderProducts(search = "") {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  grid.innerHTML = "";

  products
    .filter(p => p.active === true || p.active === "TRUE")
    .filter(p => !activeCategoryId || p.category_id === activeCategoryId)
    .filter(p =>
      `${p.product_name} ${p.product_code}`.toLowerCase().includes(search)
    )
    .forEach(p => {
      const disabled = !canSell(p);
      const lowStock =
        Object.keys(inventory).length &&
        getLowStockItems(p).length > 0;
        const img = p.image_url?.trim()
        ? p.image_url
        : "images/placeholder.png";

      const card = document.createElement("div");
      card.className = "product-card" + (disabled ? " disabled" : "") +
         (lowStock ? " low-stock" : "");

card.innerHTML = `
  <div class="recipe-indicator"  ${disabled ? "style='opacity:.4;pointer-events:none'" : ""}
       onclick="showRecipeInfo('${p.product_id}', event)">
    🧪
  </div>

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
  const nextQty = existing ? existing.qty + 1 : 1;

    if (POS_CLOSED) {
    alert("🔒 Inventory is closed.");
    return;
  }

  // 🚫 HARD BLOCK if stock would be exceeded
  if (!canSell(p, nextQty)) {
    alert("❌ Not enough stock");
    return;
  }

    // ⚠️ LOW STOCK WARNING
  const lowItems = getLowStockItems(p, nextQty);
if (lowItems.length) {
  console.warn("Low stock warning:", lowItems);
}

  if (existing) {
    existing.qty = nextQty;
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

  // ⏱ keep tablet-safe render fix
  setTimeout(renderCart, 0);
  renderProducts();
}

function renderCart() {
  const tbody = document.getElementById("orderTable");
  const sumEl = document.getElementById("sumTotal");

  if (!tbody || !sumEl) {
    console.warn("⚠️ Cart table not ready yet");
    return;
  }

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

function loadPOSProductSaleTracker() {
  const date = getPHDate();
  const location = LOCATION;

  const modal = document.getElementById("productTrackerModal");

  if (!modal) {
    alert("Product tracker modal not found");
    return;
  }

  modal.classList.remove("hidden");

  loadProductSales(date, location);
  loadInventoryReconciliation(date, location);
}

/* =========================================================
   CHECKOUT
========================================================= */
async function checkoutPOS(cartItems) {
  if (POS_CLOSED) {
    alert("🔒 Inventory is closed. Sales are disabled.");
    return;
  }

  if (!cartItems || !cartItems.length) {
  alert("No items in cart");
  return;
}

if (!window.__lastPayment) {
  alert("Payment not confirmed");
  return;
}

const warnings = cartItems.flatMap(i =>
  getLowStockItems(
    { product_id: i.product_id },
    i.qty
  )
);

if (warnings.length) {
  console.warn("Low stock items:", warnings);
}

if (!window.__lastPayment?.payment_status) {
  console.warn("⚠️ Payment status missing, forcing EXACT");
  window.__lastPayment.payment_status = "EXACT";
}

  const ref = "ORD-" + Date.now();


  try {
    const payment = window.__lastPayment;
    const body = new URLSearchParams({
      action: "checkoutOrder",
      ref_id: ref,
      staff_id: STAFF_ID,
      location: LOCATION,
      payment: JSON.stringify(window.__lastPayment),
      items: JSON.stringify(
  cartItems.map(i => ({
    product_id: i.product_id,
    qty: i.qty,
    price: i.price,
    total: i.qty * i.price // ✅ ADD THIS
  }))
)

      
    });

    // ✅ OFFLINE CHECKOUT
if (!navigator.onLine) {
  const pending = getPendingOrders();

  pending.push({
    ref_id: ref,
    staff_id: STAFF_ID,
    location: LOCATION,
items: cartItems.map(i => ({
  product_id: i.product_id,
  qty: i.qty,
  price: i.price,
  total: i.qty * i.price
})),
    payment: window.__lastPayment, // ✅ ADD THIS
    time: Date.now()
  });
  setPendingOrders(pending); // 👈 instead of savePendingOrders

  delete window.__lastPayment;
updateSyncCounter(); // optional safety refresh

  return;
}

    const res = await authFetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || "Checkout failed");
    }

    // ✅ HARD REFRESH inventory from server after successful checkout
if (navigator.onLine) {
  refreshInventoryOnly({ silent: true });
}

    delete window.__lastPayment;
  } catch (err) {
    console.error(err);
    alert("❌ Checkout failed");
  } finally {
    
  }
}

let pendingPayment = null;

function openPaymentModal(total) {
  pendingPayment = { total };
  
paidValue = "0";
document.getElementById("paidDisplay").textContent = "₱0.00";
document.getElementById("changeAmount").textContent = "₱0.00";


  document.getElementById("payTotal").textContent =
    `₱${Number(total).toFixed(2)}`;

  document.getElementById("gcashRef").value = "";

  // Reset to Cash each time the modal opens — otherwise a previous
  // GCash selection would silently carry over and mis-tag the next
  // (actually cash) sale.
  const methodSelect = document.getElementById("paymentMethod");
  if (methodSelect) methodSelect.value = "CASH";
  document.getElementById("methodBadge").textContent = "CASH";
  document.getElementById("gcashRefRow")?.classList.add("hidden");
  document.getElementById("gcashQrRow")?.classList.add("hidden");

  // 🔴 Disable confirm initially
  const btn = document.getElementById("confirmPaymentBtn");
  btn.classList.remove("enabled");
  btn.disabled = true;

  document.getElementById("paymentModal").classList.remove("hidden");
}

function closePaymentModal() {
  document.getElementById("paymentModal").classList.add("hidden");
  pendingPayment = null;
}


document.getElementById("paymentMethod")?.addEventListener("change", e => {
  const method = e.target.value;

  // update badge text
  const badge = document.getElementById("methodBadge");
  if (badge) badge.textContent = method;

  // show / hide GCash reference + QR code
  const isGCash = method === "GCASH";
  document.getElementById("gcashRefRow")?.classList.toggle("hidden", !isGCash);
  document.getElementById("gcashQrRow")?.classList.toggle("hidden", !isGCash);
});

function confirmPayment() {

  // 🔒 EXTRA SAFETY GUARD (STEP 4)
  if (document.getElementById("confirmPaymentBtn").disabled) {
    return;
  }

  const paid = Number(paidValue);
  const method = document.getElementById("paymentMethod").value;
  const isGCash = method === "GCASH"; // ✅ ADD THIS LINE
  const ref = document.getElementById("gcashRef").value || "";
  const total = pendingPayment?.total || 0;

  if (paid < total) {
    alert("❌ Insufficient payment");
    return;
  }

  const payment_status =
  paid < total ? "UNDERPAID" :
  paid > total ? "OVERPAID" :
  "EXACT";

  // Store temporarily (used later in backend Step 3)
  window.__lastPayment = {
    total_bill: total,
    amount_paid: paid,
    change: paid - total,
    payment_method: method,
    gcash_payment: isGCash, // ✅ ADD THIS
    gcash_ref: ref,
    payment_status // ✅ ADD THIS
  };

// 🔥 OPTIMISTIC CHECKOUT (NO WAITING)
const currentCart = [...cart];

// 🔥 CLEAR CART IMMEDIATELY
cart = [];
renderCart();
renderProducts();

// 1️⃣ Deduct inventory immediately (UI only)
deductLocalInventory(currentCart);

// 3️⃣ Close modal immediately
closePaymentModal();

// 4️⃣ Send order to backend in background
checkoutPOS(currentCart);
}

let paidValue = "0";

function keypadInput(val) {
  if (val === "." && paidValue.includes(".")) return;

  if (paidValue === "0" && val !== ".") {
    paidValue = val;
  } else {
    paidValue += val;
  }

  updatePaidDisplay();
}

function keypadBackspace() {
  paidValue = paidValue.slice(0, -1) || "0";
  updatePaidDisplay();
}

function updatePaidDisplay() {
  const paid = Number(paidValue) || 0;
  const total = pendingPayment?.total || 0;

  document.getElementById("paidDisplay").textContent =
    `₱${paid.toFixed(2)}`;

  const change = paid - total;
  document.getElementById("changeAmount").textContent =
    `₱${Math.max(change, 0).toFixed(2)}`;

    // ✅ Enable confirm only if paid >= total
  const btn = document.getElementById("confirmPaymentBtn");
  if (paid >= total) {
    btn.disabled = false;
    btn.classList.add("enabled");
  } else {
    btn.disabled = true;
    btn.classList.remove("enabled");
  }
  
}

function closeProductTracker() {
  document.getElementById("productTrackerModal")?.classList.add("hidden");
}

window.closeProductTracker = closeProductTracker;

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeProductTracker();
  }
});

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      alert("Fullscreen not supported");
      console.error(err);
    });
  } else {
    document.exitFullscreen();
  }
}

function getPendingOrders() {
  return JSON.parse(localStorage.getItem("pendingOrders") || "[]");
}


function setPendingOrders(arr) {
  localStorage.setItem("pendingOrders", JSON.stringify(arr));
  updateSyncCounter();
}

function updateSyncCounter() {
  const pending = getPendingOrders();
  const el = document.getElementById("syncCount");
  const box = document.getElementById("syncStatus");

  if (!el || !box) return;

  // 🔄 Sync in progress
  if (SYNC_IN_PROGRESS) {
    el.textContent = "⟳";
    box.style.background = "#1e40af"; // blue
    return;
  }

  // 📦 Pending count
  el.textContent = pending.length;

  box.style.background =
    pending.length > 0
      ? "#b45309"  // orange
      : "#15803d"; // green

  box.onclick = () => {
    alert(
      pending.length
        ? pending.map(o => o.ref_id).join("\n")
        : "All orders synced"
    );
  };
}

function saveOrderLocally(order) {
  const pending = getPendingOrders();

  pending.push({
    ...order,
    synced: false,
    created_at: Date.now()
  });

  setPendingOrders(pending);
}

document.getElementById("stocksBtn")?.addEventListener("click", openStocks);


async function openStocks() {
  const tbody = document.getElementById("stocksTable");
  tbody.innerHTML = "<tr><td colspan='3'>Loading…</td></tr>";

  try {
    const today = getPHDate();

    const res = await fetch(
      `${API_URL}?type=dailyInventoryItems&date=${today}&location=${LOCATION}`
    );

    const data = await res.json();

    if (data.status !== "OPEN") {
      tbody.innerHTML =
        "<tr><td colspan='3'>Inventory is closed.</td></tr>";
      return;
    }

    const rows = data.items || [];

    tbody.innerHTML = "";

    if (!rows.length) {
      tbody.innerHTML =
        "<tr><td colspan='3'>No inventory data.</td></tr>";
      return;
    }

    rows.forEach(r => {
      tbody.innerHTML += `
        <tr>
          <td>${r.item_name}</td>
          <td>${r.qty_added}</td>
          <td>${r.remaining}</td>
        </tr>
      `;
    });

    document.getElementById("stocksModal").classList.remove("hidden");

  } catch (err) {
    console.error(err);
    tbody.innerHTML =
      "<tr><td colspan='3'>Failed to load inventory.</td></tr>";
  }
}


async function syncPendingOrders() {
  if (!navigator.onLine || SYNC_IN_PROGRESS) return;

  SYNC_IN_PROGRESS = true;

  const pending = getPendingOrders();
  if (!pending.length) {
    SYNC_IN_PROGRESS = false;
    return;
  }

  // Drop each order from the queue as soon as IT succeeds, not after the
  // whole batch finishes — otherwise one failure partway through re-sends
  // every order that already went through on the next sync, duplicating
  // sales that were already recorded.
  const remaining = [...pending];

  for (const o of pending) {
    try {
      const body = new URLSearchParams({
        action: "checkoutOrder",
        ref_id: o.ref_id,
        staff_id: o.staff_id,
        location: o.location,
        items: JSON.stringify(o.items),
        payment: JSON.stringify(o.payment || {}) // ✅ ADD
      });

      await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });

      remaining.shift();
      setPendingOrders(remaining);

    } catch (err) {
      console.warn("Sync failed for order:", o.ref_id);
      SYNC_IN_PROGRESS = false;
      return;
    }
  }

  SYNC_IN_PROGRESS = false;
  updateSyncCounter();
  console.log("✅ Offline orders synced");
}

function lockPosUI() {
  // Disable all buttons
  document
    .querySelectorAll("button, input, select")
    .forEach(el => {
      el.disabled = true;
    });

  // Add overlay
  const overlay = document.createElement("div");
  overlay.id = "posLockedOverlay";
  overlay.innerHTML = `
    <div class="pos-locked-box">
      🔒 POS is locked<br>
      <small>Inventory day has been closed</small>
    </div>
  `;

  document.body.appendChild(overlay);
}

function closeStocks() {
  document.getElementById("stocksModal").classList.add("hidden");
}


function closeSales() {
  document.getElementById("salesModal").classList.add("hidden");
}

window.closeSales = closeSales;

function renderSalesTable(orders) {

  const tbody = document.getElementById("salesBody");
  const totalEl = document.getElementById("sumGross");

  tbody.innerHTML = "";
  let grandTotal = 0;
  let cashTotal = 0;
  let gcashTotal = 0;

  if (!orders.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#888">
          No sales today
        </td>
      </tr>`;
    totalEl.textContent = "0.00";
    return;
  }

  orders.forEach((o, i) => {
    // ✅ SAME LOGIC AS ADMIN
    const transactionTotal = (o.items || []).reduce(
      (sum, item) => sum + (Number(item.total) || 0),
      0
    );

    grandTotal += transactionTotal;

    const method = o.payment?.payment_method || "CASH";

if (method === "GCASH") {
  gcashTotal += transactionTotal;
} else {
  cashTotal += transactionTotal;
}

    // TRANSACTION HEADER
    tbody.insertAdjacentHTML("beforeend", `
      <tr style="background:#f4f4f4;font-weight:600">
        <td>${i + 1}</td>
        <td>
          ${o.ref_id}<br>
          <small>${formatDateTime(o.datetime)}</small>
            <small>
              <span class="payment-badge ${
  o.payment?.payment_method === "GCASH"
    ? "payment-gcash"
    : "payment-cash"
}">
  ${o.payment?.payment_method || "CASH"}
</span>
           </small>
        </td>
        <td></td>
        <td>${o.cashier || "-"}</td>
        <td>₱${transactionTotal.toFixed(2)}</td>
      </tr>
    `);

    // PRODUCT ROWS
    (o.items || []).forEach(item => {
      tbody.insertAdjacentHTML("beforeend", `
        <tr>
          <td></td>
          <td>${item.product_name}</td>
          <td>${item.qty || 0}</td>
          <td></td>
          <td>₱${Number(item.total || 0).toFixed(2)}</td>
        </tr>
      `);
    });
  });

  // SUMMARY
totalEl.innerHTML = `
  <div><strong>Gross Sales:</strong> ₱${grandTotal.toFixed(2)}</div>
  <div>💵 Cash: ₱${cashTotal.toFixed(2)}</div>
  <div>📱 GCash: ₱${gcashTotal.toFixed(2)}</div>
`;
}

function formatDateTime(value) {
  if (!value) return "-";

  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function performLogout() {
  // Clear session
  disableWakeLock();
  localStorage.removeItem("userLocation");
  localStorage.removeItem("staff_id");
  localStorage.removeItem("userName");
  localStorage.removeItem("userPosition");

  alert("👋 Logged out");

  // Exit fullscreen safely
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }

  // Redirect to login
  window.location.href = "index.html";
}

function loadTodaySales() {
  return new Promise((resolve, reject) => {
    const callbackName = "salesCallback_" + Date.now();

    window[callbackName] = data => {
      delete window[callbackName];
      script.remove();
      resolve(data);
    };

    const script = document.createElement("script");
    script.src =
      `${API_URL}?type=dailySalesReport` +
      `&date=${getPHDate()}` +
      `&location=${LOCATION}` +
      `&callback=${callbackName}`;

    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      reject(new Error("Failed to load sales"));
    };

    document.body.appendChild(script);
  });
}

function updateNetStatus() {
  const el = document.getElementById("netStatus");
  if (!el) return;

  if (navigator.onLine) {
    el.textContent = "ONLINE";
    el.className = "net online";
  } else {
    el.textContent = "OFFLINE";
    el.className = "net offline";
  }
}

function incrementUnread() {
  const badge = document.getElementById("chatUnreadBadge");
  if (!badge) return;

  const n = Number(badge.textContent || 0) + 1;
  badge.textContent = n;
  badge.classList.remove("hidden");
}

let lastChatHash = "";
let chatLoading = false;

function loadPOSChat() {
    if (!POS_CHAT_ENABLED) return;
  if (chatLoading) return;
  chatLoading = true;

  const loc = localStorage.getItem("userLocation");
  if (!loc) return;

  const callbackName = "posChatCallback_" + Date.now();
  const script = document.createElement("script");

  window[callbackName] = messages => {
    chatLoading = false;
    delete window[callbackName];
    script.remove();

  const hash = JSON.stringify(messages);

  if (hash !== lastChatHash) {
    // 🔔 only notify if chat is closed
    if (chatBox.classList.contains("hidden")) {
      incrementUnread();
    }

    lastChatHash = hash;
    renderChatMessages(messages);
  }
  };

  script.src =
    `${API_URL}?type=chatMessages` +
    `&location=${loc}` +
    `&callback=${callbackName}`;

  script.onerror = () => {
    chatLoading = false;
    delete window[callbackName];
    script.remove();
    console.warn("⚠️ POS chat JSONP failed");
  };

  document.body.appendChild(script);
}

// 🔁 SINGLE poll — keeps polling even while the chat box is closed, so
// the unread badge (which loadPOSChat() only sets when the box is
// hidden) actually has a chance to fire instead of never running.
setInterval(() => {
  if (!POS_CHAT_ENABLED) return;
  if (!chatBox) return;

  loadPOSChat();
}, 3000);

function initChatUI() {
    if (!chatBox) return; // 🛑 safety guard
chatBox.innerHTML = `
  <div class="chat-header">
    Admin Chat
  </div>

  <div id="chatMessages" class="pos-chat-messages"></div>

  <div class="pos-chat-input">
    <input id="chatInput" placeholder="Type a message…" />
    <button id="chatSendBtn">Send</button>
  </div>
`;

  document.getElementById("chatSendBtn").onclick = sendChat;

  document.getElementById("chatInput").addEventListener("keydown", e => {
      if (e.key === "Enter") {
    e.preventDefault();
    sendChat();
  }
  });
}

function renderChatMessages(messages = []) {
  const box = document.getElementById("chatMessages");
  if (!box) return;

  // Are we near bottom?
  const atBottom =
    box.scrollHeight - box.scrollTop - box.clientHeight < 40;

  box.innerHTML = messages.map(m => `
    <div class="chat-msg ${
      m.sender_role === "CASHIER" ? "me" : "other"
    }">
      ${m.message}
    </div>
  `).join("");

  // Auto-scroll ONLY if user was at bottom
  if (atBottom) {
    box.scrollTop = box.scrollHeight;
  }
}

function sendChat() {
  if (!POS_CHAT_ENABLED) {
  alert("💬 Chat is currently disabled by admin");
  return;
}

  const input = document.getElementById("chatInput");
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;

authFetch(API_URL, {
  method: "POST",
  body: new URLSearchParams({
    action: "sendChatMessage",
    sender_role: "CASHIER",
    sender_id: STAFF_ID,
    location: LOCATION,
    message: msg
  })
}).then(() => loadPOSChat());

  input.value = "";
}

window.addEventListener("online", updateNetStatus);
window.addEventListener("offline", updateNetStatus);
updateNetStatus();

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    await new Promise(r => setTimeout(r, 500));
    enableWakeLock();
  }
});;

document.getElementById("salesBtn")?.addEventListener("click", async () => {
  const tbody = document.getElementById("salesBody");
  const totalEl = document.getElementById("sumGross");

  if (!navigator.onLine) {
  alert("📴 Sales report unavailable offline");
  return;
}

  if (!tbody || !totalEl) {
    alert("Sales report UI missing");
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center;color:#888">
        Loading today’s sales…
      </td>
    </tr>`;
  totalEl.textContent = "0.00";

  try {
    showLoader("Loading sales report…");

    // ✅ JSONP — NO CORS
    const orders = await loadTodaySales();

    if (!Array.isArray(orders)) {
      throw new Error("Invalid sales data");
    }

    renderSalesTable(orders);
    document.getElementById("salesModal").classList.remove("hidden");

  } catch (err) {
    console.error("Sales report error:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:red">
          Failed to load sales
        </td>
      </tr>`;
  } finally {
    hideLoader();
  }
});

window.addEventListener("online", syncPendingOrders);

// 🔓 expose keypad + modal functions to HTML
window.keypadInput = keypadInput;
window.keypadBackspace = keypadBackspace;
window.confirmPayment = confirmPayment;
window.closePaymentModal = closePaymentModal;
window.closeStocks = closeStocks;

// 🔍 DEBUG EXPOSURE (SAFE)
window.__products = () => products;
window.__categories = () => categories;
window.__inventory = () => inventory;
window.__recipes = () => recipes;

// 🔁 Auto-sync every 5 seconds when online
setInterval(() => {
  if (navigator.onLine) {
    syncPendingOrders();
  }
}, 5000);

//🔁 Auto-refresh every 30 seconds for POS inventory

setInterval(() => {
  refreshInventoryOnly({ silent: true });
}, 30000); // every 30s