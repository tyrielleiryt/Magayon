import { bindDataBoxScroll } from "../admin.js";

import { icon } from "../icons.js";
import { getDailySalesAnalytics, getLowStockAlerts, getStockDaysRemaining, listTodaySales, listUnresolvedFailedCheckouts, resolveFailedCheckout, getCustomerTraffic } from "../data/orders.js";
import { listStaff } from "../data/staff.js";
import { getAttendanceOverview } from "../data/attendance.js";
import { listLocations } from "../data/locations.js";


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
  dailyPerformance: (date, signal) => loadDailyAnalytics(date, signal),
  lowStock: (date, signal) => loadLowStockAlerts(date, signal),
  laborCost: (date, signal) => loadLaborCost(date, signal),
  stockDays: (date, signal) => loadStockDaysRemaining(date, signal),
  salesTracker: (date, signal) => loadSalesTracker(signal),
  failedCheckouts: (date, signal) => loadFailedCheckouts(signal)
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
  salesTracker: { icon: "trophy", label: "Sales Tracker", color: "amber" },
  liveSales: { label: "Live Sales Feed", color: "green", live: true },
  dailyPerformance: { icon: "trending-up", label: "Daily Performance", color: "blue" },
  lowStock: { icon: "alert-triangle", label: "Low Stock Warnings", color: "red" },
  stockDays: { icon: "package", label: "Days of Stock Remaining", color: "slate" },
  laborCost: { icon: "banknote", label: "Labor Cost", color: "green" },
  failedCheckouts: { icon: "receipt", label: "Failed Checkouts", color: "red" }
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
    case "salesTracker":
      return `
        ${periodControlsHTML("salesTracker", `
          <select id="salesTrackerBucket" aria-label="Time slot size" style="padding:6px 8px">
            <option value="15">15-min slots</option>
            <option value="30" selected>30-min slots</option>
            <option value="60">1-hour slots</option>
          </select>`)}
        <div id="salesTrackerSummary" style="margin-bottom:8px;font-size:13px;color:#374151"></div>
        <div style="overflow-x:auto">
          <div id="salesTrackerChart" style="min-width:560px"></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0 6px">
          <strong id="salesTrackerProductsTitle" style="font-size:14px">Best sellers</strong>
          <button type="button" id="salesTrackerAllHours" style="background:none;border:0;color:#2563eb;cursor:pointer;font-weight:600;padding:2px 4px" hidden>Show all hours</button>
        </div>
        <div class="dashboard-table-wrap" style="overflow:visible">
          <table class="category-table">
            <thead>
              <tr><th>#</th><th>Product</th><th>Qty</th><th>Sales</th><th title="Share of customers who bought it">% Cust.</th></tr>
            </thead>
            <tbody id="salesTrackerProducts"><tr><td colspan="5" style="text-align:center;color:#888">Loading…</td></tr></tbody>
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

    case "failedCheckouts":
      return `
        <div class="dashboard-table-wrap">
          <table class="category-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Location</th>
                <th>Staff</th>
                <th>Items</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="failedCheckoutsBody"><tr><td colspan="6" style="text-align:center;color:#888">Loading…</td></tr></tbody>
          </table>
        </div>
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

/* ================= SHARED PERIOD PICKER =================
   Day (default: today) / Week (Monday–Sunday containing the picked date)
   / Month, for the Sales Tracker. Element ids are all `${prefix}…`
   (ModeDay, ModeWeek, ModeMonth, Date, Month, Period). */
const PERIOD_BTN_STYLE = "padding:6px 14px;border:0;cursor:pointer";

