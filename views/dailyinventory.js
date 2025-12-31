import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let inventoryItems = [];
let quantities = {};
let dailyInventoryCache = [];
let editDailyId = null; // 🔑 TRACK EDIT MODE

/* ================= ENTRY ================= */
export default function loadDailyInventoryView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addTodayBtn" class="category-action-btn">
      + Add today's Inventory
    </button>
  `;

  document.getElementById("addTodayBtn").onclick = () => openAddEditModal();

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

/* ================= LOAD LIST ================= */
async function loadDailyInventory() {
  const res = await fetch(API_URL + "?type=dailyInventory");
  dailyInventoryCache = await res.json();

  const tbody = document.getElementById("dailyInventoryBody");
  tbody.innerHTML = "";

  if (!dailyInventoryCache.length) {
    tbody.innerHTML = `
      <tr><td colspan="6" style="color:#888;">No daily inventory yet</td></tr>
    `;
    return;
  }

  dailyInventoryCache.forEach((row, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${row.date}</td>
        <td>${row.dn}</td>
        <td>
          <button class="btn-view" onclick="viewDaily('${row.daily_id}')">View</button>
          <button class="btn-view" onclick="editDaily('${row.daily_id}')">Edit</button>
        </td>
        <td>${row.location || ""}</td>
        <td>${row.created_by}</td>
      </tr>
    `;
  });
}

/* ================= VIEW ================= */
window.viewDaily = async dailyId => {
  const header = dailyInventoryCache.find(d => d.daily_id === dailyId);
  const res = await fetch(
    API_URL + `?type=dailyInventoryItems&daily_id=${dailyId}`
  );
  const items = await res.json();

  openModal(`
    <div class="modal-header">Daily Inventory</div>

    <div class="modal-section">
      <div class="form-grid">
        <div><label>Date</label><input value="${header.date}" disabled></div>
        <div><label>Location</label><input value="${header.location || ""}" disabled></div>
      </div>
    </div>

    <div class="modal-section">
      <div class="section-title">Inventory</div>
      <div class="inventory-modal-box">
        <table class="inventory-table">
          ${items.map(i => `
            <tr>
              <td>${i.item_name}</td>
              <td style="text-align:center">${i.qty}</td>
            </tr>
          `).join("")}
        </table>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
};

/* ================= EDIT ================= */
window.editDaily = async dailyId => {
  editDailyId = dailyId;

  const header = dailyInventoryCache.find(d => d.daily_id === dailyId);

  inventoryItems = await (await fetch(API_URL + "?type=inventoryItems")).json();
  const existing = await (await fetch(
    API_URL + `?type=dailyInventoryItems&daily_id=${dailyId}`
  )).json();

  quantities = {};
  existing.forEach(i => (quantities[i.item_id] = i.qty));

  openAddEditModal(header);
};

/* ================= ADD / EDIT MODAL ================= */
async function openAddEditModal(header = null) {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  if (!inventoryItems.length) {
    inventoryItems = await (await fetch(API_URL + "?type=inventoryItems")).json();
  }

  openModal(`
    <div class="modal-header">
      ${editDailyId ? "Edit Daily Inventory" : "Add Today's Inventory"}
    </div>

    <div class="modal-section">
      <div class="form-grid">
        <div>
          <label>Date</label>
          <input value="${header ? header.date : today}" disabled>
        </div>
        <div>
          <label>Location</label>
          <select id="locationSelect">
            <option value="">-- Select location --</option>
          </select>
        </div>
      </div>
    </div>

    <div class="modal-section">
      <div class="section-title">Inventory</div>
      <div class="inventory-modal-box">
        <table class="inventory-table">
          ${inventoryItems.map(i => `
            <tr>
              <td>${i.item_name}</td>
              <td class="qty-col">
                <button class="qty-btn" onclick="chg('${i.item_id}',-1)">−</button>
                <span id="q-${i.item_id}" class="qty-value">${quantities[i.item_id] || 0}</span>
                <button class="qty-btn" onclick="chg('${i.item_id}',1)">+</button>
              </td>
            </tr>
          `).join("")}
        </table>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveDaily()">Save</button>
      <button class="btn-back" onclick="cancelDaily()">Cancel</button>
    </div>
  `);

  if (header?.location) {
    document.getElementById("locationSelect").value = header.location;
  }
}

/* ================= HELPERS ================= */
window.chg = (id, d) => {
  quantities[id] = Math.max(0, (quantities[id] || 0) + d);
  document.getElementById(`q-${id}`).textContent = quantities[id];
};

window.cancelDaily = () => {
  editDailyId = null;
  quantities = {};
  closeModal();
};

/* ================= SAVE (ADD OR EDIT) ================= */
window.saveDaily = () => {
  const items = Object.entries(quantities)
    .filter(([, q]) => q > 0)
    .map(([item_id, qty]) => ({ item_id, qty }));

  if (!items.length) {
    alert("No inventory entered");
    return;
  }

  const location = document.getElementById("locationSelect")?.value || "";

  let url =
    API_URL +
    `?action=${editDailyId ? "editDailyInventory" : "addDailyInventory"}` +
    `&location=${encodeURIComponent(location)}` +
    `&created_by=ADMIN` +
    `&items=${encodeURIComponent(JSON.stringify(items))}`;

  // 🔑 THIS LINE PREVENTS NEW RECORD CREATION
  if (editDailyId) {
    url += `&daily_id=${editDailyId}`;
  }

  new Image().src = url;

  editDailyId = null;
  closeModal();
  setTimeout(loadDailyInventory, 700);
};