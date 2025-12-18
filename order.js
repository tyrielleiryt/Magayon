import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* Firebase config */
const firebaseConfig = {
  apiKey: "AIzaSyAojoYbRWIPSEf3a-f5cfPbV-U97edveHg",
  authDomain: "magayon.firebaseapp.com",
  projectId: "magayon",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* AUTH + ROLE CHECK */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "cashier") {
    window.location.href = "index.html";
  }
});

/* PRODUCTS (TEMP — you will replace images) */
const products = [
  { id: 1, name: "Pancit Bato w/ Lechon Kawali", price: 60, image: "images/p1.jpg" },
  { id: 2, name: "Pancit Bato w/ Chicharon", price: 47, image: "images/p2.jpg" },
  { id: 3, name: "Pancit Bato w/ Dinuguan", price: 55, image: "images/p3.jpg" },
  { id: 4, name: "Pancit Bato w/ 2pcs Lumpia", price: 50, image: "images/p4.jpg" }
];

const grid = document.getElementById("productGrid");
const table = document.getElementById("orderTable");
const totalEl = document.getElementById("sumTotal");

let order = [];
let total = 0;

/* RENDER PRODUCTS */
products.forEach(p => {
  const div = document.createElement("div");
  div.className = "product-card";
  div.innerHTML = `
    <img src="${p.image}">
    <h4>${p.name}</h4>
    <strong>₱${p.price}</strong>
  `;
  div.onclick = () => addToOrder(p);
  grid.appendChild(div);
});

/* ORDER LOGIC */
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