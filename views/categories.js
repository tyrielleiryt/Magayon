const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let categories = [];
let selectedIndex = null;

export default function loadCategoriesView() {
  document.getElementById("actionBar").innerHTML = `
    <div class="action-bar">
      <button onclick="addCategory()">+ Add Category</button>
      <button onclick="editCategory()">Edit</button>
      <button onclick="deleteCategory()">Delete</button>
      <button onclick="moveUp()">⬆ Move Up</button>
      <button onclick="moveDown()">⬇ Move Down</button>
    </div>
  `;

  document.getElementById("contentBox").innerHTML = `
    <div class="table-wrapper">
      <table class="category-table">
        <thead>
          <tr>
            <th style="width:50px">#</th>
            <th>Category Name</th>
            <th>Description</th>
            <th style="width:60px">QTY</th>
          </tr>
        </thead>
        <tbody id="categoryTableBody"></tbody>
      </table>
    </div>
  `;

  loadCategories();
}

async function loadCategories() {
  const res = await fetch(API_URL);
  categories = await res.json();
  selectedIndex = null;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("categoryTableBody");
  tbody.innerHTML = "";

  categories.forEach((cat, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${cat.category_name}</td>
      <td>${cat.description}</td>
      <td>—</td>
    `;

    tr.addEventListener("click", () => {
      document.querySelectorAll("#categoryTableBody tr")
        .forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selectedIndex = i;
    });

    tbody.appendChild(tr);
  });
}

/* TEMP STUBS — MODALS NEXT */
window.addCategory = () => alert("Add modal coming next");
window.editCategory = () => alert("Edit modal coming next");
window.deleteCategory = () => alert("Delete modal coming next");

/* MOVE */
window.moveUp = async () => {
  if (selectedIndex === null || selectedIndex === 0) return;

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "move",
      rowIndex: selectedIndex,
      direction: "up"
    })
  });

  loadCategories();
};

window.moveDown = async () => {
  if (selectedIndex === null || selectedIndex === categories.length - 1) return;

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "move",
      rowIndex: selectedIndex,
      direction: "down"
    })
  });

  loadCategories();
};