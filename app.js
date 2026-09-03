import { signInWithEmailAndPassword } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import { ROLES, hasFullAccess } from "./auth-guard.js";

const KNOWN_ROLES = [ROLES.CASHIER, ROLES.MANAGER, ROLES.ADMIN, ROLES.IT_ADMIN, ROLES.OWNER];

/* ================= ELEMENTS ================= */
const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("errorMsg");

/* ================= LOGIN ================= */
async function handleLogin() {
  errorMsg.textContent = "";

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    errorMsg.textContent = "Please enter email and password.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";

  try {
    /* 🔐 AUTH */
    const cred = await signInWithEmailAndPassword(auth, email, password);

    /* 🔎 FIRESTORE PROFILE */
    const userRef = doc(db, "users", cred.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      throw new Error("User profile not found.");
    }

    const user = snap.data();

    if (user.active !== true) {
      throw new Error("Account is inactive.");
    }

    if (!KNOWN_ROLES.includes(user.role)) {
      throw new Error("Unrecognized role. Contact your IT admin.");
    }

    if (user.role === ROLES.CASHIER && user.can_pos !== true && user.can_pos !== "true") {
      throw new Error("Not authorized for POS.");
    }

    /* ✅ SESSION (cache only — every protected page re-verifies via auth-guard.js) */
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("staff_id", user.staff_id);
    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userName", user.name);
    localStorage.setItem("userPosition", user.role);
    localStorage.setItem("userLocation", user.location);
    localStorage.setItem("canPOS", user.can_pos);

    /* 🚦 ROUTE — full-access roles and manager land on the admin panel
       (manager just sees fewer nav items there); cashier goes to POS. */
    window.location.replace(
      hasFullAccess(user.role) || user.role === ROLES.MANAGER ? "main.html" : "order.html"
    );

  } catch (err) {
    console.error(err);
    errorMsg.textContent = err.message;
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
}

/* ================= EVENTS ================= */
loginBtn.addEventListener("click", handleLogin);
