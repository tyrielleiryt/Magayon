import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let locations = [];
let selected = null;

export default async function loadLocationsView() {
  document.getElementById("actionBar").innerHTML = `
    <button class="category-action-btn" id="addBtn">➕ Add Location</button>
    <button class="category-action-btn" id="editBtn" disabled>Edit</button>
    <button class="category-action-btn" id="deleteBtn" disabled>Delete</button>
  `;

  document.getElementById("contentBox").innerHTML = `
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
  document.getElementById("editBtn").onclick = () => selected && openLocationModal(selected);
  document.getElementById("deleteBtn").onclick = deleteLocation;

  await loadLocations();
}

async function loadLocations() {
  locations = await fetch(API_URL + "?type=locations").then(r => r.json());
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("locationBody");
  tbody.innerHTML = "";

  locations.forEach((l, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${l.location_name}</td>
      <td>${l.address || ""}</td>
      <td>${l.active ? "✔" : "✖"}</td>
    `;

    tr.onclick = () => {
      document.querySelectorAll("tr").forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selected = l;
      editBtn.disabled = false;
      deleteBtn.disabled = false;
    };

    tbody.appendChild(tr);
  });
}

function openLocationModal(loc = {}) {
  openModal(`
    <div class="modal-header">${loc.location_id ? "Edit" : "Add"} Location</div>
    <label>Name</label>
    <input id="locName" value="${loc.location_name || ""}">
    <label>Address</label>
    <input id="locAddress" value="${loc.address || ""}">
    <div class="modal-actions">
      <button class="btn-danger" onclick="saveLocation('${loc.rowIndex || ""}')">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

window.saveLocation = function (rowIndex) {
  const name = locName.value.trim();
  const address = locAddress.value.trim();
  if (!name) return alert("Location name required");

  const action = rowIndex ? "editLocation" : "addLocation";
  let url = `${API_URL}?action=${action}&location_name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}`;
  if (rowIndex) url += `&rowIndex=${rowIndex}`;

  new Image().src = url;
  closeModal();
  setTimeout(loadLocations, 500);
};

function deleteLocation() {
  if (!confirm("Delete this location?")) return;
  new Image().src = `${API_URL}?action=deleteLocation&rowIndex=${selected.rowIndex}`;
  setTimeout(loadLocations, 500);
}