import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";
 
/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

const STAFF_ID = localStorage.getItem("staff_id");
const CREATED_BY =
  localStorage.getItem("admin_email") ||
  localStorage.getItem("staff_id") ||
  "ADMIN";

/* ================= LOADER ================= */
function showLoader(text = "Loading…") {
  const l = document.getElementById("globalLoader");
  if (!l) return;
  l.querySelector(".loader-text").textContent = text;
  l.classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("globalLoader")?.classList.add("hidden");
}

/* ================= STATE ================= */
let dailyInventory = [];
let inventoryItems = [];
let locations = [];
let searchDate = "";
let searchLocation = "";

const el = id => document.getElementById(id);

/* ================= ENTRY ================= */
export default function loadDailyInventoryView() {
  renderActionBar();

  el("contentBox").innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Inventory</th>
              <th>Location</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody id="dailyInventoryBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
  loadDailyInventory();
}

function getPHDate() {
  const now = new Date();
  const ph = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  return ph.toISOString().slice(0, 10);
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  el("actionBar").innerHTML = `
    <input id="searchDateInput" placeholder="Search date" />
    <input id="searchLocationInput" placeholder="Search location" />

            <button id="startDayBtn" class="primary">
  🌅 Start Inventory Day
</button>

    <button id="closeDayBtn" class="danger">
  🔒 Close Inventory Day
</button>
  `;

  el("searchDateInput").oninput = e => {
    searchDate = e.target.value.toLowerCase();
    renderTable();
  };

  el("searchLocationInput").oninput = e => {
    searchLocation = e.target.value.toLowerCase();
    renderTable();
  };

  el("startDayBtn").onclick = startInventoryDay; // ✅ THIS WAS MISSING
  
}

/* =================  Start Inventory ================= */

async function startInventoryDay() {
  if (!confirm("Start today's inventory?")) return;

  const date = getPHDate();
const location = localStorage.getItem("userLocation");
if (!location) {
  alert("❌ Location missing. Please reload or reselect location.");
  return;
}

  const adminUser =
    localStorage.getItem("admin_email") || "ADMIN";

  showLoader("Starting inventory day…");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "manualStartInventoryDay",
        date,
        location,
        adminUser
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert("❌ " + data.error);
      return;
    }

    alert("✅ Inventory day started");
    loadDailyInventory(); // refresh table

  } catch (err) {
    console.error(err);
    alert("❌ Failed to start inventory day");
  } finally {
    hideLoader();
  }
}

/* ================= LOAD DAILY INVENTORY ================= */
async function loadDailyInventory() {
  showLoader("Loading daily inventory…");

  try {
    const res = await fetch(`${API_URL}?type=dailyInventory`);
    const data = await res.json();

    dailyInventory = Array.isArray(data) ? data : [];
    renderTable();
  } catch (err) {
    console.error(err);
    alert("Failed to load daily inventory");
  } finally {
    hideLoader();
  }
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = el("dailyInventoryBody");
  tbody.innerHTML = "";

  const filtered = dailyInventory.filter(d =>
    (!searchDate ||
      new Date(d.date).toLocaleDateString().toLowerCase().includes(searchDate)) &&
    (!searchLocation ||
      (d.location || "").toLowerCase().includes(searchLocation))
  );


  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#888">
          No daily inventory found
        </td>
      </tr>`;
    return;
  }

  filtered.forEach((d, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(d.date).toLocaleDateString()}</td>
        <td>
<button class="btn-view"
  onclick="viewDailyInventory(
  '${d.date}',
    '${d.location}',
    '${d.status}'
  )">
            View
          </button>
        </td>
        <td>${d.location}</td>
        <td>${d.created_by || "-"}</td>
      </tr>
    `;
  });
}

