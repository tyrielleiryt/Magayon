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

      <div class="capital-summary-grid">

  <div class="summary-box">
    <label><strong>Capital Fund</strong></label>
    <input id="capitalFundInput" type="number" value="10000">
  </div>

  <div class="summary-box">
    <label><strong>Total Capital Needed</strong></label>
    <div id="totalCapital">₱0</div>
  </div>

  <div class="summary-box">
    <label><strong>Projected Income</strong></label>
    <div id="totalIncome">₱0</div>
  </div>

  <div class="summary-box profit">
    <label><strong>Projected Profit</strong></label>
    <div id="totalProfit">₱0</div>
  </div>

  <div class="summary-box inventory">
    <label><strong>📦 Required Inventory</strong></label>
    <div id="inventorySummaryList" class="inventory-summary-list"></div>
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

function updateInventorySummary() {
  const summary = {};

  products.forEach(p => {
    const qty = qtyMap[p.product_id] || 0;
    if (!qty) return;

    const recipe = recipesMap[p.product_id] || [];

    recipe.forEach(r => {
      if (!summary[r.item_id]) {
        summary[r.item_id] = {
          name: r.item_name || "",
          total: 0,
          unit: r.unit || ""
        };
      }

      summary[r.item_id].total += qty * Number(r.qty_used);
    });
  });

  renderInventorySummary(summary);
}

function renderInventorySummary(summary) {
  const box = document.getElementById("inventorySummaryList");
  if (!box) return;

  const items = Object.values(summary);

  if (!items.length) {
    box.innerHTML = `<div class="muted">No items required</div>`;
    return;
  }

  box.innerHTML = items.map(i => `
    <div>
      <strong>${i.name}</strong>: ${i.total}
    </div>
  `).join("");
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

  const fund = Number(document.getElementById("capitalFundInput").value || 0);

if (totalCapital > fund) {
  document.getElementById("totalCapital").style.color = "#dc2626";
} else {
  document.getElementById("totalCapital").style.color = "#16a34a";
}

  document.getElementById("totalCapital").textContent = `₱${totalCapital.toFixed(2)}`;
  document.getElementById("totalIncome").textContent = `₱${totalIncome.toFixed(2)}`;
  document.getElementById("totalProfit").textContent = `₱${profit.toFixed(2)}`;

  updateInventorySummary();
}
