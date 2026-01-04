const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= JSONP ================= */
function jsonp(url) {
  return new Promise(resolve => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    window[cb] = data => {
      resolve(data);
      delete window[cb];
      script.remove();
    };
    const script = document.createElement("script");
    script.src = `${url}&callback=${cb}`;
    document.body.appendChild(script);
  });
}

/* ================= STATE ================= */
let products = [];
let cart = [];
let inventoryRemaining = {};
let recipeCache = {};
let reservedInventory = {};

const LOCATION = "MAIN";
const LOW_STOCK_THRESHOLD = 5;
const REFRESH_MS = 15000;

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  await loadRecipes();
  await refreshInventory();
  await loadProducts();
  setInterval(refreshInventory, REFRESH_MS);
});

/* ================= LOADERS ================= */
async function loadRecipes() {
  const list = await jsonp(API_URL + "?type=products");
  for (const p of list) {
    recipeCache[p.product_id] = await jsonp(
      API_URL + `?type=productRecipes&product_id=${p.product_id}`
    );
  }
}

async function refreshInventory() {
  const data = await jsonp(
    API_URL +
      `?type=dailyRemainingInventory&date=${new Date().toISOString()}&location=${LOCATION}`
  );

  inventoryRemaining = {};
  data.forEach(i => inventoryRemaining[i.item_id] = Number(i.remaining || 0));
  renderProducts(products);
}

async function loadProducts() {
  products = await jsonp(API_URL + "?type=products");
  renderProducts(products);
}

/* ================= HELPERS ================= */
function warningsFor(product, qty = 1) {
  const rec = recipeCache[product.product_id] || [];
  const w = [];

  rec.forEach(r => {
    const need = qty * r.qty_used;
    const avail = (inventoryRemaining[r.item_id] || 0) - (reservedInventory[r.item_id] || 0);
    if (avail < need) w.push({ type: "block", msg: `${r.item_name}: need ${need}, left ${avail}` });
    else if (avail <= LOW_STOCK_THRESHOLD)
      w.push({ type: "low", msg: `${r.item_name}: low (${avail})` });
  });

  return w;
}

/* ================= RENDER ================= */
function renderProducts(list) {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  list.forEach(p => {
    const w = warningsFor(p, 1);
    const block = w.some(x => x.type === "block");
    const low = w.some(x => x.type === "low");

    const card = document.createElement("div");
    card.className = "product-card" + (block ? " disabled" : "") + (low ? " low-stock" : "");

    card.innerHTML = `
      <div class="product-img">
        <img src="${p.image_url || "placeholder.png"}">
        ${block ? `<div class="sold-out">OUT OF STOCK</div>` : ""}
      </div>
      <div class="product-info">
        <div class="product-name">${p.product_name}</div>
        <div class="product-price">₱${Number(p.price).toFixed(2)}</div>
      </div>
      ${
        w.length
          ? `<div class="product-tooltip ${block ? "block" : "low"}">
               ${w.map(x => x.msg).join("<br>")}
             </div>`
          : ""
      }
    `;

    if (!block) card.onclick = () => addToCart(p);
    grid.appendChild(card);
  });
}

/* ================= CART ================= */
function addToCart(p) {
  const existing = cart.find(i => i.product_id === p.product_id);
  const qty = (existing?.qty || 0) + 1;
  const w = warningsFor(p, qty);
  if (w.some(x => x.type === "block")) return alert("❌ Insufficient stock");

  recipeCache[p.product_id].forEach(r => {
    reservedInventory[r.item_id] = (reservedInventory[r.item_id] || 0) + r.qty_used;
  });

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
  renderProducts(products);
}

function renderCart() {
  const tb = document.getElementById("orderTable");
  const sum = document.getElementById("sumTotal");
  tb.innerHTML = "";
  let t = 0;

  cart.forEach((i, n) => {
    t += i.total;
    tb.innerHTML += `
      <tr>
        <td>${n + 1}</td>
        <td>${i.product_name}</td>
        <td>${i.qty}</td>
        <td>₱${i.price.toFixed(2)}</td>
        <td>₱${i.total.toFixed(2)}</td>
      </tr>`;
  });

  sum.textContent = t.toFixed(2);
}

/* ================= CHECKOUT ================= */
document.querySelector(".checkout").onclick = async () => {
  if (!cart.length) return;

  const ref = "ORD-" + Date.now();

  cart.forEach(l => {
    new Image().src =
      API_URL +
      `?action=recordPosOrderItem&product_id=${l.product_id}&qty=${l.qty}` +
      `&price=${l.price}&total=${l.total}&ref_id=${ref}&location=${LOCATION}`;

    recipeCache[l.product_id].forEach(r => {
      new Image().src =
        API_URL +
        `?action=stockOut&item_id=${r.item_id}&qty=${r.qty_used * l.qty}` +
        `&location=${LOCATION}&source=POS&ref_id=${ref}`;
    });
  });

  alert("✅ Order completed");
  cart = [];
  reservedInventory = {};
  await refreshInventory();
  renderCart();
};