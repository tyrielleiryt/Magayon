import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let inventoryItems = [];
let quantities = {};
let dailyInventoryCache = [];
let editDailyId = null;

let currentPage = 1;
const PAGE_SIZE = 10;
let searchDate = "";
let searchLocation = "";

/* ================= HELPERS ================= */
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

/* ================= ENTRY ================= */
export default function loadDailyInventoryView() {
  renderActionBar();

  document.getElementById("contentBox").innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>DN</th>
              <th>Inventory</th>
              <th>Total Qty</th>
              <th>Capital</th>
              <th>Earnings</th>
              <th>Profit</th>
              <th>Location</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody id="dailyInventoryBody"></tbody>
        </table>
      </div>
      <div id="pagination" style="padding:10px;text-align:center;"></div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
  loadDailyInventory();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <input id="searchDateInput" placeholder="Search date (e.g. December)" />
    <input id="searchLocationInput" placeholder="Search location" />

    <button id="addTodayBtn" class="category-action-btn">
      + Add Today's Inventory
    </button>

    <button id="exportExcelBtn" class="category-action-btn">
      ⬇ Export Excel
    </button>

    <button id="exportPdfBtn" class="category-action-btn">
      📄 Export PDF
    </button>
  `;

  document.getElementById("addTodayBtn").onclick = () => openAddEditModal();

  document.getElementById("exportExcelBtn").onclick = exportToExcel;
  document.getElementById("exportPdfBtn").onclick = exportToPDF;

  searchDateInput.oninput = e => {
    searchDate = e.target.value.toLowerCase();
    currentPage = 1;
    renderTable();
  };

  searchLocationInput.oninput = e => {
    searchLocation = e.target.value.toLowerCase();
    currentPage = 1;
    renderTable();
  };
}

/* ================= LOAD ================= */
async function loadDailyInventory() {
  dailyInventoryCache = await (await fetch(API_URL + "?type=dailyInventory")).json();
  renderTable();
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = document.getElementById("dailyInventoryBody");
  const pagination = document.getElementById("pagination");

  tbody.innerHTML = "";
  pagination.innerHTML = "";

  const filtered = dailyInventoryCache.filter(r =>
    formatDate(r.date).toLowerCase().includes(searchDate) &&
    (r.location || "").toLowerCase().includes(searchLocation)
  );

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;color:#888">No data</td>
      </tr>
    `;
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;

  filtered.slice(start, start + PAGE_SIZE).forEach((r, i) => {
    const canEdit = isToday(r.date);

    tbody.innerHTML += `
      <tr>
        <td>${start + i + 1}</td>
        <td>${formatDate(r.date)}</td>
        <td>${r.dn}</td>

        <td>
          <button class="btn-view" onclick="viewDaily('${r.daily_id}')">View</button>
          <button class="btn-edit" ${!canEdit ? "disabled" : ""}
            onclick="editDaily('${r.daily_id}')">Edit</button>
          <button class="btn-delete" ${!canEdit ? "disabled" : ""}
            onclick="deleteDaily('${r.daily_id}')">Delete</button>
        </td>

        <td>${r.total_qty || 0}</td>
        <td>₱${Number(r.total_capital || 0).toFixed(2)}</td>
        <td>₱${Number(r.total_earnings || 0).toFixed(2)}</td>
        <td style="font-weight:bold;color:${(r.total_profit || 0) >= 0 ? "#1b8f3c" : "#c0392b"}">
          ₱${Number(r.total_profit || 0).toFixed(2)}
        </td>

        <td>${r.location || ""}</td>
        <td>${r.created_by}</td>
      </tr>
    `;
  });

  for (let i = 1; i <= totalPages; i++) {
    const b = document.createElement("button");
    b.textContent = i;
    b.className = "btn-view";
    if (i === currentPage) b.style.background = "#f3c84b";
    b.onclick = () => { currentPage = i; renderTable(); };
    pagination.appendChild(b);
  }
}

