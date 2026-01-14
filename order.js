/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";



  window.API_URL = API_URL; // 👈 ADD THIS

  let POS_LOCKED = true; // 🔒 default locked
  let PIN_ACTION = "unlock"; // 🔑 unlock | logout
const MANAGER_PIN = "1234"; // 🔑 change this

let relockTimer = null;

function enforceBodyLayout() {
  document.body.style.display = "flex";
  document.body.style.flexDirection = "column";
  document.body.style.height = "100vh";
}

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

  if (POS_LOCKED && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    setTimeout(enforceBodyLayout, 0);
  }
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && POS_LOCKED && PIN_ACTION !== "logout" &&
    document.activeElement.tagName !== "INPUT") {
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

    // ✅ SAFE
function safeFullscreen() {
  if (
    window.innerWidth >= 768 &&
    !document.fullscreenElement &&
    navigator.userActivation?.isActive
  ) {
    document.documentElement.requestFullscreen().catch(() => {});
    setTimeout(enforceBodyLayout, 0);
  }
}
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

let CHECKOUT_IN_PROGRESS = false;

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
  staff_id: STAFF_ID
},
    retries: 0,
    created_at: Date.now()
  };

  // ✅ Save locally instantly
  await savePendingOrder(order);

  // ✅ UI clears immediately (no waiting)
  clearCart();
  showToast("✅ Order saved");

  CHECKOUT_IN_PROGRESS = false; // 🔓 UNLOCK

  // ✅ GUARANTEED background sync (tablet-safe)
  setTimeout(syncPendingOrders, 500);
  
}



let syncing = false;

async function syncPendingOrders() {
  if (!navigator.onLine) return;
  if (syncing) return;

  const orders = await getPendingOrders();
  const todayOrders = orders.filter(o => isSameBusinessDay(o.created_at));

  // ✅ NOTHING TO SYNC → DO NOT ENTER SYNC STATE
  if (!todayOrders.length) {
    syncing = false;
    updateStatusBadge();
    updatePendingBadge();
    return;
  }

  syncing = true; // ✅ ONLY SET WHEN THERE IS REAL WORK

  try {
    for (const order of todayOrders) {
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          body: new URLSearchParams(order.payload)
        });

        const data = await res.json();

        if (data.success) {
          await deletePendingOrder(order.id);
          console.log("✅ Synced", order.id);
        } else {
          throw new Error(data.error || "Server rejected order");
        }
      } catch (err) {
        console.error("❌ Order sync failed", order.id, err);

        order.retries = (order.retries || 0) + 1;
        await savePendingOrder(order);

        showToast("❌ Some orders failed to sync", 3000);
      }
    }
  } catch (err) {
    console.error("❌ Sync system failure", err);
    showToast("❌ Sync failed — check network", 3000);
  } finally {
    syncing = false;
    updateStatusBadge();
    updatePendingBadge();
    
  }
}

/* =========================================================
   STATUS BADGE (ONLINE / OFFLINE / SYNCING)
========================================================= */
let lastStatus = "";
let offlineSince = null;

async function updateStatusBadge() {
  const el = document.getElementById("statusBadge");
  if (!el) return;

  const orders = await getPendingOrders();
const todayOrders = orders.filter(o => isSameBusinessDay(o.created_at));
const pending = todayOrders.length;

  let nextStatus;

if (!navigator.onLine) {
  nextStatus = pending > 0 ? "offline" : "offline";
} else if (pending > 0) {
  nextStatus = syncing ? "syncing" : "online";
} else {
  nextStatus = "online";
}

  // ⛔ Prevent unnecessary DOM updates
  if (nextStatus === lastStatus && nextStatus !== "syncing") return;
  lastStatus = nextStatus;

  el.className = `status ${nextStatus}`;
  el.classList.remove("hidden");

  const syncBtn = document.getElementById("syncOrdersBtn");
if (syncBtn) {
  syncBtn.classList.remove("enabled", "syncing");
  syncBtn.disabled = true;

  if (nextStatus === "syncing") {
    syncBtn.classList.add("syncing");
    syncBtn.textContent = "Syncing…";
  } else if (nextStatus === "online" && pending > 0) {
    syncBtn.classList.add("enabled");
    syncBtn.disabled = false;
    syncBtn.textContent = `Sync Orders (${pending})`;
  } else {
    syncBtn.textContent = "No Orders to Sync";
  }
}

  if (nextStatus === "offline") {
    el.textContent = "Offline – Orders saved";
  } else if (nextStatus === "syncing") {
    el.textContent = `Syncing ${pending} order${pending > 1 ? "s" : ""}`;
  } else {
    el.textContent = "Online";
  }
  if (nextStatus === "syncing" && offlineSince) {
  const mins =
    Math.floor((Date.now() - offlineSince.getTime()) / 60000);

  if (mins >= 15) {
    el.textContent = "⚠ Sync delayed – Check network";
  }
}
}




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

