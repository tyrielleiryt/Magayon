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
    <input
      id="searchDate"
      placeholder="Search date (e.g. December)"
      style="padding:8px;border-radius:6px;border:1px solid #bbb"
    />
    <input
      id="searchLocation"
      placeholder="Search location"
      style="padding:8px;border-radius:6px;border:1px solid #bbb"
    />

    <button id="addTodayBtn" class="category-action-btn">
      + Add Today's Inventory
    </button>
  `;

  document.getElementById("addTodayBtn").onclick = () => openAddEditModal();

  document.getElementById("searchDate").oninput = e => {
    searchDate = e.target.value.toLowerCase();
    currentPage = 1;
    renderTable();
  };

  document.getElementById("searchLocation").oninput = e => {
    searchLocation = e.target.value.toLowerCase();
    currentPage = 1;
    renderTable();
  };
}

/* ================= LOAD ================= */
async function loadDailyInventory() {
  const res = await fetch(API_URL + "?type=dailyInventory");
  dailyInventoryCache = await res.json();
  renderTable();
}

/* ================= RENDER TABLE ================= */
function renderTable() {
  const tbody = document.getElementById("dailyInventoryBody");
  const pagination = document.getElementById("pagination");

  tbody.innerHTML = "";
  pagination.innerHTML = "";

  const filtered = dailyInventoryCache.filter(row => {
    const dateMatch = formatDate(row.date).toLowerCase().includes(searchDate);
    const locMatch = (row.location || "").toLowerCase().includes(searchLocation);
    return dateMatch && locMatch;
  });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#888">
          No daily inventory found
        </td>
      </tr>
    `;
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  pageItems.forEach((row, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${start + i + 1}</td>
        <td>${formatDate(row.date)}</td>
        <td>${row.dn}</td>
        <td>
          <button class="btn-view" onclick="viewDaily('${row.daily_id}')">View</button>
          <button class="btn-edit" onclick="editDaily('${row.daily_id}')">Edit</button>
          <button class="btn-delete" onclick="deleteDaily('${row.daily_id}')">Delete</button>
        </td>
        <td>${row.location || ""}</td>
        <td>${row.created_by}</td>
      </tr>
    `;
  });

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = "btn-view";
    if (i === currentPage) btn.style.background = "#f3c84b";

    btn.onclick = () => {
      currentPage = i;
      renderTable();
    };

    pagination.appendChild(btn);
  }
}

/* ================= VIEW ================= */
window.viewDaily = async dailyId => {
  const header = dailyInventoryCache.find(d => d.daily_id === dailyId);
  const res = await fetch(
    API_URL + `?type=dailyInventoryItems&daily_id=${dailyId}`
  );
  const items = await res.json();

  openModal(`
    <div class="modal-header">Daily Inventory</div>

    <label>Date</label>
    <input value="${formatDate(header.date)}" disabled>

    <label>Location</label>
    <input value="${header.location || ""}" disabled>

    <div class="inventory-modal-box">
      <table class="inventory-table">
        ${items.map(i => `
          <tr>
            <td>${i.item_name}</td>
            <td style="text-align:center">${i.qty}</td>
          </tr>
        `).join("")}
      </table>
    </div>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
};

/* ================= EDIT ================= */
window.editDaily = async dailyId => {
  editDailyId = dailyId;

  const header = dailyInventoryCache.find(d => d.daily_id === dailyId);

  inventoryItems = await (await fetch(API_URL + "?type=inventoryItems")).json();
  const existing = await (await fetch(
    API_URL + `?type=dailyInventoryItems&daily_id=${dailyId}`
  )).json();

  quantities = {};
  existing.forEach(i => (quantities[i.item_id] = i.qty));

  openAddEditModal(header);
};

/* ================= DELETE ================= */
window.deleteDaily = dailyId => {
  if (!confirm("Are you sure you want to delete this daily inventory?")) return;

  new Image().src =
    API_URL + `?action=deleteDailyInventory&daily_id=${dailyId}`;

  setTimeout(loadDailyInventory, 700);
};

/* ================= ADD / EDIT MODAL ================= */
async function openAddEditModal(header = null) {
  const today = formatDate(new Date());

  if (!inventoryItems.length) {
    inventoryItems = await (await fetch(API_URL + "?type=inventoryItems")).json();
  }

  openModal(`
    <div class="modal-header">
      ${editDailyId ? "Edit Daily Inventory" : "Add Today's Inventory"}
    </div>

    <label>Date</label>
    <input value="${header ? formatDate(header.date) : today}" disabled>

    <label>Location</label>
    <input id="locationSelect" value="${header?.location || ""}">

    <div style="margin:16px 0 8px;font-weight:bold;border-bottom:1px solid #ddd">
      📦 Add Inventory
    </div>

    <div class="inventory-modal-box" style="max-height:260px;overflow:auto">
      <table class="inventory-table">
        ${inventoryItems.map(i => `
          <tr>
            <td>${i.item_name}</td>
            <td class="qty-col">
              <button class="qty-btn" onclick="chg('${i.item_id}',-1)">−</button>
              <span id="q-${i.item_id}" class="qty-value">${quantities[i.item_id] || 0}</span>
              <button class="qty-btn" onclick="chg('${i.item_id}',1)">+</button>
            </td>
          </tr>
        `).join("")}
      </table>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveDaily()">Save Inventory</button>
      <button class="btn-back" onclick="cancelDaily()">Cancel</button>
    </div>
  `);
}

/* ================= HELPERS ================= */
window.chg = (id, d) => {
  quantities[id] = Math.max(0, (quantities[id] || 0) + d);
  document.getElementById(`q-${id}`).textContent = quantities[id];
};

window.cancelDaily = () => {
  editDailyId = null;
  quantities = {};
  closeModal();
};

/* ================= SAVE ================= */
window.saveDaily = () => {
  const items = Object.entries(quantities)
    .filter(([, q]) => q > 0)
    .map(([item_id, qty]) => ({ item_id, qty }));

  if (!items.length) {
    alert("No inventory entered");
    return;
  }

  const location = document.getElementById("locationSelect").value || "";

  let url =
    API_URL +
    `?action=${editDailyId ? "editDailyInventory" : "addDailyInventory"}` +
    `&location=${encodeURIComponent(location)}` +
    `&created_by=ADMIN` +
    `&items=${encodeURIComponent(JSON.stringify(items))}`;

  if (editDailyId) {
    url += `&daily_id=${editDailyId}`;
  }

  new Image().src = url;

  editDailyId = null;
  closeModal();
  setTimeout(loadDailyInventory, 700);
};