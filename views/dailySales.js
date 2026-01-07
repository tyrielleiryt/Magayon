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

  // default to today
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("salesDate").value = today;
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
    <div class="data-box" style="display:flex;flex-direction:column;height:100%">
      
      <div class="data-scroll" style="flex:1;overflow-y:auto;">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product / Transaction</th>
              <th>Qty</th>
              <th>Cashier</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="salesBody">
            <tr>
              <td colspan="6" style="text-align:center;color:#888">
                Select a date and click Load Report
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="inventory-summary" style="margin-top:12px">
        <div><b>Gross Sales:</b> ₱<span id="sumGross">0.00</span></div>
      </div>

    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
}

/* ================= LOAD SALES ================= */
async function loadSales() {
  const date = document.getElementById("salesDate").value;
  const location = document.getElementById("salesLocation").value.trim();

  if (!date) {
    alert("Select a date");
    return;
  }

  showLoader("Loading sales report…");

  try {
    const res = await fetch(
      `${API_URL}?type=dailySalesReport&date=${date}&location=${encodeURIComponent(location)}`
    );

    const data = await res.json();

    // 🔒 HARD SAFETY — never break UI
    if (!Array.isArray(data)) {
      console.warn("Unexpected sales response:", data);
      renderTable([]);
      return;
    }

    renderTable(data);

  } catch (err) {
    console.error(err);
    alert("Failed to load report");
    renderTable([]);
  } finally {
    hideLoader();
  }
}

/* ================= RENDER ================= */
function renderTable(orders) {
  const tbody = document.getElementById("salesBody");
  tbody.innerHTML = "";

  let grandTotal = 0;

  if (!orders.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#888">
          No sales found
        </td>
      </tr>`;
    updateTotals(0);
    return;
  }

  orders.forEach((o, i) => {
    grandTotal += Number(o.total) || 0;

    // 🔹 TRANSACTION HEADER
    tbody.innerHTML += `
      <tr style="background:#f4f4f4;font-weight:600">
        <td>${i + 1}</td>
        <td colspan="2">
          ${o.ref_id}<br>
          <small>
            ${new Date(o.datetime).toLocaleString()}<br>
            ${o.location || ""}
          </small>
        </td>
        <td>${o.cashier || "-"}</td>
        <td>₱${Number(o.total).toFixed(2)}</td>
        <td></td>
      </tr>
    `;

    // 🔸 PRODUCT ROWS
    (o.items || []).forEach(item => {
      tbody.innerHTML += `
        <tr>
          <td></td>
          <td>${item.product_name}</td>
          <td>${item.qty}</td>
          <td></td>
          <td>₱${Number(item.total).toFixed(2)}</td>
          <td></td>
        </tr>
      `;
    });
  });

  updateTotals(grandTotal);
}

/* ================= TOTALS ================= */
function updateTotals(total) {
  document.getElementById("sumGross").textContent =
    Number(total).toFixed(2);
}