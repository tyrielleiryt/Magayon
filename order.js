/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";



  window.API_URL = API_URL; // 👈 ADD THIS

  let POS_LOCKED = true; // 🔒 default locked
const MANAGER_PIN = "1234"; // 🔑 change this

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

async function loadTodayStocks() {
  const res = await fetch(
    `${API_URL}?type=todayStocks&location=${LOCATION}`
  );
  return res.json();
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

  showLoader("Loading POS data…");

  // 🔒 Force fullscreen on POS load
setTimeout(() => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
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

  let relockTimer = null;

function showPinModal() {
  const modal = document.getElementById("pinModal");
  const input = document.getElementById("pinInput");
  if (!modal || !input) return;

  input.value = "";
  modal.classList.remove("hidden");
  input.focus();
}

function closePinModal() {
  document.getElementById("pinModal")?.classList.add("hidden");

  // 🔒 If still locked, force fullscreen back
  if (POS_LOCKED && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

function unlockPOS() {
  const input = document.getElementById("pinInput");
  const pin = input?.value || "";

  if (pin !== MANAGER_PIN) {
    alert("❌ Invalid PIN");
    input.value = "";
    input.focus();
    return;
  }

  // 🔓 Unlock
  POS_LOCKED = false;
  document.getElementById("pinModal")?.classList.add("hidden");

  startRelockTimer();
}

function startRelockTimer() {
  clearTimeout(relockTimer);

  // ⏱ Auto re-lock after 5 minutes
  relockTimer = setTimeout(() => {
    POS_LOCKED = true;

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, 5 * 60 * 1000); // 5 minutes
}

  document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && POS_LOCKED) {
    showPinModal();
  }
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
  }
}, 800);
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
      const disabled = !canSell(p);
      const img = p.image_url?.trim()
        ? p.image_url
        : "images/placeholder.png";

      const card = document.createElement("div");
      card.className = "product-card" + (disabled ? " disabled" : "");

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

// update button icon/state
document.addEventListener("fullscreenchange", () => {
  const btn = document.getElementById("fullscreenBtn");

  if (!document.fullscreenElement) {
    if (POS_LOCKED) {
      // 🔒 FORCE fullscreen back
      setTimeout(() => {
        document.documentElement.requestFullscreen().catch(() => {});
      }, 300);
    }
    if (btn) btn.textContent = "⛶";
  } else {
    if (btn) btn.textContent = "⛶ Exit";
  }
});

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
    const today = new Date().toISOString().slice(0, 10);

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


window.unlockPOS = unlockPOS;

// 🔓 expose keypad + modal functions to HTML
window.keypadInput = keypadInput;
window.keypadBackspace = keypadBackspace;
window.confirmPayment = confirmPayment;
window.closePaymentModal = closePaymentModal;
window.closeStocks = closeStocks;