function phToday() {
  // Philippine date, not UTC — before 8 AM PH, toISOString() is still "yesterday".
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function monthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, "0")}` };
}

// type="week" inputs aren't supported in Safari, so the picker is a normal
// date and the week is derived from it.
function weekRange(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  const start = new Date(d.getTime() - sinceMonday * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function fmtDay(ymd, opts) {
  return new Date(ymd + "T00:00:00").toLocaleDateString("en-US", opts);
}

function periodControlsHTML(prefix, extraHTML = "") {
  return `
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:10px">
      <div style="display:inline-flex;border:1px solid #d1d5db;border-radius:8px;overflow:hidden">
        <button type="button" id="${prefix}ModeDay" style="${PERIOD_BTN_STYLE}">Day</button>
        <button type="button" id="${prefix}ModeWeek" style="${PERIOD_BTN_STYLE}">Week</button>
        <button type="button" id="${prefix}ModeMonth" style="${PERIOD_BTN_STYLE}">Month</button>
      </div>
      <input type="date" id="${prefix}Date" style="padding:6px 8px">
      <input type="month" id="${prefix}Month" style="padding:6px 8px" hidden>
      ${extraHTML}
      <span id="${prefix}Period" style="color:#6b7280;font-size:13px"></span>
    </div>
  `;
}

/** Wires the controls; onChange() fires on any change. Returns { current() }
    where current() → { mode: "day"|"week"|"month", start, end } (and updates
    the period label), or null if the picker is empty / not in the DOM. */
function setupPeriodPicker(prefix, onChange) {
  const el = id => document.getElementById(prefix + id);
  const dateInput = el("Date"), monthInput = el("Month"), periodEl = el("Period");
  const btns = { day: el("ModeDay"), week: el("ModeWeek"), month: el("ModeMonth") };
  if (!dateInput || !monthInput || !periodEl || !btns.day || !btns.week || !btns.month) return null;

  const today = phToday();
  let mode = "day";
  dateInput.value = today;
  monthInput.value = today.slice(0, 7);

  const syncUI = () => {
    for (const [m, btn] of Object.entries(btns)) {
      const on = m === mode;
      btn.style.background = on ? "#2563eb" : "#fff";
      btn.style.color = on ? "#fff" : "#111";
    }
    dateInput.hidden = mode === "month";
    monthInput.hidden = mode !== "month";
  };
  const choose = m => () => { mode = m; syncUI(); onChange(); };
  btns.day.onclick = choose("day");
  btns.week.onclick = choose("week");
  btns.month.onclick = choose("month");
  dateInput.onchange = () => onChange();
  monthInput.onchange = () => onChange();
  syncUI();

  return {
    current() {
      const picked = mode === "month" ? monthInput.value : dateInput.value;
      if (!picked) return null;

      let range;
      if (mode === "day") {
        range = { start: picked, end: picked };
        periodEl.textContent = fmtDay(picked, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
      } else if (mode === "week") {
        range = weekRange(picked);
        periodEl.textContent =
          `${fmtDay(range.start, { month: "short", day: "numeric" })} – ${fmtDay(range.end, { month: "short", day: "numeric", year: "numeric" })}`;
      } else {
        range = monthRange(picked);
        periodEl.textContent = fmtDay(`${picked}-01`, { year: "numeric", month: "long" });
      }
      return { mode, ...range };
    }
  };
}

/* ================= SALES TRACKER =================
   One widget for both questions: WHEN do customers come (chart: x = time of
   day, y = customers checking out; one customer = one order) and WHAT do
   they buy (ranked list below). The list covers the whole period by
   default — i.e. the overall best sellers — and narrows to one time slot
   when you click a bar (click it again, or "Show all hours", to go back).
   For a week or month the bars are totals across the period; the tooltip
   also gives the per-day average. */
const TRAFFIC_PRODUCTS_PAGE = 5;

function fmtClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function trafficChartSVG({ counts, first, last, size, selected, peak, days }) {
  const W = 640, H = 270, L = 44, R = 10, T = 16, B = 46;
  const nb = last - first + 1;
  const iw = W - L - R, ih = H - T - B, bw = iw / nb;

  const max = Math.max(1, ...counts.slice(first, last + 1));
  let step = 1;
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]) {
    step = s;
    if (max / s <= 5) break;
  }
  const top = Math.max(step, Math.ceil(max / step) * step);
  const y = v => T + ih - (v / top) * ih;

  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Customers per time slot">`;

  for (let v = 0; v <= top; v += step) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "#9ca3af" : "#e5e7eb"}"/>`;
    svg += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#6b7280">${v}</text>`;
  }

  for (let i = first; i <= last; i++) {
    const c = counts[i];
    const x = L + (i - first) * bw;
    const slot = `${fmtClock(i * size)} – ${fmtClock((i + 1) * size)}`;
    const tip = `${slot}: ${c} customer${c === 1 ? "" : "s"}` + (days > 1 ? ` (avg ${(c / days).toFixed(1)} per day)` : "");

    if (c > 0) {
      const fill = i === selected ? "#f59e0b" : i === peak ? "#2563eb" : "#60a5fa";
      svg += `<rect x="${x + bw * 0.12}" y="${y(c)}" width="${bw * 0.76}" height="${(c / top) * ih}" rx="2" fill="${fill}" pointer-events="none"/>`;
      if (bw >= 17) svg += `<text x="${x + bw / 2}" y="${y(c) - 4}" text-anchor="middle" font-size="10" fill="#374151" pointer-events="none">${c}</text>`;
    }
    // Full-height invisible hit area so thin or empty slots are still clickable.
    svg += `<rect data-slot="${i}" x="${x}" y="${T}" width="${bw}" height="${ih}" fill="transparent" style="cursor:pointer" role="button" tabindex="0" aria-label="${tip}"><title>${tip}</title></rect>`;
  }

  // Label on whole hours (never odd times like 11:30), every 1/2/3/… hours
  // depending on how wide the window is, so each tick marks the START of
  // the slot whose bar sits just to its right.
  let stepMin = 60;
  for (const s of [60, 120, 180, 240, 360, 720]) {
    stepMin = s;
    if ((nb * size) / s <= 9) break;
  }
  for (let k = 0; k < nb; k++) {
    const startMin = (first + k) * size;
    if (startMin % stepMin !== 0) continue;
    const x = L + k * bw;
    svg += `<line x1="${x}" x2="${x}" y1="${T + ih}" y2="${T + ih + 4}" stroke="#9ca3af"/>`;
    svg += `<text x="${x}" y="${T + ih + 17}" text-anchor="middle" font-size="11" fill="#6b7280">${fmtClock(startMin)}</text>`;
  }

  svg += `<text x="${L + iw / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="#374151">Time of day</text>`;
  svg += `<text transform="translate(12 ${T + ih / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#374151">Customers</text>`;
  return svg + `</svg>`;
}

