/*********************************************************
 * CONFIG
 *********************************************************/
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

const LOCATION = "MAIN";
const LOW_STOCK_THRESHOLD = 5;
const INVENTORY_REFRESH_INTERVAL = 15000; // 15s

/*********************************************************
 * STATE
 *********************************************************/
let products = [];
let cart = [];

let inventoryRemaining = {};   // item_id → remaining
let recipeCache = {};          // product_id → recipe[]
let reservedInventory = {};    // item_id → reserved in cart

let isCheckingOut = false;

/*********************************************************
 * JSONP HELPER (NO CORS)
 *********************************************************/
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).substring(2);
    window[cb] = data => {
      resolve(data);
      delete window[cb];
      script.remove();
    };

    const script = document.createElement("script");
    script.src = `${url}&callback=${cb}`;
    script.onerror = () => {
      reject("JSONP failed");
      delete window[cb];
      script.remove();
    };
    document.body.appendChild(script);
  });
}

/*********************************************************
 * INIT
 *********************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadInventoryRemaining();
    await loadProductRecipes();
    await loadProducts();

    setInterval(refreshInventorySafely, INVENTORY_REFRESH_INTERVAL);
  } catch (e) {
    console.error("❌ POS init failed", e);
    alert("Failed to initialize POS");
  }
});

/*********************************************************
 * INVENTORY
 *********************************************************/
async function loadInventoryRemaining() {
  inventoryRemaining = {};
  reservedInventory = {};

  const items = await jsonp(API_URL + "?type=inventoryItems");
  items.forEach(i => {
    inventoryRemaining[i.item_id] = Number(i.remaining || 0);
  });
}

async function refreshInventorySafely() {
  try {
    const data = await jsonp(
      API_URL +
        "?type=dailyInventoryBreakdown" +
        "&date=" + encodeURIComponent(new Date()) +
        "&location=" + LOCATION
    );

    inventoryRemaining = {};
    data.forEach(d => {
      inventoryRemaining[d.item_id] = Number(d.remaining || 0);
    });

    renderProducts(products);
    console.log("🔄 Inventory refreshed");
  } catch (e) {
    console.warn("⚠️ Inventory refresh skipped");
  }
}

/*********************************************************
 * RECIPES
 *********************************************************/
async function loadProductRecipes() {
  const list = await jsonp(API_URL + "?type=products");

  for (const p of list) {
    recipeCache[p.product_id] = await jsonp(
      API_URL + `?type=productRecipes&product_id=${p.product_id}`
    );
  }
}

/*********************************************************
 * PRODUCTS
 *********************************************************/
async function loadProducts() {
  products = await jsonp(API_URL + "?type=products");
  renderProducts(products);
}

/*********************************************************
 * STOCK WARNINGS
 *********************************************************/
function getIngredientWarnings(product, qty = 1) {
  const recipe = recipeCache[product.product_id];
  if (!recipe || !recipe.length) {
    return [{ type: "block", message: "No recipe set" }];
  }

  const warnings = [];

  recipe.forEach(r => {
    const needed = qty * Number(r.qty_used || 0);
    const available =
      (inventoryRemaining[r.item_id] || 0) -
      (reservedInventory[r.item_id] || 0);

    if (available < needed) {
      warnings.push({
        type: "block",
        message: `${r.item_name || r.item_id} insufficient (${available} left)`
      });
    } else if (available <= LOW_STOCK_THRESHOLD) {
      warnings.push({
        type: "low",
        message: `${r.item_name || r.item_id} low (${available} left)`
      });
    }
  });

  return warnings;
}

