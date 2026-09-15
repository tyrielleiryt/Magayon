
/* =========================================================
   CONFIG
========================================================= */
import { API_URL } from "./firebase-config.js";
import { ROLES, requireRole, logout, authFetch } from "./auth-guard.js";
import { icon, renderIcons } from "./icons.js";
import { listCategories } from "./data/categories.js";
import { listProducts, listAllRecipes } from "./data/products.js";
import { listInventoryItems } from "./data/inventoryItems.js";

window.API_URL = API_URL; // kept for any legacy code expecting a global

renderIcons();

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
    ${icon("lock")} Inventory Closed<br>
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

  el.innerHTML = text;
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
let inventoryConversionMap = {}; // item_id → { unit, perServing } — for showing a quantity equivalent (e.g. "= 1,200g") next to raw counts
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

/* ================= LOGOUT CONFIRM ================= */
function confirmLogout() {
  const overlay = document.getElementById("logoutConfirmOverlay");
  if (!overlay) return Promise.resolve(confirm("Log out?"));

  return new Promise(resolve => {
    overlay.classList.remove("hidden");

    const cancelBtn = document.getElementById("logoutConfirmCancel");
    const okBtn = document.getElementById("logoutConfirmOk");

    function cleanup(result) {
      overlay.classList.add("hidden");
      cancelBtn.removeEventListener("click", onCancel);
      okBtn.removeEventListener("click", onOk);
      overlay.removeEventListener("click", onOverlayClick);
      resolve(result);
    }
    function onCancel() { cleanup(false); }
    function onOk() { cleanup(true); }
    function onOverlayClick(e) { if (e.target === overlay) cleanup(false); }

    cancelBtn.addEventListener("click", onCancel);
    okBtn.addEventListener("click", onOk);
    overlay.addEventListener("click", onOverlayClick);
  });
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
  document.getElementById("cashierLocation").textContent = LOCATION; // fallback while the name resolves below

  // LOCATION is the raw location_id (that's what every API call correctly
  // filters by) — resolve it to a friendly name just for display, same as
  // every admin view already does via its own locationMap lookup.
  fetch(`${API_URL}?type=locations`)
    .then(r => r.json())
    .then(locs => {
      const loc = (Array.isArray(locs) ? locs : []).find(l => l.location_id === LOCATION);
      if (loc) document.getElementById("cashierLocation").textContent = loc.location_name;
    })
    .catch(err => console.warn("Failed to resolve location name", err));
  document.getElementById("fullscreenBtn")
  ?.addEventListener("click", toggleFullscreen);

  /* ================= OVERFLOW MENU =================
     Sync / Clock In/Out / sync status / Sync Inventory / the report
     buttons all live in one dropdown now (everything except Chat and
     Logout, which stay visible since they're used far more often). */
  const posMenuBtn = document.getElementById("posMenuBtn");
  const posMenuPanel = document.getElementById("posMenuPanel");

  if (posMenuBtn && posMenuPanel) {
    posMenuBtn.addEventListener("click", e => {
      e.stopPropagation();
      const willOpen = posMenuPanel.classList.contains("hidden");
      posMenuPanel.classList.toggle("hidden", !willOpen);
      posMenuBtn.setAttribute("aria-expanded", String(willOpen));
    });

    // Close after picking any action.
    posMenuPanel.addEventListener("click", e => {
      if (e.target.closest(".menu-item")) {
        posMenuPanel.classList.add("hidden");
        posMenuBtn.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("click", e => {
      if (!posMenuPanel.classList.contains("hidden") &&
          !posMenuPanel.contains(e.target) &&
          !posMenuBtn.contains(e.target)) {
        posMenuPanel.classList.add("hidden");
        posMenuBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

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

  // Paint the product grid from whatever was cached on the last visit
  // *before* waiting on the network. Inventory levels are cached now too
  // (previously only categories/products/recipes were, so canSell() —
  // which fails safe whenever `inventory` is empty — stayed false for
  // every item until the network caught up regardless; the grid looked
  // ready but wasn't actually usable). With inventory included, a
  // returning cashier with a good last-known snapshot can start ordering
  // immediately, no blocking loader, while a fresh copy loads quietly in
  // the background.
  const paintedFromCache = paintFromCachedPOSData();

  if (paintedFromCache) {
    loadAllData()
      .then(() => {
        renderCategories();
        renderProducts();
        renderCart();
      })
      .catch(err => {
        console.error(err);
        showInventoryToast(`${icon("alert-triangle", { size: 13 })} Showing last saved data — couldn't refresh`);
      });
  } else {
    // True first-ever load on this device — nothing to paint yet, so
    // this is the one case still worth blocking on.
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
  }

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    if (!(await confirmLogout())) return;
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

  // Mobile-only cart bottom sheet — tapping the peek bar expands/
  // collapses the cart. No-op above the phone breakpoint, where the
  // cart is always fully visible and this bar stays hidden.
  document.getElementById("cartPeekBar")?.addEventListener("click", () => {
    document.getElementById("cartPanel")?.classList.toggle("expanded");
  });

  document.getElementById("searchInput")?.addEventListener("input", e => {
    renderProducts(e.target.value.toLowerCase());
  });

    updateSyncCounter(); // 👈 ADD THIS
    chatBox?.classList.add("hidden");

});

/* =========================================================
   PAINT FROM CACHE
   Restores everything loadAllData() would normally populate — straight
   from what was saved locally after the last successful load — so a
   returning cashier gets an immediately usable grid instead of staring
   at a loader while Apps Script responds. Returns false (paints
   nothing) unless every piece needed to actually sell something is
   present; a partial cache would leave canSell() silently false again.
========================================================= */
function paintFromCachedPOSData() {
  try {
    const cachedCategories = JSON.parse(localStorage.getItem("categories") || "null");
    const cachedProducts = JSON.parse(localStorage.getItem("products") || "null");
    const cachedRecipes = JSON.parse(localStorage.getItem("recipes") || "null");
    const cachedInventory = JSON.parse(localStorage.getItem("inventory") || "null");
    const cachedInventoryNames = JSON.parse(localStorage.getItem("inventoryNames") || "null");
    const cachedConversionMap = JSON.parse(localStorage.getItem("inventoryConversionMap") || "null");
    const cachedReorderLevels = JSON.parse(localStorage.getItem("inventoryReorderLevels") || "null");
    const cachedPosClosed = JSON.parse(localStorage.getItem("posClosed") || "false");

    if (!cachedCategories || !cachedProducts || !cachedRecipes ||
        !cachedInventory || !cachedInventoryNames) {
      return false;
    }

    categories = cachedCategories;
    products = cachedProducts;
    recipes = cachedRecipes;
    inventory = cachedInventory;
    inventoryNames = cachedInventoryNames;
    inventoryConversionMap = cachedConversionMap || {};
    inventoryReorderLevels = cachedReorderLevels || {};

    renderCategories();
    renderProducts();
    renderCart();

    // Reflects the last known open/closed state immediately instead of
    // defaulting to "open" for a few seconds — loadAllData()'s own
    // applyInventoryGate() call corrects this within moments either way
    // once the real fetch resolves, same as it always has.
    if (cachedPosClosed) {
      POS_CLOSED = true;
      enterSalesOnlyMode();
    }

    return true;
  } catch (err) {
    console.warn("Failed to read cached POS data", err);
    return false;
  }
}

/* =========================================================
   FETCH WITH RETRY
   Apps Script's web-app redirect chain occasionally hangs 30-95s under
   load and comes back with a non-JSON error page instead of real data
   (confirmed live, not hypothetical) — every plain fetch()+res.json()
   in this file was a single shot with no defense against that, so one
   bad response showed "Failed to load..." even though the data was
   fine moments before/after. Same fix already shipped for the admin
   side's fetchJSONWithRetry() in admin.js.
========================================================= */
async function fetchJSONWithRetry(url, attempts = 3, delayMs = 1200) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      return JSON.parse(text);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

/* =========================================================
   LOAD ALL DATA
========================================================= */
async function loadAllData() {
  const today = getPHDate();

  // Phase 1 of the Supabase migration (see docs/supabase-migration.md):
  // catalog/reference data (categories, products, recipes, inventory
  // items) now comes straight from Supabase, fetched in parallel with
  // Apps Script's posInit call — which now only supplies today's live
  // stock (dailyInventory); that part hasn't migrated yet (Phase 2).
  const [posInitData, categoriesData, productsData, inventoryItemsData, recipesData] =
    await Promise.all([
      fetchJSONWithRetry(`${API_URL}?type=posInit&date=${today}&location=${LOCATION}`),
      listCategories(),
      listProducts(),
      listInventoryItems(),
      listAllRecipes()
    ]);

  const inventoryResponse = posInitData.dailyInventory;

  inventoryReorderLevels = {};
  inventoryConversionMap = {};
  inventoryItemsData.forEach(i => {
    if (i.reorder_level !== undefined && i.reorder_level !== null) {
      inventoryReorderLevels[i.item_id] = Number(i.reorder_level);
    }
    inventoryConversionMap[i.item_id] = {
      unit: i.unit || "",
      perServing: Number(i.quantity_per_serving) || 0
    };
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
  localStorage.setItem("inventory", JSON.stringify(inventory));
  localStorage.setItem("inventoryNames", JSON.stringify(inventoryNames));
  localStorage.setItem("inventoryConversionMap", JSON.stringify(inventoryConversionMap));
  localStorage.setItem("inventoryReorderLevels", JSON.stringify(inventoryReorderLevels));
  localStorage.setItem("posClosed", JSON.stringify(POS_CLOSED));
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
      showInventoryToast(`${icon("refresh-cw", { size: 13 })} Syncing inventory…`);
    }

   const data = await fetchJSONWithRetry(
  `${API_URL}?type=dailyInventoryItems&date=${today}&location=${LOCATION}`
);

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
      showInventoryToast(`${icon("check-circle", { size: 13 })} Inventory updated`);
    }

  } catch (err) {
    console.warn("Inventory refresh failed", err);
    if (!silent) {
      showInventoryToast(`${icon("alert-triangle", { size: 13 })} Inventory sync failed`);
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
    ${icon("flask-conical", { size: 14 })}
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

  let sum = 0;
  let rows = "";

  cart.forEach((i, idx) => {
    sum += i.total;
    rows += `
      <tr>
        <td>${idx + 1}</td>
        <td>${i.product_name}</td>
        <td>${i.qty}</td>
        <td>₱${i.price.toFixed(2)}</td>
        <td>₱${i.total.toFixed(2)}</td>
      </tr>
    `;
  });

  tbody.innerHTML = rows;
  sumEl.textContent = sum.toFixed(2);

  // Mobile-only cart peek bar — no-op above the phone breakpoint, where
  // this element doesn't exist in a rendered/visible state.
  const peekText = document.getElementById("cartPeekText");
  if (peekText) {
    const itemCount = cart.reduce((n, i) => n + (Number(i.qty) || 0), 0);
    peekText.textContent = `${itemCount} item${itemCount === 1 ? "" : "s"} · ₱${sum.toFixed(2)}`;
  }
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

// Orders the server explicitly rejected during sync (not a network
// failure — a real success:false from checkoutOrder, e.g. inventory
// changed while offline). These stop retrying automatically since
// resending the same payload will never succeed, but they're kept here
// instead of just being dropped, so nothing silently disappears.
function getFailedOrders() {
  return JSON.parse(localStorage.getItem("failedOrders") || "[]");
}

function setFailedOrders(arr) {
  localStorage.setItem("failedOrders", JSON.stringify(arr));
}

// Badge on the merged "Sync" menu item — pending+failed count, or "⟳"
// while a sync is actively running. Hidden entirely when there's
// nothing to flag, so the menu item just reads "Sync" the rest of the
// time instead of showing a permanent "0".
function updateSyncCounter() {
  const pending = getPendingOrders();
  const failed = getFailedOrders();
  const el = document.getElementById("syncCount");

  if (!el) return;

  if (SYNC_IN_PROGRESS) {
    el.textContent = "⟳";
    el.classList.remove("hidden", "sync-count-warn");
    return;
  }

  const count = pending.length + failed.length;

  if (!count) {
    el.classList.add("hidden");
    return;
  }

  el.textContent = count;
  el.classList.toggle("sync-count-warn", failed.length > 0);
  el.classList.remove("hidden");
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
document.getElementById("pettyCashBtn")?.addEventListener("click", openPettyCash);
document.getElementById("addInventoryBtn")?.addEventListener("click", openAddInventory);

// "Sync" merges what used to be three separate menu rows (Sync,
// Syncing: N, Sync Inventory) into one: pushes any queued offline
// orders, then pulls a fresh inventory snapshot, then reports one
// combined result — instead of leaving the cashier to guess which of
// three buttons to press.
document.getElementById("syncBtn")?.addEventListener("click", async () => {
  if (!navigator.onLine) {
    showInventoryToast(`${icon("alert-triangle", { size: 13 })} You're offline — orders will sync automatically once you're back online`);
    return;
  }

  const pendingBefore = getPendingOrders().length;
  const failedBefore = getFailedOrders().length;

  if (pendingBefore) {
    showInventoryToast(`${icon("refresh-cw", { size: 13 })} Syncing ${pendingBefore} order${pendingBefore === 1 ? "" : "s"}…`);
    await syncPendingOrders(); // alerts on its own if anything NEW fails here
  }

  await refreshInventoryOnly({ silent: true });

  const pendingAfter = getPendingOrders().length;
  const failed = getFailedOrders();

  // Orders that were ALREADY failed before this click never get retried
  // automatically (see syncPendingOrders), so this is the only remaining
  // way to see them — but skip it when syncPendingOrders() just alerted
  // about a fresh failure this same run, to avoid showing it twice.
  if (failed.length && failed.length === failedBefore) {
    alert(
      `⚠️ ${failed.length} order${failed.length === 1 ? "" : "s"} still need${failed.length === 1 ? "s" : ""} manual review:\n\n` +
      failed.map(o => `${o.ref_id}: ${o.error}`).join("\n")
    );
  } else if (!failed.length) {
    showInventoryToast(
      pendingAfter === 0
        ? `${icon("check-circle", { size: 13 })} Synced — inventory up to date`
        : `${icon("alert-triangle", { size: 13 })} ${pendingAfter} order${pendingAfter === 1 ? "" : "s"} still pending — will retry automatically`
    );
  }
});


async function openStocks() {
  const tbody = document.getElementById("stocksTable");
  tbody.innerHTML = "<tr><td colspan='3' class='pos-modal-empty'>Loading…</td></tr>";
  document.getElementById("stocksModal").classList.remove("hidden");

  try {
    const today = getPHDate();

    const data = await fetchJSONWithRetry(
      `${API_URL}?type=dailyInventoryItems&date=${today}&location=${LOCATION}`
    );

    if (data.status !== "OPEN") {
      tbody.innerHTML =
        `<tr><td colspan='3' class="pos-modal-empty">${icon("lock", { size: 20 })}<br>Inventory is closed.</td></tr>`;
      return;
    }

    const rows = data.items || [];

    tbody.innerHTML = "";

    if (!rows.length) {
      tbody.innerHTML =
        `<tr><td colspan='3' class="pos-modal-empty">${icon("clipboard-list", { size: 20 })}<br>No inventory data.</td></tr>`;
      return;
    }

    rows.forEach(r => {
      const added = Number(r.qty_added) || 0;
      const remaining = Number(r.remaining) || 0;
      const conv = inventoryConversionMap[r.item_id];
      const addedEquiv = conv && conv.perServing
        ? ` <small style="color:var(--apple-text-secondary)">(${(added * conv.perServing).toLocaleString()} ${conv.unit})</small>`
        : "";
      const remainingEquiv = conv && conv.perServing
        ? ` <small style="color:var(--apple-text-secondary)">(${(remaining * conv.perServing).toLocaleString()} ${conv.unit})</small>`
        : "";

      tbody.insertAdjacentHTML("beforeend", `
        <tr>
          <td>${r.item_name}</td>
          <td>${added}${addedEquiv}</td>
          <td>${remaining}${remainingEquiv}</td>
        </tr>
      `);
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML =
      `<tr><td colspan='3' class="pos-modal-empty">${icon("alert-triangle", { size: 20 })}<br>Failed to load inventory.</td></tr>`;
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

  // Drop each order from the queue as soon as it RESOLVES — either a
  // real success or a definite server-side rejection — not after the
  // whole batch finishes, otherwise one failure partway through re-sends
  // every order that already went through on the next sync, duplicating
  // sales that were already recorded. Only a genuine network failure
  // (the fetch itself throwing) leaves an order in the queue for retry.
  const remaining = [...pending];
  const rejected = [];

  for (const o of pending) {
    let data;

    try {
      const body = new URLSearchParams({
        action: "checkoutOrder",
        ref_id: o.ref_id,
        staff_id: o.staff_id,
        location: o.location,
        items: JSON.stringify(o.items),
        payment: JSON.stringify(o.payment || {}) // ✅ ADD
      });

      const res = await authFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });

      data = await res.json();
    } catch (err) {
      // Offline mid-sync, DNS failure, etc. — this order (and everything
      // still behind it) stays in the queue for the next sync attempt.
      console.warn("Sync failed for order:", o.ref_id, err);
      SYNC_IN_PROGRESS = false;
      updateSyncCounter();
      return;
    }

    remaining.shift();
    setPendingOrders(remaining);

    // The request completed, but the server rejected this specific order
    // (e.g. inventory changed while offline, or today's inventory day
    // wasn't open) — resending the identical payload will never succeed,
    // so pull it into a separate failed list instead of looping on it
    // forever and blocking every valid order queued behind it.
    if (!data.success) {
      console.error("Order rejected by server:", o.ref_id, data.error);
      rejected.push({ ...o, error: data.error || "Unknown error", failed_at: Date.now() });
    }
  }

  if (rejected.length) {
    setFailedOrders(getFailedOrders().concat(rejected));
    alert(
      `⚠️ ${rejected.length} order${rejected.length === 1 ? "" : "s"} could not be recorded and ` +
      `need${rejected.length === 1 ? "s" : ""} manual review:\n\n` +
      rejected.map(o => `${o.ref_id}: ${o.error}`).join("\n")
    );
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
      ${icon("lock")} POS is locked<br>
      <small>Inventory day has been closed</small>
    </div>
  `;

  document.body.appendChild(overlay);
}

function closeStocks() {
  document.getElementById("stocksModal").classList.add("hidden");
}

/* =========================================================
   PETTY CASH FUND / EXPENSES (POS popup)
   Same fields/actions as the admin-side view it replaced — always
   today + this cashier's own LOCATION, no date/location pickers
   needed since a cashier only ever reconciles their own register.
   Just an overlay like Stocks List/Sales Report above, so it never
   touches the cart or product grid underneath it.
========================================================= */
let lastPettyCashSummary = null;

async function openPettyCash() {
  const content = document.getElementById("pettyCashContent");
  content.innerHTML = `<div class="pos-modal-empty">Loading…</div>`;
  document.getElementById("pettyCashModal").classList.remove("hidden");

  try {
    const today = getPHDate();
    const res = await fetch(
      `${API_URL}?type=pettyCashSummary&date=${today}&location=${LOCATION}`
    );
    const data = await res.json();
    renderPettyCash(data);
  } catch (err) {
    console.error(err);
    content.innerHTML =
      `<div class="pos-modal-empty">${icon("alert-triangle", { size: 20 })}<br>Failed to load petty cash.</div>`;
  }
}

function renderPettyCash(data) {
  lastPettyCashSummary = data;
  const content = document.getElementById("pettyCashContent");

  if (!data || !data.success) {
    content.innerHTML =
      `<div class="pos-modal-empty">${data?.error || "No inventory day found for today"}</div>`;
    return;
  }

  const expenses = data.expenses || [];

  content.innerHTML = `
    <div class="pc-row">
      <div class="pc-box">
        <label>Petty Cash Fund</label>
        <div style="display:flex;gap:8px">
          <input id="pcFund" type="number" min="0" step="0.01" value="${data.petty_cash_fund}">
          <button id="pcSaveFundBtn" class="pos-modal-save-btn">${icon("save", { size: 14 })} Save</button>
        </div>
      </div>
      <div class="pc-box">
        <label>Remaining PCF</label>
        <div class="pc-remaining-value">₱${Number(data.remaining_petty_cash).toFixed(2)}</div>
      </div>
    </div>

    <div class="pos-modal-section-title">${icon("plus", { size: 12 })} Add Expense</div>
    <div class="pc-expense-form">
      <div class="pc-field">
        <label>Description</label>
        <input id="pcExpDescription" placeholder="e.g. Gas for delivery">
      </div>
      <div class="pc-field" style="max-width:110px">
        <label>Amount</label>
        <input id="pcExpAmount" type="number" min="0" step="0.01" placeholder="0.00">
      </div>
      <div class="pc-field">
        <label>Remarks</label>
        <input id="pcExpRemarks" placeholder="Optional">
      </div>
      <button id="pcSaveExpenseBtn" class="pos-modal-save-btn">Save</button>
    </div>

    <div class="pos-modal-section-title">Expenses Today</div>
    <div class="sales-table-wrapper" style="max-height:180px">
      <table>
        <thead>
          <tr><th>Description</th><th>Amount</th><th>Remarks</th></tr>
        </thead>
        <tbody>
          ${!expenses.length
            ? `<tr><td colspan="3" class="pos-modal-empty">No expenses logged for today</td></tr>`
            : expenses.map(e => `
              <tr>
                <td>${e.description}</td>
                <td>₱${Number(e.amount).toFixed(2)}</td>
                <td>${e.remarks || ""}</td>
              </tr>
            `).join("")
          }
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("pcSaveFundBtn").onclick = savePettyCashFund;
  document.getElementById("pcSaveExpenseBtn").onclick = saveExpense;
}

async function savePettyCashFund() {
  if (!lastPettyCashSummary?.daily_id) return;

  const fund = Number(document.getElementById("pcFund").value) || 0;
  const btn = document.getElementById("pcSaveFundBtn");
  btn.disabled = true;

  try {
    const res = await authFetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "updateDailyFinance",
        daily_id: lastPettyCashSummary.daily_id,
        petty_cash_fund: fund
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "Save failed");
    openPettyCash();
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
    btn.disabled = false;
  }
}

async function saveExpense() {
  if (!lastPettyCashSummary?.daily_id) return;

  const description = document.getElementById("pcExpDescription").value.trim();
  const amount = Number(document.getElementById("pcExpAmount").value);
  const remarks = document.getElementById("pcExpRemarks").value.trim();

  if (!description) {
    alert("Expense description is required");
    return;
  }
  if (!amount || amount <= 0) {
    alert("Amount must be greater than 0");
    return;
  }

  const btn = document.getElementById("pcSaveExpenseBtn");
  btn.disabled = true;

  try {
    const res = await authFetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "addExpense",
        daily_id: lastPettyCashSummary.daily_id,
        description,
        amount,
        remarks
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "Save failed");
    openPettyCash();
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
    btn.disabled = false;
  }
}

function closePettyCash() {
  document.getElementById("pettyCashModal").classList.add("hidden");
}
window.closePettyCash = closePettyCash;

/* =========================================================
   ADD INVENTORY (POS popup)
   Ports admin's Daily Inventory System "Add Inventory" flow so a
   cashier can top up stock mid-shift without pulling in an admin.
   Builds the form straight from the inventory data already sitting
   in memory (inventory/inventoryNames/inventoryConversionMap, loaded
   once via posInit) — no extra fetch needed just to open it.
========================================================= */
async function openAddInventory() {
  if (POS_CLOSED) {
    alert("Today's inventory isn't open yet — ask an admin/manager to start it before adding stock.");
    return;
  }

  const list = document.getElementById("addInventoryList");
  const errorEl = document.getElementById("addInventorySaveError");
  errorEl.classList.add("hidden");

  const itemIds = Object.keys(inventoryNames);

  list.innerHTML = !itemIds.length
    ? `<div class="pos-modal-empty">No inventory items found.</div>`
    : itemIds.map(id => {
        const name = inventoryNames[id];
        const remaining = inventory[id] || 0;
        const conv = inventoryConversionMap[id] || {};
        const unit = conv.unit || "";

        return `
          <div class="inv-item-row">
            <div class="inv-item-info">
              <div class="inv-item-name">${name}${unit ? ` <span class="inv-item-unit">(${unit})</span>` : ""}</div>
              <div class="inv-item-current">Currently: ${remaining}${unit ? " " + unit : ""}</div>
            </div>
            <input type="number" min="0"
              data-id="${id}"
              data-yield="${conv.perServing || 0}"
              data-unit="${unit}"
              class="add-inventory-qty"
              placeholder="Qty">
            <div class="add-inventory-yield">—</div>
          </div>
        `;
      }).join("");

  if (itemIds.length) bindAddInventoryYieldInputs();

  document.getElementById("addInventoryModal").classList.remove("hidden");
}

function bindAddInventoryYieldInputs() {
  document.querySelectorAll("#addInventoryList .add-inventory-qty").forEach(input => {
    const yieldEl = input.nextElementSibling;
    const perServing = Number(input.dataset.yield) || 0;
    const unit = input.dataset.unit || "";

    input.addEventListener("input", () => {
      const qty = Number(input.value) || 0;

      if (!perServing || !qty) {
        yieldEl.textContent = "—";
        return;
      }

      const total = qty * perServing;
      yieldEl.textContent = `= ${total.toLocaleString()}${unit} total`;
    });
  });
}

function saveAddInventory() {
  const inputs = document.querySelectorAll("#addInventoryList [data-id]");
  const items = [];

  inputs.forEach(i => {
    const qty = Number(i.value);
    if (qty > 0) items.push({ item_id: i.dataset.id, qty });
  });

  const errorEl = document.getElementById("addInventorySaveError");
  errorEl.classList.add("hidden");

  if (!items.length) {
    errorEl.textContent = "No quantities entered";
    errorEl.classList.remove("hidden");
    return;
  }

  const saveBtn = document.getElementById("addInventorySaveBtn");
  saveBtn.disabled = true;

  authFetch(API_URL, {
    method: "POST",
    body: new URLSearchParams({
      action: "addDailyInventory",
      date: getPHDate(),
      location: LOCATION,
      created_by: CASHIER_NAME || STAFF_ID,
      items: JSON.stringify(items)
    })
  })
    .then(r => r.json())
    .then(res => {
      if (!res.success) {
        errorEl.textContent = res.error || "Failed to save inventory";
        errorEl.classList.remove("hidden");
        saveBtn.disabled = false;
        return;
      }

      // Refresh the in-memory inventory (already used elsewhere for the
      // manual "Sync Inventory" menu item) so the product grid's
      // canSell() reflects the new stock immediately.
      return refreshInventoryOnly().then(closeAddInventory);
    })
    .catch(err => {
      console.error(err);
      errorEl.textContent = "Failed to save inventory";
      errorEl.classList.remove("hidden");
      saveBtn.disabled = false;
    })
    .finally(() => {
      saveBtn.disabled = false;
    });
}

function closeAddInventory() {
  document.getElementById("addInventoryModal").classList.add("hidden");
}
window.closeAddInventory = closeAddInventory;
window.saveAddInventory = saveAddInventory;

/* =========================================================
   STAFF CLOCK IN/OUT (biometric, local-gate only)
   WebAuthn platform credentials (Face ID/fingerprint) are bound to this
   specific tablet+browser — enrollment happens here in the POS, not the
   admin desktop Staff tab, since a credential made on a manager's laptop
   would be useless here. The backend never re-verifies the WebAuthn
   signature; a resolved navigator.credentials.get() for a specific
   staff member's specific stored credential is treated as proof it was
   them — that's still enough to stop casual buddy-punching, since the
   OS won't unlock the wrong person's credential.
========================================================= */

document.getElementById("clockInOutBtn")?.addEventListener("click", openClockIn);

async function openClockIn() {
  document.getElementById("clockInModal").classList.remove("hidden");
  await loadClockInData();
}

function closeClockIn() {
  document.getElementById("clockInModal").classList.add("hidden");
}
window.closeClockIn = closeClockIn;

function loadClockInData() {
  const tbody = document.getElementById("clockInTable");
  tbody.innerHTML = "<tr><td colspan='3'>Loading…</td></tr>";

  return new Promise(resolve => {
    const callbackName = "clockInCallback_" + Date.now();

    window[callbackName] = data => {
      delete window[callbackName];
      script.remove();
      renderClockInTable(data);
      resolve();
    };

    const script = document.createElement("script");
    script.src =
      `${API_URL}?type=clockInKioskData` +
      `&location=${LOCATION}` +
      `&callback=${callbackName}`;

    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      tbody.innerHTML = "<tr><td colspan='3'>Failed to load staff.</td></tr>";
      resolve();
    };

    document.body.appendChild(script);
  });
}

function renderClockInTable(data) {
  const tbody = document.getElementById("clockInTable");

  if (!data || !data.success) {
    tbody.innerHTML = `<tr><td colspan='3'>${data?.error || "Failed to load staff."}</td></tr>`;
    return;
  }

  const staff = data.staff || [];
  if (!staff.length) {
    tbody.innerHTML = "<tr><td colspan='3'>No active staff at this location.</td></tr>";
    return;
  }

  tbody.innerHTML = "";
  staff.forEach(s => {
    let statusCell, actionCell;

    if (!s.enrolled) {
      statusCell = "Not enrolled";
      actionCell = `<button onclick="enrollStaff('${s.staff_id}', '${(s.name || "").replace(/'/g, "\\'")}')">${icon("fingerprint", { size: 14 })} Enroll</button>`;
    } else if (s.status === "IN") {
      statusCell = `In since ${s.clock_in_time || "—"}`;
      actionCell = `<button onclick="clockInOut('${s.staff_id}', '${s.credential_id}', 'clockOut')">${icon("log-out", { size: 14 })} Clock Out</button>`;
    } else {
      statusCell = s.clock_out_time ? `Out (last: ${s.clock_out_time})` : "Not clocked in today";
      actionCell = `<button onclick="clockInOut('${s.staff_id}', '${s.credential_id}', 'clockIn')">${icon("log-in", { size: 14 })} Clock In</button>`;
    }

    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${s.name}</td>
        <td>${statusCell}</td>
        <td>${actionCell}</td>
      </tr>
    `);
  });
}

function base64urlToBuffer(base64url) {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(base64url.length + (4 - base64url.length % 4) % 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function enrollStaff(staffId, name) {
  if (!window.PublicKeyCredential) {
    alert("This device/browser doesn't support biometric enrollment.");
    return;
  }

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Magayon POS" },
        user: {
          id: new TextEncoder().encode(staffId),
          name: staffId,
          displayName: name || staffId
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        attestation: "none",
        timeout: 60000
      }
    });

    if (!credential) throw new Error("Enrollment was cancelled");

    const res = await authFetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "enrollBiometric",
        staff_id: staffId,
        credential_id: credential.id
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "Enrollment failed");

    await loadClockInData();
  } catch (err) {
    console.error(err);
    alert("❌ " + (err.message || "Enrollment failed"));
  }
}
window.enrollStaff = enrollStaff;

async function clockInOut(staffId, credentialId, action) {
  if (!window.PublicKeyCredential) {
    alert("This device/browser doesn't support biometric verification.");
    return;
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{
          type: "public-key",
          id: base64urlToBuffer(credentialId),
          transports: ["internal"]
        }],
        userVerification: "required",
        timeout: 60000
      }
    });

    if (!assertion) throw new Error("Verification was cancelled");

    const res = await authFetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action,
        staff_id: staffId,
        location_id: LOCATION
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "Failed to record");

    await loadClockInData();
  } catch (err) {
    console.error(err);
    alert("❌ Verification failed — try again");
  }
}
window.clockInOut = clockInOut;


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
        <td colspan="5" class="pos-modal-empty">
          ${icon("receipt", { size: 20 })}<br>No sales today
        </td>
      </tr>`;
    totalEl.textContent = "0.00";
    document.getElementById("sumCash").textContent = "0.00";
    document.getElementById("sumGcash").textContent = "0.00";
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
  totalEl.textContent = grandTotal.toFixed(2);
  document.getElementById("sumCash").textContent = cashTotal.toFixed(2);
  document.getElementById("sumGcash").textContent = gcashTotal.toFixed(2);
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

// Same transient-Apps-Script-failure defense as fetchJSONWithRetry() above,
// but for this one call's JSONP transport (a <script> tag, not fetch) —
// a bad response here doesn't reject with a normal error, it fails to
// load as valid JS, which only shows up as the tag's onerror firing, so
// the retry has to live at that same layer instead.
function loadTodaySales(attempts = 3, delayMs = 1200) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    function tryLoad() {
      attempt++;
      const callbackName = "salesCallback_" + Date.now() + "_" + attempt;

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
        if (attempt < attempts) {
          setTimeout(tryLoad, delayMs);
        } else {
          reject(new Error("Failed to load sales"));
        }
      };

      document.body.appendChild(script);
    }

    tryLoad();
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
// Self-rescheduling instead of a fixed setInterval so it can poll fast
// (3s) while the chat is actually open/being watched, but back off to
// 20s while it's closed — a tablet sitting idle doesn't need a chat
// round-trip roughly every 1.5s just to catch an occasional message.
function scheduleChatPoll() {
  const isOpen = chatBox && !chatBox.classList.contains("hidden");
  setTimeout(() => {
    if (POS_CHAT_ENABLED && chatBox) loadPOSChat();
    scheduleChatPoll();
  }, isOpen ? 3000 : 20000);
}
scheduleChatPoll();

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
      <td colspan="5" class="pos-modal-empty">
        Loading today's sales…
      </td>
    </tr>`;
  totalEl.textContent = "0.00";
  document.getElementById("salesModal").classList.remove("hidden");

  try {
    showLoader("Loading sales report…");

    // ✅ JSONP — NO CORS
    const orders = await loadTodaySales();

    if (!Array.isArray(orders)) {
      throw new Error("Invalid sales data");
    }

    renderSalesTable(orders);

  } catch (err) {
    console.error("Sales report error:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="pos-modal-empty">
          ${icon("alert-triangle", { size: 20, style: "color:var(--apple-red)" })}<br>Failed to load sales
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