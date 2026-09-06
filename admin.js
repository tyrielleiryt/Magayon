

import { ROLES, requireRole, logout, authFetch, getAllowedPages } from "./auth-guard.js";
import { API_URL } from "./firebase-config.js";
import { renderIcons } from "./icons.js";

window.API_URL = API_URL; // kept for admin-close-day.js

renderIcons();

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

/* ================= LAZY-LOADED VIEWS =================
   Was 13 static imports at the top of this file — every one of those
   view files downloaded and parsed on every single admin page load,
   regardless of which tab (if any) the admin actually visits. Loading
   each view's JS only when its tab is clicked cuts that dead weight
   off the initial page load, which matters most on a slow tablet
   connection. import() results are cached after the first load, so
   revisiting a tab doesn't re-fetch or re-parse anything. */
const VIEW_LOADERS = {
  capitalCalculator: () => import("./views/capital-calculator.js"),
  categories: () => import("./views/categories.js"),
  products: () => import("./views/products.js"),
  inventory: () => import("./views/inventoryitems.js"),
  dailyInventory: () => import("./views/dailyinventory.js"),
  dailySales: () => import("./views/dailySales.js"),
  pettyCash: () => import("./views/pettyCash.js"),
  salesExpensesTracker: () => import("./views/salesExpensesTracker.js"),
  locations: () => import("./views/locations.js"),
  staff: () => import("./views/staff.js"),
  attendance: () => import("./views/attendance.js"),
  permissions: () => import("./views/permissions.js"),
  dashboard: () => import("./views/dashboard.js")
};

// Only set once the dashboard has actually been loaded at least once —
// stopDashboardPolling() is a named export from that module, so it
// can't be referenced until the module itself has loaded.
let dashboardModule = null;

function clearView() {
  dashboardModule?.stopDashboardPolling?.(); // stop the dashboard's live-sales polling when leaving it
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
    const view = btn.dataset.view || "dashboard";
    const loadModule = VIEW_LOADERS[view] || VIEW_LOADERS.dashboard;

    try {
      const mod = await loadModule();
      if (view === "dashboard") dashboardModule = mod;
      mod.default();
    } catch (err) {
      console.error(`Failed to load view "${view}":`, err);
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
let adminChatFirstLoad = true;

function incrementAdminUnread() {
  const badge = document.getElementById("adminChatUnreadBadge");
  if (!badge) return;

  const n = Number(badge.textContent || 0) + 1;
  badge.textContent = n;
  badge.classList.remove("hidden");
}

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
      // 🔔 only notify if chat is closed (skip the very first load, since
      // that's just picking up existing history, not a new message)
      const box = document.getElementById("adminChatBox");
      if (!adminChatFirstLoad && box?.classList.contains("hidden")) {
        incrementAdminUnread();
      }
      adminChatFirstLoad = false;

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
    // ✅ CLEAR unread badge when opening chat
    const badge = document.getElementById("adminChatUnreadBadge");
    if (badge) {
      badge.textContent = "0";
      badge.classList.add("hidden");
    }

    await ensureAdminChatLocations();
    loadAdminChat();
    document.getElementById("adminChatInput")?.focus();
  }
});

//loadAdminChat();

// Self-rescheduling instead of a fixed setInterval, so it can poll fast
// (3s) while the chat is actually open, but back off to 20s while it's
// closed — this was hitting the backend every 3s for the entire time the
// admin panel is open, regardless of whether anyone was watching chat,
// competing with whatever view/data fetch the admin was actually waiting
// on. Still keeps polling while closed (just slower) so the unread badge
// (set inside loadAdminChat() only while hidden) can still fire.
function scheduleAdminChatPoll() {
  const box = document.getElementById("adminChatBox");
  const isOpen = box && !box.classList.contains("hidden");
  setTimeout(() => {
    loadAdminChat();
    scheduleAdminChatPoll();
  }, isOpen ? 3000 : 20000);
}
scheduleAdminChatPoll();

// 🔓 expose ONCE
window.sendAdminChat = sendAdminChat;

// Land on whichever page is marked active — dashboard for full-access
// roles, or the first page a page-restricted role (e.g. manager) is
// actually allowed, per the access-control block near the top of this file.
document.querySelector(".nav-btn.active")?.click();