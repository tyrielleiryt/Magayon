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

const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const eyeIcon = document.getElementById("eyeIcon");

togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";

  passwordInput.type = isHidden ? "text" : "password";

  eyeIcon.innerHTML = isHidden
    ? `<line x1="1" y1="1" x2="23" y2="23"></line>
       <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.94"></path>
       <path d="M9.9 4.24A9.77 9.77 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.06 3.18"></path>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path>
       <circle cx="12" cy="12" r="3"></circle>`;
});