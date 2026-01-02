import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let dailyInventoryCache = [];
let dailyItemsCache = [];
let inventoryItems = [];
let quantities = {};
let editDailyId = null;

let currentPage = 1;
const PAGE_SIZE = 10;
let searchDate = "";
let searchLocation = "";

/* ================= HELPERS ================= */
function formatDate(dateStr) {
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

/* 🔢 Compute totals PER DAILY INVENTORY */
function getTotalsByInventoryId(id) {
  const rows = dailyItemsCache.filter(r => r.inventory_id === id);

  let capital = 0;
  let earnings = 0;

  rows.forEach(r => {
    capital += Number(r.capital) || 0;
    earnings += Number(r.earnings) || 0;
  });

  return {
    capital,
    earnings,
    profit: earnings - capital
  };
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
              <th>Capital</th>
              <th>Earnings</th>
              <th>Profit</th>
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

    <button class="category-action-btn" id="addTodayBtn">
      + Add Today's Inventory
    </button>

    <button class="category-action-btn" id="exportExcelBtn">
      ⬇ Export Excel
    </button>

    <button class="category-action-btn" id="exportPdfBtn">
      📄 Export PDF
    </button>
  `;

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

  addTodayBtn.onclick = () => openAddEditModal();
  exportExcelBtn.onclick = exportToExcel;
  exportPdfBtn.onclick = () => window.print();
}

/* ================= LOAD ================= */
async function loadDailyInventory() {
  const [headers, items] = await Promise.all([
    fetch(API_URL + "?type=dailyInventory").then(r => r.json()),
    fetch(API_URL + "?type=dailyInventoryItems").then(r => r.json())
  ]);

  dailyInventoryCache = headers;
  dailyItemsCache = items;

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
        <td colspan="7" style="text-align:center;color:#888">
          No daily inventory found
        </td>
      </tr>`;
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;

  filtered.slice(start, start + PAGE_SIZE).forEach((r, i) => {
    const canEdit = isToday(r.date);
    const t = getTotalsByInventoryId(r.daily_id);

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

        <td>₱${t.capital.toFixed(2)}</td>
        <td>₱${t.earnings.toFixed(2)}</td>
        <td style="font-weight:bold;color:${t.profit >= 0 ? "#1b8f3c" : "#c0392b"}">
          ₱${t.profit.toFixed(2)}
        </td>
      </tr>
    `;
  });

  for (let i = 1; i <= totalPages; i++) {
    const b = document.createElement("button");
    b.textContent = i;
    b.className = "btn-view";
    if (i === currentPage) b.style.background = "#f3c84b";
    b.onclick = () => {
      currentPage = i;
      renderTable();
    };
    pagination.appendChild(b);
  }
}

/* ================= VIEW ================= */
window.viewDaily = async id => {
  const header = dailyInventoryCache.find(d => d.daily_id === id);
  const items = dailyItemsCache.filter(i => i.inventory_id === id);

  const inventory = await fetch(API_URL + "?type=inventoryItems").then(r => r.json());
  const map = {};
  inventory.forEach(i => map[i.item_id] = i.item_name);

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
            <td>${map[i.item_id] || "Unknown Item"}</td>
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

/* ================= EXPORT ================= */
function exportToExcel() {
  let csv = "Date,DN,Capital,Earnings,Profit,Location\n";

  dailyInventoryCache.forEach(r => {
    const t = getTotalsByInventoryId(r.daily_id);
    csv += `"${formatDate(r.date)}","${r.dn}",${t.capital},${t.earnings},${t.profit},"${r.location || ""}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "daily_inventory.csv";
  a.click();
}