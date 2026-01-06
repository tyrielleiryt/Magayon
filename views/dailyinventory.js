import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

const STAFF_ID = localStorage.getItem("staff_id");
const LOCATION = localStorage.getItem("userLocation");

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
let quantities = {};
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
              <th>Entries</th>
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

/* ================= LOAD ================= */
async function loadDailyInventory() {
  showLoader("Loading daily inventory…");

  try {
    const res = await jsonp({ type: "dailyInventory" });
    dailyInventoryCache = Array.isArray(res) ? res : [];
    renderTable();
  } finally {
    hideLoader();
  }
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = el("dailyInventoryBody");
  tbody.innerHTML = "";

  if (!dailyInventoryCache.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888">No data</td></tr>`;
    return;
  }

  dailyInventoryCache.forEach((d, i) => {
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

/* ================= ADD TODAY ================= */
async function openAddTodayModal() {
  showLoader("Loading inventory items…");
  inventoryItems = await fetch(`${API_URL}?type=inventoryItems`).then(r => r.json());
  hideLoader();

  quantities = {};

  openModal(
    `
    <div class="modal-header">Add Today's Inventory</div>

    <div style="max-height:300px;overflow:auto">
      ${inventoryItems
        .map(
          i => `
        <div style="display:flex;gap:10px;margin-bottom:6px">
          <div style="flex:1">${i.item_name}</div>
          <input type="number" min="0"
            data-id="${i.item_id}"
            style="width:80px"
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
}

/* ================= SAVE ================= */
function saveDailyInventory() {
  const inputs = document.querySelectorAll("[data-id]");
  const items = [];

  inputs.forEach(i => {
    const qty = Number(i.value);
    if (qty > 0) {
      items.push({
        item_id: i.dataset.id,
        qty
      });
    }
  });

  if (!items.length) {
    alert("No quantities entered");
    return;
  }

  showLoader("Saving daily inventory…");

  new Image().src =
    `${API_URL}?action=addDailyInventory` +
    `&location=${LOCATION}` +
    `&created_by=${STAFF_ID}` +
    `&items=${encodeURIComponent(JSON.stringify(items))}`;

  closeModal();
  setTimeout(loadDailyInventory, 700);
}

/* ================= JSONP ================= */
function jsonp(params) {
  return new Promise(resolve => {
    const cb = "cb_" + Date.now();
    window[cb] = d => {
      delete window[cb];
      script.remove();
      resolve(d);
    };

    const qs = Object.entries({ ...params, callback: cb })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const script = document.createElement("script");
    script.src = `${API_URL}?${qs}`;
    document.body.appendChild(script);
  });
}