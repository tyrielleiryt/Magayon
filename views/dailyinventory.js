import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let inventoryItems = [];
let quantities = {};
let dailyInventoryCache = [];
let editDailyId = null;

let searchDate = "";
let searchLocation = "";

/* ================= HELPERS ================= */
const el = id => document.getElementById(id);

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
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

function groupByDateAndLocation(data) {
  const map = {};
  data.forEach(d => {
    const key = `${new Date(d.date).toDateString()}|${d.location || ""}`;
    if (!map[key]) {
      map[key] = {
        date: d.date,
        location: d.location || "",
        created_by: d.created_by,
        entries: []
      };
    }
    map[key].entries.push(d);
  });
  return Object.values(map);
}

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
              <th>Stocked Inventories</th>
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

/* ================= ACTION BAR ================= */
function renderActionBar() {
  el("actionBar").innerHTML = `
    <input id="searchDateInput" placeholder="Search date (e.g. December)" />
    <input id="searchLocationInput" placeholder="Search location" />
    <button class="category-action-btn" id="addTodayBtn">
      + Add Today's Inventory
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

  el("addTodayBtn").onclick = () => {
    editDailyId = null;
    quantities = {};
    openAddEditModal();
  };
}

/* ================= LOAD ================= */
async function loadDailyInventory() {
  dailyInventoryCache = await fetch(API_URL + "?type=dailyInventory").then(r => r.json());
  renderTable();
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = el("dailyInventoryBody");
  tbody.innerHTML = "";

  const grouped = groupByDateAndLocation(dailyInventoryCache).filter(g =>
    formatDate(g.date).toLowerCase().includes(searchDate) &&
    (g.location || "").toLowerCase().includes(searchLocation)
  );

  if (!grouped.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#888">
          No daily inventory found
        </td>
      </tr>
    `;
    return;
  }

  grouped.forEach((g, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${formatDate(g.date)}</td>
        <td>
          <button class="btn-view"
            onclick="viewDailyGroup('${g.date}','${g.location}')">
            View (${g.entries.length})
          </button>
        </td>
        <td>${g.location}</td>
        <td>${g.created_by}</td>
      </tr>
    `;
  });
}

/* ================= CHECK IF SALES EXIST ================= */
async function hasSalesForDay(date, location) {
  const res = await fetch(
    API_URL +
      `?type=dailyRemainingInventory&date=${date}&location=${location}`
  ).then(r => r.json());

  // If ANY remaining is less than total IN → sales occurred
  return res.some(r => Number(r.remaining) < 0);
}

/* ================= VIEW GROUP ================= */
window.viewDailyGroup = async function (date, location) {
  const entries = dailyInventoryCache.filter(d =>
    new Date(d.date).toDateString() === new Date(date).toDateString() &&
    (d.location || "") === (location || "")
  );

  const salesExist = await hasSalesForDay(date, location);

  let html = `
    <div class="modal-header">
      Inventory for ${formatDate(date)} — ${location}
    </div>
  `;

  for (const entry of entries) {
    html += `
      <div style="margin-bottom:14px;padding:12px;border:1px solid #ddd;border-radius:8px">
        <button class="btn-view"
          onclick="viewDaily('${entry.daily_id}')">
          View Details
        </button>

        ${
          isToday(entry.date) && !salesExist
            ? `<button class="btn-edit"
                 onclick="editDaily('${entry.daily_id}')">
                 Edit
               </button>`
            : `<div style="color:#999;margin-top:6px">
                 Editing locked (sales already recorded)
               </div>`
        }
      </div>
    `;
  }

  html += `
    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `;

  openModal(html, true);
};