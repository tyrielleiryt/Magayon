import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let inventoryItems = [];
let selectedIndex = null;

export default function loadInventoryItemsView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addItemBtn">+ Add inventory item</button>
    <button id="editItemBtn">Edit</button>
    <button id="deleteItemBtn">Delete</button>
  `;

  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table" style="min-width:900px">
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

      <div class="data-scroll-controls">
        <button class="scroll-left">◀</button>
        <button class="scroll-right">▶</button>
      </div>
    </div>
  `;

  bindActions();
  loadInventoryItems();
  bindDataBoxScroll(contentBox.querySelector(".data-box"));
}

/* ================= DATA ================= */

async function loadInventoryItems() {
  const res = await fetch(API_URL + "?type=inventoryItems");
  inventoryItems = await res.json();
  selectedIndex = null;
  renderTable();
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
      document.querySelectorAll("#inventoryTableBody tr")
        .forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selectedIndex = i;
    };

    tbody.appendChild(tr);
  });
}

/* ================= ACTIONS ================= */

function bindActions() {
  document.getElementById("addItemBtn").onclick = openAddItemModal;
}

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
      <button class="btn-danger" id="saveItem">Save</button>
      <button class="btn-back" id="cancelItem">Cancel</button>
    </div>
  `);

  document.getElementById("cancelItem").onclick = closeModal;
  document.getElementById("saveItem").onclick = async () => {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "addInventoryItem",
        item_name: itemName.value,
        description: itemDesc.value,
        capital: Number(itemCap.value),
        selling_price: Number(itemPrice.value)
      })
    });

    closeModal();
    loadInventoryItems();
  };
}