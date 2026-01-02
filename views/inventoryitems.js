import { bindDataBoxScroll, jsonp } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API = "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let items = [];
let selected = null;

export default async function loadInventoryItemsView() {
  renderActionBar();
  renderTableLayout();
  items = await jsonp(API + "?type=inventoryItems");
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
  del.onclick = openDelete;
}

function renderTableLayout() {
  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead><tr><th>#</th><th>Name</th><th>Capital</th><th>Price</th></tr></thead>
          <tbody id="body"></tbody>
        </table>
      </div>
    </div>`;
  bindDataBoxScroll(contentBox.querySelector(".data-box"));
}

function renderTable() {
  const body = document.getElementById("body");
  body.innerHTML = "";
  items.forEach((i, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${idx + 1}</td><td>${i.item_name}</td><td>${i.capital}</td><td>${i.selling_price}</td>`;
    tr.onclick = () => {
      body.querySelectorAll("tr").forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selected = i;
      edit.disabled = del.disabled = false;
    };
    body.appendChild(tr);
  });
}