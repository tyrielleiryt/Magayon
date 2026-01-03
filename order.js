const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let products = [];
let cart = [];

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
});

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
        <img src="${p.image_url || 'placeholder.png'}" alt="${p.product_name}">
      </div>

      <div class="product-info">
        <div class="product-name">${p.product_name}</div>
        <div class="product-code">${p.product_code}</div>
        <div class="product-price">₱${Number(p.price).toFixed(2)}</div>
      </div>
    `;

    card.onclick = () => addToCart(p);
    grid.appendChild(card);
  });
}

/* ================= CART ================= */
function addToCart(product) {
  const existing = cart.find(i => i.product_id === product.product_id);

  if (existing) {
    existing.qty += 1;
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
document.getElementById("clearOrderBtn").onclick = () => {
  cart = [];
  renderCart();
};