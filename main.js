console.log("ADMIN.JS LOADED");
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* FIREBASE */
const firebaseConfig = {
  apiKey: "AIzaSyAojoYbRWIPSEf3a-f5cfPbV-U97edveHg",
  authDomain: "magayon.firebaseapp.com",
  projectId: "magayon",
};

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= INVENTORY DAY ACTIONS ================= */

function getPHDate() {
  const now = new Date();
  const ph = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  return ph.toISOString().slice(0, 10);
}


/* ADMIN GUARD */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("index.html");
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists() || snap.data().role !== "admin") {
    window.location.replace("order.html");
  }
});

/* LOGOUT */
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.replace("index.html");
  });
});

/* DATE & TIME */
function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").textContent =
    now.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
}

updateDateTime();
setInterval(updateDateTime, 60000);

function openCloseDayModal(date, location) {
  document.getElementById("closeDayDate").textContent = date;
  document.getElementById("closeDayLocation").textContent = location;

  const checkbox = document.getElementById("confirmCloseDayCheckbox");
  const confirmBtn = document.getElementById("confirmCloseDayBtn");

  checkbox.checked = false;
  confirmBtn.disabled = true;

  document.getElementById("closeDayModal").classList.remove("hidden");

  // 🛡 SAFE CALL
  if (typeof loadInventorySummary === "function") {
    loadInventorySummary(date, location);
  }
}

function showLoader(text = "Loading…") {
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


document.getElementById("startDayBtn")?.addEventListener("click", async () => {
  console.log("START DAY CLICKED");

  if (!confirm("Start today's inventory? This will close yesterday if needed.")) {
    return;
  }

  const today = getPHDate();
  const location = localStorage.getItem("userLocation");
  const adminUser = localStorage.getItem("admin_email") || "ADMIN";

  if (!location) {
    alert("❌ Location not set.");
    return;
  }

  try {
    showLoader("Starting inventory day…");

    const res = await fetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "manualStartInventoryDay",
        date: today,
        location,
        adminUser
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert("❌ " + data.error);
      return;
    }

    alert("✅ Inventory day started successfully");
    window.location.reload();

  } catch (err) {
    console.error(err);
    alert("❌ Failed to start inventory day");
  } finally {
    hideLoader();
  }
});

document.getElementById("closeDayBtn")?.addEventListener("click", () => {
  const date = getPHDate();
  const location = localStorage.getItem("userLocation");

  if (!location) {
    alert("❌ Location not set.");
    return;
  }

  openCloseDayModal(date, location);
});



document.getElementById("confirmCloseDayCheckbox")
  ?.addEventListener("change", e => {
    document.getElementById("confirmCloseDayBtn").disabled = !e.target.checked;
  });

  document.getElementById("cancelCloseDayBtn")
  ?.addEventListener("click", () => {
    document.getElementById("closeDayModal").classList.add("hidden");
  });

  document.getElementById("confirmCloseDayBtn")
  ?.addEventListener("click", async () => {
    const date = document.getElementById("closeDayDate").textContent;
    const location = document.getElementById("closeDayLocation").textContent;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: new URLSearchParams({
          action: "closeInventoryDay",
          date,
          location
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      alert("✅ Inventory successfully closed.");
      window.location.reload();
    } catch (err) {
      alert("❌ " + err.message);
    }
  });
