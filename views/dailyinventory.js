import { bindDataBoxScroll } from "../admin.js";
import { openModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= ENTRY ================= */
export default function loadDailyInventoryView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addTodayBtn">+ Add today's Inventory</button>
  `;

  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>DN</th>
              <th>Inventory</th>
              <th>Location</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody id="dailyInventoryBody">
            <tr>
              <td colspan="6" style="text-align:center;color:#888;">
                No daily inventory yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(contentBox.querySelector(".data-box"));
  loadDailyInventory();
}

/* ================= LOAD DAILY INVENTORY ================= */
async function loadDailyInventory() {
  const res = await fetch(API_URL + "?type=dailyInventory");
  const data = await res.json();

  const tbody = document.getElementById("dailyInventoryBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#888;">
          No daily inventory yet
        </td>
      </tr>
    `;
    return;
  }

  data.forEach((row, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${row.date}</td>
      <td>${row.dn}</td>
      <td>
        <button class="btn-view" data-id="${row.daily_id}">
          View
        </button>
      </td>
      <td>${row.location || ""}</td>
      <td>${row.created_by}</td>
    `;

    tr.querySelector(".btn-view").onclick = () =>
      openViewModal(row.daily_id);

    tbody.appendChild(tr);
  });
}

/* ================= VIEW MODAL ================= */
async function openViewModal(dailyId) {
  const res = await fetch(
    API_URL + "?type=dailyInventoryItems&daily_id=" + encodeURIComponent(dailyId)
  );
  const items = await res.json();

  let rows = items
    .map(
      (i, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${i.item_name}</td>
        <td>${i.qty}</td>
      </tr>
    `
    )
    .join("");

  if (!rows) {
    rows = `
      <tr>
        <td colspan="3" style="text-align:center;">No items</td>
      </tr>
    `;
  }

  openModal(`
    <div class="modal-header">📦 Daily Inventory Details</div>

    <div class="data-scroll" style="max-height:300px;">
      <table class="category-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
}