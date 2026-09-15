import { bindDataBoxScroll } from "../admin.js";

import { icon } from "../icons.js";
import { getDailySalesAnalytics, getTopSellers, getLowStockAlerts, getStockDaysRemaining, listTodaySales } from "../data/orders.js";
import { listStaff } from "../data/staff.js";
import { getAttendanceOverview } from "../data/attendance.js";


/* ================= ENTRY =================
   Every widget below is collapsed on landing and loads nothing until
   the cashier/admin actually opens it — a visit that only checks one
   number no longer pays the network cost of the other five. Opening a
   widget a second time just re-shows what was already fetched; nothing
   re-fetches unless the whole Dashboard tab is re-entered. */
let dashboardAbort = null;
let loadedWidgets = new Set();
let todaySalesPromise = null;
let liveSalesExpanded = false;

export function abortDashboardRequests() {
  dashboardAbort?.abort();
}

export default async function loadDashboardView() {
  renderLayout();
  bindDataBoxScroll(document.querySelector(".data-box"));

  dashboardAbort = new AbortController();
  loadedWidgets = new Set();
  todaySalesPromise = null;
  liveSalesExpanded = false;

  wireWidgetToggles();
}

/* ================= WIDGET TOGGLE (click to load / click again to hide) ================= */
const WIDGET_LOADERS = {
  topSellers: (date, signal) => loadTopSellers(date, signal),
  dailyPerformance: (date, signal) => loadDailyAnalytics(date, signal),
  lowStock: (date, signal) => loadLowStockAlerts(date, signal),
  laborCost: (date, signal) => loadLaborCost(date, signal),
  stockDays: (date, signal) => loadStockDaysRemaining(date, signal)
  // liveSales is handled separately below — it's a poller, not a one-shot fetch
};

/* Widgets render as chips (same look as Categories & Products) collapsed
   by default. First expand lazily builds the widget's panel and inserts
   it as a full-width row right after its chip (same CSS Grid row-break
   accordion technique used there); later toggles just show/hide that
   same panel — nothing here re-fetches on a second open, matching the
   original behavior exactly. */
function wireWidgetToggles() {
  const today = new Date().toISOString().slice(0, 10);
  const signal = dashboardAbort.signal;
  const grid = document.getElementById("dashboardGrid");

  grid.querySelectorAll(".dashboard-chip").forEach(chip => {
    const widget = chip.dataset.widget;
    if (!widget) return;

    chip.addEventListener("click", () => {
      const nowExpanded = !chip.classList.contains("expanded");
      chip.classList.toggle("expanded", nowExpanded);

      let panel = chip.nextElementSibling;
      if (!panel || !panel.classList.contains("dashboard-expanded-panel")) {
        panel = document.createElement("div");
        panel.className = "dashboard-expanded-panel";
        panel.innerHTML = panelBodyHTML(widget);
        chip.insertAdjacentElement("afterend", panel);
      }
      panel.classList.toggle("hidden", !nowExpanded);

      if (widget === "liveSales") {
        liveSalesExpanded = nowExpanded;
        if (nowExpanded) {
          startLiveSalesPolling(today);
        } else {
          stopDashboardPolling();
        }
        return;
      }

      if (nowExpanded && !loadedWidgets.has(widget)) {
        loadedWidgets.add(widget);
        WIDGET_LOADERS[widget]?.(today, signal);
      }
    });
  });
}

/* ================= LIVE SALES FEED (POLLING) =================
   Only runs while the Live Sales card is expanded — starts on expand,
   stops on collapse, and stops entirely when the admin leaves the
   Dashboard (see stopDashboardPolling, called from admin.js). */
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

/* Today's gross/orders/average is needed by both Daily Performance and
   Labor Cost — whichever widget is opened first fetches it, the other
   reuses that same in-flight/resolved promise instead of re-fetching. */
function getTodaySales(date, signal) {
  if (!todaySalesPromise) {
    todaySalesPromise = getDailySalesAnalytics(date);
  }
  return todaySalesPromise;
}

/* ================= Add Trend Logic Function ================= */
function applyTrend(el, today, yesterday) {
  el.className = "trend";

  if (today > yesterday) {
    el.innerHTML = icon("trending-up", { size: 15 });
    el.classList.add("up");
  } else if (today < yesterday) {
    el.innerHTML = icon("trending-down", { size: 15 });
    el.classList.add("down");
  } else {
    el.innerHTML = icon("minus", { size: 15 });
    el.classList.add("flat");
  }
}

