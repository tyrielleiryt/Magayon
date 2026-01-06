import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

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
export default function loadDailySalesView() {
  renderActionBar();
  renderLayout();

  const today = new Date().toISOString().slice(0, 10);
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
                Select a date and click Load Report
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
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
}

/* ================= LOAD SALES ================= */
async function loadSales() {
  const date = document.getElementById("salesDate").value;
  const location = document.getElementById("salesLocation").value.trim();

  if (!date) return alert("Select a date");

  showLoader("Loading sales report…");

  try {
    const res = await fetch(
      `${API_URL}?type=dailySalesReport&date=${date}&location=${encodeURIComponent(location)}`
    );

    const data = await res.json();
    renderTable(data);
  } catch (err) {
    console.error(err);
    alert("Failed to load report");
  } finally {
    hideLoader();
  }
}

/* ================= RENDER ================= */
function renderTable(rows) {
  const tbody = document.getElementById("salesBody");
  tbody.innerHTML = "";

  let gross = 0, capital = 0, net = 0;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#888">
          No sales found
        </td>
      </tr>`;
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
        <td>${r.product_name}</td>
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
function updateTotals(g, c, n) {
  document.getElementById("sumGross").textContent = g.toFixed(2);
  document.getElementById("sumCapital").textContent = c.toFixed(2);
  document.getElementById("sumNet").textContent = n.toFixed(2);
}