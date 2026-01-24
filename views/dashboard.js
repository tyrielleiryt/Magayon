import { bindDataBoxScroll } from "../admin.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";


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

/* ================= SAFE JSON FETCH ================= */
async function safeFetchJSON(url) {
  const res = await fetch(url);
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("API returned non-JSON:", text);
    throw new Error("Invalid JSON response");
  }
}

/* ================= Add Trend Logic Function ================= */
function applyTrend(el, today, yesterday) {
  el.className = "trend";

  if (today > yesterday) {
    el.textContent = "⬆";
    el.classList.add("up");
  } else if (today < yesterday) {
    el.textContent = "⬇";
    el.classList.add("down");
  } else {
    el.textContent = "➖";
    el.classList.add("flat");
  }
}

/* ================= LAYOUT ================= */
function renderLayout() {
  document.getElementById("actionBar").innerHTML = "";

  document.getElementById("contentBox").innerHTML = `
    <div class="data-box">
      <h2>📊 Dashboard Overview</h2>

      <div class="dashboard-grid">

  <!-- Left: Top Sellers -->
  <div class="dashboard-card">
    <h3>🏆 Top 5 Best Sellers</h3>
    <div class="dashboard-table-wrap">
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
  </div>

  <!-- Right column -->
  <div class="dashboard-right-column">

    <!-- Daily Performance -->
    <div class="dashboard-card">
      <h3>📈 Daily Performance</h3>
      <div class="analytics-grid">
        <div class="analytics-box">
          <div class="label">Gross Sales</div>
          <div class="value-row">
            <div class="value" id="metricGross">₱0</div>
            <div class="trend" id="trendGross">—</div>
          </div>
        </div>

        <div class="analytics-box">
          <div class="label">Transactions</div>
          <div class="value-row">
            <div class="value" id="metricOrders">0</div>
            <div class="trend" id="trendOrders">—</div>
          </div>
        </div>

        <div class="analytics-box">
          <div class="label">Avg Order</div>
          <div class="value-row">
            <div class="value" id="metricAvg">₱0</div>
            <div class="trend" id="trendAvg">—</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Low Stock -->
    <div class="dashboard-card danger">
      <h3>⚠️ Low Stock Warnings</h3>
      <div class="dashboard-table-wrap">
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

</div>
  `;
}

/* ================= TOP SELLERS ================= */
async function loadTopSellers(date) {
  try {
    const url = `${API_URL}?type=topSellers&date=${date}`;
    const data = await safeFetchJSON(url);

    const tbody = document.getElementById("topSellersBody");
    tbody.innerHTML = "";

    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `<tr><td colspan="4">No sales</td></tr>`;
      return;
    }

    data.slice(0, 5).forEach((p, i) => {
      tbody.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${p.product_name}</td>
          <td>${p.qty_sold}</td>
          <td>₱${Number(p.total_sales || 0).toFixed(2)}</td>
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
    const todayURL = `${API_URL}?type=dailySalesAnalytics&date=${date}`;

    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toISOString().slice(0, 10);

    const yesterdayURL = `${API_URL}?type=dailySalesAnalytics&date=${yDate}`;

    const [todayData, yesterdayData] = await Promise.all([
      safeFetchJSON(todayURL),
      safeFetchJSON(yesterdayURL)
    ]);

    const grossToday = Number(todayData?.gross || 0);
    const grossYesterday = Number(yesterdayData?.gross || 0);

    const ordersToday = Number(todayData?.orders || 0);
    const ordersYesterday = Number(yesterdayData?.orders || 0);

    const avgToday = Number(todayData?.average || 0);
    const avgYesterday = Number(yesterdayData?.average || 0);

    document.getElementById("metricGross").textContent =
      `₱${grossToday.toFixed(2)}`;

    document.getElementById("metricOrders").textContent =
      ordersToday;

    document.getElementById("metricAvg").textContent =
      `₱${avgToday.toFixed(2)}`;

    applyTrend(document.getElementById("trendGross"), grossToday, grossYesterday);
    applyTrend(document.getElementById("trendOrders"), ordersToday, ordersYesterday);
    applyTrend(document.getElementById("trendAvg"), avgToday, avgYesterday);

  } catch (err) {
    console.error("Analytics failed", err);
  }
}

/* ================= LOW STOCK ================= */
async function loadLowStockAlerts(date) {
  try {
    const url = `${API_URL}?type=lowStockAlerts&date=${date}`;
    const data = await safeFetchJSON(url);

    const tbody = document.getElementById("lowStockBody");
    tbody.innerHTML = "";

    if (!Array.isArray(data) || !data.length) {
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