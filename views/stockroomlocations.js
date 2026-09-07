import { bindDataBoxScroll, showLoader, hideLoader, getCached, invalidateCache } from "../admin.js";
import { openModal, closeModal } from "./modal.js";
import { authFetch } from "../auth-guard.js";

import { API_URL } from "../firebase-config.js";
import { icon } from "../icons.js";

/* ================= STATE ================= */
let stockrooms = [];
let selected = null;
let currentStockroom = null; // set while the batch screen is open

/* ================= ENTRY ================= */
export default async function loadStockroomLocationsView() {
  currentStockroom = null;
  await showListScreen();
}

/* ================= LIST SCREEN ================= */
async function showListScreen() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <button class="category-action-btn" id="addBtn">${icon("plus")} Add Stockroom</button>
    <button class="category-action-btn" id="editBtn" disabled>${icon("pencil")} Edit</button>
    <button class="category-action-btn" id="batchesBtn" disabled>${icon("archive")} View Batches</button>
    <button class="category-action-btn" id="deleteBtn" disabled>${icon("trash-2")} Delete</button>
  `;

  contentBox.innerHTML = `
    <div class="data-box">
      <p class="set-section-hint" style="margin:0 0 10px">
        Physical stock pools that "Start Inventory Day" and "Add Inventory" draw from,
        so what gets entered is based on what's actually on hand — not a guess.
      </p>
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Stockroom Name</th>
              <th>Address</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody id="stockroomBody"><tr><td colspan="4" style="text-align:center;color:#888">Loading…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));

  document.getElementById("addBtn").onclick = () => openStockroomModal();
  document.getElementById("editBtn").onclick = () =>
    selected && openStockroomModal(selected);
  document.getElementById("batchesBtn").onclick = () =>
    selected && showBatchScreen(selected);
  document.getElementById("deleteBtn").onclick = deleteStockroom;

  await loadStockrooms();
}

/* ================= LOAD DATA ================= */
async function loadStockrooms() {
  stockrooms = await getCached("stockroomLocations");
  selected = null;

  document.getElementById("editBtn").disabled = true;
  document.getElementById("batchesBtn").disabled = true;
  document.getElementById("deleteBtn").disabled = true;

  renderTable();
}

/* ================= RENDER ================= */
function renderTable() {
  const tbody = document.getElementById("stockroomBody");
  tbody.innerHTML = "";

  if (!stockrooms.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:#888">
          No stockrooms yet
        </td>
      </tr>
    `;
    return;
  }

  stockrooms.forEach((s, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${s.stockroom_name}</td>
      <td>${s.address || ""}</td>
      <td>${s.active ? icon("check", { style: "color:#34c759" }) : icon("x", { style: "color:#8e8e93" })}</td>
    `;

    tr.onclick = () => {
      document
        .querySelectorAll("#stockroomBody tr")
        .forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");

      selected = s;
      document.getElementById("editBtn").disabled = false;
      document.getElementById("batchesBtn").disabled = false;
      document.getElementById("deleteBtn").disabled = false;
    };

    tbody.appendChild(tr);
  });
}

