import { bindDataBoxScroll, getCached } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

import { icon } from "../icons.js";
import { getDailySalesReportSummary, getDayExpenses, listTodaySales, voidOrderItem as voidOrderItemSupabase } from "../data/orders.js";

/* ================= STATE ================= */
let locationMap = {};  // location_id → location_name
let lastOrders = [];   // last-loaded report, so voiding an item can refresh in place
let lastDate = "";      // date/location of the currently-open transaction list modal,
let lastLocation = "";  // so a void can refresh the same modal in place

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
    <button id="dailySalesReportBtn" class="category-action-btn">
  ${icon("receipt")} Generate Report
</button>
  `;
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
    <div class="tracker-card dsr-report" style="height:100%">
      <h3>${icon("receipt")} Daily Sales Report — ${date}</h3>
      <div style="text-align:center;color:#888;padding:24px">Loading…</div>
    </div>
  `;

  Promise.all([
    getDailySalesReportSummary(date, location).catch(err => ({ success: false, error: err.message })),
    getDayExpenses(date, location).catch(() => [])
  ]).then(([summary, expenses]) => {
    renderDailySalesReportFull(summary, expenses, date, location);
  });
}

function renderDailySalesReportFull(data, expenses, date, location) {
  lastReportSummary = data;

  if (!data || !data.success) {
    document.getElementById("contentBox").innerHTML = `
      <div class="tracker-card dsr-report">
        <h3>${icon("receipt")} Daily Sales Report — ${date}</h3>
        <div style="text-align:center;color:#888;padding:24px">
          ${data?.error || "No inventory day found for that date"}
        </div>
      </div>
    `;
    return;
  }

  const items = data.items || [];
  const expensesTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  document.getElementById("contentBox").innerHTML = `
    <div class="tracker-card dsr-report" style="height:100%">
      <h3>${icon("receipt")} Daily Sales Report — ${date}</h3>

      <div class="data-scroll">
        <div class="table-scroll" style="max-height:none">
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

        <div class="dsr-report-footer">
          <div class="dsr-report-actions">
            <button id="dsrViewTxnBtn" class="category-action-btn">${icon("list-checks")} View Transaction List</button>
            <button id="dsrPrintBtn" class="inv-modal-btn-secondary">${icon("printer")} Print</button>
          </div>

          <div class="dsr-summary">
            <div class="dsr-summary-pair">
              <div class="dsr-summary-cell">
                <label>PETTY CASH FUND</label>
                <span>₱${Number(data.petty_cash_fund).toFixed(2)}</span>
              </div>
              <div class="dsr-summary-cell dsr-summary-cell-right">
                <label>CASH ON HAND</label>
                <span>₱${Number(data.cash_on_hand).toFixed(2)}</span>
              </div>
            </div>

            <div class="dsr-summary-row">
              <label>TOTAL SALES</label>
              <span>₱${Number(data.total_sales).toFixed(2)}</span>
            </div>
            <div class="dsr-summary-row">
              <label>CASH SALES</label>
              <span>₱${Number(data.cash_sales).toFixed(2)}</span>
            </div>
            <div class="dsr-summary-row">
              <label>GCASH PAYMENT</label>
              <span>₱${Number(data.gcash_payment).toFixed(2)}</span>
            </div>

            <div class="dsr-expenses">
              <label class="dsr-expenses-label">EXPENSES</label>
              <table class="dsr-expenses-table">
                <tbody>
                  ${!expenses.length
                    ? `<tr><td colspan="2" class="dsr-expenses-empty">No expenses logged</td></tr>`
                    : expenses.map(e => `
                      <tr>
                        <td>${e.item || e.description || "-"}</td>
                        <td>₱${Number(e.amount || 0).toFixed(2)}</td>
                      </tr>
                    `).join("")
                  }
                </tbody>
                <tfoot>
                  <tr><td>TOTAL</td><td>₱${expensesTotal.toFixed(2)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("dsrViewTxnBtn").onclick = () => openTransactionListModal(date, location);
  document.getElementById("dsrPrintBtn").onclick = () => window.print();

  bindDataBoxScroll(document.querySelector(".dsr-report"));
}

/* ================= LAYOUT =================
   Idle state before a report has been generated — the transaction list
   now only ever appears inside the "View Transaction List" modal (see
   below), triggered from within an already-generated report. */
function renderLayout() {
  document.getElementById("contentBox").innerHTML = `
    <div class="tracker-card" style="height:100%">
      <div class="set-tip">${icon("receipt", { size: 22 })} Choose a date and location, then click Generate Report</div>
    </div>
  `;
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

/* ================= VIEW TRANSACTION LIST (modal) =================
   Opened from inside a generated report ("View Transaction List") —
   uses that report's own date/location, not whatever's currently
   sitting in the action-bar inputs, so it can't show the wrong day. */
function openTransactionListModal(date, location) {
  lastDate = date;
  lastLocation = location;

  openModal(`
    <div class="modal-header">${icon("list-checks")} Transactions — ${date}</div>
    <div class="table-scroll" style="max-height:60vh;overflow:auto">
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
        <tbody id="txnListBody">
          <tr><td colspan="5" style="text-align:center;color:#888">Loading…</td></tr>
        </tbody>
      </table>
    </div>
    <div style="margin-top:12px;text-align:right"><b>Gross Sales:</b> ₱<span id="txnListGross">0.00</span></div>
    <div class="modal-actions">
      <button class="inv-modal-btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `, true);

  loadTransactionList(date, location);
}

function loadTransactionList(date, location) {
  listTodaySales(date, location || undefined)
    .then(orders => renderTransactionList(orders))
    .catch(err => {
      console.error(err);
      renderTransactionList([]);
    });
}

/* ================= RENDER ================= */
function renderTransactionList(orders) {
  lastOrders = orders;

  const tbody = document.getElementById("txnListBody");
  if (!tbody) return; // modal was closed mid-fetch

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
    const data = await voidOrderItemSupabase(Number(orderItemId), restore);

    closeModal();
    alert(
      restore && !data.restored
        ? "✅ Item voided. Stock wasn't restored — today's inventory day for that order is already closed."
        : "✅ Item voided" + (data.restored ? " and stock restored." : ".")
    );

    // The Order Items / Void screens replace the same single modal the
    // transaction list was showing, so by this point that list is gone —
    // reopen it fresh (re-fetched) instead of trying to refresh in place.
    if (lastDate) openTransactionListModal(lastDate, lastLocation);
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
  } finally {
    hideLoader();
  }
};

/* ================= TOTALS ================= */
function updateTotals(total) {
  const el = document.getElementById("txnListGross");
  if (el) el.textContent = Number(total).toFixed(2);
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

