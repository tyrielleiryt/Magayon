import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= JSONP HELPER ================= */
function jsonp(params) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Date.now();
    window[cb] = data => {
      delete window[cb];
      script.remove();
      resolve(data);
    };

    const qs = Object.entries({ ...params, callback: cb })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const script = document.createElement("script");
    script.src = `${API_URL}?${qs}`;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

/* ================= STATE ================= */
let inventoryItems = [];
let dailyInventoryCache = [];
let quantities = {};
let editDailyId = null;

let searchDate = "";
let searchLocation = "";

/* ================= HELPERS ================= */
const el = id => document.getElementById(id);

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function isToday(d) {
  const a = new Date(d);
  const b = new Date();
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function groupByDateAndLocation(data) {
  const map = {};
  data.forEach(d => {
    const key = `${new Date(d.date).toDateString()}|${d.location || ""}`;
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
  dailyInventoryCache = await jsonp({ type: "dailyInventory" });
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

/* ================= SALES CHECK ================= */
async function hasSalesForDay(date, location) {
  const res = await jsonp({
    type: "dailySalesReport",
    date,
    location
  });
  return res.length > 0;
}

/* ================= VIEW GROUP ================= */
window.viewDailyGroup = async function (date, location) {
  const entries = dailyInventoryCache.filter(d =>
    new Date(d.date).toDateString() === new Date(date).toDateString() &&
    (d.location || "") === (location || "")
  );

  const salesExist = await hasSalesForDay(date, location);

  let html = `
    <div class="modal-header">
      Inventory for ${formatDate(date)} — ${location}
    </div>
  `;

  for (const e of entries) {
    html += `
      <div style="margin-bottom:12px;padding:10px;border:1px solid #ddd;border-radius:6px">
        <button class="btn-view" onclick="viewDaily('${e.daily_id}')">
          View Details
        </button>
        ${
          isToday(e.date) && !salesExist
            ? `<button class="btn-edit" onclick="editDaily('${e.daily_id}')">Edit</button>`
            : `<div style="color:#999;margin-top:6px">Editing locked</div>`
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

/* ======================================================
   ✅ ORIGINAL ADD DAILY INVENTORY UI (RESTORED)
====================================================== */
window.openAddEditModal = async function () {
  inventoryItems = await jsonp({ type: "inventoryItems" });

  let rows = inventoryItems.map(i => `
    <tr>
      <td>${i.item_name}</td>
      <td>${i.unit || ""}</td>
      <td>
        <input type="number" min="0" value="0"
          onchange="quantities['${i.item_id}']=Number(this.value)">
      </td>
    </tr>
  `).join("");

  openModal(`
    <div class="modal-header">Add Today's Inventory</div>
    <table class="category-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Unit</th>
          <th>Quantity</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="modal-actions">
      <button class="btn-danger" onclick="saveDailyInventory()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `, true);
};

window.saveDailyInventory = function () {
  const items = Object.entries(quantities)
    .filter(([_, q]) => q > 0)
    .map(([item_id, qty]) => ({
      item_id,
      qty,
      total: 0,
      capital: 0,
      earnings: 0
    }));

  if (!items.length) return alert("No quantities entered");

  jsonp({
    action: "addDailyInventory",
    items: JSON.stringify(items),
    location: localStorage.getItem("userLocation"),
    created_by: localStorage.getItem("userName")
  }).then(() => {
    closeModal();
    loadDailyInventory();
  });
};