import { bindDataBoxScroll, getCached, invalidateCache } from "../admin.js";
import { openModal, closeModal, showModalLoader, hideModalLoader } from "./modal.js";

/* =========================================================
   CONFIG
========================================================= */
import { openCloseDayModal } from "../admin-close-day.js";
import { icon } from "../icons.js";
import { saveInventoryItem as saveInventoryItemSupabase, deleteInventoryItem as deleteInventoryItemSupabase } from "../data/inventoryItems.js";
import {
  listDailyInventoryDays,
  getDailyInventoryItems,
  startInventoryDay as startInventoryDaySupabase,
  addDailyInventory as addDailyInventorySupabase
} from "../data/dailyInventory.js";

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
let locationMap = {};
let searchDate = "";
let searchLocation = "";

const el = id => document.getElementById(id);

/* ================= ENTRY ================= */
export default async function loadDailyInventoryView() {
  renderActionBar();

  el("contentBox").innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Location</th>
              <th>Created By</th>
              <th>Inventory</th>
            </tr>
          </thead>
          <tbody id="dailyInventoryBody"><tr><td colspan="5" style="text-align:center;color:#888">Loading…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));

  try {
    locations = await getCached("locations");
    locations.forEach(l => { locationMap[l.location_id] = l.location_name; });
  } catch (err) {
    console.warn("Failed to load locations", err);
  }

  loadDailyInventory();
}

function getPHDate() {
  const now = new Date();
  const ph = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  return ph.toISOString().slice(0, 10);
}

/* Used everywhere a date reaches the screen (table rows, modal headers)
   — the backend's raw `date` value is an ISO datetime string, which
   used to leak straight into a couple of modal titles unformatted
   (e.g. "Inventory — 2026-09-13T16:00:00.000Z"). */
function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  el("actionBar").innerHTML = `
    <input id="searchDateInput" placeholder="Search date" />
    <input id="searchLocationInput" placeholder="Search location" />

            <button id="startDayBtn" class="primary">
  ${icon("sunrise")} Start Inventory Day
</button>

    <button id="closeDayBtn" class="danger">
  ${icon("lock")} Close Inventory Day
</button>

    <button id="inventoryItemsBtn" class="category-action-btn" style="margin-left:auto">
  ${icon("archive")} Inventory Items
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

  el("inventoryItemsBtn").onclick = openInventoryItemsModal;
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

/* Shows EVERY catalog item (not just ones yesterday happened to still
   have stock in) so the admin picks exactly how much of each to carry
   into today — set an item to 0 to leave it out. An item that hit 0
   remaining (or was never tracked at all) used to silently drop out of
   every future day's carry-over forever, since it was only ever
   sourced from yesterday's own nonzero rows; now it's always in the
   list, pre-filled with whatever it actually had (0 if none), never
   dropped just for being out of stock. */
async function loadCarryOverReview(location) {
  showLoader("Loading yesterday's remaining stock…");

  try {
    const [{ rows: days }, masterItems] = await Promise.all([
      listDailyInventoryDays({ limit: 1000, offset: 0 }),
      getCached("inventoryItems")
    ]);

    // Inactive items don't get carried into a new day's tracking going
    // forward, same as they can't be freshly added elsewhere — they
    // stay exactly as they were in whatever day already has them.
    const catalog = (Array.isArray(masterItems) ? masterItems : []).filter(i => i.active !== false);
    const unitMap = {};
    catalog.forEach(i => {
      unitMap[i.item_id] = i.unit || "";
    });

    const prevDay = days
      .filter(d => d.location === location && String(d.status).toUpperCase() === "CLOSED")
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    const remainingByItemId = {};
    if (prevDay) {
      const itemsData = await getDailyInventoryItems(prevDay.date, location);
      (itemsData.items || []).forEach(i => {
        remainingByItemId[i.item_id] = Number(i.remaining) || 0;
      });
    }

    const prevItems = catalog.map(i => ({
      item_id: i.item_id,
      item_name: i.item_name,
      remaining: remainingByItemId[i.item_id] || 0
    }));

    if (!prevItems.length) {
      submitStartInventoryDay(null);
      return;
    }

    openModal(`
      <div class="modal-header">
        ${icon("sunrise")} Start Inventory Day${prevDay ? ` — stock remaining from ${new Date(prevDay.date).toLocaleDateString()}` : ""}
      </div>
      <p style="padding:4px 0;color:#666">
        Every catalog item is listed below${prevDay ? ", pre-filled with what was left yesterday" : ""}.
        Choose how much to carry into today — set an item to 0 to leave it out.
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
  // Every catalog item gets an explicit row — including ones left at
  // 0 — so today's day always starts with the full catalog trackable
  // (Stocks List / Add Inventory show it as "0 remaining" instead of
  // it just not existing yet), not only whatever had stock or got
  // manually bumped above 0 in this review.
  const items = [];
  document.querySelectorAll("[data-carry-id]").forEach(input => {
    const qty = Number(input.value) || 0;
    items.push({ item_id: input.dataset.carryId, qty });
  });

  submitStartInventoryDay(items);
};

