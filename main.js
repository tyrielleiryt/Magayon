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

/* SIDEBAR NAVIGATION */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    window.location.href = btn.dataset.page;
  });
});

function getPHDate() {
  const now = new Date();
  const ph = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  return ph.toISOString().slice(0, 10);
}

function openCloseDayModal(date, location) {
  document.getElementById("closeDayDate").textContent = date;
  document.getElementById("closeDayLocation").textContent = location;

  const checkbox = document.getElementById("confirmCloseDayCheckbox");
  const confirmBtn = document.getElementById("confirmCloseDayBtn");

  checkbox.checked = false;
  confirmBtn.disabled = true;

  document.getElementById("closeDayModal").classList.remove("hidden");

    // ✅ LOAD INVENTORY SUMMARY
  loadInventorySummary(date, location);
}

document.getElementById("closeDayBtn")?.addEventListener("click", () => {
  const date = getPHDate();
  const location = localStorage.getItem("userLocation");

  if (!location) {
    alert("Location not set.");
    return;
  }
  // ✅ THIS WAS MISSING
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
      window.location.reload(); // ✅ FIXED

    } catch (err) {
      alert("❌ " + err.message);
    }
});