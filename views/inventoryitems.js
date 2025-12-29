import { bindDataBoxScroll } from "../admin.js";

export default function loadInventoryItemsView() {
  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
    <div class="action-bar">
      <button id="addItemBtn">+ Add inventory item</button>
      <button id="editItemBtn">Edit</button>
      <button id="deleteItemBtn">Delete</button>
    </div>

    <div class="data-box">
      <div class="data-scroll">
        <table class="category-table" style="min-width: 900px">
          <thead>
            <tr>
              <th>#</th>
              <th>Item Name</th>
              <th>Description</th>
              <th>Capital</th>
              <th>Selling Price</th>
            </tr>
          </thead>
          <tbody id="inventoryTableBody"></tbody>
        </table>
      </div>

      <div class="data-scroll-controls">
        <button class="scroll-left">◀</button>
        <button class="scroll-right">▶</button>
      </div>
    </div>
  `;

  bindActions();
  loadInventoryItems();
  bindDataBoxScroll(contentBox.querySelector(".data-box"));
}