import { bindDataBoxScroll, getCached } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

import { API_URL } from "../firebase-config.js";
import { authFetch } from "../auth-guard.js";

/* ================= STATE ================= */
let locationMap = {};  // location_id → location_name
let lastOrders = [];   // last-loaded report, so voiding an item can refresh in place
let lastDate = "";      // tracks whether a report has been loaded yet

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
export default async function loadDailySalesView() {
  renderActionBar();
  renderLayout();

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("salesDate").value = today;
  document.getElementById("salesLocation").value =
    localStorage.getItem("userLocation") || "";

  // SAFE preload (locations only)
  await loadLocations();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <input type="date" id="salesDate" />
    <input type="text" id="salesLocation" placeholder="Location ID (optional)" />
    <button class="category-action-btn" id="loadSalesBtn">
      Load Report
    </button>
    <button id="dailySalesReportBtn" class="primary">
  📋 DAILY SALES REPORT
</button>
  `;
  document.getElementById("loadSalesBtn").onclick = loadSales;
  document.getElementById("dailySalesReportBtn").onclick =
  loadDailySalesReportFull;
}

/* ================= DAILY SALES REPORT (full format) =================
   Mirrors the manual "Inventory Sheet" report: per-item beginning/ending
   stock counts with their gram/liter yield equivalent, plus a petty
   cash / total sales / GCash / expenses / cash-on-hand summary at the
   bottom. Beginning/ending stock come from that day's
   Daily_Inventory_Items (already connected to the Daily Inventory System
   tab); petty cash fund and expenses are editable here and saved per
   day; total sales and GCash payment are computed server-side from that
   day's orders (void-adjusted). */
let lastReportSummary = null;

function loadDailySalesReportFull() {
  const date = document.getElementById("salesDate")?.value;
  const location =
    document.getElementById("salesLocation").value ||
    localStorage.getItem("userLocation") ||
    "";

  if (!date) {
    alert("Please select a date first");
    return;
  }
  if (!location) {
    alert("Please enter a location");
    return;
  }

  document.getElementById("contentBox").innerHTML = `
    <div class="tracker-card" style="height:100%">
      <h3>📋 Daily Sales Report — ${date}</h3>
      <div style="text-align:center;color:#888;padding:24px">Loading…</div>
    </div>
  `;

  fetchDailySalesReportSummary(date, location);
}

function fetchDailySalesReportSummary(date, location) {
  const callback = "handleDailySalesReportSummary";
  delete window[callback];

  window[callback] = function (data) {
    renderDailySalesReportFull(data, date, location);
  };

  const old = document.getElementById("dsrJsonpScript");
  if (old) old.remove();

  const script = document.createElement("script");
  script.id = "dsrJsonpScript";
  script.src =
    `${API_URL}?type=dailySalesReportSummary&date=${date}` +
    `&location=${encodeURIComponent(location)}&callback=${callback}`;

  document.body.appendChild(script);
}

function renderDailySalesReportFull(data, date, location) {
  lastReportSummary = data;

  if (!data || !data.success) {
    document.getElementById("contentBox").innerHTML = `
      <div class="tracker-card">
        <h3>📋 Daily Sales Report — ${date}</h3>
        <div style="text-align:center;color:#888;padding:24px">
          ${data?.error || "No inventory day found for that date"}
        </div>
      </div>
    `;
    return;
  }

  const items = data.items || [];

  document.getElementById("contentBox").innerHTML = `
    <div class="tracker-card" style="height:100%">
      <h3>📋 Daily Sales Report — ${date}</h3>

      <div class="table-scroll" style="max-height:none;flex:1">
        <table class="category-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Beginning Stocks</th>
              <th>Yield</th>
              <th>Ending Stocks</th>
              <th>Yield</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${!items.length
              ? `<tr><td colspan="6" style="text-align:center;color:#888">No inventory items for this day</td></tr>`
              : items.map(i => `
                <tr>
                  <td>${i.item_name}</td>
                  <td>${Number(i.beginning_stock).toLocaleString()}${i.unit ? " " + i.unit : ""}</td>
                  <td>${Number(i.beginning_yield).toLocaleString()}</td>
                  <td>${Number(i.ending_stock).toLocaleString()}${i.unit ? " " + i.unit : ""}</td>
                  <td>${Number(i.ending_yield).toLocaleString()}</td>
                  <td></td>
                </tr>
              `).join("")
            }
          </tbody>
        </table>
      </div>

      <div style="margin-top:16px;border-top:2px solid #eee;padding-top:12px;max-width:360px;margin-left:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <label style="font-weight:600">PETTY CASH FUND</label>
          <input id="dsrPettyCash" type="number" min="0" step="0.01"
            value="${data.petty_cash_fund}" style="width:130px;text-align:right">
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0">
          <label style="font-weight:600">TOTAL SALES</label>
          <span>₱${Number(data.total_sales).toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0">
          <label style="font-weight:600">GCASH PAYMENT</label>
          <span>₱${Number(data.gcash_payment).toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <label style="font-weight:600">EXPENSES</label>
          <input id="dsrExpenses" type="number" min="0" step="0.01"
            value="${data.expenses}" style="width:130px;text-align:right">
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid #eee;margin-top:6px">
          <label style="font-weight:700">CASH ON HAND</label>
          <span id="dsrCashOnHand" style="font-weight:700">₱${Number(data.cash_on_hand).toFixed(2)}</span>
        </div>

        <button id="dsrSaveBtn" class="category-action-btn" style="width:100%;margin-top:8px">
          💾 Save Petty Cash / Expenses
        </button>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".tracker-card"));

  document.getElementById("dsrPettyCash").oninput = recalcCashOnHand;
  document.getElementById("dsrExpenses").oninput = recalcCashOnHand;
  document.getElementById("dsrSaveBtn").onclick = () => saveDailyFinance(date, location);
}