/* ================= VIEW ================= */
window.viewDaily = async id => {
  const header = dailyInventoryCache.find(d => d.daily_id === id);

  // 1️⃣ Load daily inventory items
  const items = await (await fetch(
    API_URL + `?type=dailyInventoryItems&daily_id=${id}`
  )).json();

  // 2️⃣ Load inventory master list
  const inventory = await (await fetch(
    API_URL + "?type=inventoryItems"
  )).json();

  // 3️⃣ Build item_id → item_name map
  const itemMap = {};
  inventory.forEach(i => {
    itemMap[i.item_id] = i.item_name;
  });

  // 4️⃣ Render modal
  openModal(`
    <div class="modal-header">Daily Inventory</div>

    <label>Date</label>
    <input value="${formatDate(header.date)}" disabled>

    <label>Location</label>
    <input value="${header.location || ""}" disabled>

    <table class="inventory-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Total</th>
          <th>Capital</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td>${itemMap[i.item_id] || "⚠ Unknown Item"}</td>
            <td>${i.qty}</td>
            <td>${i.total}</td>
            <td>₱${Number(i.earnings).toFixed(2)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
};

/* ================= ADD / EDIT ================= */
async function openAddEditModal(header = null) {
  if (!inventoryItems.length) {
    inventoryItems = await (await fetch(API_URL + "?type=inventoryItems")).json();
  }

  openModal(`
    <div class="modal-header">
      ${editDailyId ? "Edit Daily Inventory" : "Add Today's Inventory"}
    </div>

    <label>Date</label>
    <input value="${formatDate(new Date())}" disabled>

    <label>Location</label>
    <input id="locationSelect">

    <div style="margin:16px 0;font-weight:bold;border-bottom:1px solid #ddd">
      📦 Inventory Items
    </div>

    <div class="inventory-modal-box" style="max-height:280px;overflow:auto">
      <table class="inventory-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Total</th>
            <th>Capital</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryItems.map(i => `
            <tr>
              <td>${i.item_name}</td>
              <td>
                <button class="qty-btn" onclick="chg('${i.item_id}',-1)">−</button>
                <span id="q-${i.item_id}">0</span>
                <button class="qty-btn" onclick="chg('${i.item_id}',1)">+</button>
              </td>
              <td id="t-${i.item_id}">0</td>
              <td>₱<span id="c-${i.item_id}">0.00</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveDaily()">Save Inventory</button>
      <button class="btn-back" onclick="cancelDaily()">Cancel</button>
    </div>
  `);
}

/* ================= CALCULATIONS ================= */
window.chg = (id, d) => {
  quantities[id] = Math.max(0, (quantities[id] || 0) + d);
  const item = inventoryItems.find(i => i.item_id === id);
  if (!item) return;

  const qty = quantities[id];
  const total = qty * (Number(item.quantity_per_serving) || 0);
  const capital = total * (Number(item.capital) || 0);

  q(id).textContent = qty;
  t(id).textContent = total;
  c(id).textContent = capital.toFixed(2);
};

const q = id => document.getElementById(`q-${id}`);
const t = id => document.getElementById(`t-${id}`);
const c = id => document.getElementById(`c-${id}`);

/* ================= SAVE ================= */
window.saveDaily = () => {
  const items = Object.entries(quantities)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => {
      const i = inventoryItems.find(x => x.item_id === id);
      const total = qty * (Number(i.quantity_per_serving) || 0);
      return {
        item_id: id,
        qty,
        total,
        earnings: total * (Number(i.capital) || 0)
      };
    });

  if (!items.length) return alert("No inventory entered");

  new Image().src =
    API_URL +
    `?action=addDailyInventory` +
    `&location=${encodeURIComponent(locationSelect.value)}` +
    `&created_by=ADMIN` +
    `&items=${encodeURIComponent(JSON.stringify(items))}`;

  quantities = {};
  closeModal();
  setTimeout(loadDailyInventory, 700);
};

window.cancelDaily = () => {
  quantities = {};
  closeModal();
};

/* ================= EXPORT ================= */
function exportToExcel() {
  let csv = "Date,DN,Total Qty,Capital,Earnings,Profit,Location\n";
  dailyInventoryCache.forEach(r => {
    csv += `"${formatDate(r.date)}","${r.dn}",${r.total_qty || 0},${r.total_capital || 0},${r.total_earnings || 0},${r.total_profit || 0},"${r.location || ""}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "daily_inventory.csv";
  a.click();
}

function exportToPDF() {
  window.print();
}