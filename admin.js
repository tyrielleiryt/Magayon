

/* ================= AUTH GUARD ================= */
if (localStorage.getItem("isLoggedIn") !== "true") {
  window.location.replace("index.html");
}

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

window.API_URL = API_URL; // optional, but helpful for debugging

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
    const API_URL =
      "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";
    new Image().src = `${API_URL}?action=endShift&staff_id=${staffId}`;
  }

  localStorage.clear();
  sessionStorage.clear();
  window.location.replace("index.html");
});

/* ================= IMPORT VIEWS ================= */
import loadCategoriesView from "./views/categories.js";
import loadInventoryItemsView from "./views/inventoryitems.js";
import loadDailyInventoryView from "./views/dailyinventory.js";
import loadProductsView from "./views/products.js";
import loadDailySalesView from "./views/dailySales.js";
import loadLocationsView from "./views/locations.js";
import loadStaffView from "./views/staff.js";
import loadDashboardView from "./views/dashboard.js";

function clearView() {
  document.getElementById("actionBar")?.replaceChildren();
  document.getElementById("contentBox")?.replaceChildren();
}

/* ================= SPA NAV (WITH LOADER) ================= */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.onclick = async () => {
    // Active state
    document
      .querySelectorAll(".nav-btn")
      .forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Reset UI
clearView();

    // 🔥 SHOW LOADER
    showLoader("Loading module…");

    try {
      switch (btn.dataset.view) {
        case "categories":
          await loadCategoriesView();
          break;

        case "products":
          await loadProductsView();
          break;

        case "inventory":
          await loadInventoryItemsView();
          break;

        case "dailyInventory":
          await loadDailyInventoryView();
          break;

        case "dailySales":
          await loadDailySalesView();
          break;

        case "locations":
          await loadLocationsView();
          break;

        case "staff":
          await loadStaffView();
          break;

        case "dashboard":
        default:
          await loadDashboardView();
      }
    } finally {
      // ✅ ALWAYS hide loader
      requestAnimationFrame(hideLoader);
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

let currentReplyLocation = "ALL"; // default

function renderAdminChat(messages = []) {
  const box = document.getElementById("adminChatMessages");
  if (!box) return;

  // ✅ FIND LAST CASHIER MESSAGE AND SET REPLY LOCATION
  const lastCashier = [...messages]
    .reverse()
    .find(m => m.sender_role === "CASHIER");

  if (lastCashier?.location) {
    currentReplyLocation = lastCashier.location;
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
  if (!input) return;

  const msg = input.value.trim();
  if (!msg) return;

  fetch(API_URL, {
    method: "POST",
    body: new URLSearchParams({
      action: "sendChatMessage",
      sender_role: "ADMIN",
      sender_id: "ADMIN",
      location: currentReplyLocation, // ✅ NOT "ALL"
      message: msg
    })
  }).catch(err => {
    console.warn("⚠️ Admin send failed:", err.message);
  });

  input.value = "";
}

document.getElementById("adminChatToggle")?.addEventListener("click", () => {
  const box = document.getElementById("adminChatBox");
  box?.classList.toggle("hidden");

  if (!box.classList.contains("hidden")) {
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