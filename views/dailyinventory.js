import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* =========================================================
   LOADER HELPERS
========================================================= */
function showLoader(text = "Loading data…") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;
  loader.querySelector(".loader-text").textContent = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;
  loader.classList.add("hidden");
}

/* =========================================================
   STATE
========================================================= */
let dailyInventoryCache = [];
let searchDate = "";
let searchLocation = "";

/* =========================================================
   HELPERS
========================================================= */
const el = id => document.getElementById(id);

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function groupByDateAndLocation(data) {
  if (!Array.isArray(data)) return [];

  const map = {};
  data.forEach(d => {
    if (!d || !d.date) return;

    const key = `${new Date(d.date).toDateString()}|${d.location || ""}`;

    if (!map[key]) {
      map[key] = {
        date: d.date,
        location: d.location || "",
        created_by: d.created_by || "",
        entries: []
      };
    }

    map[key].entries.push(d);
  });

  return Object.values(map);
}

function getStaffId() {
  return localStorage.getItem("staff_id") || "ADMIN";
}

function getLocationId() {
  return localStorage.getItem("userLocation") || "";
}

/* =========================================================
   ENTRY
========================================================= */
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

/* =========================================================
   ACTION BAR
========================================================= */
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

  el("addTodayBtn").onclick = openAddEditModal;
}

/* =========================================================
   LOAD DAILY INVENTORY
========================================================= */
async function loadDailyInventory() {
  showLoader("Loading daily inventory…");

  try {
    const res = await jsonp({ type: "dailyInventory" });

    if (res?.success === false) {
      alert(res.error);
      dailyInventoryCache = [];
    } else if (Array.isArray(res)) {
      dailyInventoryCache = res;
    } else {
      dailyInventoryCache = [];
    }

    renderTable();
  } catch (err) {
    console.error(err);
    alert("Failed to load daily inventory");
  } finally {
    hideLoader();
  }
}

/* =========================================================
   TABLE
========================================================= */
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
            onclick="viewDailyGroup('${encodeURIComponent(g.date)}','${encodeURIComponent(g.location)}')">
            View (${g.entries.length})
          </button>
        </td>
        <td>${g.location || "-"}</td>
        <td>${g.created_by || "-"}</td>
      </tr>
    `;
  });
}

/* =========================================================
   JSONP
========================================================= */
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

/* =========================================================
   VIEW DAILY GROUP
========================================================= */
window.viewDailyGroup = async function (date, locationId) {
  showLoader("Loading remaining inventory…");

  try {
    const res = await fetch(
      API_URL +
        `?type=dailyRemainingInventory` +
        `&date=${decodeURIComponent(date)}` +
        `&location=${decodeURIComponent(locationId)}`
    );

    const data = await res.json();
    renderDailyInventoryModal(data, decodeURIComponent(date));
  } catch (err) {
    console.error(err);
    alert("Failed to load remaining inventory");
  } finally {
    hideLoader();
  }
};

/* =========================================================
   MODAL — REMAINING INVENTORY
========================================================= */
function renderDailyInventoryModal(data, date) {
  openModal(
    `
    <div class="modal-header">
      Remaining Inventory — ${formatDate(date)}
    </div>

    <div class="inventory-scroll">
      <table class="inventory-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Remaining</th>
          </tr>
        </thead>
        <tbody>
          ${
            !Array.isArray(data) || !data.length
              ? `<tr><td colspan="2" style="text-align:center;color:#888">No data</td></tr>`
              : data.map(
                  i => `
                  <tr>
                    <td>${i.item_name || i.item_id}</td>
                    <td>${i.remaining}</td>
                  </tr>
                `
                ).join("")
          }
        </tbody>
      </table>
    </div>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `,
    true
  );
}

/* =========================================================
   ADD TODAY'S INVENTORY (FULLY WORKING)
========================================================= */
async function openAddEditModal() {
  showLoader("Loading inventory items…");

  try {
    const items = await fetch(`${API_URL}?type=inventoryItems`).then(r => r.json());

    openModal(
      `
      <div class="modal-header">Add Today's Inventory</div>

      <div class="inventory-scroll" style="max-height:60vh">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td>${i.item_name}</td>
                <td>
                  <input type="number"
                         min="0"
                         class="daily-qty"
                         data-item="${i.item_id}"
                         style="width:80px">
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="modal-actions">
        <button class="btn-danger" onclick="submitDailyInventory()">Save</button>
        <button class="btn-back" onclick="closeModal()">Cancel</button>
      </div>
    `,
      true
    );
  } finally {
    hideLoader();
  }
}

window.submitDailyInventory = async function () {
  const inputs = document.querySelectorAll(".daily-qty");
  const items = [];

  inputs.forEach(i => {
    const qty = Number(i.value);
    if (qty > 0) {
      items.push({
        item_id: i.dataset.item,
        qty
      });
    }
  });

  if (!items.length) {
    alert("Please enter at least one quantity");
    return;
  }

  showLoader("Saving inventory…");

  try {
    const qs = [
      `action=addDailyInventory`,
      `location=${encodeURIComponent(getLocationId())}`,
      `created_by=${encodeURIComponent(getStaffId())}`,
      `items=${encodeURIComponent(JSON.stringify(items))}`
    ].join("&");

    const res = await fetch(`${API_URL}?${qs}`).then(r => r.json());

    if (!res.success) throw new Error(res.error);

    closeModal();
    loadDailyInventory();
    alert("✅ Daily inventory saved");
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
};