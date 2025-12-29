export default function loadInventoryItemsView() {
  console.log("Inventory Items View Loaded");

  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <div class="action-bar">
      <button>+ Add Item</button>
      <button>Edit</button>
      <button>Delete</button>
    </div>
  `;

  contentBox.innerHTML = `
    <div class="view-body">
      <table class="category-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item Name</th>
            <th>Description</th>
            <th>Capital</th>
            <th>Selling Price</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="5" style="text-align:center;">
              Inventory Items UI (Step 1)
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

