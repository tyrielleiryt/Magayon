import { bindDataBoxScroll, getCached, showLoader, hideLoader } from "../admin.js";
import { API_URL } from "../firebase-config.js";
import { authFetch } from "../auth-guard.js";

/* Sales and Expenses Tracker — a month-at-a-glance rollup mirroring the
   business's manual weekly bookkeeping: Mon-Sat business weeks, daily
   Cash/GCash sales pulled from real orders, petty cash, itemized
   expenses, payroll, and overhead — down to a Gross Profit figure. */

let lastData = null;
let locationMap = {};
let staffList = [];
let opexItems = [];
let opexTotal = 0;

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };

export default async function loadSalesExpensesTrackerView() {
  renderActionBar();
  renderLayout();

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  document.getElementById("setMonth").value = defaultMonth;
  document.getElementById("setLocation").value = localStorage.getItem("userLocation") || "";

  try {
    const locs = await getCached("locations");
    locs.forEach(l => { locationMap[l.location_id] = l.location_name; });
  } catch (err) {
    console.warn("Failed to load locations", err);
  }

  try {
    staffList = (await getCached("staff")).filter(s => s.active !== false);
  } catch (err) {
    console.warn("Failed to load staff", err);
  }
}

function getCurrentLocation() {
  return document.getElementById("setLocation").value.trim();
}

function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <div class="set-action-bar">
      <div class="set-action-field">
        <label for="setMonth">Month</label>
        <input type="month" id="setMonth" />
      </div>
      <div class="set-action-field">
        <label for="setLocation">Location ID</label>
        <input type="text" id="setLocation" placeholder="e.g. LOC-1767637180808" />
      </div>
      <button class="category-action-btn" id="setLoadBtn">Load</button>
      <button class="category-action-btn" id="setOpexBtn">⚙️ Overhead (OPEX)</button>
    </div>
  `;
  document.getElementById("setLoadBtn").onclick = loadMonth;
  document.getElementById("setOpexBtn").onclick = openOpexModal;
}

function renderLayout() {
  document.getElementById("contentBox").innerHTML = `
    <div class="tracker-card" style="height:100%">
      <h3>📈 Sales and Expenses Tracker</h3>
      <div id="setContent" class="data-scroll" style="padding:12px">
        <div class="set-tip">📅 Choose a month to open the Sales and Expenses Tracker</div>
      </div>
    </div>
  `;
}

/* ================= OPEX ================= */

async function loadOpex(location) {
  return new Promise(resolve => {
    const callback = "handleOpexList";
    delete window[callback];

    window[callback] = function (data) {
      opexItems = (data && data.items) || [];
      opexTotal = opexItems.reduce((sum, i) => sum + (Number(i.amount_month) || 0), 0);
      resolve();
    };

    const old = document.getElementById("setOpexJsonpScript");
    if (old) old.remove();

    const script = document.createElement("script");
    script.id = "setOpexJsonpScript";
    script.src = `${API_URL}?type=opex&location=${encodeURIComponent(location)}&callback=${callback}`;
    script.onerror = () => { opexItems = []; opexTotal = 0; resolve(); };
    document.body.appendChild(script);
  });
}

async function openOpexModal() {
  const location = getCurrentLocation();
  if (!location) { alert("Please enter a location first"); return; }

  showLoader("Loading overhead…");
  await loadOpex(location);
  hideLoader();

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <h3 class="set-section-title">⚙️ Operating Expenses — ${locationMap[location] || location}</h3>
    <p class="set-section-hint">
      Fixed monthly overhead for this location (rent, electricity, etc.) — set it once
      and it stays until you change it. Divided by 4 to get the Overhead Subsidy
      applied to each week below.
    </p>
    <table class="set-table" style="margin-bottom:14px">
      <thead><tr><th>Item</th><th>Amount / Month</th><th></th></tr></thead>
      <tbody id="opexModalBody">
        ${opexItems.length
          ? opexItems.map(i => `
            <tr>
              <td>${i.item_name}</td>
              <td>₱${Number(i.amount_month).toFixed(2)}</td>
              <td><button class="btn-del-opex" data-id="${i.opex_id}">✕</button></td>
            </tr>
          `).join("")
          : `<tr><td colspan="3" class="set-empty-row">No OPEX items yet</td></tr>`
        }
      </tbody>
      <tfoot>
        <tr><td>Total / Month</td><td>₱${opexTotal.toFixed(2)}</td><td></td></tr>
      </tfoot>
    </table>
    <div class="set-form-row" style="margin-bottom:16px">
      <div>
        <label>Item Name</label><br>
        <input type="text" id="opexNewName" placeholder="e.g. Rent" style="width:180px">
      </div>
      <div>
        <label>Amount / Month</label><br>
        <input type="number" id="opexNewAmount" placeholder="0.00" style="width:120px">
      </div>
      <button class="category-action-btn" id="opexAddBtn" style="align-self:flex-end">Add</button>
    </div>
    <button class="category-action-btn" id="opexCloseBtn">Close</button>
  `;

  overlay.classList.remove("hidden");

  document.getElementById("opexCloseBtn").onclick = () => overlay.classList.add("hidden");

  document.getElementById("opexAddBtn").onclick = async () => {
    const item_name = document.getElementById("opexNewName").value.trim();
    const amount_month = Number(document.getElementById("opexNewAmount").value);
    if (!item_name) { alert("Item name is required"); return; }
    if (!amount_month || amount_month <= 0) { alert("Amount must be greater than 0"); return; }

    showLoader("Saving OPEX item…");
    try {
      const res = await authFetch(API_URL, {
        method: "POST",
        body: new URLSearchParams({ action: "addOpexItem", item_name, amount_month, location_id: location })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Save failed");
      openOpexModal();
      loadMonth();
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      hideLoader();
    }
  };

  box.querySelectorAll(".btn-del-opex").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Remove this OPEX item?")) return;
      showLoader("Removing…");
      try {
        const res = await authFetch(API_URL, {
          method: "POST",
          body: new URLSearchParams({ action: "deleteOpexItem", opex_id: btn.dataset.id })
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Delete failed");
        openOpexModal();
        loadMonth();
      } catch (err) {
        alert("❌ " + err.message);
      } finally {
        hideLoader();
      }
    };
  });
}

