import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

const STAFF_ID = localStorage.getItem("staff_id");

/* ================= LOADER ================= */
function showLoader(text = "Loading…") {
  const l = document.getElementById("globalLoader");
  if (!l) return;
  l.querySelector(".loader-text").textContent = text;
  l.classList.remove("hidden");
}
function hideLoader() {
  document.getElementById("globalLoader")?.classList.add("hidden");
}

/* ================= STATE ================= */
let dailyInventoryCache = [];
let inventoryItems = [];
let locations = [];
let searchDate = "";
let searchLocation = "";

const el = id => document.getElementById(id);

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
              <th>Daily ID</th>
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
    <input id="searchDateInput" placeholder="Search date" />
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

  el("addTodayBtn").onclick = openAddTodayModal;
}

/* ================= LOAD DAILY INVENTORY ================= */
async function loadDailyInventory() {
  showLoader("Loading daily inventory…");

  try {
    const res = await jsonp({ type: "dailyInventory" });
    dailyInventoryCache = Array.isArray(res) ? res : [];
    renderTable();
  } catch (err) {
    console.error(err);
    alert("Failed to load daily inventory");
  } finally {
    hideLoader();
  }
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = el("dailyInventoryBody");
  tbody.innerHTML = "";

  const filtered = dailyInventoryCache.filter(d =>
    (!searchDate ||
      new Date(d.date)
        .toLocaleDateString()
        .toLowerCase()
        .includes(searchDate)) &&
    (!searchLocation ||
      (d.location || "").toLowerCase().includes(searchLocation))
  );

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#888">
          No daily inventory found
        </td>
      </tr>`;
    return;
  }

  filtered.forEach((d, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(d.date).toLocaleDateString()}</td>
        <td>${d.daily_id}</td>
        <td>${d.location}</td>
        <td>${d.created_by}</td>
      </tr>
    `;
  });
}

/* ================= ADD TODAY INVENTORY ================= */
async function openAddTodayModal() {
  showLoader("Loading inventory & locations…");

  try {
    const [items, locs] = await Promise.all([
      fetch(`${API_URL}?type=inventoryItems`).then(r => r.json()),
      loadLocationsSafe()
    ]);

    if (!Array.isArray(items) || !Array.isArray(locs) || !locs.length) {
      alert("Inventory or locations failed to load.");
      return;
    }

    inventoryItems = items;
    locations = locs;

    openModal(
      `
      <div class="modal-header">Add Today's Inventory</div>

      <label>Location</label>
      <select id="dailyLocation">
        ${locations
          .map(
            l =>
              `<option value="${l.location_id}">
                ${l.location_name}
              </option>`
          )
          .join("")}
      </select>

      <div style="max-height:320px;overflow:auto;margin-top:12px">
        ${inventoryItems
          .map(
            i => `
          <div style="display:flex;gap:10px;margin-bottom:6px">
            <div style="flex:1">${i.item_name}</div>
            <input type="number" min="0"
              data-id="${i.item_id}"
              style="width:90px"
              placeholder="Qty">
          </div>
        `
          )
          .join("")}
      </div>

      <div class="modal-actions">
        <button class="btn-danger" id="saveDaily">Save</button>
        <button class="btn-back" onclick="closeModal()">Cancel</button>
      </div>
      `,
      true
    );

    document.getElementById("saveDaily").onclick = saveDailyInventory;

  } catch (err) {
    console.error(err);
    alert("Failed to load inventory or locations.");
  } finally {
    hideLoader();
  }
}

/* ================= SAVE DAILY INVENTORY ================= */
function saveDailyInventory() {
  const location = document.getElementById("dailyLocation")?.value;
  if (!location) return alert("Please select a location");

  const inputs = document.querySelectorAll("[data-id]");
  const items = [];

  inputs.forEach(i => {
    const qty = Number(i.value);
    if (qty > 0) {
      items.push({ item_id: i.dataset.id, qty });
    }
  });

  if (!items.length) {
    alert("No quantities entered");
    return;
  }

  showLoader("Saving daily inventory…");

  new Image().src =
    `${API_URL}?action=addDailyInventory` +
    `&location=${encodeURIComponent(location)}` +
    `&created_by=${encodeURIComponent(STAFF_ID)}` +
    `&items=${encodeURIComponent(JSON.stringify(items))}`;

  closeModal();
  setTimeout(loadDailyInventory, 700);
}

/* ================= LOAD LOCATIONS (SAFE) ================= */
async function loadLocationsSafe() {
  const res = await fetch(`${API_URL}?type=locations`).then(r => r.json());

  if (!Array.isArray(res)) {
    console.error("Invalid locations response:", res);
    return [];
  }

  return res.filter(l => l.active === true);
}

/* ================= JSONP ================= */
function jsonp(params) {
  return new Promise(resolve => {
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
    document.body.appendChild(script);
  });
}