async function loadTodayStocks() {
  const res = await fetch(
    `${API_URL}?type=todayStocks&location=${LOCATION}`
  );
  return res.json();
}

async function refreshStockState({ silent = false } = {}) {
  try {
    if (!silent) showLoader("Refreshing stock…");

    const rows = await loadTodayStocks();

    // 🔄 Rebuild inventory map
    inventory = {};
    rows.forEach(r => {
      inventory[r.item_id] = Number(r.remaining) || 0;
    });

    // ✅ OPTIONAL SAFE ADDITION
    // Remove cart items that are no longer sellable
    cart = cart.filter(item => {
      const product = products.find(
        p => p.product_id === item.product_id
      );
      return product && canSell(product, item.qty);
    });

    // 🔄 Re-render UI
    renderProducts();
    renderCart();

    console.log("🔄 Stock refreshed", inventory);

  } catch (err) {
    console.error("Stock refresh failed:", err);
    if (!silent) alert("⚠️ Failed to refresh stock");
  } finally {
    if (!silent) hideLoader();
  }
}

function showToast(message, duration = 2000) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "#2ecc71";
  toast.style.color = "#fff";
  toast.style.padding = "10px 16px";
  toast.style.borderRadius = "8px";
  toast.style.zIndex = "10000";
  toast.style.fontWeight = "600";
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), duration);
}

function getSellableCount(product) {
  const recipe = recipes[product.product_id];
  if (!recipe || !recipe.length) return 0;

  return Math.min(
    ...recipe.map(r => {
      const available = inventory[r.item_id] || 0;
      return Math.floor(available / Number(r.qty_used));
    })
  );
}

function clearCart() {
  cart = [];
  renderCart();
  renderProducts();
}

enableWakeLock(); // 🔒 prevent tablet sleep

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("cashierName").textContent = CASHIER_NAME;
  document.getElementById("cashierPosition").textContent = CASHIER_POSITION;
  document.getElementById("cashierLocation").textContent = LOCATION;
  document.getElementById("fullscreenBtn")
  ?.addEventListener("click", toggleFullscreen);
  
  document
  .getElementById("refreshStockBtn")
  ?.addEventListener("click", () => refreshStockState());

enforceBodyLayout();

document.getElementById("syncOrdersBtn")
  ?.addEventListener("click", async () => {
    if (syncing) return;
    showToast("🔁 Syncing orders…");
    await syncPendingOrders();
  });
  await purgeOldPendingOrders();
  await updateStatusBadge();
  await updatePendingBadge();


  showLoader("Loading POS data…");
  //syncPendingOrders();
updatePendingBadge();
  // 🔒 Force fullscreen on POS load
setTimeout(() => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    setTimeout(enforceBodyLayout, 0);
  }
}, 500);

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
  // 🔒 FORCE fullscreen on POS load (tablet safe)
