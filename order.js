const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let products = [];
let cart = [];
let isCheckingOut = false;

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", loadProducts);

/* ================= LOAD PRODUCTS ================= */
async function loadProducts() {
  const res = await fetch(API_URL + "?type=products");
  products = await res.json();
  renderProducts(products);
}

/* ================= RENDER PRODUCTS ================= */
function renderProducts(list) {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  list.forEach(p => {
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
  const item = cart.find(i => i.product_id === product.product_id);

  if (item) {
    item.qty++;
    item.total = item.qty * item.price;
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

/* ================= RENDER CART ================= */
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

/* ================= CLEAR ================= */
document.getElementById("clearOrderBtn").onclick = () => {
  if (!cart.length) return;
  if (!confirm("Clear current order?")) return;
  cart = [];
  renderCart();
};

/* ================= CHECKOUT ================= */
document.querySelector(".checkout").onclick = checkoutPOS;

async function checkoutPOS() {
  if (isCheckingOut) return;
  if (!cart.length) return alert("Cart is empty");

  isCheckingOut = true;
  const orderId = "ORD-" + Date.now();
  const location = "MAIN";

  try {
    // 1️⃣ Build inventory deduction map
    const deductionMap = await buildInventoryDeduction(cart);

    // 2️⃣ Deduct inventory (single batch)
    stockOutInventory(deductionMap, orderId, location);

    // 3️⃣ Clear cart
    cart = [];
    renderCart();

    alert("Checkout successful");
  } catch (err) {
    console.error(err);
    alert("Checkout failed");
  }

  isCheckingOut = false;
}

/* ================= BUILD DEDUCTION ================= */
async function buildInventoryDeduction(cart) {
  const map = {}; // item_id → qty

  for (const c of cart) {
    const recipes = await fetch(
      API_URL + `?type=productRecipes&product_id=${c.product_id}`
    ).then(r => r.json());

    if (!recipes.length) {
      throw new Error(`No recipe set for ${c.product_name}`);
    }

    recipes.forEach(r => {
      const used = c.qty * Number(r.qty_used || 0);
      map[r.item_id] = (map[r.item_id] || 0) + used;
    });
  }

  return map;
}

/* ================= STOCK OUT ================= */
function stockOutInventory(map, refId, location) {
  Object.entries(map).forEach(([item_id, qty]) => {
    const url =
      API_URL +
      `?action=stockOut` +
      `&item_id=${item_id}` +
      `&qty=${qty}` +
      `&location=${location}` +
      `&source=POS` +
      `&ref_id=${refId}`;

    new Image().src = url; // Apps Script-safe
  });
}