/* ================= MONTH LOAD ================= */

async function loadMonth() {
  const month = document.getElementById("setMonth").value;
  const location = document.getElementById("setLocation").value.trim();

  if (!month) { alert("Please select a month"); return; }
  if (!location) { alert("Please enter a location"); return; }

  document.getElementById("setContent").innerHTML =
    `<div style="text-align:center;color:#888;padding:24px">Loading…</div>`;

  // OPEX is location-specific, so re-fetch it for whichever location is
  // currently selected before rendering — it may have changed since the
  // last load.
  await loadOpex(location);

  const callback = "handleSalesExpensesMonth";
  delete window[callback];

  window[callback] = function (data) {
    lastData = data;
    renderMonth(data, month, location);
  };

  const old = document.getElementById("setJsonpScript");
  if (old) old.remove();

  const script = document.createElement("script");
  script.id = "setJsonpScript";
  script.src =
    `${API_URL}?type=salesExpensesMonth&month=${month}` +
    `&location=${encodeURIComponent(location)}&callback=${callback}`;
  script.onerror = () => {
    document.getElementById("setContent").innerHTML =
      `<div style="text-align:center;color:#888;padding:24px">Failed to load</div>`;
  };
  document.body.appendChild(script);
}

/* ================= HELPERS ================= */

function getBusinessWeeks(year, monthIndex) {
  const weeks = [];
  const cursor = new Date(year, monthIndex, 1);
  const offset = (1 - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + offset);

  while (cursor.getMonth() === monthIndex) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + 5);
    weeks.push({ start, end });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function fmtDate(d) {
  // Local date components, not toISOString() — that converts to UTC first,
  // which shifts the date backward a day whenever the browser's local
  // timezone is ahead of UTC (e.g. Asia/Manila, UTC+8).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtMoney(n) {
  return `₱${Number(n || 0).toFixed(2)}`;
}

