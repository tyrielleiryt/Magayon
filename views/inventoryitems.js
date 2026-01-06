import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* ================= API ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* =========================================================
   LOADER HELPERS (STEP 4)
========================================================= */
function showLoader(text = "Loading data…") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.querySelector(".loader-text").textContent = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.classList.add("hidden");
}

/* ================= STATE ================= */
let inventoryItems = [];
let selected = null;

let currentPage = 1;
const PAGE_SIZE = 10;
let searchQuery = "";

/* ================= ENTRY ================= */
export default async function loadInventoryItemsView() {
  renderActionBar();
  renderTableLayout();

  showLoader("Loading inventory items…");
  try {
    await loadInventoryItems();
  } finally {
    hideLoader();
  }
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  const actionBar = document.getElementById("actionBar");

  actionBar.innerHTML = `
    <input
      type="text"
      id="inventorySearch"
      placeholder="Search inventory..."
      style="padding:8px;border-radius:6px;border:1px solid #bbb"
    />

    <button id="addItemBtn" class="category-action-btn">➕ Add Item</button>
    <button id="editItemBtn" class="category-action-btn" disabled>✏️ Edit</button>
    <button id="deleteItemBtn" class="category-action-btn" disabled>🗑️ Delete</button>
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

/* ================= TABLE LAYOUT ================= */
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
              <th>Qty / Serving</th>
              <th>Capital</th>
              <th>Selling Price</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody id="inventoryTableBody"></tbody>
        </table>
      </div>
      <div id="pagination" style="padding-top:10px;text-align:center;"></div>
    </div>
  `;

  bindDataBoxScroll(contentBox.querySelector(".data-box"));
}

/* ================= LOAD DATA ================= */
async function loadInventoryItems() {
  const res = await fetch(API_URL + "?type=inventoryItems");
  inventoryItems = await res.json();

  clearSelection();
  renderTable();
}

/* ================= HELPERS ================= */
function clearSelection() {
  selected = null;
  document.getElementById("editItemBtn").disabled = true;
  document.getElementById("deleteItemBtn").disabled = true;
}

/* ================= RENDER TABLE ================= */
function renderTable() {
  const tbody = document.getElementById("inventoryTableBody");
  const pagination = document.getElementById("pagination");

  tbody.innerHTML = "";
  pagination.innerHTML = "";

  const filtered = inventoryItems.filter(item =>
    `${item.item_name} ${item.description || ""}`
      .toLowerCase()
      .includes(searchQuery)
  );

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:#888">
          No inventory items found
        </td>
      </tr>
    `;
    return;
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  pageItems.forEach((item, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${start + i + 1}</td>
      <td>${item.item_name}</td>
      <td>${item.description || ""}</td>
      <td>${item.quantity_per_serving || ""}</td>
      <td>${item.capital}</td>
      <td>${item.selling_price}</td>
      <td>${item.unit || ""}</td>
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

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = "btn-view";
    if (i === currentPage) btn.style.background = "#f3c84b";

    btn.onclick = () => {
      currentPage = i;
      clearSelection();
      renderTable();
    };

    pagination.appendChild(btn);
  }
}

/* ================= ADD ================= */
function openAddItemModal() {
  openModal(`
    <div class="modal-header">➕ Add Inventory Item</div>
    <label>Item Name</label><input id="itemName">
    <label>Description</label><textarea id="itemDesc"></textarea>
    <label>Quantity per Serving</label><input type="number" id="itemQtyServing">
    <label>Unit</label><input id="itemUnit">
    <label>Capital</label><input type="number" id="itemCap">
    <label>Selling Price</label><input type="number" id="itemPrice">
    <div class="modal-actions">
      <button class="btn-danger" id="saveItem">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("saveItem").onclick = () => {
    showLoader("Adding inventory item…");

    new Image().src =
      API_URL +
      `?action=addInventoryItem` +
      `&item_name=${encodeURIComponent(itemName.value)}` +
      `&description=${encodeURIComponent(itemDesc.value)}` +
      `&capital=${itemCap.value}` +
      `&selling_price=${itemPrice.value}` +
      `&quantity_per_serving=${itemQtyServing.value}` +
      `&unit=${encodeURIComponent(itemUnit.value)}`;

    closeModal();
    setTimeout(() => {
      loadInventoryItems();
      hideLoader();
    }, 600);
  };
}

/* ================= EDIT ================= */
function openEditItemModal() {
  if (!selected) return;

  openModal(`
    <div class="modal-header">✏️ Edit Inventory Item</div>
    <label>Item Name</label><input id="itemName" value="${selected.item_name}">
    <label>Description</label><textarea id="itemDesc">${selected.description || ""}</textarea>
    <label>Quantity per Serving</label><input type="number" id="itemQtyServing" value="${selected.quantity_per_serving || ""}">
    <label>Unit</label><input id="itemUnit" value="${selected.unit || ""}">
    <label>Capital</label><input type="number" id="itemCap" value="${selected.capital}">
    <label>Selling Price</label><input type="number" id="itemPrice" value="${selected.selling_price}">
    <div class="modal-actions">
      <button class="btn-danger" id="saveEdit">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("saveEdit").onclick = () => {
    showLoader("Saving changes…");

    new Image().src =
      API_URL +
      `?action=editInventoryItem` +
      `&rowIndex=${selected.rowIndex}` +
      `&item_name=${encodeURIComponent(itemName.value)}` +
      `&description=${encodeURIComponent(itemDesc.value)}` +
      `&capital=${itemCap.value}` +
      `&selling_price=${itemPrice.value}` +
      `&quantity_per_serving=${itemQtyServing.value}` +
      `&unit=${encodeURIComponent(itemUnit.value)}`;

    closeModal();
    setTimeout(() => {
      loadInventoryItems();
      hideLoader();
    }, 600);
  };
}

/* ================= DELETE ================= */
function openDeleteItemModal() {
  if (!selected) return;

  openModal(`
    <div class="modal-header danger">🗑️ Delete Inventory Item</div>
    <p>Are you sure you want to delete <b>${selected.item_name}</b>?</p>
    <div class="modal-actions">
      <button class="btn-danger" id="confirmDelete">Delete</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("confirmDelete").onclick = () => {
    showLoader("Deleting item…");

    new Image().src =
      API_URL +
      `?action=deleteInventoryItem&rowIndex=${selected.rowIndex}`;

    closeModal();
    setTimeout(() => {
      loadInventoryItems();
      hideLoader();
    }, 600);
  };
}