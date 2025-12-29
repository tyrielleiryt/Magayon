import { bindDataBoxScroll } from "../admin.js";

export default function loadCategoriesView() {
  document.getElementById("actionBar").innerHTML = `
    <button id="addBtn">+ Add Category</button>
    <button id="editBtn">Edit</button>
    <button id="deleteBtn">Delete</button>
    <button id="upBtn">⬆</button>
    <button id="downBtn">⬇</button>
  `;

  document.getElementById("contentBox").innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table" style="min-width: 800px">
          <thead>
            <tr>
              <th>#</th>
              <th>Category Name</th>
              <th>Description</th>
              <th>QTY</th>
            </tr>
          </thead>
          <tbody id="categoryTableBody"></tbody>
        </table>
      </div>

      <div class="data-scroll-controls">
        <button class="scroll-left">◀</button>
        <button class="scroll-right">▶</button>
      </div>
    </div>
  `;

  bindActions();
  loadCategories();
  bindDataBoxScroll(document.querySelector(".data-box"));
}