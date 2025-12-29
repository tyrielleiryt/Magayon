import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= ENTRY ================= */
export default function loadDailyInventoryView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addTodayBtn">+ Add Today’s Inventory</button>
  `;

  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>DN</th>
              <th>Location</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="4" style="text-align:center;color:#888;">
                No daily inventory yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(contentBox.querySelector(".data-box"));
  document.getElementById("addTodayBtn").onclick = openAddTodayModal;
}

/* ================= MODAL ================= */
async function openAddTodayModal() {
  openModal(`
    <div class="modal-header">📦 Add Today’s Inventory</div>

    <label>Date</label>
    <input value="${new Date().toISOString().slice(0, 10)}" readonly>

    <label>Location</label>
    <input id="dailyLocation" placeholder="(coming soon)" disabled>

    <div style="margin-top:14px;font-weight:bold;">Inventory Items</div>

    <div class="data-scroll" style="max-height:260px;margin-top:6px;">
      <table class="category-table">
        <thead>
          <tr>
            <th>Item</th>
            <th style="width:140px;text-align:center;">Qty</th>
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

  document.getElementById("cancelTodayInv").onclick = closeModal;
  document.getElementById("saveTodayInv").onclick = saveTodayInventory;

  loadInventoryItemsForToday();
}

/* ================= LOAD INVENTORY ITEMS ================= */
async function loadInventoryItemsForToday() {
  const res = await fetch(API_URL + "?type=inventoryItems");
  const items = await res.json();
  const tbody = document.getElementById("dailyItemsBody");

  tbody.innerHTML = "";

  items.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${item.item_name}</td>
      <td style="text-align:center;">
        <div style="display:flex;justify-content:center;gap:6px;">
          <button class="qty-btn" data-delta="-1">−</button>
          <input
            type="number"
            min="0"
            value="0"
            data-id="${item.item_id}"
            style="width:60px;text-align:center;"
            readonly
          >
          <button class="qty-btn" data-delta="1">+</button>
        </div>
      </td>
    `;

    const input = tr.querySelector("input");
    tr.querySelectorAll(".qty-btn").forEach(btn => {
      btn.onclick = () => {
        const delta = Number(btn.dataset.delta);
        const next = Math.max(0, Number(input.value) + delta);
        input.value = next;
      };
    });

    tbody.appendChild(tr);
  });
}

/* ================= SAVE DAILY INVENTORY ================= */
function saveTodayInventory() {
  const inputs = document.querySelectorAll("#dailyItemsBody input");
  const items = [];

  inputs.forEach(input => {
    const qty = Number(input.value);
    if (qty > 0) {
      items.push({
        item_id: input.dataset.id,
        qty
      });
    }
  });

  if (!items.length) {
    alert("Please add at least one item");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  new Image().src =
    API_URL +
    `?action=addDailyInventory` +
    `&date=${today}` +
    `&created_by=ADMIN` +
    `&items=${encodeURIComponent(JSON.stringify(items))}`;

  closeModal();
  alert("Daily inventory saved ✅");
}