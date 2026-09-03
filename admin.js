

import { ROLES, requireRole, logout, authFetch, getAllowedPages } from "./auth-guard.js";
import { API_URL } from "./firebase-config.js";

window.API_URL = API_URL; // kept for admin-close-day.js

/* ================= AUTH GUARD =================
   Re-verifies against Firebase Auth + the user's Firestore profile on every
   load. Replaces the old `localStorage.isLoggedIn === "true"` check, which
   anyone could set by hand in devtools with no real login at all — or which
   any logged-in cashier could reach since it never checked role. */
const currentUser = await requireRole([
  ROLES.ADMIN,
  ROLES.IT_ADMIN,
  ROLES.OWNER,
  ROLES.MANAGER
]);

/* ================= PAGE-LEVEL ACCESS CONTROL =================
   Full-access roles (admin/it_admin/owner) see every nav item. Everyone
   else only sees the pages their role is allowed — the default set, or
   whatever an IT admin has configured on the Permissions page. This is
   a UI convenience, not the real security boundary: every mutating
   backend action is separately gated by role in Code.gs. */
const allowedPages = await getAllowedPages(currentUser.role);

if (allowedPages !== null) {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    if (!allowedPages.includes(btn.dataset.view)) btn.remove();
  });

  // If the page that was active by default (dashboard) got removed above,
  // mark the first remaining page active instead of leaving none selected.
  // The actual navigation to it happens once click handlers are wired up
  // further down (see "LAND ON THE ACTIVE PAGE").
  if (!document.querySelector(".nav-btn.active")) {
    document.querySelector(".nav-btn")?.classList.add("active");
  }
}

document.querySelectorAll('.nav-btn[data-view="permissions"]').forEach(btn => {
  if (currentUser.role !== ROLES.IT_ADMIN) btn.remove();
});

/* ================= LOADER HELPERS ================= */
export function showLoader(text = "Loading data…") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.querySelector(".loader-text").textContent = text;
  loader.classList.remove("hidden");
}

export function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.classList.add("hidden");
}

/* ================= SHARED REFERENCE-DATA CACHE =================
   categories / locations / inventoryItems barely change but were being
   re-fetched from Apps Script (slow round-trip) on every single view
   switch — Products, Staff, Locations, Capital Calculator, Daily
   Inventory all pulled their own fresh copy every time. Cache each by
   `type` for the rest of this session; call invalidateCache(type) right
   after any add/edit/delete so the next read picks up the change. */
const dataCache = {};

export async function getCached(type) {
  if (!dataCache[type]) {
    dataCache[type] = fetch(`${API_URL}?type=${type}`)
      .then(r => r.json())
      .catch(err => {
        delete dataCache[type]; // don't cache a failed fetch
        throw err;
      });
  }
  return dataCache[type];
}

export function invalidateCache(type) {
  delete dataCache[type];
}

/* ================= DATE & TIME ================= */
function updateDateTime() {
  const el = document.getElementById("datetime");
  if (!el) return;

  el.textContent = new Date().toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
updateDateTime();
setInterval(updateDateTime, 60000);

document.getElementById("adminChatInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault(); // ⛔ stop newline
    sendAdminChat();    // ✅ send message
  }
});

/* ================= LOGOUT ================= */
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  if (!confirm("Are you sure you want to logout?")) return;

  const staffId = localStorage.getItem("staff_id");
  if (staffId) {
    new Image().src = `${API_URL}?action=endShift&staff_id=${staffId}`;
  }

  logout(); // signs out of Firebase too (the old handler only cleared localStorage)
});

/* ================= CLOSE DAY MODAL (static chrome — wired once here) =================
   The trigger button (closeDayBtn) is rendered per-visit by views/dailyinventory.js,
   but this modal itself lives once in main.html, so its own controls are wired here. */
document.getElementById("confirmCloseDayCheckbox")?.addEventListener("change", e => {
  const btn = document.getElementById("confirmCloseDayBtn");
  if (btn) btn.disabled = !e.target.checked;
});

document.getElementById("cancelCloseDayBtn")?.addEventListener("click", () => {
  document.getElementById("closeDayModal")?.classList.add("hidden");
});

