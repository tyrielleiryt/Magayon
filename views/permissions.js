import { bindDataBoxScroll, showLoader, hideLoader } from "../admin.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../firebase-config.js";
import { ROLES, DEFAULT_ROLE_PAGES } from "../auth-guard.js";
import { icon } from "../icons.js";

/* IT-admin-only screen: choose which admin pages each non-full-access
   role (manager, cashier) can see. server/cook get no login at all, so
   they have nothing to configure here. Saved to Firestore at
   config/rolePermissions — admin.js reads this doc on every login to
   decide which nav buttons to show that role. */
const PAGES = [
  { key: "dashboard", label: `${icon("layout-dashboard")} Dashboard` },
  { key: "capitalCalculator", label: `${icon("calculator")} Capital Calculator` },
  { key: "categories", label: `${icon("tag")} Categories` },
  { key: "products", label: `${icon("package")} Products` },
  { key: "locations", label: `${icon("store")} Locations` },
  { key: "staff", label: `${icon("users")} Staff` },
  { key: "attendance", label: `${icon("clock")} Attendance` },
  { key: "inventory", label: `${icon("archive")} Inventory` },
  { key: "dailyInventory", label: `${icon("clipboard-list")} Daily Inventory System` },
  { key: "dailySales", label: `${icon("receipt")} Daily Sales` },
  { key: "pettyCash", label: `${icon("banknote")} Petty Cash Fund / Expenses` },
  { key: "salesExpensesTracker", label: `${icon("trending-up")} Sales and Expenses Tracker` }
];

// Cashier isn't editable here: cashier accounts are hard-restricted to
// the POS screen and never reach the admin panel at all (see the
// requireRole() call at the top of admin.js), so a permission entry for
// cashier could never take effect. Manager is the only role whose
// admin-page access is actually configurable.
const EDITABLE_ROLES = [
  { key: ROLES.MANAGER, label: "Manager" }
];

export default async function loadPermissionsView() {
  renderActionBar();
  renderLayout();

  showLoader("Loading permissions…");
  try {
    const snap = await getDoc(doc(db, "config", "rolePermissions"));
    const saved = snap.exists() ? snap.data() : {};

    EDITABLE_ROLES.forEach(role => {
      const pages = Array.isArray(saved[role.key])
        ? saved[role.key]
        : (DEFAULT_ROLE_PAGES[role.key] || []);

      PAGES.forEach(page => {
        const cb = document.getElementById(`perm_${role.key}_${page.key}`);
        if (cb) cb.checked = pages.includes(page.key);
      });
    });
  } catch (err) {
    console.error(err);
    alert("❌ Failed to load current permissions.");
  } finally {
    hideLoader();
  }
}

function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <button id="savePermissionsBtn" class="category-action-btn">${icon("save")} Save Permissions</button>
  `;
  document.getElementById("savePermissionsBtn").onclick = savePermissions;
}

function renderLayout() {
  document.getElementById("contentBox").innerHTML = `
    <div class="data-box">
      <h2>${icon("shield")} Role Permissions</h2>
      <p style="color:#666;margin-bottom:12px">
        Choose which admin pages Manager can access. IT Admin, Owner, and
        Admin always have full access; Cashier is always POS-only.
      </p>

      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>Page</th>
              ${EDITABLE_ROLES.map(r => `<th style="text-align:center">${r.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${PAGES.map(page => `
              <tr>
                <td>${page.label}</td>
                ${EDITABLE_ROLES.map(role => `
                  <td style="text-align:center">
                    <input type="checkbox" id="perm_${role.key}_${page.key}">
                  </td>
                `).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
}

async function savePermissions() {
  showLoader("Saving permissions…");

  try {
    const data = {};
    EDITABLE_ROLES.forEach(role => {
      data[role.key] = PAGES
        .filter(page => document.getElementById(`perm_${role.key}_${page.key}`)?.checked)
        .map(page => page.key);
    });

    await setDoc(doc(db, "config", "rolePermissions"), data, { merge: true });
    alert("✅ Permissions saved. Affected staff will see the change next time they log in.");
  } catch (err) {
    console.error(err);
    alert("❌ Failed to save: " + err.message);
  } finally {
    hideLoader();
  }
}
