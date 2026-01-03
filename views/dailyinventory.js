import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let inventoryItems = [];
let quantities = {};
let dailyInventoryCache = [];
let editDailyId = null;

let searchDate = "";
let searchLocation = "";

/* ================= HELPERS ================= */
const el = id => document.getElementById(id);

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

/* ================= ENTRY ================= */
export default function loadDailyInventoryView() {
  renderActionBar();

  el("contentBox").innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>DN</th>
              <th>Actions</th>
              <th>Location</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody id="dailyInventoryBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
  loadDailyInventory();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  el("actionBar").innerHTML = `
    <input id="searchDateInput" placeholder="Search date (e.g. December)" />
    <input id="searchLocationInput" placeholder="Search location" />
    <button class="category-action-btn" id="addTodayBtn">
      + Add Today's Inventory
    </button>
  `;

  el("searchDateInput").oninput = e => {
    searchDate = e.target.value.toLowerCase();
    renderTable();
  };

  el("searchLocationInput").oninput = e => {
    searchLocation = e.target.value.toLowerCase();
    renderTable();
  };

  el("addTodayBtn").onclick = () => {
    editDailyId = null;
    quantities = {};
    openAddEditModal();
  };
}

/* ================= LOAD ================= */
async function loadDailyInventory() {
  dailyInventoryCache = await (await fetch(
    API_URL + "?type=dailyInventory"
  )).json();
  renderTable();
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = el("dailyInventoryBody");
  tbody.innerHTML = "";

  const filtered = dailyInventoryCache.filter(r =>
    formatDate(r.date).toLowerCase().includes(searchDate) &&
    (r.location || "").toLowerCase().includes(searchLocation)
  );

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

  filtered.forEach((r, i) => {
    const canEdit = isToday(r.date);

    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${formatDate(r.date)}</td>
        <td>${r.dn}</td>
        <td>
          <button class="btn-view" onclick="viewDaily('${r.daily_id}')">View</button>
          <button class="btn-edit" ${!canEdit ? "disabled" : ""}
            onclick="editDaily('${r.daily_id}')">Edit</button>
        </td>
        <td>${r.location || ""}</td>
        <td>${r.created_by}</td>
      </tr>
    `;
  });
}

/* ================= VIEW ================= */
window.viewDaily = async dailyId => {
  const header = dailyInventoryCache.find(d => d.daily_id === dailyId);

  const items = await (await fetch(
    API_URL + `?type=dailyInventoryItems&daily_id=${dailyId}`
  )).json();

  openModal(`
    <div class="modal-header">Daily Inventory</div>

    <label>Date</label>
    <input value="${formatDate(header.date)}" disabled>

    <label>Location</label>
    <input value="${header.location || ""}" disabled>

    <div class="inventory-scroll">
      <table class="inventory-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Total</th>
            <th>Capital</th>
            <th>Earnings</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => {
            const net = i.earnings - i.capital;
            return `
              <tr>
                <td>${i.item_name}</td>
                <td>${i.qty}</td>
                <td>${i.total}</td>
                <td>₱${i.capital.toFixed(2)}</td>
                <td>₱${i.earnings.toFixed(2)}</td>
                <td style="color:${net >= 0 ? "#1b8f3c" : "#c0392b"}">
                  ₱${net.toFixed(2)}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
};

/* ================= ADD / EDIT ================= */
async function openAddEditModal() {
  if (!inventoryItems.length) {
    inventoryItems = await (await fetch(
      API_URL + "?type=inventoryItems"
    )).json();
  }

  openModal(`
    <div class="modal-header">
      ${editDailyId ? "Edit Daily Inventory" : "Add Today's Inventory"}
    </div>

    <label>Date</label>
    <input value="${formatDate(new Date().toISOString())}" disabled>

    <label>Location</label>
    <input id="locationInput">

    <div class="inventory-scroll">
      <table class="inventory-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Total</th>
            <th>Capital</th>
            <th>Earnings</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryItems.map(i => `
            <tr>
              <td>${i.item_name}</td>
              <td>
                <button class="qty-btn" onclick="chg('${i.item_id}',-1)">−</button>
                <span id="q-${i.item_id}">${quantities[i.item_id] || 0}</span>
                <button class="qty-btn" onclick="chg('${i.item_id}',1)">+</button>
              </td>
              <td id="t-${i.item_id}">0</td>
              <td>₱<span id="c-${i.item_id}">0.00</span></td>
              <td>₱<span id="e-${i.item_id}">0.00</span></td>
              <td>₱<span id="n-${i.item_id}">0.00</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="inventory-summary">
      <div>Capital: ₱<span id="gt-capital">0.00</span></div>
      <div>Earnings: ₱<span id="gt-earnings">0.00</span></div>
      <div><b>Net:</b> ₱<span id="gt-net">0.00</span></div>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveDaily()">Save Inventory</button>
      <button class="btn-back" onclick="cancelDaily()">Cancel</button>
    </div>
  `);

  Object.keys(quantities).forEach(id => chg(id, 0));
}

/* ================= CALCULATIONS ================= */
window.chg = (id, d) => {
  quantities[id] = Math.max(0, (quantities[id] || 0) + d);

  let totalCapital = 0;
  let totalEarnings = 0;

  inventoryItems.forEach(i => {
    const qty = quantities[i.item_id] || 0;

    const total = qty * Number(i.quantity_per_serving || 0);
    const capital = qty * Number(i.capital || 0);
    const earnings = qty * Number(i.selling_price || 0);
    const net = earnings - capital;

    el(`q-${i.item_id}`).textContent = qty;
    el(`t-${i.item_id}`).textContent = total;
    el(`c-${i.item_id}`).textContent = capital.toFixed(2);
    el(`e-${i.item_id}`).textContent = earnings.toFixed(2);
    el(`n-${i.item_id}`).textContent = net.toFixed(2);
    el(`n-${i.item_id}`).style.color = net >= 0 ? "#1b8f3c" : "#c0392b";

    totalCapital += capital;
    totalEarnings += earnings;
  });

  el("gt-capital").textContent = totalCapital.toFixed(2);
  el("gt-earnings").textContent = totalEarnings.toFixed(2);
  el("gt-net").textContent = (totalEarnings - totalCapital).toFixed(2);
};

/* ================= SAVE ================= */
window.saveDaily = () => {
  const location = el("locationInput");
  if (!location.value.trim()) return alert("Location is required");

  const items = Object.entries(quantities)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => {
      const i = inventoryItems.find(x => x.item_id === id);
      return {
        item_id: id,
        qty,
        total: qty * Number(i.quantity_per_serving || 0),
        capital: qty * Number(i.capital || 0),
        earnings: qty * Number(i.selling_price || 0)
      };
    });

  if (!items.length) return alert("No inventory entered");

  let url =
    API_URL +
    `?action=${editDailyId ? "editDailyInventory" : "addDailyInventory"}` +
    `&location=${encodeURIComponent(location.value)}` +
    `&created_by=ADMIN` +
    `&items=${encodeURIComponent(JSON.stringify(items))}`;

  if (editDailyId) url += `&daily_id=${editDailyId}`;

  new Image().src = url;

  editDailyId = null;
  quantities = {};
  closeModal();
  setTimeout(loadDailyInventory, 700);
};

window.cancelDaily = () => {
  editDailyId = null;
  quantities = {};
  closeModal();
};