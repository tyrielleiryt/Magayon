import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";
import { listDailyInventoryDays } from "../data/dailyInventory.js";
import { listTodaySales } from "../data/orders.js";

/* ================= HELPERS ================= */
const el = id => document.getElementById(id);

function showLoader(text = "Loading…") {
  const l = document.getElementById("globalLoader");
  if (!l) return;
  l.querySelector(".loader-text").textContent = text;
  l.classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("globalLoader")?.classList.add("hidden");
}

/* ================= STATE ================= */
let salesDays = [];
let searchDate = "";
let searchLocation = "";

/* ================= ENTRY ================= */
export default function loadSalesReportView() {
  renderActionBar();

  el("contentBox").innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Location</th>
              <th>Sales</th>
            </tr>
          </thead>
          <tbody id="salesReportBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
  loadSalesDays();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  el("actionBar").innerHTML = `
    <input id="searchDateInput" placeholder="Search date (YYYY-MM-DD)" />
    <input id="searchLocationInput" placeholder="Search location" />
  `;

  el("searchDateInput").oninput = e => {
    searchDate = e.target.value.toLowerCase();
    renderTable();
  };

  el("searchLocationInput").oninput = e => {
    searchLocation = e.target.value.toLowerCase();
    renderTable();
  };
}

/* ================= LOAD DAYS ================= */
async function loadSalesDays() {
  showLoader("Loading sales data…");

  try {
    // reuse dailyInventory as "days with activity"
    const { rows } = await listDailyInventoryDays({ limit: 1000, offset: 0 });

    salesDays = rows;
    renderTable();

  } catch (err) {
    console.error(err);
    alert("Failed to load sales report");
  } finally {
    hideLoader();
  }
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = el("salesReportBody");
  tbody.innerHTML = "";

  const filtered = salesDays.filter(d =>
    (!searchDate ||
      new Date(d.date).toISOString().slice(0, 10).includes(searchDate)) &&
    (!searchLocation ||
      (d.location || "").toLowerCase().includes(searchLocation))
  );

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:#888">
          No sales records found
        </td>
      </tr>`;
    return;
  }

  filtered.forEach((d, i) => {
    const dayKey = new Date(d.date).toISOString().slice(0, 10);

    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(d.date).toLocaleDateString()}</td>
        <td>${d.location}</td>
        <td>
          <button class="btn-view"
            onclick="viewDailySales('${dayKey}','${d.location}')">
            View
          </button>
        </td>
      </tr>
    `);
  });
}

/* ================= VIEW DAILY SALES ================= */
window.viewDailySales = async function (date, location) {
  showLoader("Loading sales…");

  try {
    const orders = await listTodaySales(date, location);
    const summary = {
      total_orders: orders.length,
      gross_sales: orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    };

    openModal(
      `
      <div class="modal-header">
        Sales — ${date} (${location})
      </div>

      <div class="sales-summary">
        <div><strong>Total Orders:</strong> ${summary.total_orders}</div>
        <div><strong>Gross Sales:</strong> ₱${summary.gross_sales.toFixed(2)}</div>
      </div>

      <div class="inventory-scroll">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Ref</th>
              <th>Cashier</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
  ${
    !orders.length
      ? `<tr>
           <td colspan="4" style="text-align:center;color:#888">
             No transactions
           </td>
         </tr>`
      : orders.map(o => `
          <tr>
            <td>${new Date(o.datetime).toLocaleTimeString()}</td>
            <td>${o.ref_id}</td>
            <td>${o.cashier}</td>
            <td>₱${o.total.toFixed(2)}</td>
          </tr>
        `).join("")
  }
</tbody>
        </table>
      </div>

      <div class="modal-actions">
        <button class="btn-back" onclick="closeModal()">Close</button>
      </div>
      `,
      true
    );

  } catch (err) {
    console.error(err);
    alert("Failed to load sales report");
  } finally {
    hideLoader();
  }
};