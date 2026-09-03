import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";
 
/* =========================================================
   CONFIG
========================================================= */
import { API_URL } from "../firebase-config.js";
import { openCloseDayModal } from "../admin-close-day.js";
import { authFetch } from "../auth-guard.js";

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

  el("startDayBtn").onclick = startInventoryDay;

  el("closeDayBtn").onclick = () => {
    const date = getPHDate();
    const location = localStorage.getItem("userLocation");
    if (!location) {
      alert("❌ Location missing. Please reload or reselect location.");
      return;
    }
    openCloseDayModal(date, location);
  };
}

/* =================  Start Inventory ================= */

function startInventoryDay() {
  const location = localStorage.getItem("userLocation");
  if (!location) {
    alert("❌ Location missing. Please reload or reselect location.");
    return;
  }

  loadCarryOverReview(location);
}

/* Always shows yesterday's remaining stock (if any) so the admin picks
   exactly how much of each item to carry into today, item by item —
   set an item to 0 to leave it out entirely. If there's no previous
   closed day, or nothing was left over, there's nothing to review, so
   the day just starts empty. */
async function loadCarryOverReview(location) {
  showLoader("Loading yesterday's remaining stock…");

  try {
    const [days, masterItems] = await Promise.all([
      fetch(`${API_URL}?type=dailyInventory`).then(r => r.json()),
      fetch(`${API_URL}?type=inventoryItems`).then(r => r.json())
    ]);

    const unitMap = {};
    (Array.isArray(masterItems) ? masterItems : []).forEach(i => {
      unitMap[i.item_id] = i.unit || "";
    });

    const prevDay = (Array.isArray(days) ? days : [])
      .filter(d => d.location === location && String(d.status).toUpperCase() === "CLOSED")
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!prevDay) {
      submitStartInventoryDay(null);
      return;
    }

    const itemsData = await fetch(
      `${API_URL}?type=dailyInventoryItems` +
      `&date=${encodeURIComponent(prevDay.date)}&location=${encodeURIComponent(location)}`
    ).then(r => r.json());

    const prevItems = (itemsData.items || []).filter(i => Number(i.remaining) > 0);

    if (!prevItems.length) {
      submitStartInventoryDay(null);
      return;
    }

    openModal(`
      <div class="modal-header">
        🌅 Start Inventory Day — stock remaining from ${new Date(prevDay.date).toLocaleDateString()}
      </div>
      <p style="padding:4px 0;color:#666">
        Choose how much of yesterday's remaining stock to carry over. Set an item to 0 to leave it out.
      </p>

      <div style="max-height:340px;overflow:auto;margin-top:8px">
        ${prevItems.map(i => {
          const unit = unitMap[i.item_id] || "";
          const remaining = Number(i.remaining) || 0;
          return `
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
            <div style="flex:1">
              ${i.item_name}${unit ? ` <span style="color:#888">(${unit})</span>` : ""}
              <div style="font-size:12px;color:#888">Remaining: ${remaining}</div>
            </div>
            <button type="button" class="btn-back"
              onclick="this.nextElementSibling.value = 0"
              style="padding:4px 10px;font-size:12px;white-space:nowrap">
              NONE
            </button>
            <input type="number" min="0"
              data-carry-id="${i.item_id}"
              value="${remaining}"
              style="width:90px">
          </div>
        `;
        }).join("")}
      </div>

      <div class="modal-actions">
        <button class="btn-back" onclick="zeroAllCarryOver()">NO CARRY OVER</button>
        <button class="btn-back" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="confirmCarryOverStart()">Start Day</button>
      </div>
    `, true);

  } catch (err) {
    console.error(err);
    alert("❌ Failed to load yesterday's stock");
  } finally {
    hideLoader();
  }
}

window.zeroAllCarryOver = function () {
  document.querySelectorAll("[data-carry-id]").forEach(input => {
    input.value = 0;
  });
};

window.confirmCarryOverStart = function () {
  const items = [];
  document.querySelectorAll("[data-carry-id]").forEach(input => {
    const qty = Number(input.value) || 0;
    if (qty > 0) {
      items.push({ item_id: input.dataset.carryId, qty });
    }
  });

  submitStartInventoryDay(items);
};

