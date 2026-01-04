const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let products = [];
let categories = [];
let cart = [];

let inventoryRemaining = {};   // item_id → remaining qty
let recipeCache = {};          // product_id → recipe[]
let reservedInventory = {};    // item_id → qty reserved in cart

let activeCategory = "ALL";
let isCheckingOut = false;

const LOCATION = "MAIN";
const LOW_STOCK_THRESHOLD = 5;
const INVENTORY_REFRESH_INTERVAL = 15000;

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  await loadCategories();
  await loadInventoryRemaining();
  await loadProductRecipes();
  await loadProducts();

  setInterval(refreshInventorySafely, INVENTORY_REFRESH_INTERVAL);
});

/* ================= LOAD CATEGORIES ================= */
async function loadCategories() {
  categories = await fetch(API_URL + "?type=categories").then(r => r.json());
  renderCategories();
}

function renderCategories() {
  const box = document.getElementById("categoryList");
  box.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "category-btn active";
  allBtn.textContent = "All";
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

/* ================= LOAD INVENTORY ================= */
async function loadInventoryRemaining() {
  inventoryRemaining = {};
  reservedInventory = {};

  const remaining = await fetch(
    API_URL +
      "?type=dailyRemainingInventory" +
      "&date=" + encodeURIComponent(new Date()) +
      "&location=" + LOCATION
  ).then(r => r.json());

  remaining.forEach(i => {
    inventoryRemaining[i.item_id] = Number(i.remaining || 0);
  });
}

async function refreshInventorySafely() {
  try {
    await loadInventoryRemaining();
    renderProducts(products);
  } catch (e) {
    console.warn("Inventory refresh failed");
  }
}

/* ================= LOAD RECIPES ================= */
async function loadProductRecipes() {
  const list = await fetch(API_URL + "?type=products").then(r => r.json());

  for (const p of list) {
    recipeCache[p.product_id] = await fetch(
      API_URL + `?type=productRecipes&product_id=${p.product_id}`
    ).then(r => r.json());
  }
}

/* ================= LOAD PRODUCTS ================= */
async function loadProducts() {
  products = await fetch(API_URL + "?type=products").then(r => r.json());
  renderProducts(products);
}

/* ================= INGREDIENT WARNINGS ================= */
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
        message: `${r.item_id} insufficient`
      });
    } else if (available <= LOW_STOCK_THRESHOLD) {
      warnings.push({
        type: "low",
        message: `${r.item_id} low (${available})`
      });
    }
  });

  return warnings;
}

function buildTooltipHTML(product, qty = 1) {
  const recipe = recipeCache[product.product_id];
  if (!recipe) return "";

  return recipe
    .map(r => {
      const needed = qty * r.qty_used;
      const available =
        (inventoryRemaining[r.item_id] || 0) -
        (reservedInventory[r.item_id] || 0);

      if (available < needed) {
        return `❌ ${r.item_id}: needs ${needed}, ${available} left`;
      }
      if (available <= LOW_STOCK_THRESHOLD) {
        return `⚠️ ${r.item_id}: needs ${needed}, ${available} left`;
      }
      return null;
    })
    .filter(Boolean)
    .join("<br>");
}

/* ================= RENDER PRODUCTS ================= */
function renderProducts(list) {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  list
    .filter(p =>
      activeCategory === "ALL" ||
      p.category_id === activeCategory
    )
    .forEach(p => {
      const warnings = getIngredientWarnings(p, 1);
      const hasBlock = warnings.some(w => w.type === "block");
      const hasLow = warnings.some(w => w.type === "low");

      const tooltipHTML = buildTooltipHTML(p, 1);

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
          tooltipHTML
            ? `<div class="product-tooltip ${hasBlock ? "block" : "low"}">
                ${tooltipHTML}
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

/* ================= CART ================= */
function addToCart(product) {
  const existing = cart.find(i => i.product_id === product.product_id);
  const newQty = (existing?.qty || 0) + 1;

  const warnings = getIngredientWarnings(product, newQty);
  const block = warnings.find(w => w.type === "block");
  if (block) {
    alert("Insufficient inventory");
    return;
  }

  const recipe = recipeCache[product.product_id];
  recipe.forEach(r => {
    reservedInventory[r.item_id] =
      (reservedInventory[r.item_id] || 0) + Number(r.qty_used);
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

/* ================= RENDER CART ================= */
function renderCart() {
  const tbody = document.getElementById("orderTable");
  const sumEl = document.getElementById("sumTotal");

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

/* ================= CLEAR ================= */
document.getElementById("clearOrderBtn")?.addEventListener("click", () => {
  if (!cart.length) return;
  if (!confirm("Clear current order?")) return;

  cart = [];
  reservedInventory = {};
  renderCart();
  renderProducts(products);
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

    alert("Order completed");

    cart = [];
    reservedInventory = {};
    await loadInventoryRemaining();

    renderCart();
    renderProducts(products);

  } catch (e) {
    alert("Checkout failed");
    console.error(e);
  }

  isCheckingOut = false;
}

document.querySelector(".checkout")?.addEventListener("click", checkoutPOS);