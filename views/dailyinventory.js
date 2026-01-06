import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* =========================================================
   LOADER HELPERS (GLOBAL)
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
let inventoryItems = [];
let dailyInventoryCache = [];
let quantities = {};
let editDailyId = null;

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

/* =========================================================
   ENTRY POINT
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
  loadDailyInventory(); // 🔥 loader is inside
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

  el("addTodayBtn").onclick = () => {
    quantities = {};
    openAddEditModal();
  };
}

/* =========================================================
   LOAD DATA (WITH LOADER)
========================================================= */
async function loadDailyInventory() {
  showLoader("Loading daily inventory…");

  try {
    dailyInventoryCache = await jsonp({ type: "dailyInventory" });
    renderTable();
  } catch (err) {
    console.error(err);
    alert("Failed to load daily inventory.");
  } finally {
    hideLoader();
  }
}

/* =========================================================
   TABLE RENDER
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

/* =========================================================
   JSONP HELPER
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