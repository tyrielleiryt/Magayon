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
const togglePasswordBtn = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");

/* ================= PASSWORD VISIBILITY TOGGLE ================= */
const EYE_OPEN_ICON = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>`;
const EYE_OFF_ICON = `<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;

togglePasswordBtn?.addEventListener("click", () => {
  const willShow = passwordInput.type === "password";
  passwordInput.type = willShow ? "text" : "password";
  eyeIcon.innerHTML = willShow ? EYE_OFF_ICON : EYE_OPEN_ICON;
});

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

    /* ✅ SESSION (cache only — every protected page re-verifies via auth-guard.js) */
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("staff_id", user.staff_id);
    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userName", user.name);
    localStorage.setItem("userPosition", user.role);
    localStorage.setItem("userLocation", user.location);

    /* 🚦 ROUTE — full-access roles and manager land on the admin panel
       (manager just sees fewer nav items there); cashier goes to POS. */
    window.location.replace(
      hasFullAccess(user.role) || user.role === ROLES.MANAGER ? "main.html" : "order.html"
    );

  } catch (err) {
    console.error(err);

    const WRONG_CREDENTIAL_CODES = [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
      "auth/invalid-email"
    ];

    if (WRONG_CREDENTIAL_CODES.includes(err.code)) {
      alert("Email or password is wrong, please check again.");
    } else {
      errorMsg.textContent = err.message;
    }

    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
}

/* ================= EVENTS ================= */
loginBtn.addEventListener("click", handleLogin);

// Enter submits from either field, matching a normal login form even
// though these inputs aren't wrapped in a <form> (the button is
// type="button" on purpose, to avoid a real page-reloading submit).
[emailInput, passwordInput].forEach(input => {
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLogin();
    }
  });
});
