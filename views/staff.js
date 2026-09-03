import { bindDataBoxScroll, getCached, showLoader, hideLoader } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

import { API_URL, firebaseConfig, db } from "../firebase-config.js";
import { authFetch, getCurrentProfile, ROLES } from "../auth-guard.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================================
   POSITIONS
   server/cook -> roster only, no login, no system access.
   cashier -> POS only. manager -> the 4 pages in
   auth-guard.js's DEFAULT_ROLE_PAGES (IT-admin editable).
   it_admin/owner -> full access. These values are stored
   verbatim in the Staff sheet's position column AND, for the
   login-requiring ones, as the linked account's Firestore role.
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
    <button class="category-action-btn" id="deleteStaffBtn" disabled>🗑️ Deactivate</button>
  `;

  addStaffBtn.onclick = () => openStaffModal();
  editStaffBtn.onclick = () => selected && openStaffModal(selected);
  deleteStaffBtn.onclick = deactivateStaff;
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
              <th>Position</th>
              <th>Login Email</th>
              <th>Location</th>
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
    const position = POSITIONS.find(p => p.value === s.position);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${s.last_name}</td>
      <td>${s.first_name}</td>
      <td>${position ? position.label : (s.position || "-")}</td>
      <td>${s.email || "—"}</td>
      <td>${loc ? loc.location_name : ""}</td>
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
function openStaffModal(staff = null) {
  const isEdit = !!staff;
  const isITAdmin = getCurrentProfile()?.role === ROLES.IT_ADMIN;
  const position = staff?.position || "";
  const alreadyHasLogin = isEdit && !!staff.email;

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
            l.location_id === staff?.location_id ? "selected" : ""
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

    <div id="loginSection" style="margin-top:10px;padding-top:10px;border-top:1px solid #eee"></div>

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveStaff()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  window.saveStaff = () => saveStaff(staff);

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

/* =========================================================
   SAVE
========================================================= */
async function saveStaff(existing) {
  const lastName = document.getElementById("lastName").value.trim();
  const firstName = document.getElementById("firstName").value.trim();
  if (!lastName || !firstName) {
    alert("First and last name are required");
    return;
  }

  const position = document.getElementById("position").value;
  const locationId = document.getElementById("location").value;

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
    const payload = {
      action: existing ? "editStaff" : "addStaff",
      last_name: lastName,
      first_name: firstName,
      position,
      location_id: locationId
    };
    if (existing) payload.staff_id = existing.staff_id;

    const res = await authFetch(API_URL, {
      method: "POST",
      body: new URLSearchParams(payload)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Save failed");

    const staffId = existing ? existing.staff_id : data.staff_id;

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
      await authFetch(API_URL, {
        method: "POST",
        body: new URLSearchParams({ action: "editStaff", staff_id: staffId, email })
      });
    }

    closeModal();
    await loadStaffView();
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
  } finally {
    hideLoader();
  }
}

/* =========================================================
   CREATE LOGIN (Firebase Auth + Firestore profile)

   Uses a throwaway secondary Firebase App instance to create the new
   auth user — createUserWithEmailAndPassword() on the PRIMARY app would
   sign the current admin OUT and into the new account instead. The
   secondary app is torn down right after, leaving the admin's own
   session untouched. The Firestore profile write goes through the
   PRIMARY app's `db` (still authenticated as the admin), so it's
   evaluated against firestore.rules as the admin's own write — only an
   active IT admin is allowed to create another user's /users/{uid} doc.
========================================================= */
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

/* =========================================================
   DEACTIVATE
========================================================= */
function deactivateStaff() {
  if (!selected) return;
  if (!confirm("Deactivate this staff member?")) return;

  showLoader("Updating staff status…");

  authFetch(API_URL, {
    method: "POST",
    body: new URLSearchParams({ action: "deleteStaff", staff_id: selected.staff_id })
  })
    .then(r => r.json())
    .then(data => {
      if (!data.success) throw new Error(data.error || "Failed");
      return loadStaffView();
    })
    .catch(err => {
      console.error(err);
      alert("❌ " + err.message);
    })
    .finally(hideLoader);
}
