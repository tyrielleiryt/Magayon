import { bindDataBoxScroll, getCached, invalidateCache, showLoader, hideLoader } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

import { firebaseConfig, db } from "../firebase-config.js";
import { getCurrentProfile, ROLES } from "../auth-guard.js";
import { saveLocation as saveLocationSupabase, deleteLocation as deleteLocationSupabase } from "../data/locations.js";
import { listStaff, saveStaff as saveStaffSupabase, deactivateStaff as deactivateStaffSupabase } from "../data/staff.js";
import { getAttendanceOverview, getEmployeeDTR } from "../data/attendance.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { icon } from "../icons.js";

window.closeModal = closeModal;

/* =========================================================
   POSITIONS (same list Staff always used)
========================================================= */
const POSITIONS = [
  { value: "server", label: "Server" },
  { value: "cook", label: "Cook" },
  { value: "cashier", label: "Cashier" },
  { value: "manager", label: "Manager" },
  { value: "it_admin", label: "IT Admin" },
  { value: "owner", label: "Owner" }
];

const NO_LOGIN_POSITIONS = ["server", "cook"];

/* ================= STATE ================= */
let locations = [];
let staffList = [];
let attendanceByStaffId = {};
let isReadOnly = false;

// Both collapsed by default, both survive a reload (untouched by
// re-fetching data), same as Categories & Products.
const expandedLocationIds = new Set();
const expandedStaffIds = new Set();

function staffLabel(s) {
  return `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.staff_id;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/* ================= ENTRY =================
   No top action bar — same finalized pattern as Categories & Products.
   Add/Edit/Delete Location and Add/Edit/Deactivate Staff all live
   inside the grid. Manager keeps the same access Attendance always
   gave them (browse + DTR, read-only) — every add/edit/delete control
   is hidden for that role, nothing new is exposed. */
export default async function loadLocationStaffAttendanceView() {
  document.getElementById("actionBar").innerHTML = "";
  renderLayout();

  isReadOnly = getCurrentProfile()?.role === ROLES.MANAGER;

  const grid = document.getElementById("locationGrid");

  try {
    const [locs, staff, attendance] = await Promise.all([
      getCached("locations"),
      listStaff(),
      fetchAttendanceToday()
    ]);

    locations = locs;
    staffList = staff;
    attendanceByStaffId = attendance;
    renderLocationGrid();
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#888;padding:24px">Failed to load. Please try reloading this tab.</p>`;
  }
}

async function fetchAttendanceToday() {
  try {
    const data = await getAttendanceOverview(todayStr());
    const map = {};
    (data?.staff || []).forEach(s => { map[s.staff_id] = s; });
    return map;
  } catch (err) {
    console.warn("Failed to load today's attendance", err);
    return {};
  }
}

