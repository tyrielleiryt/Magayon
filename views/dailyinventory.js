import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

/* ================= DEFAULT EXPORT ================= */
export default function loadDailyInventoryView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <button id="addTodayBtn">+ Add today's Inventory</button>
    <button disabled>Edit Inventory</button>
    <button disabled>Inventory Items List</button>
  `;

  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table" style="min-width:1200px">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>DN</th>
              <th>Receiver</th>
              <th>Position</th>
              <th>Inventory</th>
              <th>Location</th>
              <th>Created By</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="9" style="text-align:center;color:#888;">
                No daily inventory yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="data-scroll-controls">
        <button class="scroll-left">◀</button>
        <button class="scroll-right">▶</button>
      </div>
    </div>
  `;

  bindDataBoxScroll(contentBox.querySelector(".data-box"));
  document.getElementById("addTodayBtn").onclick = openAddTodayInventoryModal;
}

/* ================= MODAL ================= */
function openAddTodayInventoryModal() {
  openModal(`
    <div class="modal-header">📦 Add Today’s Inventory</div>

    <label>Date</label>
    <input type="date" value="${new Date().toISOString().slice(0,10)}" disabled>

    <label>Location</label>
    <input placeholder="(select later)" disabled>

    <div style="margin-top:12px;font-weight:bold;">Inventory Items</div>

    <div class="data-scroll" style="max-height:260px;">
      <table class="category-table">
        <thead>
          <tr>
            <th>Item</th>
            <th style="width:80px;">Qty</th>
          </tr>
        </thead>
        <tbody id="dailyItemsBody"></tbody>
      </table>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" id="saveTodayInv">Save</button>
      <button class="btn-back" id="cancelTodayInv">Cancel</button>
    </div>
  `);

  loadInventoryItemsForToday();

  document.getElementById("cancelTodayInv").onclick = closeModal;
  document.getElementById("saveTodayInv").onclick = saveTodayInventory;
}

/* ================= LOAD ITEMS ================= */
async function loadInventoryItemsForToday() {
  const res = await fetch(API_URL + "?type=inventoryItems");
  const items = await res.json();
  const tbody = document.getElementById("dailyItemsBody");

  if (!tbody) return;
  tbody.innerHTML = "";

  items.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.item_name}</td>
      <td>
        <input type="number" min="0" value="0"
          data-id="${item.item_id}"
          data-cap="${item.capital}"
          data-price="${item.selling_price}">
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ================= SAVE (FINAL & CORRECT) ================= */
function saveTodayInventory() {
  const inputs = document.querySelectorAll("#dailyItemsBody input");
  const items = [];

  inputs.forEach(input => {
    const qty = Number(input.value);
    if (qty > 0) {
      const capital = qty * Number(input.dataset.cap);
      const total = qty * Number(input.dataset.price);

      items.push({
        item_id: input.dataset.id,
        qty,
        capital,
        total,
        earnings: total - capital
      });
    }
  });

  if (!items.length) {
    alert("Please enter at least one item");
    return;
  }

  const params = new URLSearchParams({
    action: "addDailyInventory",
    date: new Date().toISOString().slice(0, 10),
    created_by: "ADMIN",
    items: JSON.stringify(items) // ✅ DO NOT encode
  });

  new Image().src = API_URL + "?" + params.toString();

  closeModal();
  alert("Daily inventory saved ✅");
}