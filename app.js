// Firebase CDN imports (required for GitHub Pages)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 🔥 Magayon Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAojoYbRWIPSEf3a-f5cfPbV-U97edveHg",
  authDomain: "magayon.firebaseapp.com",
  projectId: "magayon",
  storageBucket: "magayon.firebasestorage.app",
  messagingSenderId: "829239121774",
  appId: "1:829239121774:web:1fc5d0eed9a2abebcad37f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// UI elements
const loginBtn = document.getElementById("loginBtn");
const btnText = document.getElementById("btnText");
const errorMsg = document.getElementById("errorMsg");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

// ===== LOGIN =====
loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = passwordInput.value;

  errorMsg.style.display = "none";

  if (!email || !password) {
    showError("Please enter both email and password.");
    return;
  }

  loginBtn.classList.add("loading");
  loginBtn.disabled = true;
  btnText.textContent = "Signing in…";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "order.html";
  } catch (error) {
    let message = "Login failed. Please try again.";

    if (error.code === "auth/user-not-found") {
      message = "User not found.";
    } else if (error.code === "auth/wrong-password") {
      message = "Incorrect password.";
    } else if (error.code === "auth/invalid-email") {
      message = "Invalid email address.";
    }

    showError(message);
  } finally {
    loginBtn.classList.remove("loading");
    loginBtn.disabled = false;
    btnText.textContent = "Sign In";
  }
});

// ===== SHOW / HIDE PASSWORD =====
togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  togglePassword.textContent = isHidden ? "🙈" : "👁";
});

// ===== ERROR HELPER =====
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.display = "block";
}