/* ================= LAYOUT ================= */
function renderLayout() {
  const box = document.getElementById("contentBox");

  box.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <div class="admin-product-grid" id="locationGrid">
          <p style="grid-column:1/-1;text-align:center;color:#888;padding:24px">Loading…</p>
        </div>
      </div>
    </div>
  `;

  bindDataBoxScroll(box.querySelector(".data-box"));
}

/* ================= RELOAD HELPERS ================= */
async function reloadLocations() {
  locations = await getCached("locations");
  renderLocationGrid();
}

async function reloadStaff() {
  staffList = await listStaff();
  renderLocationGrid();
}

/* ================= LOCATION GRID ================= */
function renderLocationGrid() {
  const grid = document.getElementById("locationGrid");
  grid.innerHTML = "";

  if (!isReadOnly) {
    grid.insertAdjacentHTML("beforeend", `
      <button type="button" class="category-chip category-chip-add" id="addLocationChip">
        ${icon("plus", { size: 22 })}
        <span>Add Location</span>
      </button>
    `);
    document.getElementById("addLocationChip").onclick = () => openLocationModal();
  }

  locations.forEach(loc => renderLocationChip(grid, loc));
}

function renderLocationChip(grid, location) {
  const isExpanded = expandedLocationIds.has(location.location_id);
  const staffHere = staffList.filter(s => String(s.location_id).trim() === String(location.location_id).trim());
  const activeCount = staffHere.filter(s => s.active !== false).length;

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "category-chip" + (isExpanded ? " expanded" : "") + (location.active === false ? " inactive" : "");
  chip.innerHTML = `
    ${!isReadOnly ? `
      <div class="category-chip-actions">
        <button type="button" class="category-chip-icon-btn" data-action="edit" title="Edit location">${icon("pencil", { size: 13 })}</button>
        <button type="button" class="category-chip-icon-btn" data-action="delete" title="Delete location">${icon("trash-2", { size: 13 })}</button>
      </div>
    ` : ""}
    <div class="category-chip-name">${location.location_name}</div>
    <div class="category-chip-count">${activeCount} staff</div>
    ${icon("chevron-down", { size: 16, class: "widget-chevron category-chip-chevron" })}
  `;

  chip.onclick = () => {
    if (expandedLocationIds.has(location.location_id)) {
      expandedLocationIds.delete(location.location_id);
    } else {
      expandedLocationIds.add(location.location_id);
    }
    renderLocationGrid();
  };

  if (!isReadOnly) {
    chip.querySelector('[data-action="edit"]').onclick = e => {
      e.stopPropagation();
      openLocationModal(location);
    };
    chip.querySelector('[data-action="delete"]').onclick = e => {
      e.stopPropagation();
      deleteLocationConfirm(location);
    };
  }

  grid.appendChild(chip);

  if (isExpanded) {
    const panel = document.createElement("div");
    panel.className = "category-expanded-panel";

    if (!isReadOnly) {
      const addTile = document.createElement("button");
      addTile.type = "button";
      addTile.className = "admin-product-card admin-product-card-add";
      addTile.innerHTML = `${icon("plus", { size: 22 })}<span>Add Staff</span>`;
      addTile.onclick = () => openStaffModal(null, location.location_id);
      panel.appendChild(addTile);
    }

    if (!staffHere.length) {
      if (isReadOnly) {
        panel.innerHTML = `<p style="text-align:center;color:#888;padding:16px">No staff assigned here</p>`;
      }
    } else {
      staffHere.forEach(s => renderStaffCard(panel, s));
    }

    grid.appendChild(panel);
  }
}

/* ================= STAFF CARD ================= */
function renderStaffCard(panel, s) {
  const position = POSITIONS.find(p => p.value === s.position);
  const att = attendanceByStaffId[s.staff_id];

  let statusHtml;
  if (att?.status === "IN") {
    statusHtml = `<span class="staff-live-badge in"><span class="live-dot"></span> In since ${att.clock_in_time || "—"}</span>`;
  } else if (att?.clock_out_time) {
    statusHtml = `<span class="staff-live-badge out">Out (last: ${att.clock_out_time})</span>`;
  } else {
    statusHtml = `<span class="staff-live-badge none">Not clocked in</span>`;
  }

  const isExpanded = expandedStaffIds.has(s.staff_id);

  const card = document.createElement("div");
  card.className = "staff-card" + (s.active === false ? " inactive" : "") + (isExpanded ? " expanded" : "");
  card.innerHTML = `
    ${!isReadOnly ? `
      <div class="category-chip-actions">
        <button type="button" class="category-chip-icon-btn" data-action="edit" title="Edit staff">${icon("pencil", { size: 13 })}</button>
        <button type="button" class="category-chip-icon-btn" data-action="delete" title="Deactivate staff">${icon("trash-2", { size: 13 })}</button>
      </div>
    ` : ""}
    <div class="staff-card-name">${staffLabel(s)}</div>
    <div class="staff-card-position">${position ? position.label : (s.position || "-")}${s.active === false ? " · Inactive" : ""}</div>
    ${statusHtml}
    ${icon("chevron-down", { size: 16, class: "widget-chevron category-chip-chevron" })}
  `;

  card.onclick = () => {
    if (expandedStaffIds.has(s.staff_id)) {
      expandedStaffIds.delete(s.staff_id);
    } else {
      expandedStaffIds.add(s.staff_id);
    }
    renderLocationGrid();
  };

  if (!isReadOnly) {
    card.querySelector('[data-action="edit"]').onclick = e => {
      e.stopPropagation();
      openStaffModal(s);
    };
    card.querySelector('[data-action="delete"]').onclick = e => {
      e.stopPropagation();
      deactivateStaffConfirm(s);
    };
  }

  panel.appendChild(card);

  if (isExpanded) {
    panel.appendChild(renderDTRPanel(s));
  }
}

/* ================= DTR PANEL (inline) ================= */
function renderDTRPanel(s) {
  const wrap = document.createElement("div");
  wrap.className = "staff-dtr-panel";
  wrap.dataset.staffId = s.staff_id;

  wrap.innerHTML = `
    <div class="set-form-row">
      <div>
        <label>From</label><br>
        <input type="date" class="dtr-start" value="${firstOfMonthStr()}">
      </div>
      <div>
        <label>To</label><br>
        <input type="date" class="dtr-end" value="${todayStr()}">
      </div>
      <button type="button" class="category-action-btn dtr-load-btn">${icon("clock")} Load DTR</button>
    </div>
    <div class="dtr-results">
      <p style="text-align:center;color:#888;padding:12px">Pick a date range and load to see this employee's clock in/out history</p>
    </div>
  `;

  wrap.querySelector(".dtr-load-btn").onclick = e => {
    e.stopPropagation();
    loadDTR(s, wrap);
  };
  // Date inputs shouldn't collapse the panel when clicked.
  wrap.querySelectorAll("input").forEach(el => {
    el.onclick = e => e.stopPropagation();
  });

  return wrap;
}

async function loadDTR(s, wrap) {
  const startDate = wrap.querySelector(".dtr-start").value;
  const endDate = wrap.querySelector(".dtr-end").value;
  const results = wrap.querySelector(".dtr-results");

  results.innerHTML = `<p style="text-align:center;color:#888;padding:12px">Loading…</p>`;

  try {
    const data = await getEmployeeDTR(s.staff_id, startDate, endDate);
    renderDTR(data, results);
  } catch (err) {
    console.error(err);
    results.innerHTML = `<p style="text-align:center;color:#888;padding:12px">Failed to load</p>`;
  }
}

function renderDTR(data, results) {
  if (!data || !data.success) {
    results.innerHTML = `<p style="text-align:center;color:#888;padding:12px">${data?.error || "Failed to load"}</p>`;
    return;
  }

  const records = data.records || [];
  const rowsHtml = records.length
    ? records.map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.clock_in_time || "—"}</td>
        <td>${r.clock_out_time || "—"}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" class="set-empty-row">No attendance records in this range</td></tr>`;

  results.innerHTML = `
    <p style="font-weight:600;margin:8px 0">${records.length} day(s) recorded</p>
    <table class="set-table">
      <thead><tr><th>Date</th><th>Time In</th><th>Time Out</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

/* ================= LOCATION ADD / EDIT ================= */
function openLocationModal(location = null) {
  openModal(`
    <div class="modal-header">${location ? "Edit Location" : "Add Location"}</div>

    <label>Name</label>
    <input id="locName" value="${location?.location_name || ""}">

    <label>Address</label>
    <input id="locAddress" value="${location?.address || ""}">

    <div class="modal-actions">
      <button class="btn-danger" id="saveLocationBtn">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("saveLocationBtn").onclick = () => saveLocation(location);
}

