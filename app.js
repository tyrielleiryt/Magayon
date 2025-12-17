import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAojoYbRWIPSEf3a-f5cfPbV-U97edveHg",
  authDomain: "magayon.firebaseapp.com",
  projectId: "magayon",
  storageBucket: "magayon.firebasestorage.app",
  messagingSenderId: "829239121774",
  appId: "1:829239121774:web:1fc5d0eed9a2abebcad37f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginBtn = document.getElementById("loginBtn");
const btnText = document.getElementById("btnText");
const errorMsg = document.getElementById("errorMsg");

const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");

/* LOGIN */
loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = passwordInput.value;

  errorMsg.style.display = "none";

  if (!email || !password) {
    showError("Please enter both email and password.");
    return;
  }

  loginBtn.classList.add("loading");
  btnText.textContent = "Signing in…";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "order.html";
  } catch (error) {
    showError("Invalid email or password.");
  } finally {
    loginBtn.classList.remove("loading");
    btnText.textContent = "Sign In";
  }
});

/* PASSWORD TOGGLE */
togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";

  eyeIcon.innerHTML = isHidden
    ? `<line x1="1" y1="1" x2="23" y2="23"></line>
       <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20
                c-7 0-11-8-11-8
                a21.8 21.8 0 0 1 5.06-6.94"></path>
       <path d="M9.9 4.24A9.77 9.77 0 0 1 12 4
                c7 0 11 8 11 8
                a21.8 21.8 0 0 1-2.06 3.18"></path>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path>
       <circle cx="12" cy="12" r="3"></circle>`;
});

/* ERROR */
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = "block";
}