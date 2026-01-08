import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

/* ================= API ================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= LOADER ================= */
function showLoader(text = "Loading data…") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;
  loader.querySelector(".loader-text").textContent = text;
  loader.classList.remove("hidden");
}
function hideLoader() {
  document.getElementById("globalLoader")?.classList.add("hidden");
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
    <input id="inventorySearch" placeholder="Search inventory..." />
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
  document.getElementById("contentBox").innerHTML = `
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

  bindDataBoxScroll(document.querySelector(".data-box"));
}

/* ================= LOAD DATA ================= */
async function loadInventoryItems() {
  const res = await fetch(`${API_URL}?type=inventoryItems`);
  const data = await res.json();

  inventoryItems = (Array.isArray(data) ? data : []).map(r => {
    // ✅ OBJECT FORMAT (CURRENT BACKEND)
    if (!Array.isArray(r)) {
      return {
        rowIndex: r.rowIndex || r.item_id,
        item_id: r.item_id,
        item_name: r.item_name,
        description: r.description,
        quantity_per_serving: r.quantity_per_serving,
        unit: r.unit,
        capital: r.capital,
        selling_price: r.selling_price,
        reorder_level: r.reorder_level,
        active: r.active
      };
    }

    // ✅ ARRAY FORMAT (MATCHES SHEET EXACTLY)
    return {
      rowIndex: r[0],                // item_id
      item_id: r[0],
      item_name: r[1],
      description: r[2],
      quantity_per_serving: r[3],
      unit: r[4],
      capital: r[5],
      selling_price: r[6],
      reorder_level: r[7],
      active: r[8]
    };
  });

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

  const filtered = inventoryItems.filter(i =>
    `${i.item_name} ${i.description || ""}`
      .toLowerCase()
      .includes(searchQuery)
  );

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:#888">
          No inventory items found
        </td>
      </tr>`;
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
      <td>${item.unit}</td>
    `;

    tr.onclick = () => {
      document.querySelectorAll("#inventoryTableBody tr")
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

/* ================= MODALS ================= */
function openAddItemModal() {
  openModal(`
    <div class="modal-header">➕ Add Inventory Item</div>
    <label>Item Name</label><input>
    <label>Description</label><textarea></textarea>
    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
}

function openEditItemModal() {
  if (!selected) return;
}
function openDeleteItemModal() {
  if (!selected) return;
}