import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let inventoryItems = [];
let quantities = {};
let dailyInventoryCache = [];

/* ================= ENTRY ================= */
export default function loadDailyInventoryView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addTodayBtn" class="category-action-btn">
      + Add today's Inventory
    </button>
  `;

  document.getElementById("addTodayBtn").onclick = openAddTodayModal;

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
          <button class="btn-view" onclick="view('${row.daily_id}')">View</button>
          <button class="btn-view" onclick="edit('${row.daily_id}')">Edit</button>
        </td>
        <td>${row.location || ""}</td>
        <td>${row.created_by}</td>
      </tr>
    `;
  });
}

/* ================= VIEW ================= */
window.view = async dailyId => {
  const header = dailyInventoryCache.find(d => d.daily_id === dailyId);
  const res = await fetch(API_URL + `?type=dailyInventoryItems&daily_id=${dailyId}`);
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
            <tr><td>${i.item_name}</td><td style="text-align:center">${i.qty}</td></tr>
          `).join("")}
        </table>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
};

/* ================= EDIT / ADD ================= */
window.edit = openAddTodayModal;

/* ================= ADD TODAY ================= */
async function openAddTodayModal() {
  const today = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });

  inventoryItems = await (await fetch(API_URL + "?type=inventoryItems")).json();
  quantities = {};

  openModal(`
    <div class="modal-header">Add Today's Inventory</div>

    <div class="modal-section">
      <div class="form-grid">
        <div><label>Date</label><input value="${today}" disabled></div>
        <div><label>Location</label><select id="locationSelect"></select></div>
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
                <span id="q-${i.item_id}" class="qty-value">0</span>
                <button class="qty-btn" onclick="chg('${i.item_id}',1)">+</button>
              </td>
            </tr>
          `).join("")}
        </table>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" onclick="save()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

/* ================= HELPERS ================= */
window.chg = (id, d) => {
  quantities[id] = Math.max(0, (quantities[id] || 0) + d);
  document.getElementById(`q-${id}`).textContent = quantities[id];
};

window.save = () => {
  const items = Object.entries(quantities)
    .filter(([,q]) => q > 0)
    .map(([id,qty]) => ({ item_id:id, qty }));

  if (!items.length) return alert("No inventory entered");

  new Image().src =
    API_URL +
    `?action=addDailyInventory&items=${encodeURIComponent(JSON.stringify(items))}`;

  closeModal();
  setTimeout(loadDailyInventory, 600);
};