/* ================= STOCKROOM MODAL ================= */
function openStockroomModal(loc = {}) {
  openModal(`
    <div class="modal-header">
      ${loc.stockroom_id ? "Edit" : "Add"} Stockroom
    </div>

    <label>Name</label>
    <input id="srName" value="${loc.stockroom_name || ""}">

    <label>Address</label>
    <input id="srAddress" value="${loc.address || ""}">

    <div class="modal-actions">
      <button class="btn-danger" id="saveStockroomBtn">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("saveStockroomBtn").onclick = () => saveStockroom(loc);
}

/* ================= SAVE ================= */
async function saveStockroom(loc) {
  const name = srName.value.trim();
  const address = srAddress.value.trim();

  if (!name) return alert("Stockroom name required");

  closeModal();
  showLoader(loc.stockroom_id ? "Updating stockroom…" : "Adding stockroom…");

  const action = loc.stockroom_id ? "updateStockroomLocation" : "addStockroomLocation";
  const data = {
    stockroom_name: name,
    address,
    // Preserve the existing active state on edit rather than resurrecting
    // a soft-deleted stockroom just because its name/address was updated.
    active: loc.stockroom_id ? (loc.active !== false) : true
  };
  if (loc.stockroom_id) data.stockroom_id = loc.stockroom_id;

  try {
    const res = await authFetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action, data: JSON.stringify(data) })
    });
    const result = await res.json();
    if (!result.success) {
      hideLoader();
      alert(result.error || "Failed to save stockroom");
      return;
    }
  } catch (err) {
    hideLoader();
    alert("Failed to save stockroom");
    return;
  }

  invalidateCache("stockroomLocations");
  await loadStockrooms();
  hideLoader();
}

/* ================= DELETE ================= */
async function deleteStockroom() {
  if (!selected) return;
  if (!confirm("Delete this stockroom?")) return;

  showLoader("Deleting stockroom…");

  try {
    const res = await authFetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "deleteStockroomLocation", stockroom_id: selected.stockroom_id })
    });
    const result = await res.json();
    if (!result.success) {
      hideLoader();
      alert(result.error || "Failed to delete stockroom");
      return;
    }
  } catch (err) {
    hideLoader();
    alert("Failed to delete stockroom");
    return;
  }

  invalidateCache("stockroomLocations");
  await loadStockrooms();
  hideLoader();
}

/* =========================================================
   BATCH SCREEN — drills into one stockroom, swap-in-place
   (same content-box, not a nested modal), matching the
   dailyinventory.js renderInvView/renderInvAdd pattern.
========================================================= */
function batchHeader() {
  return `
    <div class="inv-modal-header" style="margin-bottom:14px">
      <h2 style="margin:0;font-size:18px">${icon("archive")} ${currentStockroom.stockroom_name}</h2>
    </div>
    ${currentStockroom.address ? `<p class="set-section-hint" style="margin:-8px 0 10px">${currentStockroom.address}</p>` : ""}
  `;
}

async function showBatchScreen(stockroom) {
  currentStockroom = stockroom;

  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <button class="category-action-btn" id="backBtn">← Back to Stockrooms</button>
    <button class="category-action-btn" id="addBatchBtn">${icon("plus")} Add Batch</button>
  `;

  contentBox.innerHTML = `
    <div class="data-box">
      ${batchHeader()}
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Available Qty</th>
              <th>Batches</th>
              <th>Oldest Good-Until</th>
            </tr>
          </thead>
          <tbody id="batchBody"><tr><td colspan="4" style="text-align:center;color:#888">Loading…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));

  document.getElementById("backBtn").onclick = () => showListScreen();
  document.getElementById("addBatchBtn").onclick = showAddBatchScreen;

  await loadBatchAvailability();
}

/* ================= LOAD BATCH DATA =================
   Bypasses getCached() on purpose — this changes on every daily
   inventory save, so caching it would actively serve stale numbers. */
async function loadBatchAvailability() {
  const tbody = document.getElementById("batchBody");
  if (!tbody) return;

  try {
    const res = await fetch(
      `${API_URL}?type=stockroomAvailability&stockroom_id=${encodeURIComponent(currentStockroom.stockroom_id)}`
    );
    const items = await res.json();

    if (!Array.isArray(items) || !items.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#888">No batches in this stockroom yet</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .sort((a, b) => a.item_name.localeCompare(b.item_name))
      .map(i => `
        <tr>
          <td>${i.item_name}</td>
          <td>${i.available_qty.toLocaleString()}</td>
          <td>${i.batch_count}</td>
          <td>${i.oldest_good_until || "—"}</td>
        </tr>
      `)
      .join("");
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#888">Failed to load batches</td></tr>`;
  }
}

