import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= JSONP ================= */
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
let locations = [];
let dailyInventoryCache = [];
let quantities = {};

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
          <button class="btn-view">
            View (${g.entries.length})
          </button>
        </td>
        <td>${g.location}</td>
        <td>${g.created_by}</td>
      </tr>
    `;
  });
}

/* ======================================================
   ADD DAILY INVENTORY — LOCATION AWARE (IMPROVED UI)
====================================================== */
window.openAddEditModal = async function () {
  inventoryItems = await jsonp({ type: "inventoryItems" });
  locations = await jsonp({ type: "locations" });

  openModal(`
    <div class="modal-header">📦 Add Today's Inventory</div>

    <label>Location</label>
    <select id="dailyLocation">
      <option value="">-- Select Location --</option>
      ${locations
        .filter(l => l.active)
        .map(l =>
          `<option value="${l.location_id}">
            ${l.location_name}
          </option>`
        ).join("")}
    </select>

    <div class="inventory-modal-body">
      <input
        id="inventorySearch"
        placeholder="Search inventory..."
        class="inventory-search"
      />

      <div class="inventory-scroll" id="inventoryList"></div>
    </div>

    <div class="inventory-modal-footer">
      <button class="btn-back" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="saveDailyInventory()">Confirm</button>
    </div>
  `, true);

  renderInventoryRows();
};

/* ================= INVENTORY ROWS ================= */
function renderInventoryRows() {
  const list = el("inventoryList");
  const keyword = el("inventorySearch")?.value.toLowerCase() || "";

  list.innerHTML = "";

  inventoryItems
    .filter(i => i.item_name.toLowerCase().includes(keyword))
    .forEach(i => {
      quantities[i.item_id] ??= 0;

      const row = document.createElement("div");
      row.className = "inventory-row";

      row.innerHTML = `
        <div class="inv-name">
          ${i.item_name}
          <small>${i.unit || ""}</small>
        </div>

        <div class="inv-controls">
          <button onclick="updateQty('${i.item_id}', -1)">−</button>
          <span>${quantities[i.item_id]}</span>
          <button onclick="updateQty('${i.item_id}', 1)">+</button>
        </div>
      `;

      list.appendChild(row);
    });

  el("inventorySearch").oninput = renderInventoryRows;
}

/* ================= QTY CONTROL ================= */
window.updateQty = function (id, delta) {
  quantities[id] = Math.max(0, (quantities[id] || 0) + delta);
  renderInventoryRows();
};

/* ================= SAVE ================= */
window.saveDailyInventory = function () {
  const location = el("dailyLocation").value;

  if (!location) {
    alert("Please select a location");
    return;
  }

  const items = Object.entries(quantities)
    .filter(([_, q]) => q > 0)
    .map(([item_id, qty]) => ({
      item_id,
      qty,
      total: 0,
      capital: 0,
      earnings: 0
    }));

  if (!items.length) {
    alert("No quantities entered");
    return;
  }

  jsonp({
    action: "addDailyInventory",
    items: JSON.stringify(items),
    location: location,
    created_by: localStorage.getItem("userName")
  }).then(() => {
    closeModal();
    loadDailyInventory();
  });
};