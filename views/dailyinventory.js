import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let inventoryItems = [];
let quantities = {};
let dailyInventoryCache = [];
let editDailyId = null;

let currentPage = 1;
const PAGE_SIZE = 10;
let searchDate = "";
let searchLocation = "";

/* ================= HELPERS ================= */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

/* ================= ENTRY ================= */
export default function loadDailyInventoryView() {
  renderActionBar();

  document.getElementById("contentBox").innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>DN</th>
              <th>Actions</th>
              <th>Location</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody id="dailyInventoryBody"></tbody>
        </table>
      </div>
      <div id="pagination" style="padding:10px;text-align:center"></div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
  loadDailyInventory();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <input id="searchDateInput" placeholder="Search date (e.g. December)" />
    <input id="searchLocationInput" placeholder="Search location" />

    <button class="category-action-btn" id="addTodayBtn">
      + Add Today's Inventory
    </button>
  `;

  searchDateInput.oninput = e => {
    searchDate = e.target.value.toLowerCase();
    renderTable();
  };

  searchLocationInput.oninput = e => {
    searchLocation = e.target.value.toLowerCase();
    renderTable();
  };

  addTodayBtn.onclick = () => {
    editDailyId = null;
    quantities = {};
    openAddEditModal();
  };
}

/* ================= LOAD ================= */
async function loadDailyInventory() {
  dailyInventoryCache = await (await fetch(
    API_URL + "?type=dailyInventory"
  )).json();

  renderTable();
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = document.getElementById("dailyInventoryBody");
  tbody.innerHTML = "";

  const filtered = dailyInventoryCache.filter(r =>
    formatDate(r.date).toLowerCase().includes(searchDate) &&
    (r.location || "").toLowerCase().includes(searchLocation)
  );

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#888">
          No daily inventory found
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((r, i) => {
    const canEdit = isToday(r.date);

    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${formatDate(r.date)}</td>
        <td>${r.dn}</td>
        <td>
          <button class="btn-view" onclick="viewDaily('${r.daily_id}')">View</button>
          <button class="btn-edit" ${!canEdit ? "disabled" : ""}
            onclick="editDaily('${r.daily_id}')">Edit</button>
        </td>
        <td>${r.location || ""}</td>
        <td>${r.created_by}</td>
      </tr>
    `;
  });
}

