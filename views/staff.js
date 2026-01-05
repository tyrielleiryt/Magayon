import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= JSONP ================= */
function jsonp(params) {
  return new Promise(resolve => {
    const cb = "cb_" + Date.now();
    window[cb] = data => {
      delete window[cb];
      script.remove();
      resolve(data);
    };

    const qs = Object.entries({ ...params, callback: cb })
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");

    const script = document.createElement("script");
    script.src = `${API_URL}?${qs}`;
    document.body.appendChild(script);
  });
}

/* ================= STATE ================= */
let staff = [];
let locations = [];
let selected = null;

/* ================= ENTRY ================= */
export default async function loadStaffView() {
  renderActionBar();
  renderLayout();
  await loadLocations();
  await loadStaff();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <button class="category-action-btn" id="addBtn">➕ Add Staff</button>
    <button class="category-action-btn" id="editBtn" disabled>✏️ Edit</button>
    <button class="category-action-btn" id="deleteBtn" disabled>🗑️ Deactivate</button>
  `;

  document.getElementById("addBtn").onclick = () => openStaffModal();
  document.getElementById("editBtn").onclick = () => selected && openStaffModal(selected);
  document.getElementById("deleteBtn").onclick = deleteStaff;
}

/* ================= LAYOUT ================= */
function renderLayout() {
  const box = document.getElementById("contentBox");

  box.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Staff Name</th>
              <th>Position</th>
              <th>Location</th>
              <th>POS Access</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="staffBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(box.querySelector(".data-box"));
}

/* ================= LOADERS ================= */
async function loadLocations() {
  locations = await jsonp({ type: "locations" });
}

async function loadStaff() {
  staff = await jsonp({ type: "staff" });

  selected = null;
  document.getElementById("editBtn").disabled = true;
  document.getElementById("deleteBtn").disabled = true;

  renderTable();
}

/* ================= TABLE ================= */
function renderTable() {
  const tbody = document.getElementById("staffBody");
  tbody.innerHTML = "";

  if (!staff.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#888">
          No staff records
        </td>
      </tr>
    `;
    return;
  }

  staff.forEach((s, i) => {
    const loc = locations.find(l => l.location_id === s.location_id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${s.last_name}, ${s.first_name}</td>
      <td>${s.position}</td>
      <td>${loc ? loc.location_name : "—"}</td>
      <td>${s.can_pos ? "✔" : "—"}</td>
      <td>${s.active ? "Active" : "Inactive"}</td>
    `;

    tr.onclick = () => {
      document.querySelectorAll("#staffBody tr")
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
function openStaffModal(staffData = {}) {
  openModal(`
    <div class="modal-header">${staffData.staff_id ? "Edit" : "Add"} Staff</div>

    <label>Last Name</label>
    <input id="lastName" value="${staffData.last_name || ""}">

    <label>First Name</label>
    <input id="firstName" value="${staffData.first_name || ""}">

    <label>Location</label>
    <select id="location">
      ${locations
        .filter(l => l.active)
        .map(l =>
          `<option value="${l.location_id}"
            ${l.location_id === staffData.location_id ? "selected" : ""}>
            ${l.location_name}
          </option>`
        ).join("")}
    </select>

    <label>Position</label>
    <input id="position" value="${staffData.position || ""}">

    <label>Start Date</label>
    <input type="date" id="startDate"
      value="${staffData.start_date ? staffData.start_date.split("T")[0] : ""}">

    <label>
      <input type="checkbox" id="canPOS" ${staffData.can_pos ? "checked" : ""}>
      POS Access (Cashier)
    </label>

    <label>
      <input type="checkbox" id="active"
        ${staffData.active !== false ? "checked" : ""}>
      Active
    </label>

    <div class="modal-actions">
      <button class="btn-danger" id="saveBtn">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("saveBtn").onclick = () =>
    saveStaff(staffData.staff_id, staffData.rowIndex);
}

/* ================= SAVE ================= */
function saveStaff(staffId, rowIndex) {
  const data = {
    action: staffId ? "editStaff" : "addStaff",
    staff_id: staffId,
    rowIndex,
    last_name: lastName.value.trim(),
    first_name: firstName.value.trim(),
    location_id: location.value,
    position: position.value.trim(),
    start_date: startDate.value,
    can_pos: canPOS.checked,
    active: active.checked
  };

  jsonp(data).then(() => {
    closeModal();
    loadStaff();
  });
}

/* ================= DELETE ================= */
function deleteStaff() {
  if (!selected) return;
  if (!confirm(`Deactivate ${selected.first_name} ${selected.last_name}?`)) return;

  jsonp({
    action: "deleteStaff",
    rowIndex: selected.rowIndex
  }).then(loadStaff);
}