document.getElementById("confirmCloseDayBtn")?.addEventListener("click", async () => {
  const date = document.getElementById("closeDayDate")?.textContent;
  const location = document.getElementById("closeDayLocation")?.textContent;
  const btn = document.getElementById("confirmCloseDayBtn");
  btn.disabled = true;

  try {
    const res = await authFetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({ action: "closeInventoryDay", date, location })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Unknown error");

    alert("✅ Inventory successfully closed.");
    window.location.reload();
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
    btn.disabled = false;
  }
});

/* ================= IMPORT VIEWS ================= */
import loadCapitalCalculatorView from "./views/capital-calculator.js";
import loadCategoriesView from "./views/categories.js";
import loadInventoryItemsView from "./views/inventoryitems.js";
import loadDailyInventoryView from "./views/dailyinventory.js";
import loadProductsView from "./views/products.js";
import loadDailySalesView from "./views/dailySales.js";
import loadLocationsView from "./views/locations.js";
import loadStaffView from "./views/staff.js";
import loadDashboardView, { stopDashboardPolling } from "./views/dashboard.js";
import loadPermissionsView from "./views/permissions.js";
import loadPettyCashView from "./views/pettyCash.js";


function clearView() {
  stopDashboardPolling(); // stop the dashboard's live-sales polling when leaving it
  document.getElementById("actionBar")?.replaceChildren();
  document.getElementById("contentBox")?.replaceChildren();
}

/* ================= SPA NAV (WITH LOADER) ================= */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = async () => {
    // Defense in depth: the button itself is already hidden for a
    // page-restricted role (see the access-control block above), but
    // block the view load too in case anything still triggers a click.
    if (allowedPages !== null && !allowedPages.includes(btn.dataset.view)) {
      return;
    }

    // Active state
    document
      .querySelectorAll(".nav-btn")
      .forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Reset UI
clearView();

    // Each view renders its own layout synchronously and shows a small
    // inline "Loading…" placeholder while its own data fetch resolves —
    // no full-screen blocker here, so the page structure (sidebar,
    // buttons, headers) appears instantly instead of waiting behind a
    // spinner for every field to finish loading.
    switch (btn.dataset.view) {
      case "capitalCalculator":
        loadCapitalCalculatorView();
        break;

      case "categories":
        loadCategoriesView();
        break;

      case "products":
        loadProductsView();
        break;

      case "inventory":
        loadInventoryItemsView();
        break;

      case "dailyInventory":
        loadDailyInventoryView();
        break;

      case "dailySales":
        loadDailySalesView();
        break;

      case "pettyCash":
        loadPettyCashView();
        break;

      case "locations":
        loadLocationsView();
        break;

      case "staff":
        loadStaffView();
        break;

      case "permissions":
        loadPermissionsView();
        break;

      case "dashboard":
      default:
        loadDashboardView();
    }
  };
});



/* ================= SCROLL HELPER (EXPORTED) ================= */
export function bindDataBoxScroll(container) {
  if (!container) return;
  const scrollArea = container.querySelector(".data-scroll");
  if (!scrollArea) return;
}

