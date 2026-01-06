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
   LOAD DAILY INVENTORY (ROBUST)
========================================================= */
async function loadDailyInventory() {
  showLoader("Loading daily inventory…");

  try {
    const res = await jsonp({ type: "dailyInventory" });

    // 🔴 GAS ERROR RESPONSE
    if (res?.success === false) {
      console.error("GAS error:", res.error);
      dailyInventoryCache = [];
      alert("Daily inventory backend error:\n" + res.error);
      renderTable();
      return;
    }

    // 🛡️ NOT ARRAY
    if (!Array.isArray(res)) {
      console.error("Invalid dailyInventory response:", res);
      dailyInventoryCache = [];
      alert("Invalid daily inventory response from server.");
      renderTable();
      return;
    }

    dailyInventoryCache = res;
    renderTable();

  } catch (err) {
    console.error(err);
    alert("Failed to load daily inventory.");
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
  showLoader("Loading daily inventory…");

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
    alert("Failed to load daily inventory");
  } finally {
    hideLoader();
  }
};

/* =========================================================
   MODAL
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
              ? `<tr><td colspan="2" style="text-align:center;color:#888">No remaining inventory</td></tr>`
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
   ADD DAILY INVENTORY (PLACEHOLDER)
========================================================= */
function openAddEditModal() {
  openModal(
    `
    <div class="modal-header">Add Today's Inventory</div>
    <p style="font-size:14px;color:#555">
      Daily inventory entry is not yet implemented.
    </p>
    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `,
    true
  );
}