async function submitStartInventoryDay(items) {
  const date = getPHDate();
  const location = localStorage.getItem("userLocation");

  closeModal();
  showLoader("Starting inventory day…");

  try {
    // mode is just the fallback when no items are picked — the actual
    // per-item carry amounts (or the absence of any) come from `items`.
    const body = { action: "startNewInventoryDay", date, location, mode: "EMPTY" };
    if (items && items.length) {
      body.items = JSON.stringify(items);
    }

    const res = await authFetch(API_URL, {
      method: "POST",
      body: new URLSearchParams(body)
    });

    const data = await res.json();

    if (!data.success) {
      alert("❌ " + data.error);
      return;
    }

    alert(
      items && items.length
        ? "✅ Inventory day started with selected stock carried over"
        : "✅ Inventory day started"
    );
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
    const [res, itemsRes] = await Promise.all([
      fetch(
        `${API_URL}?type=dailyInventoryItems` +
        `&date=${encodeURIComponent(date)}` +
        `&location=${encodeURIComponent(location)}`
      ),
      fetch(`${API_URL}?type=inventoryItems`)
    ]);

const data = await res.json();
const masterItems = await itemsRes.json();

// item_id → conversion info, so we can show a quantity-equivalent
// alongside the raw Total Added / Remaining numbers.
const conversionMap = {};
(Array.isArray(masterItems) ? masterItems : []).forEach(i => {
  conversionMap[i.item_id] = {
    unit: i.unit || "",
    perServing: Number(i.quantity_per_serving) || 0
  };
});

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
            : items.map(i => {
                const added = Number(i.qty_added) || 0;
                const remaining = Number(i.remaining) || 0;
                const conv = conversionMap[i.item_id];
                const addedEquiv = conv && conv.perServing
                  ? `<br><small style="color:#888">= ${(added * conv.perServing).toLocaleString()} ${conv.unit}</small>`
                  : "";
                const remainingEquiv = conv && conv.perServing
                  ? `<br><small style="color:#888">= ${(remaining * conv.perServing).toLocaleString()} ${conv.unit}</small>`
                  : "";

                return `
                <tr>
                  <td>${i.item_name}</td>
                  <td>${added}${addedEquiv}</td>
                  <td>${remaining}${remainingEquiv}</td>
                </tr>
              `;
              }).join("")
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
    const [items, dailyData] = await Promise.all([
      fetch(`${API_URL}?type=inventoryItems`).then(r => r.json()),
      fetch(
        `${API_URL}?type=dailyInventoryItems` +
        `&date=${encodeURIComponent(date)}&location=${encodeURIComponent(location)}`
      ).then(r => r.json())
    ]);

    inventoryItems = items;

    // item_id → remaining, so staff can see current stock while topping it up
    const remainingMap = {};
    (dailyData.items || []).forEach(r => {
      remainingMap[r.item_id] = Number(r.remaining) || 0;
    });

    openModal(
      `
      <div class="modal-header">
        Add Inventory — ${date}
      </div>

      <div style="max-height:320px;overflow:auto;margin-top:12px">
        ${inventoryItems.map(i => {
          const unit = i.unit || "";
          const perServing = Number(i.quantity_per_serving) || 0;
          const remaining = remainingMap[i.item_id] ?? 0;

          return `
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
            <div style="flex:1">
              ${i.item_name}${unit ? ` <span style="color:#888">(${unit})</span>` : ""}
              <div style="font-size:12px;color:#888">
                Currently: ${remaining}${unit ? " " + unit : ""}
              </div>
            </div>
            <input type="number" min="0"
              data-id="${i.item_id}"
              data-yield="${perServing}"
              data-unit="${unit}"
              class="add-inventory-qty"
              style="width:90px"
              placeholder="Qty">
            <div class="add-inventory-yield" style="width:140px;font-size:12px;color:#555">—</div>
          </div>
        `;
        }).join("")}
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

    bindAddInventoryYieldInputs();
  } catch (err) {
    console.error(err);
    alert("Failed to load inventory");
  } finally {
    hideLoader();
  }
};

/* ================= LIVE TOTAL CALC =================
   quantity_per_serving = how much of the base unit one count of this
   item represents (e.g. Pancit Bato = 60g each), so the quantity typed
   × quantity_per_serving = the total base-unit amount being added. */
function bindAddInventoryYieldInputs() {
  document.querySelectorAll(".add-inventory-qty").forEach(input => {
    const yieldEl = input.nextElementSibling;
    const perServing = Number(input.dataset.yield) || 0;
    const unit = input.dataset.unit || "";

    input.addEventListener("input", () => {
      const qty = Number(input.value) || 0;

      if (!perServing || !qty) {
        yieldEl.textContent = "—";
        return;
      }

      const total = qty * perServing;
      yieldEl.textContent = `= ${total.toLocaleString()}${unit} Total Added`;
    });
  });
}

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

  authFetch(
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