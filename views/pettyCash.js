import { bindDataBoxScroll, getCached, showLoader, hideLoader } from "../admin.js";
import { API_URL } from "../firebase-config.js";
import { authFetch } from "../auth-guard.js";
import { icon } from "../icons.js";

/* Petty Cash Fund / Expenses — the one place the day's petty cash and
   itemized expenses are entered. Both are tied to that date+location's
   Daily_Inventory record (daily_id), so this is the same underlying
   data the Daily Sales Report reads (read-only there) — one source of
   truth, no risk of the two disagreeing. */
let lastSummary = null;
let locationMap = {};

export default async function loadPettyCashView() {
  renderActionBar();
  renderLayout();

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("pcDate").value = today;
  document.getElementById("pcLocation").value =
    localStorage.getItem("userLocation") || "";

  try {
    const locs = await getCached("locations");
    locs.forEach(l => { locationMap[l.location_id] = l.location_name; });
  } catch (err) {
    console.warn("Failed to load locations", err);
  }

  loadSummary();
}

function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <input type="date" id="pcDate" />
    <input type="text" id="pcLocation" placeholder="Location ID" />
    <button class="category-action-btn" id="pcLoadBtn">Load</button>
  `;
  document.getElementById("pcLoadBtn").onclick = loadSummary;
}

function renderLayout() {
  document.getElementById("contentBox").innerHTML = `
    <div class="tracker-card" style="height:100%">
      <h3>${icon("banknote")} Petty Cash Fund / Expenses</h3>
      <div id="pcContent" style="text-align:center;color:#888;padding:24px">Loading…</div>
    </div>
  `;
}

function loadSummary() {
  const date = document.getElementById("pcDate").value;
  const location = document.getElementById("pcLocation").value.trim();

  if (!date) {
    alert("Please select a date");
    return;
  }
  if (!location) {
    alert("Please enter a location");
    return;
  }

  document.getElementById("pcContent").innerHTML =
    `<div style="text-align:center;color:#888;padding:24px">Loading…</div>`;

  const callback = "handlePettyCashSummary";
  delete window[callback];

  window[callback] = function (data) {
    renderSummary(data, date, location);
  };

  const old = document.getElementById("pcJsonpScript");
  if (old) old.remove();

  const script = document.createElement("script");
  script.id = "pcJsonpScript";
  script.src =
    `${API_URL}?type=pettyCashSummary&date=${date}` +
    `&location=${encodeURIComponent(location)}&callback=${callback}`;

  document.body.appendChild(script);
}

function renderSummary(data, date, location) {
  lastSummary = data;
  const content = document.getElementById("pcContent");

  if (!data || !data.success) {
    content.innerHTML = `
      <div style="text-align:center;color:#888;padding:24px">
        ${data?.error || "No inventory day found for that date"}
      </div>
    `;
    return;
  }

  const expenses = data.expenses || [];
  const locName = locationMap[location] || location;

  content.innerHTML = `
    <p style="color:#666;margin-bottom:12px">
      ${date} — ${locName}
    </p>

    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">
      <div style="flex:1;min-width:220px;background:#f8fafc;border-radius:10px;padding:14px">
        <label style="font-weight:600;display:block;margin-bottom:6px">Petty Cash Fund</label>
        <div style="display:flex;gap:8px">
          <input id="pcFund" type="number" min="0" step="0.01"
            value="${data.petty_cash_fund}" style="flex:1">
          <button id="pcSaveFundBtn" class="category-action-btn">${icon("save")} Save</button>
        </div>
      </div>

      <div style="flex:1;min-width:220px;background:#f0fdf4;border-radius:10px;padding:14px">
        <label style="font-weight:600;display:block;margin-bottom:6px">Remaining PCF</label>
        <div id="pcRemaining" style="font-size:22px;font-weight:700;color:#16a34a">
          ₱${Number(data.remaining_petty_cash).toFixed(2)}
        </div>
      </div>
    </div>

    <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:16px">
      <label style="font-weight:600;display:block;margin-bottom:8px">Add Expense</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:2;min-width:180px">
          <label style="font-size:12px;color:#666">Expense Description</label>
          <input id="pcExpDescription" placeholder="e.g. Gas for delivery">
        </div>
        <div style="flex:1;min-width:110px">
          <label style="font-size:12px;color:#666">Amount</label>
          <input id="pcExpAmount" type="number" min="0" step="0.01" placeholder="0.00">
        </div>
        <div style="flex:2;min-width:150px">
          <label style="font-size:12px;color:#666">Remarks</label>
          <input id="pcExpRemarks" placeholder="Optional">
        </div>
        <button id="pcSaveExpenseBtn" class="category-action-btn">Save</button>
      </div>
    </div>

    <div class="table-scroll" style="max-height:none">
      <table class="category-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${!expenses.length
            ? `<tr><td colspan="3" style="text-align:center;color:#888">No expenses logged for this day</td></tr>`
            : expenses.map(e => `
              <tr>
                <td>${e.description}</td>
                <td>₱${Number(e.amount).toFixed(2)}</td>
                <td>${e.remarks || ""}</td>
              </tr>
            `).join("")
          }
        </tbody>
        <tfoot>
          <tr style="font-weight:700">
            <td>Total Expenses</td>
            <td>₱${Number(data.total_expenses).toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".tracker-card"));

  document.getElementById("pcSaveFundBtn").onclick = () => savePettyCashFund(date, location);
  document.getElementById("pcSaveExpenseBtn").onclick = () => saveExpense(date, location);
}

async function savePettyCashFund(date, location) {
  if (!lastSummary?.daily_id) return;

  const fund = Number(document.getElementById("pcFund").value) || 0;

  showLoader("Saving Petty Cash Fund…");
  try {
    const res = await authFetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "updateDailyFinance",
        daily_id: lastSummary.daily_id,
        petty_cash_fund: fund
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "Save failed");

    loadSummary();
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
  } finally {
    hideLoader();
  }
}

async function saveExpense(date, location) {
  if (!lastSummary?.daily_id) return;

  const description = document.getElementById("pcExpDescription").value.trim();
  const amount = Number(document.getElementById("pcExpAmount").value);
  const remarks = document.getElementById("pcExpRemarks").value.trim();

  if (!description) {
    alert("Expense description is required");
    return;
  }
  if (!amount || amount <= 0) {
    alert("Amount must be greater than 0");
    return;
  }

  showLoader("Saving expense…");
  try {
    const res = await authFetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "addExpense",
        daily_id: lastSummary.daily_id,
        description,
        amount,
        remarks
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "Save failed");

    loadSummary();
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
  } finally {
    hideLoader();
  }
}