async function submitStartInventoryDay(items) {
  const date = getPHDate();
  const location = localStorage.getItem("userLocation");

  closeModal();
  showLoader("Starting inventory day…");

  try {
    await startInventoryDaySupabase(date, location, CREATED_BY, items && items.length ? items : null);

    alert(
      items && items.length
        ? "✅ Inventory day started with selected stock carried over"
        : "✅ Inventory day started"
    );
    loadDailyInventory(); // refresh table

  } catch (err) {
    console.error(err);
    alert("❌ " + (err.message || "Failed to start inventory day"));
  } finally {
    hideLoader();
  }
}

/* ================= LOAD DAILY INVENTORY =================
   This list only grows — one row per location per day, forever — so
   pulling and rendering the entire history on every visit to this tab
   doesn't scale. Loads just the most recent page; "View More" below
   fetches further pages on demand. Server returns rows already sorted
   newest-first, so pages can just be appended in fetch order. */
const DAILY_INVENTORY_PAGE_SIZE = 5;
let dailyInventoryOffset = 0;
let dailyInventoryHasMore = false;

async function loadDailyInventory() {
  dailyInventory = [];
  dailyInventoryOffset = 0;
  dailyInventoryHasMore = false;

  try {
    const data = await listDailyInventoryDays({ limit: DAILY_INVENTORY_PAGE_SIZE, offset: 0 });

    dailyInventory = data.rows || [];
    dailyInventoryOffset = dailyInventory.length;
    dailyInventoryHasMore = !!data.hasMore;
    renderTable();
  } catch (err) {
    console.error(err);
    alert("Failed to load daily inventory");
  }
}

async function loadMoreDailyInventory() {
  const btn = el("dailyInventoryViewMoreBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Loading…";
  }

  try {
    const data = await listDailyInventoryDays({ limit: DAILY_INVENTORY_PAGE_SIZE, offset: dailyInventoryOffset });

    dailyInventory = dailyInventory.concat(data.rows || []);
    dailyInventoryOffset = dailyInventory.length;
    dailyInventoryHasMore = !!data.hasMore;
    renderTable();
  } catch (err) {
    console.error(err);
    alert("Failed to load more daily inventory");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "View More";
    }
  }
}
window.loadMoreDailyInventory = loadMoreDailyInventory;

/* ================= TABLE ================= */
function renderTable() {
  const tbody = el("dailyInventoryBody");
  tbody.innerHTML = "";

  const filtered = dailyInventory.filter(d =>
    (!searchDate ||
      new Date(d.date).toLocaleDateString().toLowerCase().includes(searchDate)) &&
    (!searchLocation ||
      (locationMap[d.location] || d.location || "").toLowerCase().includes(searchLocation))
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

  filtered.forEach(d => {
    const isOpen = String(d.status).toUpperCase() === "OPEN";
    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${new Date(d.date).toLocaleDateString()}</td>
        <td><span class="status-chip ${isOpen ? "good" : "neutral"}">${isOpen ? "Open" : "Closed"}</span></td>
        <td>${locationMap[d.location] || d.location}</td>
        <td>${d.created_by || "-"}</td>
        <td>
<button class="btn-view"
  onclick="viewDailyInventory(
  '${d.date}',
    '${d.location}',
    '${d.status}'
  )">
            ${icon("eye", { size: 13 })} View
          </button>
        </td>
      </tr>
    `);
  });

  // A search/filter only narrows what's already loaded — it doesn't
  // reach further into history — so hide "View More" while filtering
  // rather than imply it would search unloaded rows too.
  if (dailyInventoryHasMore && !searchDate && !searchLocation) {
    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td colspan="5" style="text-align:center;padding:12px">
          <button id="dailyInventoryViewMoreBtn" class="btn-view" onclick="loadMoreDailyInventory()">
            View More
          </button>
        </td>
      </tr>
    `);
  }
}