function recalcCashOnHand() {
  if (!lastReportSummary) return;

  const pettyCash = Number(document.getElementById("dsrPettyCash").value) || 0;
  const expenses = Number(document.getElementById("dsrExpenses").value) || 0;
  const totalSales = Number(lastReportSummary.total_sales) || 0;
  const gcash = Number(lastReportSummary.gcash_payment) || 0;

  const cashOnHand = (pettyCash + totalSales) - (gcash + expenses);
  document.getElementById("dsrCashOnHand").textContent = `₱${cashOnHand.toFixed(2)}`;
}

async function saveDailyFinance(date, location) {
  if (!lastReportSummary?.daily_id) return;

  const pettyCash = Number(document.getElementById("dsrPettyCash").value) || 0;
  const expenses = Number(document.getElementById("dsrExpenses").value) || 0;

  showLoader("Saving…");

  try {
    const res = await authFetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "updateDailyFinance",
        daily_id: lastReportSummary.daily_id,
        petty_cash_fund: pettyCash,
        expenses
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "Save failed");

    fetchDailySalesReportSummary(date, location);
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
  } finally {
    hideLoader();
  }
}

/* ================= LAYOUT ================= */
function renderLayout() {
  document.getElementById("contentBox").innerHTML = `
    <div class="data-box" style="display:flex;flex-direction:column;height:100%;min-height:0;">
      <div class="data-scroll" style="flex:1;overflow-y:auto;max-height:100%;">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Transaction / Product</th>
              <th>Qty</th>
              <th>Cashier</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody id="salesBody">
            <tr>
              <td colspan="5" style="text-align:center;color:#888">
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

/* ================= LOAD LOCATIONS ================= */
async function loadLocations() {
  try {
    const data = await getCached("locations");
    data.forEach(l => {
      locationMap[l.location_id] = l.location_name;
    });
  } catch (err) {
    console.warn("Failed to load locations", err);
  }
}

/* ================= LOAD SALES (JSONP) ================= */
function loadSales() {
  const date = document.getElementById("salesDate").value;
  let location = document.getElementById("salesLocation").value || "";

  if (!date) {
    alert("Select a date");
    return;
  }

  lastDate = date;

  showLoader("Loading sales report…");

  const callback = "handleDailySalesReport";
  delete window[callback];

  window[callback] = function (orders) {
    try {
      renderTable(Array.isArray(orders) ? orders : []);
    } finally {
      hideLoader();
    }
  };

  const old = document.getElementById("salesJsonpScript");
  if (old) old.remove();

  const script = document.createElement("script");
  script.id = "salesJsonpScript";
  script.src =
    `${API_URL}?type=dailySalesReport&date=${date}` +
    (location ? `&location=${encodeURIComponent(location)}` : "") +
    `&callback=${callback}`;

  document.body.appendChild(script);
}

/* ================= RENDER ================= */
function renderTable(orders) {
  lastOrders = orders;

  const tbody = document.getElementById("salesBody");
  tbody.innerHTML = "";

  let grandTotal = 0;

  if (!orders.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#888">
          No sales found
        </td>
      </tr>`;
    updateTotals(0);
    return;
  }

  orders.forEach((o, i) => {
    // Authoritative total comes from the order record itself — it's
    // already adjusted server-side whenever an item on it is voided.
    const transactionTotal = Number(o.total) || 0;
    grandTotal += transactionTotal;

    // TRANSACTION HEADER — click to manage/void its items
    tbody.insertAdjacentHTML("beforeend", `
      <tr style="background:#f4f4f4;font-weight:600;cursor:pointer"
        onclick="openOrderItemsModal('${o.ref_id}')" title="Click to view/void items">
        <td>${i + 1}</td>
        <td>
          ${o.ref_id}<br>
          <small>
            ${formatDateTime(o.datetime)}<br>
            ${locationMap[o.location] || o.location || "-"}
          </small>
        </td>
        <td></td>
        <td>${o.cashier || "-"}</td>
        <td>₱${transactionTotal.toFixed(2)}</td>
      </tr>
    `);

    (o.items || []).forEach(item => {
      const voidedStyle = item.voided ? "opacity:0.5;text-decoration:line-through" : "";
      tbody.insertAdjacentHTML("beforeend", `
        <tr style="${voidedStyle}">
          <td></td>
          <td>${item.product_name}${item.voided ? ` <span style="color:#dc2626;text-decoration:none;font-size:11px">(VOIDED${item.restored ? ", restocked" : ""})</span>` : ""}</td>
          <td>${item.qty || 0}</td>
          <td></td>
          <td>₱${Number(item.total || 0).toFixed(2)}</td>
        </tr>
      `);
    });
  });

  updateTotals(grandTotal);
}

