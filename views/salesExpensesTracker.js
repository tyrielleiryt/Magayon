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

  await loadOpex();
  loadMonth();
}

function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <input type="month" id="setMonth" />
    <input type="text" id="setLocation" placeholder="Location ID" />
    <button class="category-action-btn" id="setLoadBtn">Load</button>
    <button class="category-action-btn" id="setOpexBtn">⚙️ OPEX</button>
  `;
  document.getElementById("setLoadBtn").onclick = loadMonth;
  document.getElementById("setOpexBtn").onclick = openOpexModal;
}

function renderLayout() {
  document.getElementById("contentBox").innerHTML = `
    <div class="tracker-card" style="height:100%">
      <h3>📈 Sales and Expenses Tracker</h3>
      <div id="setContent" style="padding:12px;text-align:center;color:#888">Loading…</div>
    </div>
  `;
}

/* ================= OPEX ================= */

async function loadOpex() {
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
    script.src = `${API_URL}?type=opex&callback=${callback}`;
    script.onerror = () => { opexItems = []; opexTotal = 0; resolve(); };
    document.body.appendChild(script);
  });
}

function openOpexModal() {
  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <h3>⚙️ Operating Expenses (Monthly)</h3>
    <table class="category-table" style="margin-bottom:12px">
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
          : `<tr><td colspan="3" style="text-align:center;color:#888">No OPEX items yet</td></tr>`
        }
      </tbody>
      <tfoot>
        <tr style="font-weight:700"><td>Total / Month</td><td>₱${opexTotal.toFixed(2)}</td><td></td></tr>
      </tfoot>
    </table>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <input type="text" id="opexNewName" placeholder="e.g. Rent" style="flex:2">
      <input type="number" id="opexNewAmount" placeholder="Amount" style="flex:1">
      <button class="category-action-btn" id="opexAddBtn">Add</button>
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
        body: new URLSearchParams({ action: "addOpexItem", item_name, amount_month })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Save failed");
      await loadOpex();
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
        await loadOpex();
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

function loadMonth() {
  const month = document.getElementById("setMonth").value;
  const location = document.getElementById("setLocation").value.trim();

  if (!month) { alert("Please select a month"); return; }
  if (!location) { alert("Please enter a location"); return; }

  document.getElementById("setContent").innerHTML =
    `<div style="text-align:center;color:#888;padding:24px">Loading…</div>`;

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

  let monthlyPayroll = 0, monthlyListed = 0, monthlyOverhead = 0, monthlyCash = 0, monthlyGcash = 0;

  const weekBlocks = weeks.map(w => {
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

    monthlyPayroll += payrollTotal;
    monthlyListed += listedExpensesTotal;
    monthlyOverhead += overheadSubsidy;
    monthlyCash += totalCash;
    monthlyGcash += totalGcash;

    const weekLabel =
      `${w.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ` +
      `${w.end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    const containsToday = dayDates.includes(todayStr);

    function tableHtml(title, rows) {
      return `
        <table class="category-table" style="margin-bottom:12px">
          <thead><tr><th>${title}</th>${DAY_KEYS.map(k => `<th>${DAY_LABELS[k]}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map(([label, vals]) => `<tr><td>${label}</td>${vals.map(v => `<td>${v}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      `;
    }

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
          <td><input type="number" class="pr-rate" value="${r.rate}" style="width:70px"></td>
          ${DAY_KEYS.map(k => `<td style="text-align:center"><input type="checkbox" class="pr-day" data-day="${k}" ${r[k] ? "checked" : ""}></td>`).join("")}
          <td class="pr-total">${fmtMoney(r.weekly_total)}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="9" style="text-align:center;color:#888">No staff added yet</td></tr>`;

    const deductionsRowsHtml = payrollWeek.deductions.length
      ? payrollWeek.deductions.map(dd => `
        <tr>
          <td>${dd.first_name} ${dd.last_name}</td>
          <td>${fmtMoney(dd.amount)}</td>
          <td>${dd.notes || ""}</td>
          <td><button class="btn-del-deduction" data-id="${dd.deduction_id}">✕</button></td>
        </tr>
      `).join("")
      : `<tr><td colspan="4" style="text-align:center;color:#888">No deductions</td></tr>`;

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
      : `<tr><td colspan="4" style="text-align:center;color:#888">No expenses logged</td></tr>`;

    const dateOptions = dayDates
      .map((ds, i) => dayInfos[i] ? `<option value="${ds}" data-daily-id="${dayInfos[i].daily_id}">${ds}</option>` : "")
      .join("");

    return `
      <details class="set-week" ${containsToday ? "open" : ""} style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:10px;padding:10px" data-week="${weekStartStr}">
        <summary style="cursor:pointer;font-weight:700;font-size:15px">${weekLabel}</summary>

        <div style="margin-top:12px">
          ${tableHtml("Daily Sales", salesRows)}
          ${tableHtml("Cash On Hand", onHandRows)}

          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px">
            <div style="flex:2;min-width:340px">
              <h4 style="margin:8px 0">👥 Payroll</h4>
              <table class="category-table">
                <thead>
                  <tr><th>Employee</th><th>Rate</th>${DAY_KEYS.map(k => `<th>${DAY_LABELS[k]}</th>`).join("")}<th>Weekly Total</th></tr>
                </thead>
                <tbody class="pr-body">${payrollRowsHtml}</tbody>
              </table>
              <div style="display:flex;gap:8px;margin:8px 0;align-items:center">
                <select class="pr-add-staff" style="flex:1">${staffOptionsHtml(payrolledStaffIds)}</select>
                <button class="category-action-btn btn-add-staff-row">+ Add</button>
                <button class="category-action-btn btn-save-payroll">💾 Save Week</button>
              </div>

              <h4 style="margin:8px 0">Deductions</h4>
              <table class="category-table">
                <thead><tr><th>Employee</th><th>Amount</th><th>Notes</th><th></th></tr></thead>
                <tbody class="pd-body">${deductionsRowsHtml}</tbody>
              </table>
              <div style="display:flex;gap:8px;margin:8px 0">
                <select class="pd-staff" style="flex:1">${staffOptionsHtml()}</select>
                <input type="number" class="pd-amount" placeholder="Amount" style="width:100px">
                <input type="text" class="pd-notes" placeholder="Notes" style="flex:1">
                <button class="category-action-btn btn-add-deduction">Add</button>
              </div>
            </div>

            <div style="flex:1;min-width:280px">
              <h4 style="margin:8px 0">🧾 Listed Expenses</h4>
              <table class="category-table">
                <thead><tr><th>Date</th><th>Item</th><th>Desc.</th><th>Cost</th></tr></thead>
                <tbody>${expensesHtml}</tbody>
                <tfoot><tr style="font-weight:700"><td colspan="3">Total</td><td>${fmtMoney(listedExpensesTotal)}</td></tr></tfoot>
              </table>
              ${dateOptions ? `
                <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
                  <select class="exp-date" style="flex:1">${dateOptions}</select>
                  <input type="text" class="exp-item" placeholder="Item" style="flex:1">
                  <input type="text" class="exp-desc" placeholder="Description (qty/unit)" style="flex:1">
                  <input type="number" class="exp-cost" placeholder="Cost" style="width:90px">
                  <button class="category-action-btn btn-add-expense">Add</button>
                </div>
              ` : `<p style="color:#888;font-size:12px">No open inventory day this week to log an expense against.</p>`}
            </div>
          </div>

          <div style="background:#f8fafc;border-radius:10px;padding:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">
            <div><b>Payroll Total</b><br>${fmtMoney(payrollTotal)}</div>
            <div><b>Listed Expenses Total</b><br>${fmtMoney(listedExpensesTotal)}</div>
            <div><b>Overhead Subsidy</b><br>${fmtMoney(overheadSubsidy)}</div>
            <div><b>SUM Expenses Total</b><br>${fmtMoney(sumExpenses)}</div>
            <div><b>Total Cash Earned</b><br>${fmtMoney(totalCash)}</div>
            <div><b>Total GCash Earned</b><br>${fmtMoney(totalGcash)}</div>
            <div><b>Gross Income</b><br>${fmtMoney(grossIncome)}</div>
          </div>
        </div>
      </details>
    `;
  });

  const monthlyGrossIncome = monthlyCash + monthlyGcash;
  const monthlyTotalExpenses = monthlyPayroll + monthlyListed + monthlyOverhead;
  const grossProfit = monthlyGrossIncome - monthlyTotalExpenses;

  content.innerHTML = `
    <p style="color:#666;margin-bottom:12px">${month} — ${locationMap[location] || location}</p>
    ${weekBlocks.join("")}
    <div style="background:#111827;color:#fff;border-radius:10px;padding:16px;margin-top:8px">
      <h3 style="margin:0 0 10px">Monthly Summary</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
        <div>Payroll Total<br><b>${fmtMoney(monthlyPayroll)}</b></div>
        <div>Listed Expenses<br><b>${fmtMoney(monthlyListed)}</b></div>
        <div>Overhead Subsidy<br><b>${fmtMoney(monthlyOverhead)}</b></div>
        <div>Total Cash<br><b>${fmtMoney(monthlyCash)}</b></div>
        <div>Total GCash<br><b>${fmtMoney(monthlyGcash)}</b></div>
        <div>Gross Income<br><b>${fmtMoney(monthlyGrossIncome)}</b></div>
        <div>Gross Profit<br><b style="color:${grossProfit < 0 ? "#f87171" : "#4ade80"}">${fmtMoney(grossProfit)}</b></div>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".tracker-card"));
  wireWeekEvents(location);
}

/* ================= EVENT WIRING ================= */

function wireWeekEvents(location) {
  document.querySelectorAll(".set-week").forEach(weekEl => {
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
          <td><input type="number" class="pr-rate" value="0" style="width:70px"></td>
          ${DAY_KEYS.map(k => `<td style="text-align:center"><input type="checkbox" class="pr-day" data-day="${k}"></td>`).join("")}
          <td class="pr-total">₱0.00</td>
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
  });
}
