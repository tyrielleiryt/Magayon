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
    <button id="productTrackerBtn" class="primary">
  📊 Product Sale Tracker
</button>
  `;
  document.getElementById("loadSalesBtn").onclick = loadSales;
  document.getElementById("productTrackerBtn").onclick =
  loadProductSaleTracker;
}

/* ================= Product Sales ================= */

function loadProductSaleTracker() {
  const date = document.getElementById("salesDate")?.value;
  const location =
  document.getElementById("salesLocation").value ||
  localStorage.getItem("userLocation") ||
  "";

  if (!date) {
    alert("Please select a date first");
    return;
  }

document.getElementById("contentBox").innerHTML = `
  <div class="tracker-vertical">

    <div class="tracker-card">
      <h3>📦 Product Sale Tracker</h3>
      <div class="table-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Product</th>
              <th>Qty Sold</th>
              <th>Sum Total</th>
            </tr>
          </thead>
          <tbody id="productSalesBody"></tbody>
        </table>
      </div>
    </div>

    <div class="tracker-card">
      <h3>📊 Inventory Reconciliation</h3>
      <div class="table-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Added</th>
              <th>Consumed</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody id="inventoryReconBody"></tbody>
        </table>
      </div>
    </div>

  </div>
`;

  bindDataBoxScroll(document.querySelector(".tracker-vertical"));

  loadProductSales(date, location);
  loadInventoryReconciliation(date, location);
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

async function loadProductSales(date, location) {
  const res = await fetch(
    `${API_URL}?type=productSalesTracker&date=${date}&location=${location}`
  );
  const data = await res.json();

  const tbody = document.getElementById("productSalesBody");
  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="2">No sales</td></tr>`;
    return;
  }

  data.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td><b>${p.product_code || "-"}</b></td>
        <td>${p.product_name}</td>
        <td><strong>${p.qty_sold}</strong></td>
        <td>₱${Number(p.total_sales || 0).toFixed(2)}</td>
      </tr>
    `;
  });
}

async function loadInventoryReconciliation(date, location) {
  const res = await fetch(
    `${API_URL}?type=inventoryReconciliation&date=${date}&location=${location}`
  );
  const data = await res.json();

  const tbody = document.getElementById("inventoryReconBody");
  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4">No inventory</td></tr>`;
    return;
  }

  data.forEach(i => {
    let rowClass = "";

    if (i.remaining < 0) rowClass = "danger-row";
    else if (i.remaining <= 5) rowClass = "warning-row";

    tbody.innerHTML += `
      <tr class="${rowClass}">
        <td>${i.item_name}</td>
        <td>${i.added}</td>
        <td>${i.consumed}</td>
        <td><strong>${i.remaining}</strong></td>
      </tr>
    `;
  });
}