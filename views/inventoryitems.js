const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let inventoryItems = [];
let selectedIndex = null;

export default function loadInventoryItemsView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  /* ===== ACTION BAR ===== */
  actionBar.innerHTML = `
    <div class="action-bar">
      <button id="addItemBtn">+ Add inventory item</button>
      <button id="editItemBtn">Edit</button>
      <button id="deleteItemBtn">Delete</button>
    </div>
  `;

  /* ===== CONTENT ===== */
  contentBox.innerHTML = `
    <div class="view-body">
      <table class="category-table">
        <thead>
          <tr>
            <th style="width:50px">#</th>
            <th>Item Name</th>
            <th>Description</th>
            <th style="width:120px">Capital</th>
            <th style="width:120px">Selling Price</th>
          </tr>
        </thead>
        <tbody id="inventoryTableBody"></tbody>
      </table>
    </div>
  `;

  bindInventoryActions();
  loadInventoryItems();
}

/* ================= LOAD ================= */
async function loadInventoryItems() {
  const res = await fetch(`${API_URL}?type=inventory`);
  inventoryItems = await res.json();
  selectedIndex = null;
  renderInventoryTable();
}

/* ================= TABLE ================= */
function renderInventoryTable() {
  const tbody = document.getElementById("inventoryTableBody");
  tbody.innerHTML = "";

  inventoryItems.forEach((item, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${item.item_name}</td>
      <td>${item.description}</td>
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
function bindInventoryActions() {
  document.getElementById("addItemBtn")
    .addEventListener("click", openAddItemModal);
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

/* ================= ADD INVENTORY ITEM ================= */
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
    const name = document.getElementById("itemName").value.trim();
    const desc = document.getElementById("itemDesc").value.trim();
    const capital = Number(document.getElementById("itemCapital").value);
    const price = Number(document.getElementById("itemPrice").value);

    if (!name || !capital || !price) {
      alert("Please complete all required fields.");
      return;
    }

    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "addInventoryItem",
        item_name: name,
        description: desc,
        capital,
        selling_price: price
      })
    });

    closeModal();
    loadInventoryItems();
  };
}