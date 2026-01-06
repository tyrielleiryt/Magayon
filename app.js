/* ===== FIREBASE IMPORTS ===== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ===== CONFIG ===== */
const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ===== FIREBASE CONFIG ===== */
const firebaseConfig = {
  apiKey: "AIzaSyAojoYbRWIPSEf3a-f5cfPbV-U97edveHg",
  authDomain: "magayon.firebaseapp.com",
  projectId: "magayon",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/* ===== ELEMENTS ===== */
const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("errorMsg");

/* ===== JSONP HELPER (GAS SAFE) ===== */
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
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

/* ===== LOGIN FUNCTION ===== */
async function handleLogin() {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  errorMsg.textContent = "";

  if (!email || !password) {
    errorMsg.textContent = "Please enter both email and password.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";

  try {
    /* 🔐 FIREBASE AUTH */
    await signInWithEmailAndPassword(auth, email, password);

    /* 🔎 STAFF AUTHORIZATION (GAS) */
    const staffList = await jsonp({ type: "staff" });

    const staff = staffList.find(
      s => s.email?.toLowerCase() === email && s.active === true
    );

    if (!staff) {
      throw new Error("You are not registered as active staff.");
    }

    /* 🚫 CASHIER WITHOUT POS */
    if (staff.position.toLowerCase() === "cashier" && !staff.can_pos) {
      throw new Error("You are not authorized to access POS.");
    }

    jsonp({
  action: "startShift",
  staff_id: staff.staff_id,
  location: staff.location_id
});

jsonp({
  action: "endShift",
  staff_id: localStorage.getItem("staff_id")
});

    /* ✅ SAVE SESSION */
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userEmail", email);
    localStorage.setItem("userName", `${staff.first_name} ${staff.last_name}`);
    localStorage.setItem("userPosition", staff.position);
    localStorage.setItem("userLocation", staff.location_id);
    localStorage.setItem("canPOS", staff.can_pos);

    /* 🚦 ROUTING */
    if (staff.position.toLowerCase() === "admin") {
      window.location.replace("main.html");
    } else {
      window.location.replace("order.html");
    }

  } catch (err) {
    console.error(err);
    errorMsg.textContent = err.message || "Invalid email or password.";
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
}

/* ===== EVENTS ===== */
loginBtn.addEventListener("click", handleLogin);
document.addEventListener("keydown", e => {
  if (e.key === "Enter") handleLogin();
});