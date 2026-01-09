import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= FIREBASE CONFIG ================= */
const firebaseConfig = {
  apiKey: "AIzaSyAojoYbRWIPSEf3a-f5cfPbV-U97edveHg",
  authDomain: "magayon.firebaseapp.com",
  projectId: "magayon"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

    if (user.role === "cashier" && user.can_pos !== "true") {
      throw new Error("Not authorized for POS.");
    }

    /* ✅ SESSION */
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("staff_id", user.staff_id);
    localStorage.setItem("userEmail", user.email);
    localStorage.setItem("userName", user.name);
    localStorage.setItem("userPosition", user.role);
    localStorage.setItem("userLocation", user.location);
    localStorage.setItem("canPOS", user.can_pos);

    /* 🚦 ROUTE */
    window.location.replace(
      user.role === "admin" ? "main.html" : "order.html"
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
document.addEventListener("keydown", e => {
  if (e.key === "Enter") handleLogin();
});