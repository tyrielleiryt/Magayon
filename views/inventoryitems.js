import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let inventoryItems = [];
let selected = null;

/* ================= ENTRY ================= */
export default function loadInventoryItemsView() {
  renderActionBar();
  renderTableLayout();
  loadInventoryItems();
}

/* ================= UI ================= */
function renderActionBar() {
  const actionBar = document.getElementById("actionBar");

  actionBar.innerHTML = `
    <button id="addItemBtn" class="category-action-btn">➕ Add Inventory Item</button>
    <button id="editItemBtn" class="category-action-btn" disabled>✏️ Edit Item</button>
    <button id="deleteItemBtn" class="category-action-btn" disabled>🗑️ Delete Item</button>
  `;

  // 🔑 RE-BIND EVERY TIME
  document.getElementById("addItemBtn").onclick = openAddItemModal;
  document.getElementById("editItemBtn").onclick = openEditItemModal;
  document.getElementById("deleteItemBtn").onclick = openDeleteItemModal;
}

function renderTableLayout() {
  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item Name</th>
              <th>Description</th>
              <th>Capital</th>
              <th>Selling Price</th>
            </tr>
          </thead>
          <tbody id="inventoryTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(contentBox.querySelector(".data-box"));
}

/* ================= DATA ================= */
async function loadInventoryItems() {
  const res = await fetch(API_URL + "?type=inventoryItems");
  inventoryItems = await res.json();
  selected = null;
  renderTable();

  document.getElementById("editItemBtn").disabled = true;
  document.getElementById("deleteItemBtn").disabled = true;
}

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

    tr.onclick = () => {
      document
        .querySelectorAll("#inventoryTableBody tr")
        .forEach(r => r.classList.remove("selected"));

      tr.classList.add("selected");
      selected = item;

      document.getElementById("editItemBtn").disabled = false;
      document.getElementById("deleteItemBtn").disabled = false;
    };

    tbody.appendChild(tr);
  });
}

/* ================= ADD ================= */
function openAddItemModal() {
  openModal(`
    <div class="modal-header">➕ Add Inventory Item</div>

    <label>Item Name</label>
    <input id="itemName">

    <label>Description</label>
    <textarea id="itemDesc"></textarea>

    <label>Capital</label>
    <input type="number" id="itemCap">

    <label>Selling Price</label>
    <input type="number" id="itemPrice">

    <div class="modal-actions">
      <button class="btn-confirm" id="saveItem">Confirm</button>
      <button class="btn-back" onclick="closeModal()">Back</button>
    </div>
  `);

  document.getElementById("saveItem").onclick = () => {
    new Image().src =
      API_URL +
      `?action=addInventoryItem` +
      `&item_name=${encodeURIComponent(itemName.value)}` +
      `&description=${encodeURIComponent(itemDesc.value)}` +
      `&capital=${encodeURIComponent(itemCap.value)}` +
      `&selling_price=${encodeURIComponent(itemPrice.value)}`;

    closeModal();
    setTimeout(loadInventoryItems, 500);
  };
}

/* ================= EDIT ================= */
function openEditItemModal() {
  if (!selected) return;

  openModal(`
    <div class="modal-header">✏️ Edit Inventory Item</div>

    <label>Item Name</label>
    <input id="itemName" value="${selected.item_name}">

    <label>Description</label>
    <textarea id="itemDesc">${selected.description || ""}</textarea>

    <label>Capital</label>
    <input type="number" id="itemCap" value="${selected.capital}">

    <label>Selling Price</label>
    <input type="number" id="itemPrice" value="${selected.selling_price}">

    <div class="modal-actions">
      <button class="btn-confirm" id="saveEdit">Edit</button>
      <button class="btn-back" onclick="closeModal()">Back</button>
    </div>
  `);

  document.getElementById("saveEdit").onclick = () => {
    new Image().src =
      API_URL +
      `?action=editInventoryItem` +
      `&rowIndex=${selected.rowIndex}` +
      `&item_name=${encodeURIComponent(itemName.value)}` +
      `&description=${encodeURIComponent(itemDesc.value)}` +
      `&capital=${encodeURIComponent(itemCap.value)}` +
      `&selling_price=${encodeURIComponent(itemPrice.value)}`;

    closeModal();
    setTimeout(loadInventoryItems, 500);
  };
}

/* ================= DELETE ================= */
function openDeleteItemModal() {
  if (!selected) return;

  openModal(`
    <div class="modal-header danger">🗑️ Delete Inventory Item</div>

    <p>Are you sure you want to delete <b>${selected.item_name}</b>?</p>

    <div class="modal-actions">
      <button class="btn-confirm" id="confirmDelete">Confirm</button>
      <button class="btn-back" onclick="closeModal()">Back</button>
    </div>
  `);

  document.getElementById("confirmDelete").onclick = () => {
    new Image().src =
      API_URL +
      `?action=deleteInventoryItem&rowIndex=${selected.rowIndex}`;

    closeModal();
    setTimeout(loadInventoryItems, 500);
  };
}