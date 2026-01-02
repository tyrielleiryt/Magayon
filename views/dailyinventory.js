import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let dailyHeaders = [];
let inventoryItems = [];
let quantities = {};
let editDailyId = null;

let currentPage = 1;
const PAGE_SIZE = 10;

/* ================= HELPERS ================= */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  const t = new Date();
  return d.toDateString() === t.toDateString();
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
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
  loadDailyInventory();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <button class="category-action-btn" id="addTodayBtn">
      + Add Today's Inventory
    </button>
  `;

  addTodayBtn.onclick = () => openAddEditModal();
}

/* ================= LOAD ================= */
async function loadDailyInventory() {
  dailyHeaders = await fetch(
    API_URL + "?type=dailyInventory"
  ).then(r => r.json());

  renderTable();
}

/* ================= TABLE ================= */
async function renderTable() {
  const tbody = document.getElementById("dailyInventoryBody");
  tbody.innerHTML = "";

  if (!dailyHeaders.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:#888">
          No daily inventory yet
        </td>
      </tr>`;
    return;
  }

  for (let i = 0; i < dailyHeaders.length; i++) {
    const h = dailyHeaders[i];
    const canEdit = isToday(h.date);

    const items = await fetch(
      API_URL + `?type=dailyInventoryItems&daily_id=${h.daily_id}`
    ).then(r => r.json());

    let capital = 0;
    let earnings = 0;

    items.forEach(it => {
      capital += Number(it.capital) || 0;
      earnings += Number(it.earnings) || 0;
    });

    const profit = earnings - capital;

    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${formatDate(h.date)}</td>
        <td>${h.dn}</td>
        <td>
          <button class="btn-view" onclick="viewDaily('${h.daily_id}')">View</button>
          <button class="btn-edit" ${!canEdit ? "disabled" : ""}
            onclick="editDaily('${h.daily_id}')">Edit</button>
        </td>
        <td>₱${capital.toFixed(2)}</td>
        <td>₱${earnings.toFixed(2)}</td>
        <td style="font-weight:bold;color:${profit >= 0 ? "#1b8f3c" : "#c0392b"}">
          ₱${profit.toFixed(2)}
        </td>
      </tr>
    `;
  }
}

/* ================= VIEW ================= */
window.viewDaily = async id => {
  const header = dailyHeaders.find(d => d.daily_id === id);
  const items = await fetch(
    API_URL + `?type=dailyInventoryItems&daily_id=${id}`
  ).then(r => r.json());

  const inventory = await fetch(
    API_URL + "?type=inventoryItems"
  ).then(r => r.json());

  const map = {};
  inventory.forEach(i => (map[i.item_id] = i.item_name));

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
            <td>${map[i.item_id]}</td>
            <td>${i.qty}</td>
            <td>${i.total}</td>
            <td>₱${Number(i.capital).toFixed(2)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
};

/* ================= EDIT ================= */
window.editDaily = async id => {
  editDailyId = id;
  quantities = {};

  inventoryItems = await fetch(
    API_URL + "?type=inventoryItems"
  ).then(r => r.json());

  const existing = await fetch(
    API_URL + `?type=dailyInventoryItems&daily_id=${id}`
  ).then(r => r.json());

  existing.forEach(i => {
    quantities[i.item_id] = i.qty;
  });

  openAddEditModal();
};

/* ================= ADD / EDIT MODAL ================= */
async function openAddEditModal() {
  if (!inventoryItems.length) {
    inventoryItems = await fetch(
      API_URL + "?type=inventoryItems"
    ).then(r => r.json());
  }

  openModal(`
    <div class="modal-header">
      ${editDailyId ? "Edit Daily Inventory" : "Add Today's Inventory"}
    </div>

    <table class="inventory-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
        </tr>
      </thead>
      <tbody>
        ${inventoryItems.map(i => `
          <tr>
            <td>${i.item_name}</td>
            <td>
              <button onclick="chg('${i.item_id}',-1)">−</button>
              <span id="q-${i.item_id}">${quantities[i.item_id] || 0}</span>
              <button onclick="chg('${i.item_id}',1)">+</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveDaily()">Save</button>
      <button class="btn-back" onclick="cancelDaily()">Cancel</button>
    </div>
  `);
}

/* ================= QTY ================= */
window.chg = (id, d) => {
  quantities[id] = Math.max(0, (quantities[id] || 0) + d);
  document.getElementById(`q-${id}`).textContent = quantities[id];
};

/* ================= SAVE ================= */
window.saveDaily = () => {
  const items = Object.entries(quantities)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({ item_id: id, qty }));

  if (!items.length) return alert("No inventory entered");

  let url =
    API_URL +
    `?action=${editDailyId ? "editDailyInventory" : "addDailyInventory"}` +
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