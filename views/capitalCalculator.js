import { bindDataBoxScroll } from "../admin.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let products = [];
let recipesMap = {};
let inventoryMap = {};
let qtyMap = {};

/* ================= ENTRY ================= */
export default async function loadCapitalCalculatorView() {
  renderLayout();
  bindDataBoxScroll(document.querySelector(".data-box"));

  await Promise.all([
    loadProducts(),
    loadInventory(),
    loadAllRecipes()
  ]);

  renderTable();
}

/* ================= LAYOUT ================= */
function renderLayout() {
  document.getElementById("actionBar").innerHTML = "";

  document.getElementById("contentBox").innerHTML = `
    <div class="data-box">
      <h2>💰 Capital Calculator</h2>

      <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
        <div>
          <label><strong>Capital Fund</strong></label><br>
          <input id="capitalFundInput" type="number" value="10000" style="padding:8px;border-radius:6px;width:160px">
        </div>

        <div>
          <label><strong>Total Capital Needed</strong></label><br>
          <div id="totalCapital" style="font-size:18px;font-weight:700">₱0</div>
        </div>

        <div>
          <label><strong>Projected Income</strong></label><br>
          <div id="totalIncome" style="font-size:18px;font-weight:700">₱0</div>
        </div>

        <div>
          <label><strong>Projected Profit</strong></label><br>
          <div id="totalProfit" style="font-size:18px;font-weight:700">₱0</div>
        </div>
      </div>

      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Capital</th>
              <th>Income</th>
            </tr>
          </thead>
          <tbody id="capitalBody"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("capitalFundInput").oninput = updateTotals;
}

/* ================= LOAD DATA ================= */
async function loadProducts() {
  products = await fetch(API_URL + "?type=products").then(r => r.json());
}

async function loadInventory() {
  const items = await fetch(API_URL + "?type=inventoryItems").then(r => r.json());
  inventoryMap = {};
  items.forEach(i => inventoryMap[i.item_id] = Number(i.capital) || 0);
}

async function loadAllRecipes() {
  recipesMap = await fetch(API_URL + "?type=allProductRecipes").then(r => r.json());
}

/* ================= CAPITAL LOGIC ================= */
function computeProductCapital(productId, qty) {
  const recipe = recipesMap[productId] || [];
  let total = 0;

  recipe.forEach(r => {
    const capital = inventoryMap[r.item_id] || 0;
    total += capital * Number(r.qty_used);
  });

  return total * qty;
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = document.getElementById("capitalBody");
  tbody.innerHTML = "";

  products.forEach((p, i) => {
    qtyMap[p.product_id] = 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${p.product_name}</td>
      <td>₱${Number(p.price).toFixed(2)}</td>
      <td>
        <button class="recipe-btn minus">−</button>
        <span class="qty" data-id="${p.product_id}">0</span>
        <button class="recipe-btn plus">+</button>
      </td>
      <td id="cap-${p.product_id}">₱0</td>
      <td id="inc-${p.product_id}">₱0</td>
    `;

    const minus = tr.querySelector(".minus");
    const plus = tr.querySelector(".plus");
    const qtySpan = tr.querySelector(".qty");

    plus.onclick = () => updateQty(p, 1, qtySpan);
    minus.onclick = () => updateQty(p, -1, qtySpan);

    tbody.appendChild(tr);
  });
}

function updateQty(product, delta, qtySpan) {
  let qty = qtyMap[product.product_id] || 0;
  qty = Math.max(0, qty + delta);
  qtyMap[product.product_id] = qty;
  qtySpan.textContent = qty;

  const capital = computeProductCapital(product.product_id, qty);
  const income = qty * Number(product.price || 0);

  document.getElementById(`cap-${product.product_id}`).textContent = `₱${capital.toFixed(2)}`;
  document.getElementById(`inc-${product.product_id}`).textContent = `₱${income.toFixed(2)}`;

  updateTotals();
}

/* ================= TOTALS ================= */
function updateTotals() {
  let totalCapital = 0;
  let totalIncome = 0;

  products.forEach(p => {
    const qty = qtyMap[p.product_id] || 0;
    totalCapital += computeProductCapital(p.product_id, qty);
    totalIncome += qty * Number(p.price || 0);
  });

  const profit = totalIncome - totalCapital;

  document.getElementById("totalCapital").textContent = `₱${totalCapital.toFixed(2)}`;
  document.getElementById("totalIncome").textContent = `₱${totalIncome.toFixed(2)}`;
  document.getElementById("totalProfit").textContent = `₱${profit.toFixed(2)}`;
}
