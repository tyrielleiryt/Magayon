const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

export default function loadInventoryItemsView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  /* ===== ACTION BAR ===== */
  actionBar.innerHTML = `
    <div class="action-bar">
      <button id="addItemBtn">+ Add Inventory Item</button>
      <button id="editItemBtn">Edit</button>
      <button id="deleteItemBtn">Delete</button>
    </div>
  `;

  /* ===== MAIN CONTENT ===== */
  contentBox.innerHTML = `
    <div class="view-body">
      <table class="category-table">
        <thead>
          <tr>
            <th style="width:50px">#</th>
            <th>Item Name</th>
            <th>Description</th>
            <th style="width:120px">Capital</th>
            <th style="width:120px">Price</th>
          </tr>
        </thead>
        <tbody id="inventoryTableBody">
          <tr>
            <td colspan="5" style="text-align:center; padding:20px;">
              Inventory Items UI ready ✔
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  bindInventoryActions();
}

/* ===== ACTIONS ===== */
function bindInventoryActions() {
  document.getElementById("addItemBtn")?.addEventListener("click", () => {
    alert("Add Inventory Item modal coming next");
  });

  document.getElementById("editItemBtn")?.addEventListener("click", () => {
    alert("Edit Inventory Item coming next");
  });

  document.getElementById("deleteItemBtn")?.addEventListener("click", () => {
    alert("Delete Inventory Item coming next");
  });
}