async function saveLocation(location) {
  const name = document.getElementById("locName").value.trim();
  const address = document.getElementById("locAddress").value.trim();

  if (!name) {
    alert("Location name required");
    return;
  }

  showLoader(location ? "Saving changes…" : "Adding location…");

  try {
    await saveLocationSupabase({
      location_id: location?.location_id || "",
      location_name: name,
      address
    });

    closeModal();
    invalidateCache("locations");
    await reloadLocations();
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
  } finally {
    hideLoader();
  }
}

/* ================= LOCATION DELETE (soft) ================= */
function deleteLocationConfirm(location) {
  if (!confirm(`Delete "${location.location_name}"? Staff already assigned here keep their assignment.`)) return;

  showLoader("Deleting location…");

  deleteLocationSupabase(location.location_id)
    .then(() => {
      expandedLocationIds.delete(location.location_id);
      invalidateCache("locations");
      return reloadLocations();
    })
    .catch(err => {
      console.error(err);
      alert("❌ " + err.message);
    })
    .finally(hideLoader);
}

/* ================= STAFF ADD / EDIT =================
   Carried over from the old Staff tab nearly verbatim — same fields,
   same conditional login-creation section, same createStaffLogin()
   flow. Only addition: an optional presetLocationId so the "Add Staff"
   tile inside an expanded location pre-selects it. */