/* ================= LAYOUT =================
   Each widget is a chip — professional colored icon + label, same
   visual language as Categories & Products' category chips — collapsed
   by default. Expanding inserts a full-width panel (panelBodyHTML)
   holding that widget's actual content; every element ID inside is
   unchanged from before, so every loader function below still finds
   what it's looking for without modification. */
const WIDGET_META = {
  topSellers: { icon: "trophy", label: "Top 5 Best Sellers", color: "amber" },
  liveSales: { label: "Live Sales Feed", color: "green", live: true },
  dailyPerformance: { icon: "trending-up", label: "Daily Performance", color: "blue" },
  lowStock: { icon: "alert-triangle", label: "Low Stock Warnings", color: "red" },
  stockDays: { icon: "package", label: "Days of Stock Remaining", color: "slate" },
  laborCost: { icon: "banknote", label: "Labor Cost", color: "green" }
};

function dashboardChipHTML(key) {
  const meta = WIDGET_META[key];
  const iconHtml = meta.live
    ? `<span class="dashboard-chip-live-dot"></span>`
    : icon(meta.icon, { size: 22 });

  return `
    <div class="category-chip dashboard-chip" data-widget="${key}">
      <div class="dashboard-chip-icon ${meta.color}">${iconHtml}</div>
      <div class="category-chip-name">${meta.label}</div>
      ${icon("chevron-down", { size: 16, class: "widget-chevron category-chip-chevron" })}
    </div>
  `;
}

function panelBodyHTML(widget) {
  switch (widget) {
    case "topSellers":
      return `
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
      `;

    case "liveSales":
      return `
        <div class="live-sales-list" id="liveSalesList">
          <div style="text-align:center;color:#888;padding:12px">Loading…</div>
        </div>
      `;

    case "dailyPerformance":
      return `
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
      `;

    case "lowStock":
      return `
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
      `;

    case "stockDays":
      return `<div id="stockDaysBody"><div class="stock-empty">Loading…</div></div>`;

    case "laborCost":
      return `
        <div class="kpi-label">
          <span class="status-chip" id="laborCostChip">—</span>
        </div>
        <div class="kpi-value" id="laborCostValue">—</div>
        <div class="kpi-sub" id="laborCostSub">Loading…</div>
        <div class="bar-compare"><span id="laborCostBar" style="width:0%;background:#cbd5e1"></span></div>
      `;

    default:
      return "";
  }
}

function renderLayout() {
  document.getElementById("actionBar").innerHTML = "";

  document.getElementById("contentBox").innerHTML = `
    <div class="data-box">
      <h2>${icon("bar-chart-3")} Data Analytics</h2>

      <div class="dashboard-scroll">
        <div class="admin-product-grid dashboard-widget-grid" id="dashboardGrid">
          ${Object.keys(WIDGET_META).map(dashboardChipHTML).join("")}
        </div>
      </div>
    </div>
  `;
}

/* ================= TOP SELLERS ================= */
async function loadTopSellers(date, signal) {
  try {
    const data = await getTopSellers(date);

    const tbody = document.getElementById("topSellersBody");
    tbody.innerHTML = "";

    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `<tr><td colspan="4">No sales</td></tr>`;
      return;
    }

    data.slice(0, 5).forEach((p, i) => {
      tbody.insertAdjacentHTML("beforeend", `
        <tr>
          <td>${i + 1}</td>
          <td>${p.product_name}</td>
          <td>${p.qty_sold}</td>
          <td>₱${Number(p.total_sales || 0).toFixed(2)}</td>
        </tr>
      `);
    });
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Top sellers failed", err);
  }
}

