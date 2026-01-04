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

function groupByDateAndLocation(data) {
  const map = {};

  data.forEach(d => {
    const dateKey = new Date(d.date).toDateString();
    const key = `${dateKey}|${d.location || ""}`;

    if (!map[key]) {
      map[key] = {
        date: d.date,
        location: d.location || "",
        created_by: d.created_by,
        entries: []
      };
    }

    map[key].entries.push(d);
  });

  return Object.values(map);
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
              <th>Stocked Inventories</th>
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
  dailyInventoryCache = await (
    await fetch(API_URL + "?type=dailyInventory")
  ).json();
  renderTable();
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = el("dailyInventoryBody");
  tbody.innerHTML = "";

  const grouped = groupByDateAndLocation(dailyInventoryCache).filter(g =>
    formatDate(g.date).toLowerCase().includes(searchDate) &&
    (g.location || "").toLowerCase().includes(searchLocation)
  );

  if (!grouped.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#888">
          No daily inventory found
        </td>
      </tr>
    `;
    return;
  }

  grouped.forEach((g, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${formatDate(g.date)}</td>
        <td>
          <button class="btn-view"
            onclick="viewDailyGroup('${g.date}','${g.location}')">
            View (${g.entries.length})
          </button>
        </td>
        <td>${g.location}</td>
        <td>${g.created_by}</td>
      </tr>
    `;
  });
}

/* ================= VIEW GROUP ================= */
window.viewDailyGroup = async function (date, location) {
  const entries = dailyInventoryCache.filter(d =>
    new Date(d.date).toDateString() === new Date(date).toDateString() &&
    (d.location || "") === (location || "")
  );

  let html = `
    <div class="modal-header">
      Inventory for ${formatDate(date)} — ${location}
    </div>
  `;

  for (const entry of entries) {
    const items = await (
      await fetch(
        API_URL + `?type=dailyInventoryItems&daily_id=${entry.daily_id}`
      )
    ).json();

    const totalCapital = items.reduce((s, i) => s + Number(i.capital || 0), 0);
    const totalEarnings = items.reduce((s, i) => s + Number(i.earnings || 0), 0);
    const net = totalEarnings - totalCapital;

    html += `
      <div style="margin-bottom:14px;padding:12px;border:1px solid #ddd;border-radius:8px">
        <b>Document No:</b> ${entry.dn}
        <div style="margin-top:6px">
          Capital: ₱${totalCapital.toFixed(2)} |
          Earnings: ₱${totalEarnings.toFixed(2)} |
          <b style="color:${net >= 0 ? "#1b8f3c" : "#c0392b"}">
            Net: ₱${net.toFixed(2)}
          </b>
        </div>

        <button class="btn-view"
          onclick="viewDaily('${entry.daily_id}')">
          View Details
        </button>

        ${
          isToday(entry.date)
            ? `<button class="btn-edit"
                 onclick="editDaily('${entry.daily_id}')">
                 Edit
               </button>`
            : ""
        }
      </div>
    `;
  }

  html += `
    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `;

  openModal(html, true);
};

/* ================= VIEW SINGLE ================= */
window.viewDaily = async function (dailyId) {
  const header = dailyInventoryCache.find(d => d.daily_id === dailyId);

  const items = await (
    await fetch(API_URL + `?type=dailyInventoryItems&daily_id=${dailyId}`)
  ).json();

  const inventory = await (
    await fetch(API_URL + "?type=inventoryItems")
  ).json();

  const nameMap = {};
  inventory.forEach(i => (nameMap[i.item_id] = i.item_name));

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
            const capital = Number(i.capital || 0);
            const earnings = Number(i.earnings || 0);
            const net = earnings - capital;

            return `
              <tr>
                <td>${nameMap[i.item_id] || "Unknown"}</td>
                <td>${i.qty}</td>
                <td>${i.total}</td>
                <td>₱${capital.toFixed(2)}</td>
                <td>₱${earnings.toFixed(2)}</td>
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
  `, true);
};

/* ================= EDIT ================= */
window.editDaily = async function (dailyId) {
  editDailyId = dailyId;

  inventoryItems = await (
    await fetch(API_URL + "?type=inventoryItems")
  ).json();

  const existing = await (
    await fetch(
      API_URL + `?type=dailyInventoryItems&daily_id=${dailyId}`
    )
  ).json();

  quantities = {};
  existing.forEach(i => {
    quantities[i.item_id] = Number(i.qty) || 0;
  });

  openAddEditModal();
};

/* ================= ADD / EDIT MODAL ================= */
async function openAddEditModal() {
  if (!inventoryItems.length) {
    inventoryItems = await (
      await fetch(API_URL + "?type=inventoryItems")
    ).json();
  }

  const existing = editDailyId
    ? dailyInventoryCache.find(d => d.daily_id === editDailyId)
    : null;

  openModal(`
    <div class="modal-header">
      ${editDailyId ? "Edit Daily Inventory" : "Add Today's Inventory"}
    </div>

    <label>Date</label>
    <input value="${formatDate(new Date().toISOString())}" disabled>

    <label>Location</label>
    <input id="locationInput" value="${existing?.location || ""}">

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
  `, true);

  Object.keys(quantities).forEach(id => chg(id, 0));
}

/* ================= CALCULATIONS ================= */
window.chg = function (id, d) {
  quantities[id] = Math.max(0, (quantities[id] || 0) + d);

  let totalCapital = 0;
  let totalEarnings = 0;

  inventoryItems.forEach(i => {
    const qty = quantities[i.item_id] || 0;
    const capital = qty * Number(i.capital || 0);
    const earnings = qty * Number(i.selling_price || 0);
    const net = earnings - capital;

    el(`q-${i.item_id}`).textContent = qty;
    el(`t-${i.item_id}`).textContent =
      qty * Number(i.quantity_per_serving || 0);
    el(`c-${i.item_id}`).textContent = capital.toFixed(2);
    el(`e-${i.item_id}`).textContent = earnings.toFixed(2);
    el(`n-${i.item_id}`).textContent = net.toFixed(2);
    el(`n-${i.item_id}`).style.color =
      net >= 0 ? "#1b8f3c" : "#c0392b";

    totalCapital += capital;
    totalEarnings += earnings;
  });

  el("gt-capital").textContent = totalCapital.toFixed(2);
  el("gt-earnings").textContent = totalEarnings.toFixed(2);
  el("gt-net").textContent =
    (totalEarnings - totalCapital).toFixed(2);
};

/* ================= SAVE ================= */
window.saveDaily = function () {
  const location = el("locationInput");
  if (!location.value.trim()) {
    alert("Location is required");
    return;
  }

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

  if (!items.length) {
    alert("No inventory entered");
    return;
  }

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

window.cancelDaily = function () {
  editDailyId = null;
  quantities = {};
  closeModal();
};