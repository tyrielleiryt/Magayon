import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= ENTRY ================= */
export default function loadDailyInventoryView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addTodayBtn">+ Add today's Inventory</button>
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
  document.getElementById("addTodayBtn").onclick = openAddTodayInventoryModal;
}

/* ================= MODAL ================= */
function openAddTodayInventoryModal() {
  openModal(`
    <div class="modal-header">📦 Add Today’s Inventory</div>

    <label>Location</label>
    <input id="dailyLocation">

    <div style="margin-top:12px;font-weight:bold;">Inventory Items</div>

    <div class="data-scroll" style="max-height:260px;">
      <table class="category-table">
        <thead>
          <tr><th>Item</th><th>Qty</th></tr>
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

  tbody.innerHTML = "";
  items.forEach(i => {
    tbody.innerHTML += `
      <tr>
        <td>${i.item_name}</td>
        <td><input type="number" min="0" data-id="${i.item_id}" value="0"></td>
      </tr>
    `;
  });
}

/* ================= SAVE (CORRECT) ================= */
function saveTodayInventory() {
  const inputs = document.querySelectorAll("#dailyItemsBody input");
  const items = [];

  inputs.forEach(i => {
    const qty = Number(i.value);
    if (qty > 0) items.push({ item_id: i.dataset.id, qty });
  });

  if (!items.length) {
    alert("Enter at least one item");
    return;
  }

  const form = new FormData();
  form.append("action", "addDailyInventory");
  form.append("date", new Date().toISOString().slice(0,10));
  form.append("created_by", "ADMIN");
  form.append("location", dailyLocation.value);
  form.append("items", JSON.stringify(items));

  fetch(API_URL, {
    method: "POST",
    body: form
  });

  closeModal();
  alert("Daily inventory saved ✅");
}