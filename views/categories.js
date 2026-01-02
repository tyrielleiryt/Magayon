import { bindDataBoxScroll, jsonp } from "../admin.js";
import { openModal, closeModal } from "./modal.js";

const API = "https://script.google.com/macros/s/AKfycbzk9NGHZz6kXPTABYSr81KleSYI_9--ej6ccgiSqFvDWXaR9M8ZWf1EgzdMRVgReuh8/exec";

let categories = [];
let selected = null;
let currentPage = 1;
const PAGE_SIZE = 10;
let searchQuery = "";

export default async function loadCategoriesView() {
  renderActionBar();
  renderTableLayout();
  categories = await jsonp(API + "?type=categories");
  renderTable();
}

function renderActionBar() {
  actionBar.innerHTML = `
    <input id="search" placeholder="Search categories">
    <button id="add">➕ Add</button>
    <button id="edit" disabled>✏️ Edit</button>
    <button id="del" disabled>🗑️ Delete</button>
  `;
  search.oninput = e => { searchQuery = e.target.value.toLowerCase(); renderTable(); };
  add.onclick = openAdd;
  edit.onclick = openEdit;
  del.onclick = openDelete;
}

function renderTableLayout() {
  contentBox.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table">
          <thead><tr><th>#</th><th>Name</th><th>Description</th><th>Qty</th></tr></thead>
          <tbody id="body"></tbody>
        </table>
      </div>
    </div>`;
  bindDataBoxScroll(contentBox.querySelector(".data-box"));
}

function renderTable() {
  const body = document.getElementById("body");
  body.innerHTML = "";

  categories
    .filter(c => `${c.category_name}${c.description}`.toLowerCase().includes(searchQuery))
    .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    .forEach((c, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i + 1}</td><td>${c.category_name}</td><td>${c.description}</td><td>${c.qty}</td>`;
      tr.onclick = () => {
        body.querySelectorAll("tr").forEach(r => r.classList.remove("selected"));
        tr.classList.add("selected");
        selected = c;
        edit.disabled = del.disabled = false;
      };
      body.appendChild(tr);
    });
}

/* ADD / EDIT / DELETE use Image().src — unchanged */