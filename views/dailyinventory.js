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
let dailyInventory = [];
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
              <th>Inventory</th>
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
    const res = await fetch(`${API_URL}?type=dailyInventory`);
    const data = await res.json();

    dailyInventory = Array.isArray(data) ? data : [];
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

  const filtered = dailyInventory.filter(d =>
    (!searchDate ||
      new Date(d.date).toLocaleDateString().toLowerCase().includes(searchDate)) &&
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
    const dayKey = new Date(d.date).toLocaleDateString("en-CA");

    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(d.date).toLocaleDateString()}</td>
        <td>
          <button class="btn-view"
            onclick="viewDailyInventory('${dayKey}','${d.location}')">
            View
          </button>
        </td>
        <td>${d.location}</td>
        <td>${d.created_by || "-"}</td>
      </tr>
    `;
  });
}

/* ================= VIEW DAILY INVENTORY ITEMS ================= */
window.viewDailyInventory = async function (date, location) {
  showLoader("Loading inventory…");

  try {
    const res = await fetch(
      `${API_URL}?type=dailyInventoryItems` +
      `&date=${encodeURIComponent(date)}` +
      `&location=${encodeURIComponent(location)}`
    );

    const items = await res.json();

    openModal(
      `
      <div class="modal-header">
        Inventory — ${date}
      </div>

      <div class="inventory-scroll">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Total Added</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            ${
              !Array.isArray(items) || !items.length
                ? `<tr>
                     <td colspan="3" style="text-align:center;color:#888">
                       No data
                     </td>
                   </tr>`
                : items.map(i => `
                    <tr>
                      <td>${i.item_name}</td>
                      <td>${Number(i.qty_added) || 0}</td>
                      <td>${Number(i.remaining) || 0}</td>
                    </tr>
                  `).join("")
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
  } catch (err) {
    console.error(err);
    alert("Failed to load inventory");
  } finally {
    hideLoader();
  }
};

/* ================= ADD TODAY INVENTORY ================= */
async function openAddTodayModal() {
  showLoader("Loading data…");

  try {
    [inventoryItems, locations] = await Promise.all([
      fetch(`${API_URL}?type=inventoryItems&callback=?`).then(r => r.json()),
      fetch(`${API_URL}?type=locations&callback=?`).then(r => r.json())
    ]);

    locations = locations.filter(l => l.active);

    openModal(
      `
      <div class="modal-header">Add Today's Inventory</div>

      <label>Location</label>
      <select id="dailyLocation">
        ${locations.map(
          l => `<option value="${l.location_id}">${l.location_name}</option>`
        ).join("")}
      </select>

      <div style="max-height:320px;overflow:auto;margin-top:12px">
        ${inventoryItems.map(i => `
          <div style="display:flex;gap:10px;margin-bottom:6px">
            <div style="flex:1">${i.item_name}</div>
            <input type="number" min="0"
              data-id="${i.item_id}"
              style="width:90px"
              placeholder="Qty">
          </div>
        `).join("")}
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
    alert("Failed to load data");
  } finally {
    hideLoader();
  }
}

/* ================= SAVE DAILY INVENTORY ================= */
function saveDailyInventory() {
  const location = document.getElementById("dailyLocation")?.value;
  if (!location) return alert("Select location");

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

  showLoader("Saving inventory…");

  fetch(
    `${API_URL}?action=addDailyInventory` +
      `&location=${encodeURIComponent(location)}` +
      `&created_by=${encodeURIComponent(STAFF_ID)}` +
      `&items=${encodeURIComponent(JSON.stringify(items))}`
  )
    .then(r => r.json())
    .then(res => {
      if (!res.success) {
        alert(res.error);
        return;
      }
      closeModal();
      loadDailyInventory();
    })
    .finally(hideLoader);
}