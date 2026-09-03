import { bindDataBoxScroll } from "../admin.js";

import { API_URL } from "../firebase-config.js";


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

  startLiveSalesPolling(today);
}

/* ================= LIVE SALES FEED (POLLING) =================
   Re-fetches today's sales report every few seconds and re-renders the
   feed, latest sale on top. Polling stops when the dashboard is left
   (see stopDashboardPolling, called from admin.js on view switch) so it
   doesn't keep hitting the backend in the background. */
const LIVE_SALES_POLL_MS = 15000;
const LIVE_SALES_LIMIT = 8;
let liveSalesTimer = null;

function startLiveSalesPolling(date) {
  stopDashboardPolling();
  loadLiveSalesFeed(date);
  liveSalesTimer = setInterval(() => loadLiveSalesFeed(date), LIVE_SALES_POLL_MS);
}

export function stopDashboardPolling() {
  if (liveSalesTimer) clearInterval(liveSalesTimer);
  liveSalesTimer = null;
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
        <tbody id="topSellersBody"><tr><td colspan="4" style="text-align:center;color:#888">Loading…</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Live Sales Feed -->
  <div class="dashboard-card live-sales-card">
    <h3><span class="live-dot"></span> Live Sales Feed</h3>
    <div class="live-sales-list" id="liveSalesList">
      <div style="text-align:center;color:#888;padding:12px">Loading…</div>
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
          <tbody id="lowStockBody"><tr><td colspan="2" style="text-align:center;color:#888">Loading…</td></tr></tbody>
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

/* ================= LIVE SALES FEED ================= */
function loadLiveSalesFeed(date) {
  const callback = "handleLiveSalesFeed";
  delete window[callback];

  window[callback] = function (orders) {
    renderLiveSalesFeed(Array.isArray(orders) ? orders : []);
  };

  const old = document.getElementById("liveSalesJsonpScript");
  if (old) old.remove();

  const script = document.createElement("script");
  script.id = "liveSalesJsonpScript";
  script.src = `${API_URL}?type=dailySalesReport&date=${date}&callback=${callback}`;
  document.body.appendChild(script);
}

function renderLiveSalesFeed(orders) {
  const list = document.getElementById("liveSalesList");
  if (!list) return; // dashboard was navigated away from mid-poll

  const sorted = [...orders].sort(
    (a, b) => new Date(b.datetime) - new Date(a.datetime)
  );

  if (!sorted.length) {
    list.innerHTML = `<div style="text-align:center;color:#888;padding:12px">No sales yet today</div>`;
    return;
  }

  list.innerHTML = sorted.slice(0, LIVE_SALES_LIMIT).map(o => {
    const total = (o.items || []).reduce(
      (sum, item) => sum + (Number(item.total) || 0),
      0
    );

    const contents = (o.items || [])
      .map(item => `${item.qty || 0}x ${item.product_name}`)
      .join(", ");

    return `
      <div class="live-sales-item">
        <div class="live-sales-item-top">
          <span class="live-sales-cashier">👤 ${o.cashier || "-"}</span>
          <span class="live-sales-time">${formatLiveTime(o.datetime)}</span>
        </div>
        <div class="live-sales-contents">${contents || "-"}</div>
        <div class="live-sales-total">₱${total.toFixed(2)}</div>
      </div>
    `;
  }).join("");
}

function formatLiveTime(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}