/* ================= VIEW ================= */
window.viewDaily = async dailyId => {
  const header = dailyInventoryCache.find(d => d.daily_id === dailyId);

  const items = await (await fetch(
    API_URL + `?type=dailyInventoryItems&daily_id=${dailyId}`
  )).json();

  const inventory = await (await fetch(
    API_URL + "?type=inventoryItems"
  )).json();

  const map = {};
  inventory.forEach(i => (map[i.item_id] = i.item_name));

  openModal(`
    <div class="modal-header">Daily Inventory</div>

    <label>Date</label>
    <input value="${formatDate(header.date)}" disabled>

    <label>Location</label>
    <input value="${header.location || ""}" disabled>

    <table class="inventory-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Qty Total</th>
          <th>Capital</th>
          <th>Earnings</th>
          <th>Net</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(i => {
          const net = i.earnings - i.capital;
          return `
            <tr>
              <td>${map[i.item_id]}</td>
              <td>${i.qty}</td>
              <td>${i.total}</td>
              <td>₱${i.capital.toFixed(2)}</td>
              <td>₱${i.earnings.toFixed(2)}</td>
              <td style="color:${net >= 0 ? "#1b8f3c" : "#c0392b"}">
                ₱${net.toFixed(2)}
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
};

/* ================= ADD / EDIT MODAL ================= */
async function openAddEditModal(header = null) {
  inventoryItems = await (await fetch(
    API_URL + "?type=inventoryItems"
  )).json();

  openModal(`
    <div class="modal-header">Add Today's Inventory</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <label>Date</label>
        <input value="${formatDate(new Date())}" disabled>
      </div>
      <div>
        <label>Location</label>
        <input id="locationSelect">
      </div>
    </div>

    <div style="margin-top:20px;max-height:420px;overflow:auto">
      <table class="inventory-table">
        <thead style="background:#f3f3f3;position:sticky;top:0">
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Qty Total</th>
            <th>Capital</th>
            <th>Earnings</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryItems.map(i => `
            <tr>
              <td>${i.item_name}</td>
              <td>
                <button class="qty-btn" onclick="chg('${i.item_id}',-1)">−</button>
                <span id="q-${i.item_id}">0</span>
                <button class="qty-btn" onclick="chg('${i.item_id}',1)">+</button>
              </td>
              <td id="t-${i.item_id}">0</td>
              <td>₱<span id="c-${i.item_id}">0.00</span></td>
              <td>₱<span id="e-${i.item_id}">0.00</span></td>
              <td>₱<span id="n-${i.item_id}">0.00</span></td>
            </tr>
          `).join("")}
        </tbody>

        <tfoot>
          <tr style="background:#fafafa;border-top:2px solid #ccc">
            <th colspan="3" style="text-align:right">TOTAL</th>
            <th>₱<span id="gt-capital">0.00</span></th>
            <th>₱<span id="gt-earnings">0.00</span></th>
            <th>
              ₱<span id="gt-net" style="font-weight:bold">0.00</span>
            </th>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveDaily()">Save Inventory</button>
      <button class="btn-back" onclick="cancelDaily()">Cancel</button>
    </div>
  `);
}

/* ================= CALCULATIONS ================= */
window.chg = (id, d) => {
  quantities[id] = Math.max(0, (quantities[id] || 0) + d);

  let totalCapital = 0;
  let totalEarnings = 0;

  inventoryItems.forEach(i => {
    const qty = quantities[i.item_id] || 0;

    const qtyTotal = qty * Number(i.quantity_per_serving || 0);
    const capital = qty * Number(i.capital || 0);
    const earnings = qty * Number(i.selling_price || 0);
    const net = earnings - capital;

    if (document.getElementById(`q-${i.item_id}`)) {
      q(`q-${i.item_id}`).textContent = qty;
      q(`t-${i.item_id}`).textContent = qtyTotal;
      q(`c-${i.item_id}`).textContent = capital.toFixed(2);
      q(`e-${i.item_id}`).textContent = earnings.toFixed(2);

      const n = q(`n-${i.item_id}`);
      n.textContent = net.toFixed(2);
      n.style.color = net >= 0 ? "#1b8f3c" : "#c0392b";
    }

    totalCapital += capital;
    totalEarnings += earnings;
  });

  const totalNet = totalEarnings - totalCapital;

  q("gt-capital").textContent = totalCapital.toFixed(2);
  q("gt-earnings").textContent = totalEarnings.toFixed(2);

  const gt = q("gt-net");
  gt.textContent = totalNet.toFixed(2);
  gt.style.color = totalNet >= 0 ? "#1b8f3c" : "#c0392b";
};

const q = id => document.getElementById(id);

/* ================= SAVE ================= */
window.saveDaily = () => {
  const items = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const i = inventoryItems.find(x => x.item_id === id);
      return {
        item_id: id,
        qty,
        total: qty * Number(i.quantity_per_serving || 0),
        capital: qty * Number(i.capital || 0),
        earnings: qty * Number(i.selling_price || 0)
      };
    });

  if (!items.length) return alert("No inventory entered");

  new Image().src =
    API_URL +
    `?action=addDailyInventory` +
    `&location=${encodeURIComponent(locationSelect.value)}` +
    `&created_by=ADMIN` +
    `&items=${encodeURIComponent(JSON.stringify(items))}`;

  quantities = {};
  closeModal();
  setTimeout(loadDailyInventory, 700);
};

window.cancelDaily = () => {
  quantities = {};
  closeModal();
};