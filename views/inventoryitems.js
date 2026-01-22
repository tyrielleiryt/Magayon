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
              <th>Unit</th>
              <th>Selling Price</th>
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
<td>${item.unit}</td>
<td>${item.selling_price}</td>
    `;

tr.onclick = () => {
  document.querySelectorAll("#inventoryTableBody tr")
    .forEach(r => r.classList.remove("selected"));

  tr.classList.add("selected");
  tr.style.transform = "scale(0.995)";
  setTimeout(() => tr.style.transform = "", 80);

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

    <label>Item Name</label>
    <input id="inv_item_name" required />

    <label>Description</label>
    <textarea id="inv_description"></textarea>

    <label>Quantity per Serving</label>
    <input id="inv_qty" type="number" min="0" />

    <label>Unit</label>
    <input id="inv_unit" placeholder="g, pc, cup, etc" />

    <label>Capital</label>
    <input id="inv_capital" type="number" min="0" />

    <label>Selling Price</label>
    <input id="inv_price" type="number" min="0" />

    <label>Reorder Level</label>
    <input id="inv_reorder" type="number" min="0" />

    <label>
      <input id="inv_active" type="checkbox" checked />
      Active
    </label>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveInventoryItem()">Save</button>
    </div>
  `);
}

function openEditItemModal() {
    if (!selected) return;
  
  openModal(`
    <div class="modal-header">✏️ Edit Inventory Item</div>

    <label>Item Name</label>
    <input id="inv_item_name" value="${selected.item_name}" required />

    <label>Description</label>
    <textarea id="inv_description">${selected.description || ""}</textarea>

    <label>Quantity per Serving</label>
    <input id="inv_qty" type="number" value="${selected.quantity_per_serving}" />

    <label>Unit</label>
    <input id="inv_unit" value="${selected.unit}" />

    <label>Capital</label>
    <input id="inv_capital" type="number" value="${selected.capital}" />

    <label>Selling Price</label>
    <input id="inv_price" type="number" value="${selected.selling_price}" />

    <label>Reorder Level</label>
    <input id="inv_reorder" type="number" value="${selected.reorder_level}" />

    <label>
      <input id="inv_active" type="checkbox" ${selected.active ? "checked" : ""} />
      Active
    </label>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="updateInventoryItem()">Save Changes</button>
    </div>
  `);
}

function openDeleteItemModal() {
  if (!selected) return;

  openModal(`
    <div class="modal-header">🗑️ Delete Inventory Item</div>

    <p style="padding:10px 0">
      Are you sure you want to delete:<br>
      <strong>${selected.item_name}</strong>?
    </p>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="deleteInventoryItem()">Delete</button>
    </div>
  `);
}

async function updateInventoryItem() {
  if (!selected) return;

  const payload = {
    item_id: selected.item_id,
    item_name: document.getElementById("inv_item_name").value.trim(),
    description: document.getElementById("inv_description").value.trim(),
    quantity_per_serving: document.getElementById("inv_qty").value,
    unit: document.getElementById("inv_unit").value,
    capital: document.getElementById("inv_capital").value,
    selling_price: document.getElementById("inv_price").value,
    reorder_level: document.getElementById("inv_reorder").value,
    active: document.getElementById("inv_active").checked
  };



  showLoader("Updating item...");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "updateInventoryItem",
        data: JSON.stringify(payload)
      })
    });

    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    closeModal();
    await loadInventoryItems();

  } catch (err) {
    alert("❌ Update failed: " + err.message);
  } finally {
    hideLoader();
  }
}

async function deleteInventoryItem() {
  if (!selected) return;

  showLoader("Deleting item...");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "deleteInventoryItem",
        item_id: selected.item_id
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    closeModal();
    await loadInventoryItems();

  } catch (err) {
    alert("❌ Delete failed: " + err.message);
  } finally {
    hideLoader();
  }
}

window.deleteInventoryItem = deleteInventoryItem;

window.openDeleteItemModal = openDeleteItemModal;