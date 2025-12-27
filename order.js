console.log("ORDER.JS LOADED");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= FIREBASE ================= */

const firebaseConfig = {
  apiKey: "AIzaSyAojoYbRWIPSEf3a-f5cfPbV-U97edveHg",
  authDomain: "magayon.firebaseapp.com",
  projectId: "magayon",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= AUTH + ROLE CHECK ================= */

let authResolved = false;

onAuthStateChanged(auth, async (user) => {
  if (authResolved) return; // prevent re-run
  authResolved = true;

  if (!user) {
    window.location.replace("index.html");
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) {
      window.location.replace("index.html");
      return;
    }

    const role = snap.data().role;

    // Allow ADMIN and CASHIER
    if (role !== "admin" && role !== "cashier") {
      window.location.replace("index.html");
      return;
    }

    // ✅ Authorized — allow POS to load

  } catch (error) {
    console.error("Auth check error:", error);
    window.location.replace("index.html");
  }
});

/* ================= PRODUCTS (TEMP) ================= */

const products = [
  {
    id: 1,
    name: "Pancit Bato w/ Lechon Kawali",
    price: 60,
    category: "Pancit Bato Meals",
    image: "images/p1.jpg"
  },
  {
    id: 2,
    name: "Pancit Bato w/ Chicharon",
    price: 47,
    category: "Pancit Bato Meals",
    image: "images/p2.jpg"
  },
  {
    id: 3,
    name: "Pancit Bato w/ Dinuguan",
    price: 55,
    category: "Dinuguan Meals",
    image: "images/p3.jpg"
  },
  {
    id: 4,
    name: "Bicol Express Meal",
    price: 65,
    category: "Bicol Express Meals",
    image: "images/p4.jpg"
  },
  {
    id: 5,
    name: "Iced Tea",
    price: 20,
    category: "Drinks",
    image: "images/drink1.jpg"
  }
];

/* ================= DOM ELEMENTS ================= */

const grid = document.getElementById("productGrid");
const table = document.getElementById("orderTable");
const totalEl = document.getElementById("sumTotal");
const clearBtn = document.getElementById("clearOrderBtn");
const categoryButtons = document.querySelectorAll(".category-btn");

/* ================= STATE ================= */

let order = [];
let total = 0;

/* ================= RENDER PRODUCTS ================= */

function renderProducts(list) {
  grid.innerHTML = "";

  list.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.image}">
      <h4>${product.name}</h4>
      <strong>₱${product.price}</strong>
    `;
    card.addEventListener("click", () => addToOrder(product));
    grid.appendChild(card);
  });
}

/* ================= CATEGORY FILTER ================= */

categoryButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    categoryButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const category = btn.dataset.category;

    if (category === "all") {
      renderProducts(products);
    } else {
      renderProducts(products.filter(p => p.category === category));
    }
  });
});

/* ================= ORDER LOGIC ================= */

function addToOrder(product) {
  order.push(product);
  total += product.price;

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${order.length}</td>
    <td>${product.name}</td>
    <td>1</td>
    <td>₱${product.price}</td>
    <td>₱${product.price}</td>
  `;

  table.appendChild(row);
  totalEl.textContent = total;
}

/* ================= CLEAR ORDER ================= */

clearBtn.addEventListener("click", () => {
  if (!confirm("Clear all current orders?")) return;

  order = [];
  total = 0;
  table.innerHTML = "";
  totalEl.textContent = "0";
});

/* ================= INITIAL LOAD ================= */

renderProducts(products);