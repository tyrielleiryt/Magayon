const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let items = [];
let selectedIndex = null;

/* ===== ENTRY POINT ===== */
export default function loadInventoryItemsView() {
  document.getElementById("actionBar").innerHTML = `
    <div class="action-bar">
      <button onclick="addInventoryItem()">+ Add Item</button>
      <button onclick="editInventoryItem()">Edit</button>
      <button onclick="deleteInventoryItem()">Delete</button>
    </div>
  `;

  document.getElementById("contentBox").innerHTML = `
    <div class="table-wrapper">
      <table class="category-table">
        <thead>
          <tr>
            <th style="width:50px">#</th>
            <th>Item Name</th>
            <th>Unit</th>
            <th>Description</th>
            <th style="width:80px">Capital</th>
          </tr>
        </thead>
        <tbody id="inventoryTableBody"></tbody>
      </table>
    </div>
  `;

  loadInventoryItems();
}

/* ===== LOAD DATA ===== */
async function loadInventoryItems() {
  const res = await fetch(API_URL + "?view=inventory_items");
  items = await res.json();
  selectedIndex = null;
  renderInventoryTable();
}

/* ===== TABLE ===== */
function renderInventoryTable() {
  const tbody = document.getElementById("inventoryTableBody");
  tbody.innerHTML = "";

  items.forEach((item, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${item.item_name}</td>
      <td>${item.unit}</td>
      <td>${item.description}</td>
      <td>${item.capital}</td>
    `;

    tr.onclick = () => {
      document
        .querySelectorAll("#inventoryTableBody tr")
        .forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selectedIndex = i;
    };

    tbody.appendChild(tr);
  });
}

/* ===== PLACEHOLDERS (NEXT STEP) ===== */
window.addInventoryItem = () => alert("Add Inventory Item – next step");
window.editInventoryItem = () => alert("Edit Inventory Item – next step");
window.deleteInventoryItem = () => alert("Delete Inventory Item – next step");