import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 🔥 USE YOUR REAL FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Elements
const loginBtn = document.getElementById("loginBtn");
const btnText = document.getElementById("btnText");
const errorMsg = document.getElementById("errorMsg");

loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  // Reset error
  errorMsg.style.display = "none";
  errorMsg.innerText = "";

  if (!email || !password) {
    showError("Please enter both email and password.");
    return;
  }

  // Loading state
  loginBtn.classList.add("loading");
  loginBtn.disabled = true;
  btnText.innerText = "Signing in…";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "order.html";
  } catch (error) {
    let message = "Login failed. Please try again.";

    if (error.code === "auth/user-not-found") {
      message = "User not found.";
    } else if (error.code === "auth/wrong-password") {
      message = "Incorrect password.";
    }

    showError(message);
  } finally {
    loginBtn.classList.remove("loading");
    loginBtn.disabled = false;
    btnText.innerText = "Sign In";
  }
});

function showError(message) {
  errorMsg.innerText = message;
  errorMsg.style.display = "block";
}