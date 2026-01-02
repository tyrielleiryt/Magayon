import { bindDataBoxScroll, jsonp } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API = "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let products = [];
let categories = [];
let selected = null;

export default async function loadProductsView() {
  renderActionBar();
  renderTableLayout();
  categories = await jsonp(API + "?type=categories");
  products = await jsonp(API + "?type=products");
  renderTable();
}

function renderActionBar() {
  actionBar.innerHTML = `
    <button id="add">➕ Add</button>
    <button id="edit" disabled>✏️ Edit</button>
    <button id="del" disabled>🗑️ Delete</button>
  `;
  add.onclick = openAdd;
  edit.onclick = openEdit;
  del.onclick = deleteProduct;
}

function renderTableLayout() {
  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th><th>Code</th><th>Name</th><th>Category</th>
              <th>Price</th><th>Qty</th><th>Unit</th>
            </tr>
          </thead>
          <tbody id="body"></tbody>
        </table>
      </div>
    </div>`;
  bindDataBoxScroll(contentBox.querySelector(".data-box"));
}

function renderTable() {
  const body = document.getElementById("body");
  body.innerHTML = "";
  products.forEach((p, i) => {
    const cat = categories.find(c => c.category_id === p.category_id);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${p.product_code}</td>
      <td>${p.product_name}</td>
      <td>${cat?.category_name || ""}</td>
      <td>${p.price}</td>
      <td>${p.quantity_per_serving}</td>
      <td>${p.unit}</td>`;
    tr.onclick = () => {
      body.querySelectorAll("tr").forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selected = p;
      edit.disabled = del.disabled = false;
    };
    body.appendChild(tr);
  });
}