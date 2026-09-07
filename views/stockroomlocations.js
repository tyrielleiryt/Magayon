import { bindDataBoxScroll, showLoader, hideLoader, getCached, invalidateCache } from "../admin.js";
import { openModal, closeModal } from "./modal.js";
import { authFetch } from "../auth-guard.js";

import { API_URL } from "../firebase-config.js";
import { icon } from "../icons.js";

/* ================= STATE ================= */
let stockrooms = [];
let selected = null;

/* ================= ENTRY ================= */
export default async function loadStockroomLocationsView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <button class="category-action-btn" id="addBtn">${icon("plus")} Add Stockroom</button>
    <button class="category-action-btn" id="editBtn" disabled>${icon("pencil")} Edit</button>
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
  document.getElementById("deleteBtn").onclick = deleteStockroom;

  await loadStockrooms();
}

/* ================= LOAD DATA ================= */
async function loadStockrooms() {
  stockrooms = await getCached("stockroomLocations");
  selected = null;

  document.getElementById("editBtn").disabled = true;
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
      document.getElementById("deleteBtn").disabled = false;
    };

    tbody.appendChild(tr);
  });
}

/* ================= MODAL ================= */
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