function buildTooltipHTML(product, qty = 1) {
  const recipe = recipeCache[product.product_id];
  if (!recipe) return "";

  const lines = [];

  recipe.forEach(r => {
    const needed = qty * Number(r.qty_used || 0);
    const available =
      (inventoryRemaining[r.item_id] || 0) -
      (reservedInventory[r.item_id] || 0);

    if (available < needed) {
      lines.push(
        `❌ ${r.item_name || r.item_id}: needs ${needed}, only ${available}`
      );
    } else if (available <= LOW_STOCK_THRESHOLD) {
      lines.push(
        `⚠️ ${r.item_name || r.item_id}: needs ${needed}, ${available} left`
      );
    }
  });

  return lines.join("<br>");
}

/*********************************************************
 * RENDER PRODUCTS (RESTORES ORIGINAL UI)
 *********************************************************/
function renderProducts(list) {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  grid.innerHTML = "";

  list.forEach(p => {
    const warnings = getIngredientWarnings(p, 1);
    const hasBlock = warnings.some(w => w.type === "block");
    const hasLow = warnings.some(w => w.type === "low");
    const tooltip = buildTooltipHTML(p, 1);

    const card = document.createElement("div");
    card.className = "product-card";
    if (hasBlock) card.classList.add("disabled");
    if (hasLow) card.classList.add("low-stock");

    card.innerHTML = `
      <div class="product-img">
        <img src="${p.image_url || "placeholder.png"}">
        ${hasBlock ? `<div class="sold-out">OUT OF STOCK</div>` : ""}
      </div>
      <div class="product-info">
        <div class="product-name">${p.product_name}</div>
        <div class="product-price">₱${Number(p.price).toFixed(2)}</div>
      </div>
      ${
        tooltip
          ? `<div class="product-tooltip ${hasBlock ? "block" : "low"}">
              ${tooltip}
            </div>`
          : ""
      }
    `;

    if (!hasBlock) {
      card.onclick = () => addToCart(p);
    }

    grid.appendChild(card);
  });
}

/*********************************************************
 * CART
 *********************************************************/
function addToCart(product) {
  const existing = cart.find(i => i.product_id === product.product_id);
  const newQty = (existing?.qty || 0) + 1;

  const warnings = getIngredientWarnings(product, newQty);
  const block = warnings.find(w => w.type === "block");
  if (block) {
    alert(`❌ Cannot add item\n${block.message}`);
    return;
  }

  const recipe = recipeCache[product.product_id];
  recipe.forEach(r => {
    reservedInventory[r.item_id] =
      (reservedInventory[r.item_id] || 0) + Number(r.qty_used || 0);
  });

  if (existing) {
    existing.qty++;
    existing.total = existing.qty * existing.price;
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
  renderProducts(products);
}

function renderCart() {
  const tbody = document.getElementById("orderTable");
  const sumEl = document.getElementById("sumTotal");
  if (!tbody || !sumEl) return;

  tbody.innerHTML = "";
  let sum = 0;

  cart.forEach((item, i) => {
    sum += item.total;
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${item.product_name}</td>
        <td>${item.qty}</td>
        <td>₱${item.price.toFixed(2)}</td>
        <td>₱${item.total.toFixed(2)}</td>
      </tr>
    `;
  });

  sumEl.textContent = sum.toFixed(2);
}

/*********************************************************
 * CHECKOUT
 *********************************************************/
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

      const recipe = recipeCache[line.product_id];
      recipe.forEach(r => {
        new Image().src =
          API_URL +
          `?action=stockOut` +
          `&item_id=${r.item_id}` +
          `&qty=${r.qty_used * line.qty}` +
          `&location=${LOCATION}` +
          `&source=POS` +
          `&ref_id=${refId}`;
      });
    }

    alert("✅ Order completed");

    cart = [];
    reservedInventory = {};
    await loadInventoryRemaining();

    renderCart();
    renderProducts(products);
  } catch (e) {
    alert("❌ Checkout failed");
    console.error(e);
  }

  isCheckingOut = false;
}

/*********************************************************
 * BUTTON
 *********************************************************/
document.querySelector(".checkout")?.addEventListener("click", checkoutPOS);