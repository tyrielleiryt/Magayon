
/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";



  window.API_URL = API_URL; // 👈 ADD THIS

  let POS_LOCKED = true; // 🔒 default locked
  let PIN_ACTION = "unlock"; // 🔑 unlock | logout
const MANAGER_PIN = "1234"; // 🔑 change this
const LOW_STOCK_THRESHOLD = 5; // 👈 adjust per business

let relockTimer = null;

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

function checkInventoryStatus(dailyInventory) {
  if (!Array.isArray(dailyInventory)) return;

  const today = getPHDate();
  const todayRow = dailyInventory.find(d => d.date === today);

  if (!todayRow) {
    // No inventory created yet → stay locked
    POS_CLOSED = true;
    enterSalesOnlyMode();
    return;
  }

  if (todayRow.status === "CLOSED") {
    POS_CLOSED = true;
    enterSalesOnlyMode();
  } else {
    // ✅ OPEN DAY → AUTO UNLOCK
    exitSalesOnlyMode();
  }
}

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

function showPinModal(action = "unlock") {
  PIN_ACTION = action;

  document.querySelector("#pinModal h2").textContent =
  action === "logout"
    ? "🔒 Manager Logout"
    : "🔒 Manager Unlock";

  const modal = document.getElementById("pinModal");
  const input = document.getElementById("pinInput");

  if (!modal || !input) return;

  input.value = "";
  modal.classList.remove("hidden");
  input.focus();
}

function closePinModal() {
  document.getElementById("pinModal")?.classList.add("hidden");
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && POS_LOCKED && PIN_ACTION !== "logout") {
    showPinModal();
  }
});

function unlockPOS() {
  const input = document.getElementById("pinInput");
  const pin = input?.value.trim();

  if (pin !== MANAGER_PIN) {
    alert("❌ Invalid PIN");
    input.value = "";
    input.focus();
    return;
  }

   // 🔑 PIN OK
  document.getElementById("pinModal")?.classList.add("hidden");

   if (PIN_ACTION === "logout") {
    performLogout();
    return;
  }

  // 🔓 UNLOCK
  POS_LOCKED = false;
  closePinModal();
  startRelockTimer();
}

function startRelockTimer() {
  clearTimeout(relockTimer);

  relockTimer = setTimeout(() => {
    POS_LOCKED = true;

// ❌ no auto fullscreen here


  }, 5 * 60 * 1000); // 5 minutes
}

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
let recipes = {};        // product_id → recipe[]
let inventory = {};      // item_id → remaining
let cart = [];
let activeCategoryId = null;


/* =========================================================
   WAKE LOCK (TABLET ANTI-SLEEP)
========================================================= */
let wakeLock = null;

async function enableWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      console.log("🔒 Wake Lock enabled");

      wakeLock.addEventListener("release", () => {
        console.log("🔓 Wake Lock released");
      });
    }
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
  document.getElementById("cashierName").textContent = CASHIER_NAME;
  document.getElementById("cashierPosition").textContent = CASHIER_POSITION;
  document.getElementById("cashierLocation").textContent = LOCATION;
  document.getElementById("fullscreenBtn")
  ?.addEventListener("click", toggleFullscreen);
enableWakeLock();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
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

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
  showPinModal("logout");
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

document.addEventListener("keydown", e => {
  if (!POS_LOCKED) return;

  // Block ESC, F11
  if (e.key === "Escape" || e.key === "F11") {
    e.preventDefault();
    e.stopPropagation();
  }
});

  document.getElementById("searchInput")?.addEventListener("input", e => {
    renderProducts(e.target.value.toLowerCase());
  });
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
  inventoryRows,
  dailyInventory
] = await Promise.all([
  fetch(`${API_URL}?type=categories`).then(r => r.json()),
  fetch(`${API_URL}?type=products`).then(r => r.json()),
  fetch(`${API_URL}?type=allProductRecipes`).then(r => r.json()),
  fetch(`${API_URL}?type=dailyInventoryItems&date=${today}&location=${LOCATION}`)
    .then(r => r.json()),
  fetch(`${API_URL}?type=dailyInventory&location=${LOCATION}`)
    .then(r => r.json())
]);

// ✅ CORRECT SOURCE
checkInventoryStatus(dailyInventory);

  categories = Array.isArray(categoriesData)
  ? categoriesData
  : JSON.parse(localStorage.getItem("categories") || "[]");

products = Array.isArray(productsData)
  ? productsData
  : JSON.parse(localStorage.getItem("products") || "[]");

recipes = recipesData || JSON.parse(localStorage.getItem("recipes") || "{}");

localStorage.setItem("categories", JSON.stringify(categories));
localStorage.setItem("products", JSON.stringify(products));
localStorage.setItem("recipes", JSON.stringify(recipes));

  inventory = {};

  if (!Array.isArray(inventoryRows)) {
    console.warn("⚠️ Inventory unavailable (offline mode)");
    return;
  }

  inventoryRows.forEach(r => {
    inventory[r.item_id] = Number(r.remaining) || 0;
  });

  window.__debugInventory = inventory;
window.__debugRecipes = recipes;
window.__debugLocation = LOCATION;

console.log("DEBUG INVENTORY:", inventory);
console.log("DEBUG RECIPES:", recipes);
console.log("DEBUG LOCATION:", LOCATION);

}



