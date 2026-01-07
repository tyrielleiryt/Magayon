import { bindDataBoxScroll } from "../admin.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= LOADER ================= */
function showLoader(text = "Loading…") {
  const l = document.getElementById("globalLoader");
  if (!l) return;
  l.querySelector(".loader-text").textContent = text;
  l.classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("globalLoader")?.classList.add("hidden");
}

/* ================= ENTRY ================= */
export default function loadDailySalesView() {
  renderActionBar();
  renderLayout();

  document.getElementById("salesDate").value =
    new Date().toISOString().slice(0, 10);
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <input type="date" id="salesDate" />
    <input type="text" id="salesLocation" placeholder="Location (optional)" />
    <button class="category-action-btn" id="loadSalesBtn">
      Load Report
    </button>
  `;

  document.getElementById("loadSalesBtn").onclick = loadSales;
}

/* ================= LAYOUT ================= */
function renderLayout() {
  document.getElementById("contentBox").innerHTML = `
    <div class="data-box" style="height:100%;display:flex;flex-direction:column">
      
      <div class="data-scroll" style="flex:1;overflow-y:auto">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Transaction</th>
              <th>Cashier</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody id="salesBody">
            <tr>
              <td colspan="4" style="text-align:center;color:#888">
                Select a date and click Load Report
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="inventory-summary">
        <b>Gross Sales:</b> ₱<span id="sumGross">0.00</span>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
}

/* ================= LOAD SALES ================= */
async function loadSales() {
  const date = document.getElementById("salesDate").value;
  const location = document.getElementById("salesLocation").value.trim();

  if (!date) return alert("Select a date");

  showLoader("Loading sales…");

  try {
    let url = `${API_URL}?type=dailySalesReport&date=${date}`;
    if (location) url += `&location=${encodeURIComponent(location)}`;

    const res = await fetch(url);
    const orders = await res.json();

    renderTable(Array.isArray(orders) ? orders : []);
  } catch (err) {
    console.error(err);
    alert("Failed to load sales");
  } finally {
    hideLoader();
  }
}

/* ================= RENDER ================= */
function renderTable(orders) {
  const tbody = document.getElementById("salesBody");
  tbody.innerHTML = "";

  let gross = 0;

  if (!orders.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:#888">
          No sales found
        </td>
      </tr>`;
    updateTotal(0);
    return;
  }

  orders.forEach((o, i) => {
    gross += Number(o.total) || 0;

    tbody.innerHTML += `
      <tr style="background:#f4f4f4;font-weight:600">
        <td>${i + 1}</td>
        <td>
          ${o.ref_id}<br>
          <small>
            ${new Date(o.datetime).toLocaleString()}<br>
            ${o.location}
          </small>
        </td>
        <td>${o.cashier}</td>
        <td>₱${Number(o.total).toFixed(2)}</td>
      </tr>
    `;

    o.items.forEach(it => {
      tbody.innerHTML += `
        <tr>
          <td></td>
          <td>${it.product_name} × ${it.qty}</td>
          <td></td>
          <td>₱${Number(it.total).toFixed(2)}</td>
        </tr>
      `;
    });
  });

  updateTotal(gross);
}

/* ================= TOTAL ================= */
function updateTotal(v) {
  document.getElementById("sumGross").textContent = Number(v).toFixed(2);
}