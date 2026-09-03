import { bindDataBoxScroll, getCached } from "../admin.js";
import { openModal, closeModal } from "./modal.js";
 
/* =========================================================
   CONFIG
========================================================= */
import { API_URL } from "../firebase-config.js";

/* =========================================================
   LOADER HELPERS (GLOBAL)
========================================================= */
function showLoader(text = "Loading data…") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.querySelector(".loader-text").textContent = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.classList.add("hidden");
}

/* =========================================================
   STATE
========================================================= */
let staffList = [];
let locations = [];
let selected = null;

/* =========================================================
   ENTRY
========================================================= */
export default async function loadStaffView() {
  renderActionBar();
  renderTableLayout();

  try {
    // Locations are cached (rarely change); staff is fetched fresh — in
    // parallel, since neither needs the other to load.
    const [locs, staff] = await Promise.all([
      getCached("locations"),
      fetch(API_URL + "?type=staff").then(r => r.json())
    ]);

    locations = locs;
    staffList = staff;
    selected = null;
    editStaffBtn.disabled = true;
    deleteStaffBtn.disabled = true;
    renderTable();
  } catch (err) {
    console.error(err);
    alert("Failed to load staff data.");
  }
}

/* =========================================================
   ACTION BAR
========================================================= */
function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <button class="category-action-btn" id="addStaffBtn">➕ Add Staff</button>
    <button class="category-action-btn" id="editStaffBtn" disabled>✏️ Edit</button>
    <button class="category-action-btn" id="deleteStaffBtn" disabled>🗑️ Delete</button>
  `;

  addStaffBtn.onclick = () => openStaffModal();
  editStaffBtn.onclick = () => selected && openStaffModal(selected);
  deleteStaffBtn.onclick = deleteStaff;
}

/* =========================================================
   TABLE LAYOUT
========================================================= */
function renderTableLayout() {
  const box = document.getElementById("contentBox");

  box.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Last Name</th>
              <th>First Name</th>
              <th>Location</th>
              <th>Position</th>
              <th>POS</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="staffBody"><tr><td colspan="7" style="text-align:center;color:#888">Loading…</td></tr></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(box);
}

/* =========================================================
   LOADERS
========================================================= */
async function loadStaff() {
  staffList = await fetch(API_URL + "?type=staff").then(r => r.json());
  selected = null;
  editStaffBtn.disabled = true;
  deleteStaffBtn.disabled = true;
  renderTable();
}

/* =========================================================
   RENDER TABLE
========================================================= */
function renderTable() {
  const tbody = document.getElementById("staffBody");
  tbody.innerHTML = "";

  if (!staffList.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;color:#888">
          No staff found
        </td>
      </tr>
    `;
    return;
  }

  staffList.forEach((s, i) => {
    const loc = locations.find(l => l.location_id === s.location_id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${s.last_name}</td>
      <td>${s.first_name}</td>
      <td>${loc ? loc.location_name : ""}</td>
      <td>${s.position}</td>
      <td>${s.can_pos ? "✔" : "—"}</td>
      <td>${s.active ? "Active" : "Inactive"}</td>
    `;

    tr.onclick = () => {
      document
        .querySelectorAll("#staffBody tr")
        .forEach(r => r.classList.remove("selected"));

      tr.classList.add("selected");
      selected = s;
      editStaffBtn.disabled = false;
      deleteStaffBtn.disabled = false;
    };

    tbody.appendChild(tr);
  });
}

/* =========================================================
   MODAL
========================================================= */
function openStaffModal(staff = {}) {
  openModal(`
    <div class="modal-header">
      ${staff.staff_id ? "Edit" : "Add"} Staff
    </div>

    <label>Last Name</label>
    <input id="lastName" value="${staff.last_name || ""}">

    <label>First Name</label>
    <input id="firstName" value="${staff.first_name || ""}">

    <label>Location</label>
    <select id="location">
      ${locations
        .map(
          l => `
        <option value="${l.location_id}" ${
            l.location_id === staff.location_id ? "selected" : ""
          }>
          ${l.location_name}
        </option>`
        )
        .join("")}
    </select>

    <label>Position</label>
    <input id="position" value="${staff.position || ""}">

    <label>
      <input type="checkbox" id="canPOS" ${staff.can_pos ? "checked" : ""}>
      Allow POS Access
    </label>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveStaff()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  window.saveStaff = () => saveStaff(staff);
}

/* =========================================================
   SAVE
========================================================= */
function saveStaff(existing = {}) {
  showLoader("Saving staff…");

  const params = {
    action: existing.staff_id ? "editStaff" : "addStaff",
    rowIndex: existing.rowIndex,
    last_name: lastName.value.trim(),
    first_name: firstName.value.trim(),
    location_id: location.value,
    position: position.value.trim(),
    start_date: new Date().toISOString().slice(0, 10),
    can_pos: canPOS.checked
  };

  const qs = Object.entries(params)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  fetch(API_URL + "?" + qs)
    .then(r => r.json())
    .then(() => {
      closeModal();
      loadStaff();
    })
    .finally(hideLoader);
}

/* =========================================================
   DELETE
========================================================= */
function deleteStaff() {
  if (!selected) return;
  if (!confirm("Deactivate this staff member?")) return;

  showLoader("Updating staff status…");

  fetch(`${API_URL}?action=deleteStaff&rowIndex=${selected.rowIndex}`)
    .then(() => loadStaff())
    .finally(hideLoader);
}