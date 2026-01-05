/* ===== FIREBASE IMPORTS ===== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===== FIREBASE CONFIG ===== */
const firebaseConfig = {
  apiKey: "AIzaSyAojoYbRWIPSEf3a-f5cfPbV-U97edveHg",
  authDomain: "magayon.firebaseapp.com",
  projectId: "magayon",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ===== ELEMENTS ===== */
const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("errorMsg");

/* ===== LOGIN FUNCTION ===== */
async function handleLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  errorMsg.textContent = "";

  if (!email || !password) {
    errorMsg.textContent = "Please enter both email and password.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";

  try {
    // 🔐 Firebase Auth
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // 🔎 Firestore user profile
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) throw new Error("User profile not found");

    const data = snap.data();

    if (data.active !== true) {
      throw new Error("Account is disabled");
    }

    // ✅ SAVE SESSION
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userRole", data.role);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("userName", data.name || "");
    localStorage.setItem("userLocation", data.location || "");

    // 🚦 ROUTE BY ROLE
    if (data.role === "admin") {
      window.location.replace("main.html");
    } else if (data.role === "cashier") {
      window.location.replace("order.html");
    } else {
      throw new Error("Invalid role");
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