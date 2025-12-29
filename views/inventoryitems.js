const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let inventoryItems = [];
let selectedIndex = null;

export default function loadInventoryItemsView() {
  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
    <div class="action-bar">
      <button id="addItemBtn">+ Add inventory item</button>
      <button id="editItemBtn">Edit</button>
      <button id="deleteItemBtn">Delete</button>
    </div>

    <div class="view-body">
      <table class="category-table">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>Item Name</th>
            <th>Description</th>
            <th style="width:120px">Capital</th>
            <th style="width:140px">Selling Price</th>
          </tr>
        </thead>
        <tbody id="inventoryTableBody"></tbody>
      </table>
    </div>
  `;

  bindActions();
  loadInventoryItems();
}

/* ================= LOAD DATA ================= */
async function loadInventoryItems() {
  const res = await fetch(API_URL + "?type=inventoryItems");
  inventoryItems = await res.json();
  selectedIndex = null;
  renderTable();
}

/* ================= RENDER ================= */
function renderTable() {
  const tbody = document.getElementById("inventoryTableBody");
  tbody.innerHTML = "";

  inventoryItems.forEach((item, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${item.item_name}</td>
      <td>${item.description || ""}</td>
      <td>${item.capital}</td>
      <td>${item.selling_price}</td>
    `;

    tr.addEventListener("click", () => {
      document
        .querySelectorAll("#inventoryTableBody tr")
        .forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selectedIndex = i;
    });

    tbody.appendChild(tr);
  });
}

/* ================= ACTIONS ================= */
function bindActions() {
  document.getElementById("addItemBtn").onclick = openAddItemModal;
  document.getElementById("editItemBtn").onclick = () =>
    alert("Edit inventory item coming next");
  document.getElementById("deleteItemBtn").onclick = () =>
    alert("Delete inventory item coming next");
}

/* ================= ADD MODAL ================= */
function openAddItemModal() {
  openModal(`
    <div class="modal-header">➕ Add inventory item</div>

    <label>Item Name</label>
    <input id="itemName">

    <label>Description</label>
    <textarea id="itemDesc"></textarea>

    <label>Capital</label>
    <input id="itemCapital" type="number">

    <label>Selling Price</label>
    <input id="itemPrice" type="number">

    <div class="modal-actions">
      <button class="btn-danger" id="confirmAddItem">Confirm</button>
      <button class="btn-back" id="cancelAddItem">Back</button>
    </div>
  `);

  document.getElementById("cancelAddItem").onclick = closeModal;

  document.getElementById("confirmAddItem").onclick = async () => {
    const payload = {
      action: "addInventoryItem",
      item_name: document.getElementById("itemName").value.trim(),
      description: document.getElementById("itemDesc").value.trim(),
      capital: Number(document.getElementById("itemCapital").value),
      selling_price: Number(document.getElementById("itemPrice").value)
    };

    if (!payload.item_name) {
      alert("Item name is required");
      return;
    }

    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    closeModal();
    loadInventoryItems();
  };
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