setTimeout(() => {
  if (POS_LOCKED && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    setTimeout(enforceBodyLayout, 0);
  }
}, 800);
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
    inventoryRows
  ] = await Promise.all([
    fetch(`${API_URL}?type=categories`).then(r => r.json()),
    fetch(`${API_URL}?type=products`).then(r => r.json()),
    fetch(`${API_URL}?type=allProductRecipes`).then(r => r.json()),
    fetch(
      `${API_URL}?type=dailyInventoryItems&date=${today}&location=${LOCATION}`
    ).then(r => r.json())
  ]);

  categories = Array.isArray(categoriesData) ? categoriesData : [];
  products = Array.isArray(productsData) ? productsData : [];
  recipes = recipesData || {};

  inventory = {};

  if (!Array.isArray(inventoryRows)) {
    console.error("Invalid inventory response:", inventoryRows);
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
  const recipe = recipes[product.product_id];
  if (!recipe || !recipe.length) return false;

  return recipe.every(r => {
    const available = inventory[r.item_id] || 0;
    const needed = Number(r.qty_used) * qty;
    return available >= needed;
  });
}

/* =========================================================
   CATEGORIES
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
    document.querySelectorAll(".category-btn")
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
      // ✅ RECIPE-AWARE SELLABLE COUNT
      const sellable = getSellableCount(p);
      const isLow = sellable > 0 && sellable <= 5;
      const isSoldOut = sellable === 0;

      const img = p.image_url?.trim()
        ? p.image_url
        : "images/placeholder.png";

      const card = document.createElement("div");
      card.className = "product-card";

      if (isLow) card.classList.add("low-stock");
      if (isSoldOut) card.classList.add("disabled");

      card.innerHTML = `
        <div class="product-img">
          <img src="${img}" loading="lazy"
               onerror="this.src='images/placeholder.png'">
        </div>
        <div class="product-info">
          <div class="product-code">${p.product_code}</div>
          <div class="product-name">${p.product_name}</div>
          <div class="product-price">₱${Number(p.price).toFixed(2)}</div>
          ${
            isLow
              ? `<div class="low-stock-text">⚠ Only ${sellable} left</div>`
              : ""
          }
        </div>
      `;

      if (!isSoldOut) {
        card.onclick = () => addToCart(p);
      }

      grid.appendChild(card);
    });
}

/* =========================================================
   CART
========================================================= */
function addToCart(p) {
  const existing = cart.find(i => i.product_id === p.product_id);
  const nextQty = existing ? existing.qty + 1 : 1;

  // 🚫 HARD BLOCK if stock would be exceeded
  if (!canSell(p, nextQty)) {
    alert("❌ Not enough stock");
    return;
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
// ⚠️ LEGACY — DO NOT USE
// Online-only checkout (replaced by offline-first flow)
async function checkoutPOS() {
  if (!cart.length) {
  alert("No items in cart");
  return;
}

if (!window.__lastPayment) {
  alert("Payment not confirmed");
  return;
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

document.getElementById("amountPaid")?.addEventListener("input", e => {
  const paid = Number(e.target.value) || 0;
  const total = pendingPayment?.total || 0;
  const change = paid - total;

  document.getElementById("changeAmount").textContent =
    `₱${Math.max(change, 0).toFixed(2)}`;
});



function confirmPayment() {
  // 🚫 HARD BLOCK double confirm
  if (CHECKOUT_IN_PROGRESS) {
    console.warn("⛔ Checkout already in progress");
    return;
  }

  const btn = document.getElementById("confirmPaymentBtn");
 
  if (btn.disabled) return;

  CHECKOUT_IN_PROGRESS = true; // 🔒 LOCK
    btn.disabled = true;
  btn.classList.remove("enabled");

  const paid = Number(paidValue);
  const method = document.getElementById("paymentMethod").value;
  const ref = document.getElementById("gcashRef").value || "";
  const total = pendingPayment?.total || 0;

  if (paid < total) {
    CHECKOUT_IN_PROGRESS = false;
    btn.disabled = false;
    alert("❌ Insufficient payment");
    return;
  }

  window.__lastPayment = {
    total_bill: total,
    amount_paid: paid,
    change: paid - total,
    payment_method: method,
    gcash_ref: ref
  };

  closePaymentModal();

  // ✅ Offline-safe checkout
  checkoutOfflineSafe([...cart]);
  setTimeout(syncPendingOrders, 1000);
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

function isSameBusinessDay(timestamp) {
  const phNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  ).toISOString().slice(0, 10);

  const orderDay = new Date(timestamp)
    .toLocaleString("en-US", { timeZone: "Asia/Manila" })
    .slice(0, 10);

  return phNow === orderDay;
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

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      alert("Fullscreen not supported");
      console.error(err);
    });
    setTimeout(enforceBodyLayout, 0);
  } else {
    document.exitFullscreen();
    setTimeout(enforceBodyLayout, 0);
  }
}


document.getElementById("stocksBtn")?.addEventListener("click", openStocks);

async function openStocks() {
  const tbody = document.getElementById("stocksTable");
  tbody.innerHTML = "<tr><td colspan='3'>Loading…</td></tr>";

  try {
    const res = await fetch(
      `${API_URL}?type=todayStocks&location=${LOCATION}`
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
            <td>${r.added_today}</td>
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

function closeStocks() {
  document.getElementById("stocksModal").classList.add("hidden");
}



document.getElementById("salesBtn")?.addEventListener("click", openSales);

async function openSales() {
  const tbody = document.getElementById("salesBody");
  const totalEl = document.getElementById("sumGross");

  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center;color:#888">
        Loading…
      </td>
    </tr>`;
  totalEl.textContent = "0.00";

  try {
    const today = getPHDate(); // ✅ FIXED (PH DATE)

    const res = await fetch(
      `${API_URL}?type=dailySalesReport&date=${today}&location=${LOCATION}`
    );

    const orders = await res.json();

    renderSalesTable(Array.isArray(orders) ? orders : []);
    document.getElementById("salesModal").classList.remove("hidden");

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:red">
          Failed to load sales
        </td>
      </tr>`;
  }
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

async function updatePendingBadge() {
  const orders = await getPendingOrders();
  const todayOrders = orders.filter(o => isSameBusinessDay(o.created_at));

  const el = document.getElementById("pendingBadge");
  if (!el) return;

  el.textContent = todayOrders.length
    ? `⏳ ${todayOrders.length}`
    : "";
}

// update periodically
setInterval(updatePendingBadge, 3000);


function performLogout() {
  // Clear session
  localStorage.removeItem("userLocation");
  localStorage.removeItem("staff_id");
  localStorage.removeItem("userName");
  localStorage.removeItem("userPosition");

  alert("👋 Logged out");

  // Exit fullscreen safely
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    setTimeout(enforceBodyLayout, 0);
  }

  // Redirect to login
  window.location.href = "index.html";
}

// 🔒 BLOCK keyboard fullscreen exit
document.addEventListener("keydown", e => {
  if (!POS_LOCKED) return;

  if (
    e.key === "Escape" ||
    e.key === "F11" ||
    (e.ctrlKey && e.key.toLowerCase() === "f") ||
    (e.metaKey && e.ctrlKey)
  ) {
    e.preventDefault();
    e.stopPropagation();
  }
});

window.addEventListener("offline", () => {
  offlineSince = new Date();
  updateStatusBadge();
});
setInterval(updateStatusBadge, 3000);

window.addEventListener("online", () => {
  offlineSince = null;
  syncPendingOrders();
  updateStatusBadge();
});


// silent background sync
//setInterval(syncPendingOrders, 15000);

window.unlockPOS = unlockPOS;

// 🔓 expose keypad + modal functions to HTML
window.keypadInput = keypadInput;
window.keypadBackspace = keypadBackspace;
window.confirmPayment = confirmPayment;
window.closePaymentModal = closePaymentModal;
window.closeStocks = closeStocks;
window.toggleFullscreen = toggleFullscreen;
window.openSales = openSales;
window.openStocks = openStocks;


// 🔍 DEBUG ONLY — expose state to console
Object.defineProperties(window, {
  __products: { get: () => products },
  __categories: { get: () => categories },
  __recipes: { get: () => recipes },
  __inventory: { get: () => inventory }
});