

/* =========================================================
   FIREBASE IMPORTS
========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================================================
   CONFIG
========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* =========================================================
   FIREBASE CONFIG
========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyAojoYbRWIPSEf3a-f5cfPbV-U97edveHg",
  authDomain: "magayon.firebaseapp.com",
  projectId: "magayon"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/* =========================================================
   ELEMENTS
========================================================= */
const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("errorMsg");

/* =========================================================
   LOADER HELPERS (STEP 4)
========================================================= */
function showLoader(text = "Signing in…") {
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

/* =========================================================
   JSONP (GAS SAFE)
========================================================= */
function jsonp(params) {
  return new Promise((resolve, reject) => {
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
    script.onerror = () => {
      delete window[cb];
      reject(new Error("Server connection failed"));
    };

    document.body.appendChild(script);
  });
}

/* =========================================================
   LOGIN
========================================================= */
async function handleLogin() {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  errorMsg.textContent = "";

  if (!email || !password) {
    errorMsg.textContent = "Please enter email and password.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";
  showLoader("Authenticating account…");

  try {
    /* 🔐 FIREBASE AUTH */
    await signInWithEmailAndPassword(auth, email, password);

    showLoader("Verifying staff access…");

    /* 🔎 STAFF AUTHORIZATION */
    const staffList = await jsonp({ type: "staff" });

    const staff = staffList.find(
      s => s.email === email && s.active === true
    );

    if (!staff) {
      throw new Error("Account is not registered as active staff.");
    }

    if (
      staff.position.toLowerCase() === "cashier" &&
      staff.can_pos !== true
    ) {
      throw new Error("You are not authorized to use POS.");
    }

    showLoader("Starting shift…");

    /* ⏱ START SHIFT (BLOCKING) */
    await jsonp({
      action: "startShift",
      staff_id: staff.staff_id,
      location: staff.location_id
    });

    /* ✅ SAVE SESSION */
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("staff_id", staff.staff_id);
    localStorage.setItem("userEmail", email);
    localStorage.setItem(
      "userName",
      `${staff.first_name} ${staff.last_name}`
    );
    localStorage.setItem("userPosition", staff.position);
    localStorage.setItem("userLocation", staff.location_id);
    localStorage.setItem("canPOS", staff.can_pos);

    showLoader("Redirecting…");

    /* 🚦 ROUTE */
    if (staff.position.toLowerCase() === "admin") {
      window.location.replace("main.html");
    } else {
      window.location.replace("order.html");
    }

  } catch (err) {
    console.error(err);

    errorMsg.textContent =
      err.message || "Login failed. Please try again.";

    hideLoader();
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
}

/* =========================================================
   EVENTS
========================================================= */
loginBtn.addEventListener("click", handleLogin);

document.addEventListener("keydown", e => {
  if (e.key === "Enter") handleLogin();
});
