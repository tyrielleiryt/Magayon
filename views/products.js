import { bindDataBoxScroll } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

/* ================= ENTRY ================= */
export default function loadProductsView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addProductBtn" class="category-action-btn">
      + Add Product
    </button>
  `;

  document.getElementById("addProductBtn").onclick = openAddProductModal;

  document.getElementById("contentBox").innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table product-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="productsBody">
            <tr>
              <td colspan="5" style="color:#888;text-align:center;">
                No products yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  bindDataBoxScroll(document.querySelector(".data-box"));
}

/* ================= ADD PRODUCT MODAL ================= */
function openAddProductModal() {
  openModal(`
    <div class="modal-header">Add Product</div>

    <label>Product Name</label>
    <input id="productName">

    <label>Category</label>
    <input id="productCategory">

    <label>Price</label>
    <input type="number" id="productPrice">

    <div class="modal-actions">
      <button class="btn-danger" onclick="saveProduct()">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

/* ================= SAVE (UI ONLY FOR NOW) ================= */
window.saveProduct = () => {
  alert("Product saved (backend not wired yet)");
  closeModal();
};