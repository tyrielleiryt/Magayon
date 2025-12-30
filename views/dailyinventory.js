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
    <button id="addTodayBtn" class="category-action-btn">+ Add today's Inventory</button>
  `;

  document.getElementById("addTodayBtn").onclick = openAddTodayModal;

  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
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

  bindDataBoxScroll(contentBox.querySelector(".data-box"));
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
      <tr>
        <td colspan="6" style="text-align:center;color:#888;">
          No daily inventory yet
        </td>
      </tr>
    `;
    return;
  }

  dailyInventoryCache.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${row.date}</td>
      <td>${row.dn}</td>
      <td>
        <button class="btn-view" data-id="${row.daily_id}">View</button>
        <button class="btn-edit" data-id="${row.daily_id}">Edit</button>
      </td>
      <td>${row.location || ""}</td>
      <td>${row.created_by}</td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-view").forEach(btn => {
    btn.onclick = () => openViewModal(btn.dataset.id);
  });

  document.querySelectorAll(".btn-edit").forEach(btn => {
    btn.onclick = () => openEditDailyModal(btn.dataset.id);
  });
}

/* ================= VIEW MODAL ================= */
async function openViewModal(dailyId) {
  const header = dailyInventoryCache.find(d => d.daily_id === dailyId);
  if (!header) return;

  const res = await fetch(
    API_URL + `?type=dailyInventoryItems&daily_id=${dailyId}`
  );
  const items = await res.json();

  const rows = items.length
    ? items.map(i => `
        <tr>
          <td>${i.item_name}</td>
          <td style="text-align:center;">${i.qty}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="2" style="text-align:center;color:#888;">No items</td></tr>`;

  openModal(`
    <div class="modal-header">📋 Daily Inventory Details</div>

    <label>Date</label>
    <input value="${header.date}" disabled>

    <label>DN</label>
    <input value="${header.dn}" disabled>

    <label>Location</label>
    <input value="${header.location || ""}" disabled>

    <label>Created By</label>
    <input value="${header.created_by}" disabled>

    <label>Inventory</label>
    <div class="inventory-modal-box">
      <table class="category-table inventory-table">
        <thead>
          <tr><th>Item</th><th style="width:120px;">Qty</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
}

/* ================= EDIT DAILY INVENTORY ================= */
async function openEditDailyModal(dailyId) {
  const header = dailyInventoryCache.find(d => d.daily_id === dailyId);
  if (!header) return;

  const invRes = await fetch(API_URL + "?type=inventoryItems");
  inventoryItems = await invRes.json();

  const itemsRes = await fetch(
    API_URL + `?type=dailyInventoryItems&daily_id=${dailyId}`
  );
  const existingItems = await itemsRes.json();

  quantities = {};
  existingItems.forEach(i => {
    quantities[i.item_id] = i.qty;
  });

  const rows = inventoryItems.map(item => {
    const qty = quantities[item.item_id] || 0;
    return `
      <tr>
        <td>${item.item_name}</td>
        <td class="qty-col">
          <button class="qty-btn" data-id="${item.item_id}" data-op="-">−</button>
          <span id="qty-${item.item_id}" class="qty-value">${qty}</span>
          <button class="qty-btn" data-id="${item.item_id}" data-op="+">+</button>
        </td>
      </tr>
    `;
  }).join("");

  openModal(`
    <div class="modal-header">✏️ Edit Daily Inventory</div>

    <label>Date</label>
    <input value="${header.date}" disabled>

    <label>Location</label>
    <select id="locationSelect">
      <option value="">-- Select location --</option>
    </select>

    <label>Inventory</label>
    <div class="inventory-modal-box">
      <table class="category-table inventory-table">
        <thead>
          <tr><th>Item</th><th style="width:140px;">Qty</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="modal-actions">
      <button id="saveEditDaily" class="btn-danger">Save Changes</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.querySelectorAll(".qty-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const op = btn.dataset.op;
      quantities[id] = quantities[id] || 0;
      if (op === "+" && quantities[id] < 999) quantities[id]++;
      if (op === "-" && quantities[id] > 0) quantities[id]--;
      document.getElementById(`qty-${id}`).textContent = quantities[id];
    };
  });

  document.getElementById("saveEditDaily").onclick = () => {
    const items = Object.keys(quantities)
      .filter(id => quantities[id] > 0)
      .map(id => ({ item_id: id, qty: quantities[id] }));

    if (!items.length) {
      alert("Inventory cannot be empty");
      return;
    }

    const location =
      document.getElementById("locationSelect")?.value || "";

    const img = new Image();
    img.src =
      API_URL +
      `?action=editDailyInventory` +
      `&daily_id=${dailyId}` +
      `&location=${encodeURIComponent(location)}` +
      `&items=${encodeURIComponent(JSON.stringify(items))}`;

    closeModal();
    setTimeout(loadDailyInventory, 700);
  };
}

/* ================= ADD TODAY MODAL ================= */
async function openAddTodayModal() {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const res = await fetch(API_URL + "?type=inventoryItems");
  inventoryItems = await res.json();
  quantities = {};

  const rows = inventoryItems.map(item => `
    <tr>
      <td>${item.item_name}</td>
      <td class="qty-col">
        <button class="qty-btn" data-id="${item.item_id}" data-op="-">−</button>
        <span id="qty-${item.item_id}" class="qty-value">0</span>
        <button class="qty-btn" data-id="${item.item_id}" data-op="+">+</button>
      </td>
    </tr>
  `).join("");

  openModal(`
    <div class="modal-header">📦 Add Today's Inventory</div>

    <label>Date</label>
    <input value="${today}" disabled>

    <label>Location</label>
    <select id="locationSelect">
      <option value="">-- Select location --</option>
    </select>

    <label>Inventory</label>
    <div class="inventory-modal-box">
      <table class="category-table inventory-table">
        <thead>
          <tr><th>Item</th><th style="width:140px;">Qty</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="modal-actions">
      <button id="saveToday" class="btn-danger">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.querySelectorAll(".qty-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const op = btn.dataset.op;
      quantities[id] = quantities[id] || 0;
      if (op === "+" && quantities[id] < 999) quantities[id]++;
      if (op === "-" && quantities[id] > 0) quantities[id]--;
      document.getElementById(`qty-${id}`).textContent = quantities[id];
    };
  });

  document.getElementById("saveToday").onclick = () => {
    const items = Object.keys(quantities)
      .filter(id => quantities[id] > 0)
      .map(id => ({ item_id: id, qty: quantities[id] }));

    if (!items.length) {
      alert("Please enter at least one inventory quantity");
      return;
    }

    const location =
      document.getElementById("locationSelect")?.value || "";

    const img = new Image();
    img.src =
      API_URL +
      `?action=addDailyInventory` +
      `&location=${encodeURIComponent(location)}` +
      `&created_by=ADMIN` +
      `&items=${encodeURIComponent(JSON.stringify(items))}`;

    closeModal();
    setTimeout(loadDailyInventory, 700);
  };
}