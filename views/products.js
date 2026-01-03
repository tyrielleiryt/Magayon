import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= STATE ================= */
let products = [];
let categories = [];
let selected = null;

/* ================= ENTRY (CRITICAL) ================= */
export default async function loadProductsView() {
  renderActionBar();
  renderTableLayout();   // ✅ THIS WAS MISSING
  await loadCategories();
  await loadProducts();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addBtn" class="category-action-btn">➕ Add Product</button>
    <button id="editBtn" class="category-action-btn" disabled>✏️ Edit</button>
    <button id="deleteBtn" class="category-action-btn" disabled>🗑️ Delete</button>
  `;

  document.getElementById("addBtn").onclick = () => openProductModal();
  document.getElementById("editBtn").onclick = () => selected && openProductModal(selected);
  document.getElementById("deleteBtn").onclick = deleteProduct;
}

/* ================= TABLE LAYOUT ================= */
function renderTableLayout() {
  const box = document.getElementById("contentBox");

  box.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table product-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Image</th>
            </tr>
          </thead>
          <tbody id="productBody"></tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(box.querySelector(".data-box"));
}

/* ================= LOAD DATA ================= */
async function loadCategories() {
  const res = await fetch(API_URL + "?type=categories");
  categories = await res.json();
}

async function loadProducts() {
  const res = await fetch(API_URL + "?type=products");
  products = await res.json();

  selected = null;
  document.getElementById("editBtn").disabled = true;
  document.getElementById("deleteBtn").disabled = true;

  renderTable();
}

/* ================= RENDER TABLE ================= */
function renderTable() {
  const tbody = document.getElementById("productBody");

  // ✅ HARD GUARD (prevents crash)
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!products.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#888">
          No products found
        </td>
      </tr>
    `;
    return;
  }

  products.forEach((p, i) => {
    const cat = categories.find(c => c.category_id === p.category_id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${p.product_code || ""}</td>
      <td>${p.product_name}</td>
      <td>${cat ? cat.category_name : ""}</td>
      <td>₱${Number(p.price).toFixed(2)}</td>
      <td>${p.image_url ? "✔" : "-"}</td>
    `;

    tr.onclick = () => {
      document.querySelectorAll("#productBody tr")
        .forEach(r => r.classList.remove("selected"));

      tr.classList.add("selected");
      selected = p;

      document.getElementById("editBtn").disabled = false;
      document.getElementById("deleteBtn").disabled = false;
    };

    tbody.appendChild(tr);
  });
}

/* ================= MODAL PLACEHOLDER ================= */
window.openProductModal = function () {
  openModal(`
    <div class="modal-header">Add Product</div>
    <p style="color:#666">Product recipe UI will appear here next.</p>

    <div class="modal-actions">
      <button class="btn-back" onclick="closeModal()">Close</button>
    </div>
  `);
};

/* ================= DELETE ================= */
function deleteProduct() {
  if (!selected) return;
  if (!confirm(`Delete ${selected.product_name}?`)) return;

  new Image().src =
    API_URL + `?action=deleteProduct&rowIndex=${selected.rowIndex}`;

  setTimeout(loadProducts, 600);
}