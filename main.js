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

document.getElementById("closeDayBtn")?.addEventListener("click", async () => {
  if (!confirm("Close inventory for today? This will record wastage.")) return;

  const res = await fetch(API_URL, {
    method: "POST",
    body: new URLSearchParams({
      action: "closeInventoryDay",
      date: getPHDate(),
      location: localStorage.getItem("userLocation")
    })
  });

  const data = await res.json();

  if (data.success) {
    alert("✅ Inventory closed. Wastage recorded.");
  } else {
    alert("❌ Failed to close inventory.");
  }
});