function staffLabel(s) {
  return `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.staff_id;
}

function staffOptionsHtml(excludeIds = []) {
  return staffList
    .filter(s => !excludeIds.includes(s.staff_id))
    .map(s => `<option value="${s.staff_id}">${staffLabel(s)}</option>`)
    .join("");
}

/* ================= RENDER ================= */

let weekContexts = {};

function tableHtml(rows) {
  return `
    <table class="set-table">
      <thead><tr><th></th>${DAY_KEYS.map(k => `<th>${DAY_LABELS[k]}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map(([label, vals]) => `<tr><td>${label}</td>${vals.map(v => `<td>${v}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function buildWeekContext(w, dayMap, payrollMap) {
  const weekStartStr = fmtDate(w.start);
  const dayDates = DAY_KEYS.map((k, i) => {
    const d = new Date(w.start);
    d.setDate(d.getDate() + i);
    return fmtDate(d);
  });

  const dayInfos = dayDates.map(ds => dayMap[ds] || null);
  const payrollWeek = payrollMap[weekStartStr] || { rows: [], deductions: [] };

  const totalCash = dayInfos.reduce((s, d) => s + (d ? d.cash_sales : 0), 0);
  const totalGcash = dayInfos.reduce((s, d) => s + (d ? d.gcash_sales : 0), 0);
  const listedExpensesTotal = dayInfos.reduce((s, d) => s + (d ? d.total_expenses : 0), 0);
  const payrollGross = payrollWeek.rows.reduce((s, r) => s + (Number(r.weekly_total) || 0), 0);
  const deductionsTotal = payrollWeek.deductions.reduce((s, dd) => s + (Number(dd.amount) || 0), 0);
  const payrollTotal = payrollGross - deductionsTotal;
  const overheadSubsidy = opexTotal / 4;
  const sumExpenses = payrollTotal + listedExpensesTotal + overheadSubsidy;
  const grossIncome = totalCash + totalGcash;

  const weekLabel =
    `${w.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ` +
    `${w.end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return {
    weekStartStr, dayDates, dayInfos, payrollWeek, weekLabel,
    totalCash, totalGcash, listedExpensesTotal, payrollTotal,
    overheadSubsidy, sumExpenses, grossIncome
  };
}

// The expensive part — building 5 tables + 3 forms worth of HTML per week.
// Deferred until a week is actually opened so a weak tablet CPU only ever
// has to do this for the one week the user is looking at.
function buildWeekBodyHtml(ctx) {
  const { dayInfos, payrollWeek, dayDates, listedExpensesTotal, payrollTotal,
          overheadSubsidy, sumExpenses, totalCash, totalGcash, grossIncome } = ctx;

  const salesRows = [
    ["Cash", dayInfos.map(d => d ? fmtMoney(d.cash_sales) : "—")],
    ["GCash", dayInfos.map(d => d ? fmtMoney(d.gcash_sales) : "—")],
    ["Petty Cash Remaining", dayInfos.map(d => d ? fmtMoney(d.remaining_petty_cash) : "—")],
    ["SUM TOTAL", dayInfos.map(d => d ? fmtMoney(d.cash_sales + d.gcash_sales) : "—")]
  ];

  const onHandRows = [
    ["Replenished Petty Cash", dayInfos.map(d => d ? fmtMoney(d.petty_cash_fund) : "—")],
    ["Cash on Hand", dayInfos.map(d => d ? fmtMoney(d.cash_sales - d.petty_cash_fund) : "—")],
    ["GCash on Hand", dayInfos.map(d => d ? fmtMoney(d.gcash_sales) : "—")],
    ["SUM TOTAL", dayInfos.map(d => d ? fmtMoney((d.cash_sales - d.petty_cash_fund) + d.gcash_sales) : "—")]
  ];

  const payrolledStaffIds = payrollWeek.rows.map(r => r.staff_id);

  const payrollRowsHtml = payrollWeek.rows.length
    ? payrollWeek.rows.map(r => `
      <tr data-staff="${r.staff_id}">
        <td>${r.first_name} ${r.last_name}</td>
        <td><input type="number" class="pr-rate" value="${r.rate}"></td>
        ${DAY_KEYS.map(k => `<td><input type="checkbox" class="pr-day" data-day="${k}" ${r[k] ? "checked" : ""}></td>`).join("")}
        <td class="pr-total"><b>${fmtMoney(r.weekly_total)}</b></td>
      </tr>
    `).join("")
    : `<tr><td colspan="9" class="set-empty-row">No staff added to this week yet — pick someone below</td></tr>`;

  const deductionsRowsHtml = payrollWeek.deductions.length
    ? payrollWeek.deductions.map(dd => `
      <tr>
        <td>${dd.first_name} ${dd.last_name}</td>
        <td>${fmtMoney(dd.amount)}</td>
        <td>${dd.notes || ""}</td>
        <td><button class="btn-del-deduction" data-id="${dd.deduction_id}">✕</button></td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" class="set-empty-row">No deductions this week</td></tr>`;

  const expenseRows = [];
  dayInfos.forEach((d, idx) => {
    if (!d) return;
    (d.expenses || []).forEach(e => {
      expenseRows.push({ date: dayDates[idx], daily_id: d.daily_id, ...e });
    });
  });

  const expensesHtml = expenseRows.length
    ? expenseRows.map(e => `
      <tr>
        <td>${e.date}</td>
        <td>${e.item || ""}</td>
        <td>${e.description || ""}</td>
        <td>${fmtMoney(e.amount)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" class="set-empty-row">No expenses logged this week</td></tr>`;

  const dateOptions = dayDates
    .map((ds, i) => dayInfos[i] ? `<option value="${ds}" data-daily-id="${dayInfos[i].daily_id}">${ds}</option>` : "")
    .join("");

  return `
    <div class="set-section">
      <h4 class="set-section-title">💰 Daily Sales</h4>
      <p class="set-section-hint">Cash and GCash sales pulled automatically from POS orders each day.</p>
      ${tableHtml(salesRows)}
    </div>

    <div class="set-section">
      <h4 class="set-section-title">💵 Cash &amp; GCash On Hand</h4>
      <p class="set-section-hint">What's left in the drawer after any petty cash top-up that day.</p>
      ${tableHtml(onHandRows)}
    </div>

    <div class="set-section">
      <h4 class="set-section-title">👥 Payroll</h4>
      <p class="set-section-hint">Set each employee's daily rate and tick the days they worked. Weekly Total = Rate × days checked.</p>
      <table class="set-table">
        <thead>
          <tr><th>Employee</th><th>Rate</th>${DAY_KEYS.map(k => `<th>${DAY_LABELS[k]}</th>`).join("")}<th>Weekly Total</th></tr>
        </thead>
        <tbody class="pr-body">${payrollRowsHtml}</tbody>
      </table>
      <div class="set-form-row">
        <div>
          <label>Add Employee</label><br>
          <select class="pr-add-staff" style="min-width:180px">${staffOptionsHtml(payrolledStaffIds)}</select>
        </div>
        <button class="category-action-btn btn-add-staff-row" style="align-self:flex-end">+ Add</button>
        <button class="category-action-btn btn-save-payroll" style="align-self:flex-end;margin-left:auto">💾 Save Week</button>
      </div>
    </div>

    <div class="set-section">
      <h4 class="set-section-title">➖ Payroll Deductions</h4>
      <p class="set-section-hint">Cash advances or other amounts subtracted from an employee's pay this week.</p>
      <table class="set-table">
        <thead><tr><th>Employee</th><th>Amount</th><th>Notes</th><th></th></tr></thead>
        <tbody class="pd-body">${deductionsRowsHtml}</tbody>
      </table>
      <div class="set-form-row">
        <div>
          <label>Employee</label><br>
          <select class="pd-staff" style="min-width:160px">${staffOptionsHtml()}</select>
        </div>
        <div>
          <label>Amount</label><br>
          <input type="number" class="pd-amount" placeholder="0.00" style="width:100px">
        </div>
        <div style="flex:1;min-width:160px">
          <label>Notes</label><br>
          <input type="text" class="pd-notes" placeholder="e.g. Cash advance" style="width:100%">
        </div>
        <button class="category-action-btn btn-add-deduction" style="align-self:flex-end">Add</button>
      </div>
    </div>

    <div class="set-section">
      <h4 class="set-section-title">🧾 Listed Expenses</h4>
      <p class="set-section-hint">Itemized purchases (supplies, ingredients, etc.) logged against a specific day.</p>
      <table class="set-table">
        <thead><tr><th>Date</th><th>Item</th><th>Description</th><th>Cost</th></tr></thead>
        <tbody>${expensesHtml}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td>${fmtMoney(listedExpensesTotal)}</td></tr></tfoot>
      </table>
      ${dateOptions ? `
        <div class="set-form-row">
          <div>
            <label>Date</label><br>
            <select class="exp-date">${dateOptions}</select>
          </div>
          <div>
            <label>Item</label><br>
            <input type="text" class="exp-item" placeholder="e.g. Siomai pork">
          </div>
          <div style="flex:1;min-width:160px">
            <label>Description (qty/unit)</label><br>
            <input type="text" class="exp-desc" placeholder="e.g. 13 packs" style="width:100%">
          </div>
          <div>
            <label>Cost</label><br>
            <input type="number" class="exp-cost" placeholder="0.00" style="width:90px">
          </div>
          <button class="category-action-btn btn-add-expense" style="align-self:flex-end">Add</button>
        </div>
      ` : `<p class="set-section-hint">No open inventory day this week to log an expense against.</p>`}
    </div>

    <div class="set-rollup">
      <div class="set-rollup-item"><div class="set-label">Payroll Total</div><div class="set-value">${fmtMoney(payrollTotal)}</div></div>
      <div class="set-rollup-item"><div class="set-label">Listed Expenses Total</div><div class="set-value">${fmtMoney(listedExpensesTotal)}</div></div>
      <div class="set-rollup-item"><div class="set-label">Overhead Subsidy</div><div class="set-value">${fmtMoney(overheadSubsidy)}</div></div>
      <div class="set-rollup-item"><div class="set-label">SUM Expenses Total</div><div class="set-value">${fmtMoney(sumExpenses)}</div></div>
      <div class="set-rollup-item"><div class="set-label">Total Cash Earned</div><div class="set-value">${fmtMoney(totalCash)}</div></div>
      <div class="set-rollup-item"><div class="set-label">Total GCash Earned</div><div class="set-value">${fmtMoney(totalGcash)}</div></div>
      <div class="set-rollup-item"><div class="set-label">Gross Income</div><div class="set-value">${fmtMoney(grossIncome)}</div></div>
    </div>
  `;
}

function renderMonth(data, month, location) {
  const content = document.getElementById("setContent");
  if (!data || !data.success) {
    content.innerHTML = `<div style="text-align:center;color:#888;padding:24px">${data?.error || "No data found"}</div>`;
    return;
  }

  const [year, mo] = month.split("-").map(Number);
  const monthIndex = mo - 1;
  const weeks = getBusinessWeeks(year, monthIndex);
  const todayStr = fmtDate(new Date());

  const dayMap = {};
  (data.days || []).forEach(d => { dayMap[d.date] = d; });

  const payrollMap = {};
  (data.payroll_weeks || []).forEach(w => { payrollMap[w.week_start_date] = w; });

  // Cheap pass: compute every week's numbers (needed for the monthly
  // totals regardless of which weeks are expanded). The expensive HTML
  // build for a week's body is deferred to buildWeekBodyHtml, called only
  // when that week is actually opened.
  weekContexts = {};
  let monthlyPayroll = 0, monthlyListed = 0, monthlyOverhead = 0, monthlyCash = 0, monthlyGcash = 0;

  const weekBlocks = weeks.map(w => {
    const ctx = buildWeekContext(w, dayMap, payrollMap);
    weekContexts[ctx.weekStartStr] = ctx;

    monthlyPayroll += ctx.payrollTotal;
    monthlyListed += ctx.listedExpensesTotal;
    monthlyOverhead += ctx.overheadSubsidy;
    monthlyCash += ctx.totalCash;
    monthlyGcash += ctx.totalGcash;

    const containsToday = ctx.dayDates.includes(todayStr);

    return `
      <details class="set-week" ${containsToday ? "open" : ""} data-week="${ctx.weekStartStr}" data-rendered="false">
        <summary>${ctx.weekLabel}</summary>
        <div class="set-week-body">
          <p class="set-week-placeholder">Loading…</p>
        </div>
      </details>
    `;
  });

  const monthlyGrossIncome = monthlyCash + monthlyGcash;
  const monthlyTotalExpenses = monthlyPayroll + monthlyListed + monthlyOverhead;
  const grossProfit = monthlyGrossIncome - monthlyTotalExpenses;

  content.innerHTML = `
    <p class="set-month-label">${month} — ${locationMap[location] || location}</p>
    ${weekBlocks.join("")}
    <div class="set-monthly-summary">
      <h3>📊 Monthly Summary</h3>
      <div class="set-monthly-grid">
        <div><div class="set-label">Payroll Total</div><div class="set-value">${fmtMoney(monthlyPayroll)}</div></div>
        <div><div class="set-label">Listed Expenses</div><div class="set-value">${fmtMoney(monthlyListed)}</div></div>
        <div><div class="set-label">Overhead Subsidy</div><div class="set-value">${fmtMoney(monthlyOverhead)}</div></div>
        <div><div class="set-label">Total Cash</div><div class="set-value">${fmtMoney(monthlyCash)}</div></div>
        <div><div class="set-label">Total GCash</div><div class="set-value">${fmtMoney(monthlyGcash)}</div></div>
        <div><div class="set-label">Gross Income</div><div class="set-value">${fmtMoney(monthlyGrossIncome)}</div></div>
        <div><div class="set-label">Gross Profit</div><div class="set-value" style="color:${grossProfit < 0 ? "#f87171" : "#4ade80"}">${fmtMoney(grossProfit)}</div></div>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".tracker-card"));

  // Render (and wire) each week's body the first time it's opened, not
  // upfront — a weak tablet CPU/GPU only ever has to lay out one week's
  // worth of tables and forms at a time.
  document.querySelectorAll(".set-week").forEach(weekEl => {
    weekEl.addEventListener("toggle", () => {
      if (!weekEl.open || weekEl.dataset.rendered === "true") return;
      renderWeekBody(weekEl, location);
    });
    if (weekEl.open) renderWeekBody(weekEl, location);
  });
}

function renderWeekBody(weekEl, location) {
  const ctx = weekContexts[weekEl.dataset.week];
  if (!ctx) return;
  weekEl.querySelector(".set-week-body").innerHTML = buildWeekBodyHtml(ctx);
  weekEl.dataset.rendered = "true";
  wireWeekEvents(weekEl, location);
}

/* ================= EVENT WIRING ================= */

function wireWeekEvents(weekEl, location) {
  const weekStart = weekEl.dataset.week;

    weekEl.querySelector(".btn-add-staff-row")?.addEventListener("click", () => {
      const select = weekEl.querySelector(".pr-add-staff");
      const staffId = select.value;
      if (!staffId) return;
      const staff = staffList.find(s => s.staff_id === staffId);
      if (!staff) return;

      const tbody = weekEl.querySelector(".pr-body");
      if (tbody.querySelector(`tr[data-staff="${staffId}"]`)) return;

      const emptyRow = tbody.querySelector("td[colspan]");
      if (emptyRow) emptyRow.closest("tr").remove();

      tbody.insertAdjacentHTML("beforeend", `
        <tr data-staff="${staffId}">
          <td>${staffLabel(staff)}</td>
          <td><input type="number" class="pr-rate" value="0"></td>
          ${DAY_KEYS.map(k => `<td><input type="checkbox" class="pr-day" data-day="${k}"></td>`).join("")}
          <td class="pr-total"><b>₱0.00</b></td>
        </tr>
      `);
      select.querySelector(`option[value="${staffId}"]`)?.remove();
    });

    weekEl.querySelector(".btn-save-payroll")?.addEventListener("click", async () => {
      const rows = [...weekEl.querySelectorAll(".pr-body tr[data-staff]")].map(tr => {
        const row = { staff_id: tr.dataset.staff, rate: Number(tr.querySelector(".pr-rate").value) || 0 };
        DAY_KEYS.forEach(k => {
          row[k] = tr.querySelector(`.pr-day[data-day="${k}"]`).checked;
        });
        return row;
      });

      showLoader("Saving payroll…");
      try {
        const res = await authFetch(API_URL, {
          method: "POST",
          body: new URLSearchParams({
            action: "savePayrollWeek",
            week_start_date: weekStart,
            location_id: location,
            rows: JSON.stringify(rows)
          })
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Save failed");
        loadMonth();
      } catch (err) {
        alert("❌ " + err.message);
      } finally {
        hideLoader();
      }
    });

    weekEl.querySelector(".btn-add-deduction")?.addEventListener("click", async () => {
      const staffId = weekEl.querySelector(".pd-staff").value;
      const amount = Number(weekEl.querySelector(".pd-amount").value);
      const notes = weekEl.querySelector(".pd-notes").value.trim();

      if (!staffId) { alert("Select an employee"); return; }
      if (!amount || amount <= 0) { alert("Amount must be greater than 0"); return; }

      showLoader("Saving deduction…");
      try {
        const res = await authFetch(API_URL, {
          method: "POST",
          body: new URLSearchParams({
            action: "addPayrollDeduction",
            week_start_date: weekStart,
            location_id: location,
            staff_id: staffId,
            amount,
            notes
          })
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Save failed");
        loadMonth();
      } catch (err) {
        alert("❌ " + err.message);
      } finally {
        hideLoader();
      }
    });

    weekEl.querySelectorAll(".btn-del-deduction").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remove this deduction?")) return;
        showLoader("Removing…");
        try {
          const res = await authFetch(API_URL, {
            method: "POST",
            body: new URLSearchParams({ action: "deletePayrollDeduction", deduction_id: btn.dataset.id })
          });
          const result = await res.json();
          if (!result.success) throw new Error(result.error || "Delete failed");
          loadMonth();
        } catch (err) {
          alert("❌ " + err.message);
        } finally {
          hideLoader();
        }
      });
    });

    weekEl.querySelector(".btn-add-expense")?.addEventListener("click", async () => {
      const dateSelect = weekEl.querySelector(".exp-date");
      const dailyId = dateSelect?.selectedOptions[0]?.dataset.dailyId;
      const item = weekEl.querySelector(".exp-item").value.trim();
      const description = weekEl.querySelector(".exp-desc").value.trim();
      const amount = Number(weekEl.querySelector(".exp-cost").value);

      if (!dailyId) { alert("No inventory day selected"); return; }
      if (!description) { alert("Description is required"); return; }
      if (!amount || amount <= 0) { alert("Cost must be greater than 0"); return; }

      showLoader("Saving expense…");
      try {
        const res = await authFetch(API_URL, {
          method: "POST",
          body: new URLSearchParams({
            action: "addExpense",
            daily_id: dailyId,
            item,
            description,
            amount,
            remarks: ""
          })
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Save failed");
        loadMonth();
      } catch (err) {
        alert("❌ " + err.message);
      } finally {
        hideLoader();
      }
    });
}
