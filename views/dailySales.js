import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* =========================================================
   LOADER HELPERS (STEP 4)
========================================================= */
function showLoader(text = "Loading data…") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.querySelector(".loader-text").textContent = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.classList.add("hidden");
}

/* ================= ENTRY ================= */
export default function loadDailySalesView() {
  renderActionBar();
  renderLayout();

  // ✅ Default to today
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("salesDate").value = today;
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <input type="date" id="salesDate" />
    <input type="text" id="salesLocation" placeholder="Location (optional)" />
    <button class="category-action-btn" id="loadSalesBtn">
      Load Report
    </button>
  `;

  document.getElementById("loadSalesBtn").onclick = loadSales;
  document.getElementById("salesDate").onchange = loadSales;
  document.getElementById("salesLocation").oninput = debounce(loadSales, 500);
}

/* ================= LAYOUT ================= */
function renderLayout() {
  document.getElementById("contentBox").innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Qty Sold</th>
              <th>Gross</th>
              <th>Capital</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody id="salesBody">
            <tr>
              <td colspan="6" style="text-align:center;color:#888">
                Select a date and click “Load Report”
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="inventory-summary" style="margin-top:12px">
        <div>Gross: ₱<span id="sumGross">0.00</span></div>
        <div>Capital: ₱<span id="sumCapital">0.00</span></div>
        <div><b>Net:</b> ₱<span id="sumNet">0.00</span></div>
      </div>

      <div style="text-align:right;margin-top:12px">
        <button class="btn-view" onclick="viewRemainingStock()">
          View Remaining Inventory
        </button>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
}

/* ================= LOAD SALES ================= */
async function loadSales() {
  const date = document.getElementById("salesDate").value;
  const location = document.getElementById("salesLocation").value.trim();

  if (!date) {
    alert("Please select a date");
    return hookup();
  }

  showLoader("Loading sales report…");

  const tbody = document.getElementById("salesBody");
  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center;color:#888">
        Loading sales report…
      </td>
    </tr>
  `;

  try {
    const res = await fetch(
      API_URL +
        `?type=dailySalesReport` +
        `&date=${date}` +
        `&location=${encodeURIComponent(location)}`
    );

    const data = await res.json();
    renderTable(data);
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#c0392b">
          Failed to load report
        </td>
      </tr>
    `;
  } finally {
    hideLoader();
  }
}

/* ================= RENDER TABLE ================= */
function renderTable(rows) {
  const tbody = document.getElementById("salesBody");
  tbody.innerHTML = "";

  let gross = 0;
  let capital = 0;
  let net = 0;

  if (!rows || !rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#888">
          No sales recorded for this day
        </td>
      </tr>
    `;
    updateTotals(0, 0, 0);
    return;
  }

  rows.forEach((r, i) => {
    gross += r.gross;
    capital += r.capital;
    net += r.net;

    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${r.product_name || r.product_id}</td>
        <td>${r.qty}</td>
        <td>₱${r.gross.toFixed(2)}</td>
        <td>₱${r.capital.toFixed(2)}</td>
        <td style="color:${r.net >= 0 ? "#1b8f3c" : "#c0392b"}">
          ₱${r.net.toFixed(2)}
        </td>
      </tr>
    `;
  });

  updateTotals(gross, capital, net);
}

/* ================= TOTALS ================= */
function updateTotals(gross, capital, net) {
  document.getElementById("sumGross").textContent = gross.toFixed(2);
  document.getElementById("sumCapital").textContent = capital.toFixed(2);
  document.getElementById("sumNet").textContent = net.toFixed(2);
}

/* ================= REMAINING INVENTORY ================= */
window.viewRemainingStock = async function () {
  const date = document.getElementById("salesDate").value;
  const location = document.getElementById("salesLocation").value.trim();
  if (!date) return;

  showLoader("Loading remaining inventory…");

  try {
    const res = await fetch(
      API_URL +
        `?type=dailyRemainingInventory` +
        `&date=${date}` +
        `&location=${encodeURIComponent(location)}`
    );

    const data = await res.json();

    openModal(
      `
      <div class="modal-header">Remaining Inventory</div>

      <div class="inventory-scroll">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            ${
              !data.length
                ? `<tr><td colspan="2" style="text-align:center;color:#888">No data</td></tr>`
                : data
                    .map(
                      i => `
              <tr>
                <td>${i.item_name || i.item_id}</td>
                <td>${i.remaining}</td>
              </tr>
            `
                    )
                    .join("")
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
    alert("Failed to load remaining inventory");
  } finally {
    hideLoader();
  }
};

/* ================= DEBOUNCE ================= */
function debounce(fn, delay = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}