/* =========================================================
   ADD BATCH SCREEN — same list-of-items + single Save pattern
   as "Add Inventory" in the Daily Inventory System: one shared
   Good Until date for the batch, then every item gets its own
   qty field, all saved together in one request.
========================================================= */
function renderAddBatchScreen(items, defaultGoodUntil) {
  const rows = items.map(i => {
    const unit = i.unit || "";
    return `
      <div class="inv-item-row">
        <div class="inv-item-info">
          <div class="inv-item-name">${i.item_name}${unit ? ` <span class="inv-item-unit">(${unit})</span>` : ""}</div>
        </div>
        <input type="number" min="0"
          data-batch-item-id="${i.item_id}"
          class="add-batch-qty"
          placeholder="Qty">
      </div>
    `;
  }).join("");

  return `
    <div class="data-box">
      ${batchHeader()}
      <div style="display:flex;align-items:center;gap:10px;margin:0 0 12px">
        <label style="margin:0;font-weight:600">Good Until</label>
        <input type="date" id="batchGoodUntilAll" value="${defaultGoodUntil}">
      </div>
      <div id="addBatchError" class="inv-save-error hidden"></div>
      <div class="data-scroll">
        ${rows}
      </div>
    </div>
  `;
}

async function showAddBatchScreen() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <button class="category-action-btn" id="backBtn">← Back</button>
    <button class="category-action-btn" id="saveBatchBtn">${icon("save")} Save</button>
  `;

  contentBox.innerHTML = `
    <div class="data-box">
      ${batchHeader()}
      <div class="inv-modal-empty-cell" style="padding:48px 12px">
        ${icon("refresh-cw", { size: 20, class: "inv-spin" })}<br>Loading…
      </div>
    </div>
  `;

  document.getElementById("backBtn").onclick = () => showBatchScreen(currentStockroom);

  const items = (await getCached("inventoryItems")).filter(i => i.active !== false);
  const defaultGoodUntil = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  contentBox.innerHTML = renderAddBatchScreen(items, defaultGoodUntil);
  bindDataBoxScroll(document.querySelector(".data-box"));

  document.getElementById("saveBatchBtn").onclick = saveBatches;
}

/* ================= SAVE BATCHES ================= */
async function saveBatches() {
  const inputs = document.querySelectorAll(".add-batch-qty");
  const items = [];

  inputs.forEach(i => {
    const qty = Number(i.value);
    if (qty > 0) {
      items.push({ item_id: i.dataset.batchItemId, qty });
    }
  });

  const errorEl = document.getElementById("addBatchError");
  if (errorEl) errorEl.classList.add("hidden");

  const goodUntil = document.getElementById("batchGoodUntilAll")?.value;

  if (!items.length) {
    if (errorEl) {
      errorEl.textContent = "No quantities entered";
      errorEl.classList.remove("hidden");
    } else {
      alert("No quantities entered");
    }
    return;
  }

  if (!goodUntil) {
    if (errorEl) {
      errorEl.textContent = "Good-until date required";
      errorEl.classList.remove("hidden");
    } else {
      alert("Good-until date required");
    }
    return;
  }

  const saveBtn = document.getElementById("saveBatchBtn");
  const resetSaveBtn = () => {
    if (!saveBtn) return;
    saveBtn.disabled = false;
    saveBtn.innerHTML = `${icon("save")} Save`;
  };

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `${icon("refresh-cw", { class: "inv-spin" })} Saving…`;
  }

  try {
    const res = await authFetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "addStockroomBatches",
        stockroom_id: currentStockroom.stockroom_id,
        good_until: goodUntil,
        items: JSON.stringify(items)
      })
    });
    const result = await res.json();
    if (!result.success) {
      if (errorEl) {
        errorEl.textContent = result.error || "Failed to add batch";
        errorEl.classList.remove("hidden");
      } else {
        alert(result.error || "Failed to add batch");
      }
      resetSaveBtn();
      return;
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = "Failed to add batch";
      errorEl.classList.remove("hidden");
    }
    resetSaveBtn();
    return;
  }

  // Back to the item-totals screen for this stockroom, now reflecting
  // the batches just added.
  await showBatchScreen(currentStockroom);
}
