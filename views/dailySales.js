import { bindDataBoxScroll } from "../admin.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let productMap = {};   // product_id → product_name
let locationMap = {};  // location_id → location_name

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

  // 🔒 SAFE preload
  await loadProducts();
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
  `;
  document.getElementById("loadSalesBtn").onclick = loadSales;
}

/* ================= LAYOUT ================= */
function renderLayout() {
  document.getElementById("contentBox").innerHTML = `
    <div class="data-box" style="display:flex;flex-direction:column;height:100%">
      <div class="data-scroll" style="flex:1;overflow-y:auto;">
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

/* ================= LOAD PRODUCTS ================= */
async function loadProducts() {
  try {
    const res = await fetch(`${API_URL}?type=products`);
    const data = await res.json();
    data.forEach(p => {
      productMap[p.product_id] = p.product_name;
    });
  } catch (err) {
    console.warn("Failed to load products", err);
  }
}

/* ================= LOAD LOCATIONS ================= */
async function loadLocations() {
  try {
    const res = await fetch(`${API_URL}?type=locations`);
    const data = await res.json();
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
  // ✅ compute transaction total from items
  const transactionTotal = (o.items || []).reduce(
    (sum, it) => sum + (Number(it.total) || 0),
    0
  );

  grandTotal += transactionTotal;

  tbody.insertAdjacentHTML("beforeend", `
    <tr style="background:#f4f4f4;font-weight:600">
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

    // 🔸 PRODUCT ROWS (NAME FIRST)
    (o.items || []).forEach(item => {
      const name =
        productMap[item.product_id] ||
        item.product_name ||
        item.product_id;

      tbody.insertAdjacentHTML("beforeend", `
        <tr>
          <td></td>
          <td>${product_name}</td>
          <td>${item.qty}</td>
          <td></td>
          <td>₱${Number(item.total).toFixed(2)}</td>
        </tr>
      `);
    });

    // 🔹 TRANSACTION TOTAL ROW
    tbody.insertAdjacentHTML("beforeend", `
      <tr style="font-weight:600;border-top:1px solid #ddd">
        <td></td>
        <td style="text-align:right">Transaction Total:</td>
        <td></td>
        <td></td>
        <td>₱${transactionTotal.toFixed(2)}</td>
      </tr>
    `);
  });

  updateTotals(grandTotal);
}

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