/* ================= INVENTORY MODAL — SHARED HELPERS =================
   View, Add, and Loading are all "screens" swapped within the SAME
   open modal (via swapModalContent) instead of each being its own
   openModal() call — reads as one window whose content updates,
   rather than a jarring full modal replace. It also means any
   in-progress loading state lives inside the still-open modal itself,
   sidestepping the global loader (whose z-index sits below the modal
   overlay, so showLoader() while a modal is open used to render
   invisibly behind it). */
function invHeader(iconName, title) {
  return `
    <div class="inv-modal-header">
      <h2>${icon(iconName)} ${title}</h2>
      <button type="button" class="inv-modal-close-x" onclick="closeModal()">${icon("x")}</button>
    </div>
  `;
}

function swapModalContent(html, afterSwap) {
  const box = document.getElementById("modalBox");
  if (!box) return;

  box.classList.add("inv-modal-fade");
  setTimeout(() => {
    box.innerHTML = html;
    requestAnimationFrame(() => box.classList.remove("inv-modal-fade"));
    if (afterSwap) afterSwap();
  }, 140);
}

function renderInvView(date, location, status, items, conversionMap) {
  const rows = !items.length
    ? `<tr><td colspan="3" class="inv-modal-empty-cell">No data</td></tr>`
    : items.map(i => {
        const added = Number(i.qty_added) || 0;
        const remaining = Number(i.remaining) || 0;
        const conv = conversionMap[i.item_id];
        const addedEquiv = conv && conv.perServing
          ? ` <small style="color:#888">(${(added * conv.perServing).toLocaleString()} ${conv.unit})</small>`
          : "";
        const remainingEquiv = conv && conv.perServing
          ? ` <small style="color:#888">(${(remaining * conv.perServing).toLocaleString()} ${conv.unit})</small>`
          : "";

        return `
          <tr>
            <td>${i.item_name}</td>
            <td>${added}${addedEquiv}</td>
            <td>${remaining}${remainingEquiv}</td>
          </tr>
        `;
      }).join("");

  return `
    ${invHeader("clipboard-list", `Inventory — ${formatDate(date)}`)}
    <div class="inv-modal-scroll">
      <table class="category-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Total Added</th>
            <th>Remaining</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="modal-actions">
      ${String(status).toUpperCase() === "OPEN" ? `
        <button class="category-action-btn"
          onclick="openAddInventoryForDay('${date}','${location}')">
          ${icon("plus")} Add Inventory
        </button>
      ` : ""}
      <button class="inv-modal-btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;
}

async function fetchInvViewData(date, location) {
  const [data, masterItems] = await Promise.all([
    getDailyInventoryItems(date, location),
    getCached("inventoryItems")
  ]);

  // item_id → conversion info, so we can show a quantity-equivalent
  // alongside the raw Total Added / Remaining numbers.
  const conversionMap = {};
  (Array.isArray(masterItems) ? masterItems : []).forEach(i => {
    conversionMap[i.item_id] = {
      unit: i.unit || "",
      perServing: Number(i.quantity_per_serving) || 0
    };
  });

  return { data, conversionMap };
}

/* ================= VIEW DAILY INVENTORY ITEMS ================= */
window.viewDailyInventory = async function (date, location, status) {
  showLoader("Loading inventory…");

  try {
    const { data, conversionMap } = await fetchInvViewData(date, location);

    // 🛑 NO ACTIVE INVENTORY
    if (data.status === "NO_ACTIVE_INVENTORY") {
      openModal(
        `
        ${invHeader("clipboard-list", `Inventory — ${formatDate(date)}`)}
        <div class="inv-modal-empty-cell" style="padding:32px 12px">
          No active inventory for today
        </div>
        <div class="modal-actions">
          <button class="inv-modal-btn-secondary" onclick="closeModal()">Close</button>
        </div>
        `,
        true
      );
      return;
    }

    openModal(renderInvView(date, location, status, data.items || [], conversionMap), true);
  } catch (err) {
    console.error(err);
    alert("Failed to load inventory");
  } finally {
    hideLoader();
  }
};

/* ================= NEW ADD TODAY INVENTORY ================= */

function renderInvAdd(date, location, items, remainingMap) {
  const rows = items.map(i => {
    const unit = i.unit || "";
    const perServing = Number(i.quantity_per_serving) || 0;
    const remaining = remainingMap[i.item_id] ?? 0;
    const remainingEquiv = perServing ? ` (${(remaining * perServing).toLocaleString()}${unit})` : "";

    return `
      <div class="inv-item-row">
        <div class="inv-item-info">
          <div class="inv-item-name">${i.item_name}${unit ? ` <span class="inv-item-unit">(${unit})</span>` : ""}</div>
          <div class="inv-item-current">Currently: ${remaining}${remainingEquiv}</div>
        </div>
        <input type="number" min="0"
          data-id="${i.item_id}"
          data-yield="${perServing}"
          data-unit="${unit}"
          class="add-inventory-qty"
          placeholder="${unit ? `Total ${unit}` : "Qty"}">
        <div class="add-inventory-yield">—</div>
      </div>
    `;
  }).join("");

  return `
    ${invHeader("plus", `Add Inventory — ${formatDate(date)}`)}
    <div class="inv-modal-scroll inv-modal-scroll-form">
      ${rows}
    </div>
    <div id="invSaveError" class="inv-save-error hidden"></div>
    <div class="modal-actions">
      <button id="invSaveBtn" class="category-action-btn"
        onclick="saveInventoryForDay('${date}','${location}')">
        ${icon("save")} Save
      </button>
      <button class="inv-modal-btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `;
}

