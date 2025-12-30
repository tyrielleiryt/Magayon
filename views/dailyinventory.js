import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let inventoryItems = [];
let quantities = {};

/* ================= ENTRY ================= */
export default function loadDailyInventoryView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addTodayBtn">+ Add today's Inventory</button>
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
  const data = await res.json();

  const tbody = document.getElementById("dailyInventoryBody");
  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#888;">
          No daily inventory yet
        </td>
      </tr>
    `;
    return;
  }

  data.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${row.date}</td>
      <td>${row.dn}</td>
      <td><button class="btn-view">View</button></td>
      <td>${row.location || ""}</td>
      <td>${row.created_by}</td>
    `;
    tbody.appendChild(tr);
  });
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

  const rows = inventoryItems
    .map(
      item => `
      <tr>
        <td>${item.item_name}</td>
        <td class="qty-col">
          <button class="qty-btn" data-id="${item.item_id}" data-op="-">−</button>
          <span id="qty-${item.item_id}" class="qty-value">0</span>
          <button class="qty-btn" data-id="${item.item_id}" data-op="+">+</button>
        </td>
      </tr>
    `
    )
    .join("");

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
          <tr>
            <th>Item</th>
            <th style="width:140px;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <div class="modal-actions">
      <button id="saveToday" class="btn-danger">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  /* ===== Qty Controls ===== */
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

  /* ================= SAVE LOGIC ================= */
  document.getElementById("saveToday").onclick = () => {
    const items = [];

    Object.keys(quantities).forEach(id => {
      if (quantities[id] > 0) {
        items.push({
          item_id: id,
          qty: quantities[id]
        });
      }
    });

    if (!items.length) {
      alert("Please enter at least one inventory quantity");
      return;
    }

    const location =
      document.getElementById("locationSelect")?.value || "";

    // 🔑 CORS-safe save
    const img = new Image();
    img.src =
      API_URL +
      `?action=addDailyInventory` +
      `&location=${encodeURIComponent(location)}` +
      `&created_by=ADMIN` +
      `&items=${encodeURIComponent(JSON.stringify(items))}`;

    closeModal();

    // refresh list after save
    setTimeout(loadDailyInventory, 700);
  };
}