/* ================= VOID ORDER ITEM ================= */
window.openOrderItemsModal = function (refId) {
  const order = lastOrders.find(o => o.ref_id === refId);
  if (!order) return;

  const items = order.items || [];

  openModal(`
    <div class="modal-header">Order ${order.ref_id}</div>
    <p style="padding:4px 0;color:#666">
      ${formatDateTime(order.datetime)} — ${order.cashier || "-"}
    </p>

    <div style="max-height:340px;overflow:auto;margin-top:8px">
      ${items.length ? items.map(item => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #eee;${item.voided ? "opacity:0.5" : ""}">
          <div style="${item.voided ? "text-decoration:line-through" : ""}">
            ${item.qty || 0}x ${item.product_name}
            ${item.voided ? `<div style="color:#dc2626;text-decoration:none;font-size:11px">VOIDED${item.restored ? " — stock restored" : ""}</div>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <span>₱${Number(item.total || 0).toFixed(2)}</span>
            ${!item.voided ? `<button class="btn-back" style="font-size:12px;padding:4px 10px"
              onclick="openVoidConfirm('${item.order_item_id}','${order.ref_id}')">Void</button>` : ""}
          </div>
        </div>
      `).join("") : `<div style="color:#888;padding:12px 0">No items</div>`}
    </div>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `, true);
};

window.openVoidConfirm = function (orderItemId, refId) {
  openModal(`
    <div class="modal-header">Void Item</div>
    <p style="padding:8px 0;color:#666">
      Should the ingredients this item used be put back into today's remaining inventory?
    </p>
    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Cancel</button>
      <button class="btn-back" onclick="confirmVoidItem('${orderItemId}','${refId}', false)">Void, Don't Restore</button>
      <button class="btn-primary" onclick="confirmVoidItem('${orderItemId}','${refId}', true)">Void &amp; Restore Stock</button>
    </div>
  `, true);
};

window.confirmVoidItem = async function (orderItemId, refId, restore) {
  showLoader("Voiding item…");

  try {
    const res = await authFetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "voidOrderItem",
        order_item_id: orderItemId,
        ref_id: refId,
        restore: restore ? "true" : "false"
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Void failed");

    closeModal();
    alert(
      restore && !data.restored
        ? "✅ Item voided. Stock wasn't restored — today's inventory day for that order is already closed."
        : "✅ Item voided" + (data.restored ? " and stock restored." : ".")
    );

    if (lastDate) loadSales();
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
  } finally {
    hideLoader();
  }
};

/* ================= TOTALS ================= */
function updateTotals(total) {
  document.getElementById("sumGross").textContent =
    Number(total).toFixed(2);
}

/* ================= DATE FORMAT ================= */
function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

