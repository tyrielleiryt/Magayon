// views/inventoryItems.js
// UI ONLY – no database yet

let inventoryItems = [
  { name: "Sugar", unit: "grams", notes: "White sugar" },
  { name: "Milk", unit: "ml", notes: "Full cream" },
  { name: "Coffee Beans", unit: "grams", notes: "Arabica" }
];

let selectedIndex = null;

/* ===== ENTRY POINT ===== */
export default function loadInventoryItemsView() {
  const contentBox = document.getElementById("contentBox");

  contentBox.innerHTML = `
    <div class="action-bar">
      <button id="addItemBtn">+ Add Inventory Item</button>
      <button id="editItemBtn">Edit</button>
      <button id="deleteItemBtn">Delete</button>
    </div>

    <div class="view-body">
      <table class="category-table">
        <thead>
          <tr>
            <th style="width:50px">#</th>
            <th>Item Name</th>
            <th style="width:120px">Unit</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody id="inventoryTableBody"></tbody>
      </table>
    </div>
  `;

  bindButtons();
  renderTable();
}

/* ===== BUTTONS ===== */
function bindButtons() {
  document.getElementById("addItemBtn").onclick = () =>
    alert("Add Inventory Item modal — NEXT STEP");

  document.getElementById("editItemBtn").onclick = () => {
    if (selectedIndex === null) {
      alert("Select an item first");
      return;
    }
    alert("Edit Inventory Item modal — NEXT STEP");
  };

  document.getElementById("deleteItemBtn").onclick = () => {
    if (selectedIndex === null) {
      alert("Select an item first");
      return;
    }
    alert("Delete confirmation modal — NEXT STEP");
  };
}

/* ===== TABLE RENDER ===== */
function renderTable() {
  const tbody = document.getElementById("inventoryTableBody");
  tbody.innerHTML = "";

  inventoryItems.forEach((item, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${item.name}</td>
      <td>${item.unit}</td>
      <td>${item.notes}</td>
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