/* ================= DAILY ANALYTICS ================= */
async function loadDailyAnalytics(date, signal) {
  try {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toISOString().slice(0, 10);

    const [todayData, yesterdayData] = await Promise.all([
      getTodaySales(date, signal),
      getDailySalesAnalytics(yDate)
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
    if (err.name === "AbortError") return;
    console.error("Analytics failed", err);
  }
}

/* ================= LOW STOCK ================= */
async function loadLowStockAlerts(date, signal) {
  try {
    const data = await getLowStockAlerts(date);

    const tbody = document.getElementById("lowStockBody");
    tbody.innerHTML = "";

    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `<tr><td colspan="2">All stocks healthy</td></tr>`;
      return;
    }

    data.forEach(i => {
      tbody.insertAdjacentHTML("beforeend", `
        <tr class="danger-row">
          <td>${i.item_name}</td>
          <td>${i.remaining}</td>
        </tr>
      `);
    });
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Low stock failed", err);
  }
}

/* ================= LABOR COST % ================= */
const LABOR_COST_GOOD_MAX = 25; // <=25% of gross = healthy for food service
const LABOR_COST_WARN_MAX = 35; // 25-35% = watch, >35% = high

async function loadLaborCost(date, signal) {
  const chip = document.getElementById("laborCostChip");
  const valueEl = document.getElementById("laborCostValue");
  const subEl = document.getElementById("laborCostSub");
  const barEl = document.getElementById("laborCostBar");

  try {
    const [staffList, attendance, sales] = await Promise.all([
      listStaff(),
      getAttendanceOverview(date),
      getTodaySales(date, signal)
    ]);

    const rateByStaffId = {};
    (Array.isArray(staffList) ? staffList : []).forEach(s => {
      if (s.active) rateByStaffId[s.staff_id] = Number(s.rate) || 0;
    });

    const attendanceRows = Array.isArray(attendance?.staff) ? attendance.staff : [];
    let laborCost = 0;
    let workedCount = 0;
    attendanceRows.forEach(row => {
      // A day rate is earned by anyone who clocked in today, whether or not
      // they've clocked out yet — clock_in_time is empty for staff who
      // never clocked in at all today.
      if (row.clock_in_time && rateByStaffId[row.staff_id] != null) {
        laborCost += rateByStaffId[row.staff_id];
        workedCount++;
      }
    });

    const gross = Number(sales?.gross || 0);

    if (gross <= 0) {
      valueEl.textContent = "—";
      subEl.textContent = workedCount
        ? `₱${laborCost.toFixed(0)} labor logged, no sales yet today`
        : "No sales recorded yet today";
      chip.textContent = "—";
      chip.className = "status-chip";
      barEl.style.width = "0%";
      return;
    }

    const pct = (laborCost / gross) * 100;
    const tier =
      pct <= LABOR_COST_GOOD_MAX ? "good" :
      pct <= LABOR_COST_WARN_MAX ? "warn" : "crit";
    const tierLabel = tier === "good" ? "Healthy" : tier === "warn" ? "Watch" : "High";
    const tierColor = tier === "good" ? "#16a34a" : tier === "warn" ? "#d97706" : "#dc2626";

    valueEl.textContent = `${pct.toFixed(1)}%`;
    subEl.textContent = `₱${laborCost.toFixed(0)} labor (${workedCount} clocked in) on ₱${gross.toFixed(0)} sales`;
    chip.textContent = tierLabel;
    chip.className = `status-chip ${tier}`;
    barEl.style.width = `${Math.min(100, pct)}%`;
    barEl.style.background = tierColor;
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Labor cost failed", err);
    valueEl.textContent = "—";
    subEl.textContent = "Failed to load";
    chip.textContent = "—";
  }
}

/* ================= DAYS OF STOCK REMAINING ================= */
async function loadStockDaysRemaining(date, signal) {
  const body = document.getElementById("stockDaysBody");

  try {
    const rows = await getStockDaysRemaining(date);
    renderStockDaysRemaining(Array.isArray(rows) ? rows.slice(0, STOCK_DAYS_ROWS_SHOWN) : []);
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Stock days remaining failed", err);
    body.innerHTML = `<div class="stock-empty">Failed to load</div>`;
  }
}

const STOCK_DAYS_ROWS_SHOWN = 6;

function renderStockDaysRemaining(rows) {
  const body = document.getElementById("stockDaysBody");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `<div class="stock-empty">Not enough inventory history yet to estimate days remaining</div>`;
    return;
  }

  body.innerHTML = rows.map(r => {
    const tier = r.days < 1 ? "crit" : r.days < 3 ? "warn" : "ok";
    return `
      <div class="stock-row">
        <div class="stock-item">${r.name} <span class="stock-unit">· ${r.remaining.toLocaleString()} ${r.unit} left</span></div>
        <span class="days-pill ${tier}">${r.days.toFixed(1)} days</span>
      </div>
    `;
  }).join("");
}

/* ================= LIVE SALES FEED ================= */
function loadLiveSalesFeed(date) {
  listTodaySales(date)
    .then(orders => renderLiveSalesFeed(Array.isArray(orders) ? orders : []))
    .catch(err => console.error("Live sales feed failed", err));
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
    // Authoritative total — already adjusted server-side by any voids.
    const total = Number(o.total) || 0;

    const contents = (o.items || [])
      .filter(item => !item.voided)
      .map(item => `${item.qty || 0}x ${item.product_name}`)
      .join(", ");

    return `
      <div class="live-sales-item">
        <div class="live-sales-item-top">
          <span class="live-sales-cashier">${icon("user", { size: 13 })} ${o.cashier || "-"}</span>
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