/* =========================================================
   INVENTORY CHECK
========================================================= */
function canSell(product, qty = 1) {
    // ✅ allow selling if inventory not loaded (offline)
  if (!Object.keys(inventory).length) return true;


  const recipe = recipes[product.product_id];
  if (!recipe || !recipe.length) return false;

  return recipe.every(r => {
    const available = inventory[r.item_id] || 0;
    const needed = Number(r.qty_used) * qty;
    return available >= needed;
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
    .filter(r => r.available - r.needed <= LOW_STOCK_THRESHOLD);
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
  if (lowItems.length && navigator.onLine) {
    const names = lowItems.map(i => i.item_name).join(", ");
    alert(`⚠️ Low stock warning:\n${names}`);
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


/* =========================================================
   CHECKOUT
========================================================= */
async function checkoutPOS() {
  if (POS_CLOSED) {
    alert("🔒 Inventory is closed. Sales are disabled.");
    return;
  }

  if (!cart.length) {
  alert("No items in cart");
  return;
}

if (!window.__lastPayment) {
  alert("Payment not confirmed");
  return;
}


  // ✅ INVENTORY SAFETY (ONLINE ONLY)
  if (!Object.keys(inventory).length && navigator.onLine) {
    alert("Inventory not loaded yet. Please wait.");
    return;
  }

const warnings = cart.flatMap(i =>
  getLowStockItems(
    { product_id: i.product_id },
    i.qty
  )
);

if (warnings.length && navigator.onLine) {
  const names = [...new Set(warnings.map(w => w.item_name))];
  const proceed = confirm(
    "⚠️ Some ingredients are low:\n\n" +
    names.join("\n") +
    "\n\nProceed anyway?"
  );

  if (!proceed) return;
}

  showLoader("Processing order…");

  const ref = "ORD-" + Date.now();

  try {
    const payment = window.__lastPayment;
    const body = new URLSearchParams({
      action: "checkoutOrder",
      ref_id: ref,
      staff_id: STAFF_ID,
      location: LOCATION,
      items: JSON.stringify(cart)

      
    });

    // ✅ OFFLINE CHECKOUT
if (!navigator.onLine) {
  const pending = getPendingOrders();

  pending.push({
    ref_id: ref,
    staff_id: STAFF_ID,
    location: LOCATION,
    items: cart,
    time: Date.now()
  });

  savePendingOrders(pending);

  cart = [];
  renderCart();
  renderProducts();

  alert("📴 Offline — order saved and will sync when online");
  hideLoader();
  return;
}

    const res = await fetch(API_URL, {
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

    cart = [];
    await loadAllData();
    renderProducts();
    renderCart();

    alert("✅ Order completed");
    delete window.__lastPayment;
  } catch (err) {
    console.error(err);
    alert("❌ Checkout failed");
  } finally {
    hideLoader();
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

  // show / hide GCash reference
  document.getElementById("gcashRefRow")
    ?.classList.toggle("hidden", method !== "GCASH");
});

function confirmPayment() {

  // 🔒 EXTRA SAFETY GUARD (STEP 4)
  if (document.getElementById("confirmPaymentBtn").disabled) {
    return;
  }

  const paid = Number(paidValue);
  const method = document.getElementById("paymentMethod").value;
  const ref = document.getElementById("gcashRef").value || "";
  const total = pendingPayment?.total || 0;

  if (paid < total) {
    alert("❌ Insufficient payment");
    return;
  }

  // Store temporarily (used later in backend Step 3)
  window.__lastPayment = {
    total_bill: total,
    amount_paid: paid,
    change: paid - total,
    payment_method: method,
    gcash_ref: ref
  };

  closePaymentModal();

  // ✅ NOW perform the real checkout
  checkoutPOS();
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

function savePendingOrders(list) {
  localStorage.setItem("pendingOrders", JSON.stringify(list));
}


document.getElementById("stocksBtn")?.addEventListener("click", openStocks);

async function openStocks() {
  const tbody = document.getElementById("stocksTable");
  tbody.innerHTML = "<tr><td colspan='3'>Loading…</td></tr>";

  try {

    const today = getPHDate(); // ✅ ADD THIS LINE


    const res = await fetch(
      `${API_URL}?type=dailyInventoryItems&date=${today}&location=${LOCATION}`
    );

    const rows = await res.json();
    tbody.innerHTML = "";

    if (!Array.isArray(rows) || !rows.length) {
      tbody.innerHTML =
        "<tr><td colspan='3'>No inventory data.</td></tr>";
    } else {
      rows.forEach(r => {
        tbody.innerHTML += `
          <tr>
            <td>${r.item_name}</td>
            <td>${r.qty_added}</td>
            <td>${r.remaining}</td>
          </tr>
        `;
      });
    }

    document.getElementById("stocksModal").classList.remove("hidden");

  } catch (err) {
    console.error(err);
    tbody.innerHTML =
      "<tr><td colspan='3'>Failed to load inventory.</td></tr>";
  }
}

async function syncPendingOrders() {
  if (!navigator.onLine) return;

  const pending = getPendingOrders();
  if (!pending.length) return;

  for (const o of pending) {
    try {
      const body = new URLSearchParams({
        action: "checkoutOrder",
        ref_id: o.ref_id,
        staff_id: o.staff_id,
        location: o.location,
        items: JSON.stringify(o.items)
      });

      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
    } catch (err) {
      console.warn("Sync failed for order:", o.ref_id);
      return; // stop on first failure
    }
  }

  savePendingOrders([]);
  console.log("✅ Offline orders synced");
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

    // TRANSACTION HEADER
    tbody.insertAdjacentHTML("beforeend", `
      <tr style="background:#f4f4f4;font-weight:600">
        <td>${i + 1}</td>
        <td>
          ${o.ref_id}<br>
          <small>${formatDateTime(o.datetime)}</small>
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

  totalEl.textContent = grandTotal.toFixed(2);
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

window.addEventListener("online", updateNetStatus);
window.addEventListener("offline", updateNetStatus);
updateNetStatus();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    enableWakeLock();
  }
});

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

window.unlockPOS = unlockPOS;

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
