import { bindDataBoxScroll, showLoader, hideLoader } from "../admin.js";
import { openModal, closeModal } from "./modal.js";
 
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let locations = [];
let selected = null;

/* ================= ENTRY ================= */
export default async function loadLocationsView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <button class="category-action-btn" id="addBtn">➕ Add Location</button>
    <button class="category-action-btn" id="editBtn" disabled>✏️ Edit</button>
    <button class="category-action-btn" id="deleteBtn" disabled>🗑️ Delete</button>
  `;

  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Location Name</th>
              <th>Address</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody id="locationBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));

  document.getElementById("addBtn").onclick = () => openLocationModal();
  document.getElementById("editBtn").onclick = () =>
    selected && openLocationModal(selected);
  document.getElementById("deleteBtn").onclick = deleteLocation;

  showLoader("Loading locations…");
  await loadLocations();
  hideLoader();
}

/* ================= LOAD DATA ================= */
async function loadLocations() {
  locations = await fetch(API_URL + "?type=locations").then(r => r.json());
  selected = null;

  document.getElementById("editBtn").disabled = true;
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
        <td colspan="4" style="text-align:center;color:#888">
          No locations found
        </td>
      </tr>
    `;
    return;
  }

  locations.forEach((l, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${l.location_name}</td>
      <td>${l.address || ""}</td>
      <td>${l.active ? "✔" : "✖"}</td>
    `;

    tr.onclick = () => {
      document
        .querySelectorAll("#locationBody tr")
        .forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");

      selected = l;
      document.getElementById("editBtn").disabled = false;
      document.getElementById("deleteBtn").disabled = false;
    };

    tbody.appendChild(tr);
  });
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

  setTimeout(async () => {
    await loadLocations();
    hideLoader();
  }, 500);
}