window.openAddInventoryForDay = async function (date, location) {
  // Swap to a lightweight loading screen INSIDE the still-open modal —
  // no separate overlay, so nothing can render behind the modal, and
  // it reads as the same window updating rather than a modal swap.
  swapModalContent(`
    ${invHeader("plus", `Add Inventory — ${formatDate(date)}`)}
    <div class="inv-modal-empty-cell" style="padding:48px 12px">
      ${icon("refresh-cw", { size: 20, class: "inv-spin" })}<br>Loading…
    </div>
  `);

  try {
    const [items, dailyData] = await Promise.all([
      getCached("inventoryItems"),
      getDailyInventoryItems(date, location)
    ]);

    // Only active items can be freshly added to a day's tracking.
    inventoryItems = (items || []).filter(i => i.active !== false);

    // item_id → remaining, so staff can see current stock while topping it up
    const remainingMap = {};
    (dailyData.items || []).forEach(r => {
      remainingMap[r.item_id] = Number(r.remaining) || 0;
    });

    swapModalContent(
      renderInvAdd(date, location, inventoryItems, remainingMap),
      bindAddInventoryYieldInputs
    );
  } catch (err) {
    console.error(err);
    swapModalContent(`
      ${invHeader("plus", `Add Inventory — ${formatDate(date)}`)}
      <div class="inv-modal-empty-cell" style="padding:32px 12px">
        Failed to load inventory.
      </div>
      <div class="modal-actions">
        <button class="inv-modal-btn-secondary" onclick="closeModal()">Close</button>
      </div>
    `);
  }
};