async function loadSalesTracker(signal) {
  const el = id => document.getElementById(id);
  const bucketSel = el("salesTrackerBucket");
  const chartEl = el("salesTrackerChart");
  if (!bucketSel || !chartEl) return;

  // Needs more room than the shared 340px panel cap: controls + chart + list.
  const panelEl = bucketSel.closest(".dashboard-expanded-panel");
  if (panelEl) { panelEl.style.maxHeight = "none"; panelEl.style.overflow = "visible"; }

  let requestId = 0;
  let orders = [];
  let selected = null; // slot index, or null = all hours (the overall best sellers)
  let shown = TRAFFIC_PRODUCTS_PAGE;
  let periodMode = "day";
  let recenter = true; // scroll the chart to the selected slot (matters on phones, where it scrolls sideways)

  const summaryEl = el("salesTrackerSummary");
  const productsBody = el("salesTrackerProducts");
  const productsTitle = el("salesTrackerProductsTitle");
  const allHoursBtn = el("salesTrackerAllHours");

  const render = () => {
    const size = Number(bucketSel.value) || 30;
    const n = Math.ceil(1440 / size);

    if (!orders.length) {
      summaryEl.textContent = `No customers for this ${periodMode === "day" ? "date" : periodMode}.`;
      chartEl.innerHTML = "";
      productsTitle.textContent = "Best sellers";
      allHoursBtn.hidden = true;
      productsBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888">No sales</td></tr>`;
      return;
    }

    const counts = new Array(n).fill(0);
    let untimed = 0;
    for (const o of orders) {
      if (o.minute == null) { untimed++; continue; }
      counts[Math.floor(o.minute / size)]++;
    }
    const days = new Set(orders.map(o => o.date)).size;
    const timed = orders.length - untimed;

    // Visible window: first..last slot with customers, padded one slot each
    // side and never narrower than 6 slots.
    let first = counts.findIndex(c => c > 0);
    if (first === -1) {
      summaryEl.textContent = `${orders.length} customers, but none have a recorded time of day.`;
      chartEl.innerHTML = "";
      return;
    }
    let last = n - 1 - [...counts].reverse().findIndex(c => c > 0);
    first = Math.max(0, first - 1);
    last = Math.min(n - 1, last + 1);
    while (last - first + 1 < 6 && (first > 0 || last < n - 1)) {
      if (first > 0) first--;
      if (last - first + 1 < 6 && last < n - 1) last++;
    }

    const peak = counts.indexOf(Math.max(...counts));

    const slotLabel = i => `${fmtClock(i * size)} – ${fmtClock((i + 1) * size)}`;
    const topSlots = counts
      .map((c, i) => ({ c, i }))
      .filter(x => x.c > 0)
      .sort((a, b) => b.c - a.c || a.i - b.i)
      .slice(0, 3)
      .map(x => `${slotLabel(x.i)} (${x.c})`)
      .join(" · ");
    summaryEl.innerHTML =
      `<strong>${timed}</strong> customer${timed === 1 ? "" : "s"} over ${days} day${days === 1 ? "" : "s"}` +
      (days > 1 ? ` (avg ${(timed / days).toFixed(1)}/day)` : "") +
      `<br>Busiest: ${topSlots}` +
      `<br><span style="color:#9ca3af">Tap a bar to see what sold in that time slot.</span>` +
      (untimed ? `<br><span style="color:#9ca3af">${untimed} order${untimed === 1 ? "" : "s"} without a reliable time not plotted</span>` : "");

    chartEl.innerHTML = trafficChartSVG({ counts, first, last, size, selected, peak, days });
    if (recenter) {
      // Same geometry as trafficChartSVG (viewBox width 640, left margin 44, right 10).
      const frac = (44 + ((selected ?? peak) - first + 0.5) * ((640 - 44 - 10) / (last - first + 1))) / 640;
      const scroller = chartEl.parentElement;
      scroller.scrollLeft = Math.max(0, frac * chartEl.scrollWidth - scroller.clientWidth / 2);
    }
    recenter = false;
    chartEl.querySelectorAll("[data-slot]").forEach(rect => {
      const pick = () => {
        const i = Number(rect.dataset.slot);
        selected = selected === i ? null : i;
        shown = TRAFFIC_PRODUCTS_PAGE;
        render();
      };
      rect.onclick = pick;
      rect.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
    });

    // What customers usually buy in the selected slot (or all hours).
    const inSlot = selected == null
      ? orders
      : orders.filter(o => o.minute != null && Math.floor(o.minute / size) === selected);

    productsTitle.textContent = selected == null
      ? `Best sellers — all hours (${inSlot.length} customer${inSlot.length === 1 ? "" : "s"})`
      : `Best sellers — ${slotLabel(selected)}${selected === peak ? " · busiest slot" : ""} (${inSlot.length} customer${inSlot.length === 1 ? "" : "s"})`;
    allHoursBtn.hidden = selected == null;
    allHoursBtn.onclick = () => { selected = null; shown = TRAFFIC_PRODUCTS_PAGE; render(); };

    const byProduct = {};
    for (const o of inSlot) {
      const seen = new Set();
      for (const it of o.items) {
        const rec = (byProduct[it.product_id] ??= { name: it.product_name, qty: 0, sales: 0, customers: 0 });
        rec.qty += it.qty;
        rec.sales += it.total;
        if (!seen.has(it.product_id)) { rec.customers++; seen.add(it.product_id); }
      }
    }
    const ranked = Object.values(byProduct).sort((a, b) => b.qty - a.qty || b.customers - a.customers);

    productsBody.innerHTML = "";
    if (!ranked.length) {
      productsBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888">No customers in this time slot</td></tr>`;
      return;
    }
    ranked.slice(0, shown).forEach((p, i) => {
      productsBody.insertAdjacentHTML("beforeend", `
        <tr>
          <td>${i + 1}</td>
          <td>${p.name}</td>
          <td>${p.qty}</td>
          <td>₱${p.sales.toFixed(2)}</td>
          <td>${Math.round((100 * p.customers) / inSlot.length)}%</td>
        </tr>
      `);
    });
    const remaining = ranked.length - shown;
    if (remaining > 0) {
      productsBody.insertAdjacentHTML("beforeend", `
        <tr>
          <td colspan="5" style="text-align:center">
            <button type="button" id="salesTrackerViewMore" style="background:none;border:0;color:#2563eb;cursor:pointer;font-weight:600;padding:6px">
              View More (${remaining} more)
            </button>
          </td>
        </tr>
      `);
      el("salesTrackerViewMore").onclick = () => { shown += TRAFFIC_PRODUCTS_PAGE; render(); };
    }
  };

  const reload = async () => {
    const id = ++requestId;
    const per = picker?.current();
    if (!per) return;
    periodMode = per.mode;

    summaryEl.textContent = "Loading…";
    chartEl.innerHTML = "";
    productsBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888">Loading…</td></tr>`;

    try {
      const data = await getCustomerTraffic(per.start, per.end);
      if (id !== requestId) return;
      orders = data.orders;
      selected = null; // new period: back to the overall best sellers
      recenter = true;
      shown = TRAFFIC_PRODUCTS_PAGE;
      render();
    } catch (err) {
      if (err.name === "AbortError" || id !== requestId) return;
      console.error("Customer quantity tracker failed", err);
      summaryEl.textContent = "Failed to load";
    }
  };

  bucketSel.onchange = () => { selected = null; recenter = true; shown = TRAFFIC_PRODUCTS_PAGE; render(); };
  const picker = setupPeriodPicker("salesTracker", reload);
  await reload();
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

/* ================= FAILED CHECKOUTS =================
   Cross-device visibility for checkout failures — each device's own
   retry/review still lives in that device's localStorage queue (see
   order.js), but this shows every unresolved failure across every
   device/location in one place, so an admin doesn't have to physically
   check each tablet's own Sync button. */
let failedCheckoutsLocationMap = {};

async function loadFailedCheckouts(signal) {
  const tbody = document.getElementById("failedCheckoutsBody");

  try {
    const [failures, locations] = await Promise.all([
      listUnresolvedFailedCheckouts(),
      listLocations()
    ]);

    failedCheckoutsLocationMap = {};
    (Array.isArray(locations) ? locations : []).forEach(l => {
      failedCheckoutsLocationMap[l.location_id] = l.location_name;
    });

    renderFailedCheckouts(failures);
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Failed checkouts load failed", err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888">Failed to load</td></tr>`;
  }
}

function renderFailedCheckouts(failures) {
  const tbody = document.getElementById("failedCheckoutsBody");
  if (!tbody) return;

  if (!failures.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888">No failed checkouts — nice</td></tr>`;
    return;
  }

  tbody.innerHTML = failures.map(f => {
    const when = new Date(f.created_at).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    });
    const locationName = failedCheckoutsLocationMap[f.location_id] || f.location_id || "—";
    const itemsSummary = (f.items || [])
      .map(i => `${i.qty}× ${i.product_id}`)
      .join(", ") || "—";

    return `
      <tr class="danger-row">
        <td>${when}</td>
        <td>${locationName}</td>
        <td>${f.staff_id || "—"}</td>
        <td>${itemsSummary}</td>
        <td>${f.error}</td>
        <td><button class="btn-resolve-failed-checkout" data-id="${f.id}">Resolve</button></td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".btn-resolve-failed-checkout").forEach(btn => {
    btn.addEventListener("click", () => resolveFailedCheckoutClick(Number(btn.dataset.id)));
  });
}

async function resolveFailedCheckoutClick(id) {
  if (!confirm("Mark this failed checkout as resolved? This doesn't record a sale — only confirms it's been manually handled.")) return;

  try {
    const by = localStorage.getItem("userName") || localStorage.getItem("staff_id") || "admin";
    await resolveFailedCheckout(id, by);
    const failures = await listUnresolvedFailedCheckouts();
    renderFailedCheckouts(failures);
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
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