/* ================= VIEW DAILY INVENTORY ITEMS ================= */
window.viewDailyInventory = async function (date, location, status) {
  showLoader("Loading inventory…");

  try {
    const res = await fetch(
      `${API_URL}?type=dailyInventoryItems` +
      `&date=${encodeURIComponent(date)}` +
      `&location=${encodeURIComponent(location)}`
    );

const data = await res.json();

// 🛑 NO ACTIVE INVENTORY
if (data.status === "NO_ACTIVE_INVENTORY") {
  openModal(
    `
    <div class="modal-header">
      Inventory — ${date}
    </div>

    <div style="padding:16px;text-align:center;color:#888">
      No active inventory for today
    </div>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
    `,
    true
  );
  return;
}

const items = data.items || [];

openModal(
  `
  <div class="modal-header">
    Inventory — ${date}
  </div>

  <div class="inventory-scroll">
    <table class="inventory-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Total Added</th>
          <th>Remaining</th>
        </tr>
      </thead>
      <tbody>
        ${
          !items.length
            ? `<tr>
                 <td colspan="3" style="text-align:center;color:#888">
                   No data
                 </td>
               </tr>`
            : items.map(i => `
                <tr>
                  <td>${i.item_name}</td>
                  <td>${Number(i.qty_added) || 0}</td>
                  <td>${Number(i.remaining) || 0}</td>
                </tr>
              `).join("")
        }
      </tbody>
    </table>
  </div>

${String(status).toUpperCase() === "OPEN" ? `
  <div class="modal-actions">
    <button class="btn-primary"
      onclick="openAddInventoryForDay('${date}','${location}')">
      ➕ Add Inventory
    </button>
    <button class="btn-back" onclick="closeModal()">Close</button>
  </div>
` : `
  <div class="modal-actions">
    <button class="btn-back" onclick="closeModal()">Close</button>
  </div>
`}
    `,
      true
    );
  } catch (err) {
    console.error(err);
    alert("Failed to load inventory");
  } finally {
    hideLoader();
  }
};

/* ================= NEW ADD TODAY INVENTORY ================= */


window.openAddInventoryForDay = async function (date, location) {
  showLoader("Loading data…");

  try {
    [inventoryItems] = await Promise.all([
      fetch(`${API_URL}?type=inventoryItems`).then(r => r.json())
    ]);

    openModal(
      `
      <div class="modal-header">
        Add Inventory — ${date}
      </div>

      <div style="max-height:320px;overflow:auto;margin-top:12px">
        ${inventoryItems.map(i => `
          <div style="display:flex;gap:10px;margin-bottom:6px">
            <div style="flex:1">${i.item_name}</div>
            <input type="number" min="0"
              data-id="${i.item_id}"
              style="width:90px"
              placeholder="Qty">
          </div>
        `).join("")}
      </div>

      <div class="modal-actions">
        <button class="btn-danger"
          onclick="saveInventoryForDay('${date}','${location}')">
          Save
        </button>
        <button class="btn-back" onclick="closeModal()">Cancel</button>
      </div>
      `,
      true
    );
  } catch (err) {
    console.error(err);
    alert("Failed to load inventory");
  } finally {
    hideLoader();
  }
};

window.saveInventoryForDay = function (date, location) {
  const inputs = document.querySelectorAll("[data-id]");
  const items = [];

  inputs.forEach(i => {
    const qty = Number(i.value);
    if (qty > 0) {
      items.push({ item_id: i.dataset.id, qty });
    }
  });

  if (!items.length) {
    alert("No quantities entered");
    return;
  }

  showLoader("Saving inventory…");

  fetch(
    `${API_URL}?action=addDailyInventory` +
    `&date=${encodeURIComponent(date)}` +
    `&location=${encodeURIComponent(location)}` +
    `&created_by=${encodeURIComponent(CREATED_BY)}` +
    `&items=${encodeURIComponent(JSON.stringify(items))}`
  )
    .then(r => r.json())
    .then(res => {
      if (!res.success) {
        alert(res.error);
        return;
      }
      closeModal();
      loadDailyInventory();
    })
    .finally(hideLoader);
};