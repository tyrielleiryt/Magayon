alert("APP.JS IS RUNNING");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyAojoYbRWIPSEf3a-f5cfPbV-U97edveHg",
  authDomain: "magayon.firebaseapp.com",
  projectId: "magayon",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* LOGIN */
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Please enter email and password");
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // 🔥 FETCH ROLE FROM FIRESTORE
    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) {
      alert("User role not found");
      return;
    }

    const role = snap.data().role;

    // ✅ ROUTE BASED ON ROLE
    if (role === "admin") {
      window.location.replace("main.html");
    } else if (role === "cashier") {
      window.location.replace("order.html");
    } else {
      alert("Invalid role");
    }

  } catch (err) {
    alert("Login failed");
    console.error(err);
  }
});