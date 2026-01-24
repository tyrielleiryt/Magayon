import { bindDataBoxScroll } from "../admin.js";

const API_URL = window.API_URL;

/* ================= ENTRY ================= */
export default async function loadDashboardView() {
  renderLayout();
  bindDataBoxScroll(document.querySelector(".data-box"));

  const today = new Date().toISOString().slice(0, 10);

  await Promise.all([
    loadTopSellers(today),
    loadDailyAnalytics(today),
    loadLowStockAlerts(today)
  ]);
}

/* ================= LAYOUT ================= */
function renderLayout() {
  document.getElementById("actionBar").innerHTML = ``;

  document.getElementById("contentBox").innerHTML = `
    <div class="data-box">
      <h2>📊 Dashboard Overview</h2>

      <div class="dashboard-grid">

        <div class="dashboard-card">
          <h3>🏆 Top 5 Best Sellers</h3>
          <table class="category-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Sales</th>
              </tr>
            </thead>
            <tbody id="topSellersBody"></tbody>
          </table>
        </div>

        <div class="dashboard-card">
          <h3>📈 Daily Performance</h3>
          <div class="analytics-grid">
            <div class="analytics-box">
              <div class="label">Gross Sales</div>
              <div class="value" id="metricGross">₱0</div>
            </div>
            <div class="analytics-box">
              <div class="label">Transactions</div>
              <div class="value" id="metricOrders">0</div>
            </div>
            <div class="analytics-box">
              <div class="label">Avg Order</div>
              <div class="value" id="metricAvg">₱0</div>
            </div>
          </div>
        </div>

        <div class="dashboard-card danger">
          <h3>⚠️ Low Stock Warnings</h3>
          <table class="category-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody id="lowStockBody"></tbody>
          </table>
        </div>

      </div>
    </div>
  `;
}

/* ================= TOP SELLERS ================= */
async function loadTopSellers(date) {
  try {
    const res = await fetch(`${API_URL}?type=topSellers&date=${date}`);
    const data = await res.json();

    const tbody = document.getElementById("topSellersBody");
    tbody.innerHTML = "";

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="4">No sales</td></tr>`;
      return;
    }

    data.slice(0, 5).forEach((p, i) => {
      tbody.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${p.product_name}</td>
          <td>${p.qty_sold}</td>
          <td>₱${Number(p.total_sales).toFixed(2)}</td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("Top sellers failed", err);
  }
}

/* ================= DAILY ANALYTICS ================= */
async function loadDailyAnalytics(date) {
  try {
    const res = await fetch(`${API_URL}?type=dailySalesAnalytics&date=${date}`);
    const data = await res.json();

    document.getElementById("metricGross").textContent = `₱${Number(data.gross || 0).toFixed(2)}`;
    document.getElementById("metricOrders").textContent = data.orders || 0;
    document.getElementById("metricAvg").textContent = `₱${Number(data.average || 0).toFixed(2)}`;
  } catch (err) {
    console.error("Analytics failed", err);
  }
}

/* ================= LOW STOCK ================= */
async function loadLowStockAlerts(date) {
  try {
    const res = await fetch(`${API_URL}?type=lowStockAlerts&date=${date}`);
    const data = await res.json();

    const tbody = document.getElementById("lowStockBody");
    tbody.innerHTML = "";

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="2">All stocks healthy</td></tr>`;
      return;
    }

    data.forEach(i => {
      tbody.innerHTML += `
        <tr class="danger-row">
          <td>${i.item_name}</td>
          <td>${i.remaining}</td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("Low stock failed", err);
  }
}
