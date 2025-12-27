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

    // 🔎 Fetch role from Firestore
    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) {
      throw new Error("User role not found");
    }

    const role = snap.data().role;

    // ✅ Save session state
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("userRole", role);
    localStorage.setItem("userEmail", email);

    // 🚦 Route by role
    if (role === "admin") {
      window.location.replace("main.html");
    } else if (role === "cashier") {
      window.location.replace("order.html");
    } else {
      throw new Error("Invalid role");
    }

  } catch (err) {
    console.error(err);
    errorMsg.textContent = "Invalid email or password.";
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
}

/* ===== BUTTON CLICK ===== */
loginBtn.addEventListener("click", handleLogin);

/* ===== ENTER KEY SUPPORT ===== */
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleLogin();
  }
});