import { bindDataBoxScroll, showLoader, hideLoader, getCached, invalidateCache } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

import { API_URL } from "../firebase-config.js";
import { icon } from "../icons.js";

/* ================= STATE ================= */
let locations = [];
let staffList = [];
let selected = null;

function staffLabel(s) {
  return `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.staff_id;
}

function staffAtLocation(locationId) {
  return staffList.filter(s => String(s.location_id).trim() === String(locationId).trim());
}

/* ================= ENTRY ================= */
export default async function loadLocationsView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <button class="category-action-btn" id="addBtn">${icon("plus")} Add Location</button>
    <button class="category-action-btn" id="editBtn" disabled>${icon("pencil")} Edit</button>
    <button class="category-action-btn" id="staffBtn" disabled>${icon("users")} View Staff</button>
    <button class="category-action-btn" id="deleteBtn" disabled>${icon("trash-2")} Delete</button>
  `;

  contentBox.innerHTML = `
    <div class="data-box">
      <p class="set-section-hint" style="margin:0 0 10px">
        Staff are assigned to a location from the Staff Tab — a staff member can only
        clock in/out (and have their attendance/payroll count) at their assigned location.
      </p>
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Location Name</th>
              <th>Address</th>
              <th>Staff</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody id="locationBody"><tr><td colspan="5" style="text-align:center;color:#888">Loading…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));

  document.getElementById("addBtn").onclick = () => openLocationModal();
  document.getElementById("editBtn").onclick = () =>
    selected && openLocationModal(selected);
  document.getElementById("staffBtn").onclick = () =>
    selected && openStaffModal(selected);
  document.getElementById("deleteBtn").onclick = deleteLocation;

  await loadLocations();
}

/* ================= LOAD DATA ================= */
async function loadLocations() {
  const [locs, staff] = await Promise.all([
    getCached("locations"),
    getCached("staff")
  ]);

  locations = locs;
  staffList = staff.filter(s => s.active !== false);
  selected = null;

  document.getElementById("editBtn").disabled = true;
  document.getElementById("staffBtn").disabled = true;
  document.getElementById("deleteBtn").disabled = true;

  renderTable();
}

/* ================= RENDER ================= */
function renderTable() {
  const tbody = document.getElementById("locationBody");
  tbody.innerHTML = "";

  if (!locations.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#888">
          No locations found
        </td>
      </tr>
    `;
    return;
  }

  locations.forEach((l, i) => {
    const count = staffAtLocation(l.location_id).length;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${l.location_name}</td>
      <td>${l.address || ""}</td>
      <td>${count} staff</td>
      <td>${l.active ? icon("check", { style: "color:#34c759" }) : icon("x", { style: "color:#8e8e93" })}</td>
    `;

    tr.onclick = () => {
      document
        .querySelectorAll("#locationBody tr")
        .forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");

      selected = l;
      document.getElementById("editBtn").disabled = false;
      document.getElementById("staffBtn").disabled = false;
      document.getElementById("deleteBtn").disabled = false;
    };

    tbody.appendChild(tr);
  });
}

/* ================= STAFF MODAL ================= */
function openStaffModal(loc) {
  const assigned = staffAtLocation(loc.location_id);

  openModal(`
    <div class="modal-header">${icon("users")} Staff at ${loc.location_name}</div>
    <p style="color:#888;font-size:13px;margin-top:-6px">
      To move someone to a different location, edit their record in the Staff Tab.
    </p>
    <table class="category-table" style="margin-top:10px">
      <thead><tr><th>Name</th><th>Position</th></tr></thead>
      <tbody>
        ${assigned.length
          ? assigned.map(s => `<tr><td>${staffLabel(s)}</td><td>${s.position || ""}</td></tr>`).join("")
          : `<tr><td colspan="2" style="text-align:center;color:#888">No staff assigned here yet</td></tr>`
        }
      </tbody>
    </table>
    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
}

/* ================= MODAL ================= */
function openLocationModal(loc = {}) {
  openModal(`
    <div class="modal-header">
      ${loc.location_id ? "Edit" : "Add"} Location
    </div>

    <label>Name</label>
    <input id="locName" value="${loc.location_name || ""}">

    <label>Address</label>
    <input id="locAddress" value="${loc.address || ""}">

    <div class="modal-actions">
      <button class="btn-danger" id="saveLocationBtn">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("saveLocationBtn").onclick = () =>
    saveLocation(loc.rowIndex);
}

/* ================= SAVE ================= */
async function saveLocation(rowIndex) {
  const name = locName.value.trim();
  const address = locAddress.value.trim();

  if (!name) return alert("Location name required");

  closeModal();
  showLoader(rowIndex ? "Updating location…" : "Adding location…");

  const action = rowIndex ? "editLocation" : "addLocation";
  let url =
    `${API_URL}?action=${action}` +
    `&location_name=${encodeURIComponent(name)}` +
    `&address=${encodeURIComponent(address)}`;

  if (rowIndex) url += `&rowIndex=${rowIndex}`;

  new Image().src = url;
  invalidateCache("locations");

  setTimeout(async () => {
    await loadLocations();
    hideLoader();
  }, 500);
}

/* ================= DELETE ================= */
function deleteLocation() {
  if (!selected) return;
  if (!confirm("Delete this location?")) return;

  showLoader("Deleting location…");

  new Image().src =
    `${API_URL}?action=deleteLocation&rowIndex=${selected.rowIndex}`;
  invalidateCache("locations");

  setTimeout(async () => {
    await loadLocations();
    hideLoader();
  }, 500);
}