function openStaffModal(staff = null, presetLocationId = null) {
  const isEdit = !!staff;
  const isITAdmin = getCurrentProfile()?.role === ROLES.IT_ADMIN;
  const position = staff?.position || "";
  const alreadyHasLogin = isEdit && !!staff.email;
  const selectedLocationId = staff?.location_id || presetLocationId;

  openModal(`
    <div class="modal-header">
      ${isEdit ? "Edit" : "Add"} Staff
    </div>

    <label>Last Name</label>
    <input id="lastName" value="${staff?.last_name || ""}">

    <label>First Name</label>
    <input id="firstName" value="${staff?.first_name || ""}">

    <label>Location</label>
    <select id="location">
      ${locations
        .map(
          l => `
        <option value="${l.location_id}" ${
            l.location_id === selectedLocationId ? "selected" : ""
          }>
          ${l.location_name}
        </option>`
        )
        .join("")}
    </select>

    <label>Position</label>
    <select id="position">
      ${POSITIONS.map(
        p => `<option value="${p.value}" ${p.value === position ? "selected" : ""}>${p.label}</option>`
      ).join("")}
    </select>

    <label>Daily Rate</label>
    <input id="rate" type="number" min="0" step="0.01" value="${staff?.rate || ""}" placeholder="0.00">
    <p style="color:#888;font-size:12px;margin-top:-6px">
      Used to compute Payroll in the Sales and Expenses Tracker. Changing this only
      affects weeks going forward — past weeks keep the rate that was in effect then.
    </p>

    <div id="loginSection" style="margin-top:10px;padding-top:10px;border-top:1px solid #eee"></div>

    <div class="modal-actions">
      <button class="btn-danger" id="saveStaffBtn">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("saveStaffBtn").onclick = () => saveStaff(staff);

  renderLoginSection();
  document.getElementById("position").onchange = renderLoginSection;

  function renderLoginSection() {
    const pos = document.getElementById("position").value;
    const needsLogin = !NO_LOGIN_POSITIONS.includes(pos);
    const section = document.getElementById("loginSection");

    if (!needsLogin) {
      section.innerHTML = `
        <p style="color:#888;font-size:13px">
          Server and Cook get no system login — this is a roster entry only.
        </p>
      `;
      return;
    }

    if (isEdit && alreadyHasLogin) {
      section.innerHTML = `
        <label>Login Email</label>
        <input value="${staff.email}" disabled>
        <p style="color:#888;font-size:12px">
          To change this account's email, password, or role, use Firebase Console.
        </p>
      `;
      return;
    }

    if (!isITAdmin) {
      section.innerHTML = `
        <p style="color:#b91c1c;font-size:13px">
          This position needs a login. Only an IT Admin can create one —
          ask an IT Admin to set it up, or save the roster entry now and
          add the login later.
        </p>
      `;
      return;
    }

    section.innerHTML = `
      <label>Login Email</label>
      <input id="loginEmail" type="email" placeholder="name@example.com">
      <label>Temporary Password</label>
      <input id="loginPassword" type="password" placeholder="At least 6 characters">
      <p style="color:#888;font-size:12px">
        Creates a real login for this position right away.
      </p>
    `;
  }
}

/* ================= STAFF SAVE ================= */
async function saveStaff(existing) {
  const lastName = document.getElementById("lastName").value.trim();
  const firstName = document.getElementById("firstName").value.trim();
  if (!lastName || !firstName) {
    alert("First and last name are required");
    return;
  }

  const position = document.getElementById("position").value;
  const locationId = document.getElementById("location").value;
  const rate = document.getElementById("rate").value;

  const loginEmailEl = document.getElementById("loginEmail");
  const loginPasswordEl = document.getElementById("loginPassword");
  const wantsNewLogin = loginEmailEl && loginPasswordEl;

  if (wantsNewLogin) {
    const email = loginEmailEl.value.trim();
    const password = loginPasswordEl.value;
    if (!email || !password) {
      alert("Login email and password are required for this position");
      return;
    }
    if (password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
  }

  showLoader(existing ? "Updating staff…" : "Adding staff…");

  try {
    const saved = await saveStaffSupabase({
      staff_id: existing?.staff_id,
      last_name: lastName,
      first_name: firstName,
      position,
      location_id: locationId,
      rate: rate === "" ? 0 : Number(rate)
    });

    const staffId = saved.staff_id;

    if (wantsNewLogin) {
      const email = loginEmailEl.value.trim();
      const password = loginPasswordEl.value;
      const name = `${firstName} ${lastName}`;

      await createStaffLogin({
        email,
        password,
        role: position,
        staffId,
        name,
        location: locationId
      });

      // Keep the roster's email column in sync with the new login.
      await saveStaffSupabase({
        staff_id: staffId,
        last_name: lastName,
        first_name: firstName,
        position,
        location_id: locationId,
        rate: rate === "" ? 0 : Number(rate),
        email
      });
    }

    closeModal();
    await reloadStaff();
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
  } finally {
    hideLoader();
  }
}

/* ================= CREATE LOGIN (Firebase Auth + Firestore profile) =================
   Uses a throwaway secondary Firebase App instance so this doesn't sign
   the current admin out and into the new account. Same as before. */
async function createStaffLogin({ email, password, role, staffId, name, location }) {
  const secondaryApp = initializeApp(firebaseConfig, "StaffCreate-" + Date.now());

  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;

    await secondaryAuth.signOut();

    await setDoc(doc(db, "users", uid), {
      role,
      name,
      staff_id: staffId,
      location: location || "",
      active: true,
      email
    });
  } finally {
    await deleteApp(secondaryApp);
  }
}

/* ================= STAFF DEACTIVATE ================= */
function deactivateStaffConfirm(s) {
  if (!confirm(`Deactivate ${staffLabel(s)}?`)) return;

  showLoader("Updating staff status…");

  deactivateStaffSupabase(s.staff_id)
    .then(() => reloadStaff())
    .catch(err => {
      console.error(err);
      alert("❌ " + err.message);
    })
    .finally(hideLoader);
}
