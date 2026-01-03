const API_URL =
  "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";

let products = [];
let categories = [];
let cart = [];

/* ================= LOAD DATA ================= */
async function initPOS() {
  categories = await fetch(API_URL + "?type=categories").then(r => r.json());
  products = await fetch(API_URL + "?type=products").then(r => r.json());

  renderCategories();
  renderProducts();
}

initPOS();

/* ================= CATEGORIES ================= */
function renderCategories() {
  const el = document.getElementById("categoryList");

  el.innerHTML = `
    <button class="category-btn active" onclick="filterCategory('all')">
      All
    </button>
    ${categories.map(c => `
      <button class="category-btn"
        onclick="filterCategory('${c.category_id}')">
        ${c.category_name}
      </button>
    `).join("")}
  `;
}

window.filterCategory = id => {
  renderProducts(id);
};

/* ================= PRODUCTS ================= */
function renderProducts(category = "all") {
  const grid = document.getElementById("productGrid");

  const filtered = category === "all"
    ? products
    : products.filter(p => p.category_id === category);

  grid.innerHTML = filtered.map(p => `
    <div class="product-card" onclick="addToCart('${p.id}')">
      <div class="name">${p.product_name}</div>
      <div class="price">₱${Number(p.price).toFixed(2)}</div>
    </div>
  `).join("");
}

/* ================= CART ================= */
window.addToCart = productId => {
  const p = products.find(x => x.id === productId);
  const row = cart.find(x => x.product_id === productId);

  if (row) row.qty++;
  else cart.push({ ...p, qty: 1 });

  renderCart();
};

function renderCart() {
  const tbody = document.getElementById("orderTable");
  let sum = 0;

  tbody.innerHTML = cart.map((i, idx) => {
    const total = i.qty * i.price;
    sum += total;

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${i.product_name}</td>
        <td>${i.qty}</td>
        <td>₱${i.price.toFixed(2)}</td>
        <td>₱${total.toFixed(2)}</td>
      </tr>
    `;
  }).join("");

  document.getElementById("sumTotal").textContent = sum.toFixed(2);
}

/* ================= CHECKOUT ================= */
document.getElementById("checkoutBtn").onclick = async () => {
  if (!cart.length) return alert("Cart empty");

  const payload = {
    location: "MAIN",
    cashier: "ADMIN",
    items: cart.map(i => ({
      product_id: i.id,
      qty: i.qty,
      price: i.price
    }))
  };

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "checkoutPOS",
      data: payload
    })
  });

  cart = [];
  renderCart();
  alert("Sale completed");
};