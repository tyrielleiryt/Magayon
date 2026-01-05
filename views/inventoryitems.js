import { bindDataBoxScroll, jsonp } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* ================= API ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let inventoryItems = [];
let selected = null;

let currentPage = 1;
const PAGE_SIZE = 10;
let searchQuery = "";

/* ================= ENTRY ================= */
export default function loadInventoryItemsView() {
  renderActionBar();
  renderTableLayout();
  loadInventoryItems();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  const actionBar = document.getElementById("actionBar");

  actionBar.innerHTML = `
    <input id="inventorySearch" placeholder="Search inventory..." />
    <button id="addItemBtn">➕ Add Item</button>
    <button id="editItemBtn" disabled>✏️ Edit</button>
    <button id="deleteItemBtn" disabled>🗑️ Delete</button>
  `;

  document.getElementById("addItemBtn").onclick = openAddItemModal;
  document.getElementById("editItemBtn").onclick = openEditItemModal;
  document.getElementById("deleteItemBtn").onclick = openDeleteItemModal;

  document.getElementById("inventorySearch").oninput = e => {
    searchQuery = e.target.value.toLowerCase();
    currentPage = 1;
    clearSelection();
    renderTable();
  };
}

/* ================= TABLE ================= */
function renderTableLayout() {
  const box = document.getElementById("contentBox");

  box.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item Name</th>
              <th>Description</th>
              <th>Qty / Serving</th>
              <th>Capital</th>
              <th>Selling Price</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody id="inventoryTableBody"></tbody>
        </table>
      </div>
      <div id="pagination"></div>
    </div>
  `;

  bindDataBoxScroll(box);
}

/* ================= LOAD DATA ================= */
async function loadInventoryItems() {
  inventoryItems = await jsonp(API_URL + "?type=inventoryItems");
  clearSelection();
  renderTable();
}

/* ================= HELPERS ================= */
function clearSelection() {
  selected = null;
  document.getElementById("editItemBtn").disabled = true;
  document.getElementById("deleteItemBtn").disabled = true;
}

/* ================= RENDER ================= */
function renderTable() {
  const tbody = document.getElementById("inventoryTableBody");
  const pager = document.getElementById("pagination");

  tbody.innerHTML = "";
  pager.innerHTML = "";

  const filtered = inventoryItems.filter(i =>
    `${i.item_name} ${i.description || ""}`.toLowerCase().includes(searchQuery)
  );

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7">No items found</td></tr>`;
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;

  filtered.slice(start, start + PAGE_SIZE).forEach((item, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${start + i + 1}</td>
      <td>${item.item_name}</td>
      <td>${item.description || ""}</td>
      <td>${item.quantity_per_serving}</td>
      <td>${item.capital}</td>
      <td>${item.selling_price}</td>
      <td>${item.unit || ""}</td>
    `;

    tr.onclick = () => {
      document.querySelectorAll("tr").forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selected = item;
      document.getElementById("editItemBtn").disabled = false;
      document.getElementById("deleteItemBtn").disabled = false;
    };

    tbody.appendChild(tr);
  });

  for (let i = 1; i <= totalPages; i++) {
    const b = document.createElement("button");
    b.textContent = i;
    if (i === currentPage) b.classList.add("active");
    b.onclick = () => { currentPage = i; renderTable(); };
    pager.appendChild(b);
  }
}

/* ================= MODALS ================= */
function openAddItemModal() {
  openModal(`
    <h3>Add Inventory Item</h3>
    <input id="itemName" placeholder="Name">
    <input id="itemDesc" placeholder="Description">
    <input id="itemQty" type="number" placeholder="Qty / Serving">
    <input id="itemUnit" placeholder="Unit">
    <input id="itemCap" type="number" placeholder="Capital">
    <input id="itemPrice" type="number" placeholder="Selling Price">
    <button id="saveItem">Save</button>
  `);

  document.getElementById("saveItem").onclick = () => {
    new Image().src =
      API_URL +
      `?action=addInventoryItem` +
      `&item_name=${encodeURIComponent(itemName.value)}` +
      `&description=${encodeURIComponent(itemDesc.value)}` +
      `&quantity_per_serving=${itemQty.value}` +
      `&unit=${itemUnit.value}` +
      `&capital=${itemCap.value}` +
      `&selling_price=${itemPrice.value}`;

    closeModal();
    setTimeout(loadInventoryItems, 600);
  };
}

function openEditItemModal() {
  if (!selected) return;

  openModal(`
    <h3>Edit Inventory Item</h3>
    <input id="itemName" value="${selected.item_name}">
    <input id="itemDesc" value="${selected.description || ""}">
    <input id="itemQty" type="number" value="${selected.quantity_per_serving}">
    <input id="itemUnit" value="${selected.unit || ""}">
    <input id="itemCap" type="number" value="${selected.capital}">
    <input id="itemPrice" type="number" value="${selected.selling_price}">
    <button id="saveEdit">Save</button>
  `);

  document.getElementById("saveEdit").onclick = () => {
    new Image().src =
      API_URL +
      `?action=editInventoryItem` +
      `&rowIndex=${selected.rowIndex}` +
      `&item_name=${encodeURIComponent(itemName.value)}` +
      `&description=${encodeURIComponent(itemDesc.value)}` +
      `&quantity_per_serving=${itemQty.value}` +
      `&unit=${itemUnit.value}` +
      `&capital=${itemCap.value}` +
      `&selling_price=${itemPrice.value}`;

    closeModal();
    setTimeout(loadInventoryItems, 600);
  };
}

function openDeleteItemModal() {
  if (!selected) return;

  if (!confirm(`Delete ${selected.item_name}?`)) return;

  new Image().src =
    API_URL + `?action=deleteInventoryItem&rowIndex=${selected.rowIndex}`;

  setTimeout(loadInventoryItems, 600);
}