/* ================= MODAL CONTAINER ================= */
function ensureModal() {
  if (document.getElementById("modalOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "modalOverlay";
  overlay.className = "hidden";
  overlay.innerHTML = `<div id="modalBox"></div>`;
  document.body.appendChild(overlay);
}
ensureModal();

/* ================= ADMIN CHAT ================= */

const ADMIN_LOCATION = "ALL";
let lastAdminChatHash = "";
let adminChatLoading = false;

function loadAdminChat() {
  if (adminChatLoading) return;
  adminChatLoading = true;

  const callbackName = "adminChatCallback_" + Date.now();
  const script = document.createElement("script");

  window[callbackName] = messages => {
    adminChatLoading = false;
    delete window[callbackName];
    script.remove();

    const hash = JSON.stringify(messages);
    if (hash !== lastAdminChatHash) {
      lastAdminChatHash = hash;
  renderAdminChat(messages);
    }
  };

  script.src =
    `${API_URL}?type=chatMessages` +
    `&location=${ADMIN_LOCATION}` +
    `&callback=${callbackName}`;

  script.onerror = () => {
    adminChatLoading = false;
    delete window[callbackName];
    script.remove();
    console.warn("⚠️ Admin chat JSONP failed");
  };

  document.body.appendChild(script);
}

// Which location an outgoing admin message goes to. Populated with real
// locations below — never "ALL", since that's a read-only aggregate for
// the admin's own view, not a real cashier anyone is watching. Auto-
// follows the most recent cashier message so replying "just works" by
// default, but stops following the moment the admin manually picks a
// location, so a deliberate choice never gets silently overridden.
let adminChatLocationsLoaded = false;
let adminPickedLocationManually = false;

async function ensureAdminChatLocations() {
  if (adminChatLocationsLoaded) return;
  const select = document.getElementById("adminChatLocationSelect");
  if (!select) return;

  try {
    const locations = await getCached("locations");
    select.innerHTML = locations
      .map(l => `<option value="${l.location_id}">${l.location_name}</option>`)
      .join("");
    adminChatLocationsLoaded = true;

    select.addEventListener("change", () => {
      adminPickedLocationManually = true;
    });
  } catch (err) {
    console.warn("Failed to load locations for admin chat:", err);
  }
}

function renderAdminChat(messages = []) {
  const box = document.getElementById("adminChatMessages");
  if (!box) return;

  // Follow the last cashier to message in, unless the admin has since
  // picked a location themselves.
  const select = document.getElementById("adminChatLocationSelect");
  if (select && !adminPickedLocationManually) {
    const lastCashier = [...messages]
      .reverse()
      .find(m => m.sender_role === "CASHIER");

    if (lastCashier?.location) {
      select.value = lastCashier.location;
    }
  }

  box.innerHTML = messages.map(m => `
    <div style="
      margin-bottom:8px;
      text-align:${m.sender_role === "ADMIN" ? "right" : "left"};
    ">
      <div style="font-size:11px;color:#6b7280">
        ${m.sender_role} • ${m.location}
      </div>
      <span style="
        display:inline-block;
        padding:6px 10px;
        border-radius:12px;
        max-width:80%;
        background:${m.sender_role === "ADMIN" ? "#2563eb" : "#e5e7eb"};
        color:${m.sender_role === "ADMIN" ? "#fff" : "#000"};
      ">
        ${m.message}
      </span>
    </div>
  `).join("");

  box.scrollTop = box.scrollHeight;
}

function sendAdminChat() {
  const input = document.getElementById("adminChatInput");
  const select = document.getElementById("adminChatLocationSelect");
  if (!input) return;

  const msg = input.value.trim();
  if (!msg) return;

  const location = select?.value;
  if (!location) {
    alert("No location selected to reply to yet.");
    return;
  }

  authFetch(API_URL, {
    method: "POST",
    body: new URLSearchParams({
      action: "sendChatMessage",
      sender_role: "ADMIN",
      sender_id: "ADMIN",
      location,
      message: msg
    })
  }).then(() => loadAdminChat())
    .catch(err => {
      console.warn("⚠️ Admin send failed:", err.message);
    });

  input.value = "";
}

document.getElementById("adminChatToggle")?.addEventListener("click", async () => {
  const box = document.getElementById("adminChatBox");
  box?.classList.toggle("hidden");

  if (!box.classList.contains("hidden")) {
    await ensureAdminChatLocations();
    loadAdminChat();
    document.getElementById("adminChatInput")?.focus();
  }
});

//loadAdminChat();

// 🔁 SINGLE poll (ONLY ONE)
setInterval(() => {
  const box = document.getElementById("adminChatBox");
  if (box && !box.classList.contains("hidden")) {
    loadAdminChat();
  }
}, 3000);

// 🔓 expose ONCE
window.sendAdminChat = sendAdminChat;

// Land on whichever page is marked active — dashboard for full-access
// roles, or the first page a page-restricted role (e.g. manager) is
// actually allowed, per the access-control block near the top of this file.
document.querySelector(".nav-btn.active")?.click();