/* ================= LIVE TOTAL CALC =================
   quantity_per_serving = how much of the base unit one count of this
   item represents (e.g. Pancit Bato = 60g each). Staff now enters the
   TOTAL base-unit amount straight off the scale (e.g. 1000g) — the
   field divides by quantity_per_serving to get the actual qty that
   gets recorded (still what the recipe/stock-deduction system uses),
   instead of staff doing that division by hand before typing anything. */
function inputToQty(input) {
  const raw = Number(input.value) || 0;
  const perServing = Number(input.dataset.yield) || 0;
  return perServing ? raw / perServing : raw;
}

function bindAddInventoryYieldInputs() {
  document.querySelectorAll(".add-inventory-qty").forEach(input => {
    const yieldEl = input.nextElementSibling;

    input.addEventListener("input", () => {
      const raw = Number(input.value) || 0;

      if (!raw) {
        yieldEl.textContent = "—";
        return;
      }

      const qty = inputToQty(input);
      yieldEl.textContent = `= ${qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} qty`;
    });
  });
}

window.saveInventoryForDay = function (date, location) {
  const inputs = document.querySelectorAll("[data-id]");
  const items = [];

  inputs.forEach(i => {
    const qty = Math.round(inputToQty(i) * 100) / 100;
    if (qty > 0) {
      items.push({ item_id: i.dataset.id, qty });
    }
  });

  const errorEl = document.getElementById("invSaveError");
  if (errorEl) errorEl.classList.add("hidden");

  if (!items.length) {
    if (errorEl) {
      errorEl.textContent = "No quantities entered";
      errorEl.classList.remove("hidden");
    } else {
      alert("No quantities entered");
    }
    return;
  }

  const saveBtn = document.getElementById("invSaveBtn");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `${icon("refresh-cw", { class: "inv-spin" })} Saving…`;
  }

  const resetSaveBtn = () => {
    if (!saveBtn) return;
    saveBtn.disabled = false;
    saveBtn.innerHTML = `${icon("save")} Save`;
  };

  addDailyInventorySupabase(date, location, CREATED_BY, items)
    .then(async () => {
      // Refresh the underlying admin table in the background — it's
      // behind the modal, so this doesn't disturb what's on screen —
      // then transition this same window back to the updated View
      // screen instead of closing it.
      loadDailyInventory();

      try {
        const { data, conversionMap } = await fetchInvViewData(date, location);
        swapModalContent(renderInvView(date, location, data.status, data.items || [], conversionMap));
      } catch (err) {
        console.error(err);
        closeModal();
      }
    })
    .catch(err => {
      console.error(err);
      if (errorEl) {
        errorEl.textContent = err.message || "Failed to save inventory";
        errorEl.classList.remove("hidden");
      } else {
        alert(err.message || "Failed to save inventory");
      }
      resetSaveBtn();
    });
};

/* ================= INVENTORY ITEMS MODAL =================
   Combines the old standalone "Inventory" tab's catalog management
   (Add/Edit/Delete item) into this tab, reached via the "Inventory
   Items" button. Uses the same header/crossfade primitives as the
   View/Add Inventory screens above — one modal window whose content
   swaps between grid, add/edit form, and delete confirm instead of
   closing and reopening for every step. Items render as chips (same
   look as Categories & Products' category chips) instead of a table;
   clicking a chip opens Edit directly, same as a Product card. */
let inventoryItemsCatalog = [];
let invItemsSearch = "";

