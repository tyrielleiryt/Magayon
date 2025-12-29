const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let inventoryItems = [];

export default function loadDailyInventoryView() {
  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
    <div class="action-bar">
      <button id="addDailyBtn">+ Add today’s inventory</button>
    </div>

    <div class="view-body">
      <p>Daily Inventory records will appear here.</p>
    </div>
  `;

  document.getElementById("addDailyBtn").onclick = openAddDailyModal;
}

/* ================= ADD DAILY INVENTORY MODAL ================= */
async function openAddDailyModal() {
  await loadInventoryItems();

  const today = new Date().toISOString().split("T")[0];

  openModal(`
    <div class="modal-header">➕ Add today’s inventory</div>

    <label>Date</label>
    <input id="invDate" type="date" value="${today}">

    <label>Inventory items</label>
    <div id="itemsBox" style="max-height:300px; overflow:auto; border:1px solid #ccc; padding:8px;">
      ${inventoryItems.map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span>${item.item_name}</span>
          <input
            type="number"
            min="0"
            value="0"
            data-id="${item.item_id}"
            style="width:80px"
          >
        </div>
      `).join("")}
    </div>

    <label>Location</label>
    <select disabled>
      <option>UNASSIGNED (coming soon)</option>
    </select>

    <div class="modal-actions">
      <button class="btn-danger" id="confirmDaily">Confirm</button>
      <button class="btn-back" id="cancelDaily">Back</button>
    </div>
  `);

  document.getElementById("cancelDaily").onclick = closeModal;
  document.getElementById("confirmDaily").onclick = submitDailyInventory;
}

/* ================= SUBMIT ================= */
async function submitDailyInventory() {
  const date = document.getElementById("invDate").value;
  const inputs = document.querySelectorAll("#itemsBox input");

  const createdBy = localStorage.getItem("userEmail") || "UNKNOWN";

  const items = [];

  inputs.forEach(input => {
    const qty = Number(input.value);
    if (qty > 0) {
      const item = inventoryItems.find(i => i.item_id === input.dataset.id);

      const total = qty * item.selling_price;
      const capital = qty * item.capital;

      items.push({
        item_id: item.item_id,
        qty,
        capital,
        total,
        earnings: total - capital
      });
    }
  });

  if (!items.length) {
    alert("No inventory selected");
    return;
  }

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "addDailyInventory",
      date,
      location: "UNASSIGNED",
      created_by: createdBy,
      items
    })
  });

  closeModal();
  alert("Daily inventory saved");
}

/* ================= LOAD INVENTORY ITEMS ================= */
async function loadInventoryItems() {
  const res = await fetch(API_URL + "?type=inventoryItems");
  inventoryItems = await res.json();
}

/* ================= MODAL CORE ================= */
function ensureModal() {
  if (document.getElementById("modalOverlay")) return;

  const modal = document.createElement("div");
  modal.id = "modalOverlay";
  modal.className = "hidden";
  modal.innerHTML = `<div id="modalBox"></div>`;
  document.body.appendChild(modal);
}

function openModal(html) {
  ensureModal();
  document.getElementById("modalBox").innerHTML = html;
  document.getElementById("modalOverlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.add("hidden");
  document.getElementById("modalBox").innerHTML = "";
}