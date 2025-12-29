import { bindDataBoxScroll } from "../admin.js";

export default function loadDailyInventoryView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <button id="addTodayBtn">+ Add today's Inventory</button>
    <button disabled>+/- Edit Inventory Details</button>
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
              <td>1</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td><button disabled>View</button></td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
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

  // ✅ THIS WAS MISSING
  document.getElementById("addTodayBtn").onclick = openAddTodayInventoryModal;
}

/* ================= ADD TODAY INVENTORY MODAL ================= */

function openAddTodayInventoryModal() {
  openModal(`
    <div class="modal-header">📦 Add Today’s Inventory</div>

    <label>Date</label>
    <input type="date" value="${new Date().toISOString().slice(0,10)}" disabled>

    <label>Location</label>
    <input placeholder="(will be selectable later)" disabled>

    <div style="margin-top:12px;font-weight:bold;">Inventory Items</div>

    <div class="data-scroll" style="max-height:260px;">
      <table class="category-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
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

async function loadInventoryItemsForToday() {
  const res = await fetch(API_URL + "?type=inventoryItems");
  const items = await res.json();
  const tbody = document.getElementById("dailyItemsBody");

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

async function saveTodayInventory() {
  const rows = document.querySelectorAll("#dailyItemsBody input");
  const items = [];

  rows.forEach(input => {
    const qty = Number(input.value);
    if (qty > 0) {
      const capital = qty * Number(input.dataset.cap);
      const selling = qty * Number(input.dataset.price);

      items.push({
        item_id: input.dataset.id,
        qty,
        capital,
        total: selling,
        earnings: selling - capital
      });
    }
  });

  if (!items.length) {
    alert("Please enter at least one item");
    return;
  }

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "addDailyInventory",
      date: new Date().toISOString().slice(0,10),
      created_by: "ADMIN",
      items
    })
  });

  closeModal();
  alert("Daily inventory saved");
}