function normalizeInventoryItems(data) {
  return (Array.isArray(data) ? data : []).map(r => {
    if (!Array.isArray(r)) {
      return {
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
    return {
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
}

async function openInventoryItemsModal() {
  openModal(`
    ${invHeader("archive", "Inventory Items")}
    <div class="inv-modal-empty-cell" style="padding:48px 12px">
      ${icon("refresh-cw", { size: 20, class: "inv-spin" })}<br>Loading…
    </div>
  `, true);

  try {
    inventoryItemsCatalog = normalizeInventoryItems(await getCached("inventoryItems"));
    invItemsSearch = "";
    showInventoryItemsGrid();
  } catch (err) {
    console.error(err);
    swapModalContent(`
      ${invHeader("archive", "Inventory Items")}
      <div class="inv-modal-empty-cell" style="padding:32px 12px">Failed to load inventory items.</div>
      <div class="modal-actions">
        <button class="inv-modal-btn-secondary" onclick="closeModal()">Close</button>
      </div>
    `);
  }
}

function inventoryItemsGridHTML() {
  return `
    ${invHeader("archive", "Inventory Items")}
    <input id="invItemsSearchInput" placeholder="Search items..." value="${invItemsSearch}">
    <div class="inv-modal-scroll">
      <div class="admin-product-grid" id="invItemsGrid"></div>
    </div>
    <div class="modal-actions">
      <button class="inv-modal-btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `;
}

function showInventoryItemsGrid() {
  swapModalContent(inventoryItemsGridHTML(), () => {
    const searchInput = document.getElementById("invItemsSearchInput");
    if (searchInput) {
      searchInput.oninput = e => {
        invItemsSearch = e.target.value.toLowerCase();
        renderInvItemsGridBody();
      };
    }
    renderInvItemsGridBody();
  });
}

function renderInvItemsGridBody() {
  const grid = document.getElementById("invItemsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  grid.insertAdjacentHTML("beforeend", `
    <button type="button" class="category-chip category-chip-add" id="addInvItemChip">
      ${icon("plus", { size: 22 })}
      <span>Add Item</span>
    </button>
  `);
  document.getElementById("addInvItemChip").onclick = () => openInventoryItemForm(null);

  const filtered = inventoryItemsCatalog.filter(i =>
    `${i.item_name || ""} ${i.description || ""}`.toLowerCase().includes(invItemsSearch)
  );

  if (!filtered.length) {
    grid.insertAdjacentHTML("beforeend", `
      <p style="grid-column:1/-1;text-align:center;color:#888;padding:24px 4px">
        No inventory items found
      </p>
    `);
    return;
  }

  filtered.forEach(item => renderInventoryItemChip(grid, item));
}

function renderInventoryItemChip(grid, item) {
  const chip = document.createElement("div");
  chip.className = "category-chip category-chip-item" + (item.active === false ? " inactive" : "");

  const unit = item.unit || "";
  const perServing = item.quantity_per_serving;
  const countLine = (perServing !== undefined && perServing !== null && perServing !== "")
    ? `${perServing}${unit ? " " + unit : ""} / serving`
    : (unit || "—");

  const desc = (item.description || "").replace(/"/g, "&quot;");

  chip.innerHTML = `
    <div class="category-chip-actions">
      <button type="button" class="category-chip-icon-btn" data-action="delete" title="Deactivate item">${icon("trash-2", { size: 13 })}</button>
    </div>
    <div class="category-chip-name">${item.item_name || ""}${item.active === false ? " · Inactive" : ""}</div>
    ${desc ? `<div class="category-chip-desc" title="${desc}">${desc}</div>` : ""}
    <div class="category-chip-count">${countLine}</div>
  `;

  chip.onclick = () => openInventoryItemForm(item);

  chip.querySelector('[data-action="delete"]').onclick = e => {
    e.stopPropagation();
    openInventoryItemDeleteConfirm(item);
  };

  grid.appendChild(chip);
}

function openInventoryItemForm(item) {
  const isEdit = !!item;

  swapModalContent(`
    ${invHeader(isEdit ? "pencil" : "plus", isEdit ? "Edit Inventory Item" : "Add Inventory Item")}
    <div class="inv-modal-scroll inv-modal-scroll-form">
      <label>Item Name</label>
      <input id="invf_name" value="${isEdit ? (item.item_name || "") : ""}" required>

      <label>Description</label>
      <textarea id="invf_desc">${isEdit ? (item.description || "") : ""}</textarea>

      <div class="form-row">
        <div class="form-field">
          <label>Quantity per Serving</label>
          <input id="invf_qty" type="number" min="0" value="${isEdit ? (item.quantity_per_serving ?? "") : ""}">
        </div>
        <div class="form-field">
          <label>Unit</label>
          <input id="invf_unit" placeholder="g, pc, cup, etc" value="${isEdit ? (item.unit || "") : ""}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label>Capital</label>
          <input id="invf_capital" type="number" min="0" value="${isEdit ? (item.capital ?? "") : ""}">
        </div>
        <div class="form-field">
          <label>Selling Price</label>
          <input id="invf_price" type="number" min="0" value="${isEdit ? (item.selling_price ?? "") : ""}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label>Reorder Level</label>
          <input id="invf_reorder" type="number" min="0" value="${isEdit ? (item.reorder_level ?? "") : ""}">
        </div>
        <div class="form-field">
          <label style="display:flex;align-items:center;gap:8px;margin-top:24px">
            <input id="invf_active" type="checkbox" style="width:auto;margin:0" ${(!isEdit || item.active !== false) ? "checked" : ""}>
            Active
          </label>
        </div>
      </div>
    </div>
    <div id="invItemFormError" class="inv-save-error hidden"></div>
    <div class="modal-actions">
      <button class="category-action-btn" onclick="saveInventoryItemFromModal(${isEdit ? `'${item.item_id}'` : "null"})">${icon("save")} Save</button>
      <button class="inv-modal-btn-secondary" onclick="showInventoryItemsGrid()">Cancel</button>
    </div>
  `);
}

function openInventoryItemDeleteConfirm(item) {
  swapModalContent(`
    ${invHeader("trash-2", "Deactivate Inventory Item")}
    <p style="padding:10px 0">
      Deactivate <strong>${item.item_name}</strong>? It'll disappear from Add Inventory,
      Stocks List, and the recipe picker going forward, but stays assigned to any recipe
      or historical stock it's already part of — reactivate it any time from its Edit screen.
    </p>
    <div class="modal-actions">
      <button class="inv-modal-btn-secondary" onclick="showInventoryItemsGrid()">Cancel</button>
      <button class="category-action-btn" style="background:var(--apple-red)" onclick="confirmDeleteInventoryItem('${item.item_id}')">${icon("trash-2")} Deactivate</button>
    </div>
  `);
}

async function saveInventoryItemFromModal(existingId) {
  const payload = {
    item_name: document.getElementById("invf_name").value.trim(),
    description: document.getElementById("invf_desc").value.trim(),
    quantity_per_serving: document.getElementById("invf_qty").value,
    unit: document.getElementById("invf_unit").value,
    capital: document.getElementById("invf_capital").value,
    selling_price: document.getElementById("invf_price").value,
    reorder_level: document.getElementById("invf_reorder").value,
    active: document.getElementById("invf_active").checked
  };

  const errorEl = document.getElementById("invItemFormError");
  if (errorEl) errorEl.classList.add("hidden");

  if (!payload.item_name) {
    if (errorEl) {
      errorEl.textContent = "Item name is required";
      errorEl.classList.remove("hidden");
    } else {
      alert("Item name is required");
    }
    return;
  }

  if (existingId) payload.item_id = existingId;

  showModalLoader(existingId ? "Updating item…" : "Saving item…");

  try {
    await saveInventoryItemSupabase(payload);

    invalidateCache("inventoryItems");
    inventoryItemsCatalog = normalizeInventoryItems(await getCached("inventoryItems"));
    showInventoryItemsGrid();
  } catch (err) {
    console.error(err);
    if (errorEl) {
      errorEl.textContent = err.message || "Save failed";
      errorEl.classList.remove("hidden");
    } else {
      alert("❌ " + err.message);
    }
  } finally {
    hideModalLoader();
  }
}

async function confirmDeleteInventoryItem(itemId) {
  showModalLoader("Deactivating item…");

  try {
    await deleteInventoryItemSupabase(itemId);

    invalidateCache("inventoryItems");
    inventoryItemsCatalog = normalizeInventoryItems(await getCached("inventoryItems"));
    showInventoryItemsGrid();
  } catch (err) {
    console.error(err);
    alert("❌ Deactivate failed: " + err.message);
  } finally {
    hideModalLoader();
  }
}

window.saveInventoryItemFromModal = saveInventoryItemFromModal;
window.showInventoryItemsGrid = showInventoryItemsGrid;
window.confirmDeleteInventoryItem = confirmDeleteInventoryItem;