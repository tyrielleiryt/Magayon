const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

let categories = [];
let selectedIndex = null;

/* ===== ENTRY POINT ===== */
export default function loadCategoriesView() {

  /* ACTION BAR (FIXED) */
  document.getElementById("actionBar").innerHTML = `
    <button onclick="addCategory()">+ Add Category</button>
    <button onclick="editCategory()">Edit</button>
    <button onclick="deleteCategory()">Delete</button>
    <button onclick="moveUp()">⬆ Move Up</button>
    <button onclick="moveDown()">⬇ Move Down</button>
  `;

  /* WHITE CONTENT BOX */
  document.getElementById("contentBox").innerHTML = `
    <div class="view-body">
      <table class="category-table">
        <thead>
          <tr>
            <th style="width:50px">#</th>
            <th>Category Name</th>
            <th>Description</th>
            <th style="width:70px">QTY</th>
          </tr>
        </thead>
        <tbody id="categoryTableBody"></tbody>
      </table>
    </div>
  `;

  loadCategories();
}

/* ===== LOAD ===== */
async function loadCategories() {
  const res = await fetch(API_URL);
  categories = await res.json();
  selectedIndex = null;
  renderTable();
}

/* ===== RENDER TABLE ===== */
function renderTable() {
  const tableBody = document.getElementById("categoryTableBody");
  tableBody.innerHTML = "";

  categories.forEach((cat, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${cat.category_name}</td>
      <td>${cat.description}</td>
      <td>—</td>
    `;

    tr.onclick = () => {
      document
        .querySelectorAll("#categoryTableBody tr")
        .forEach(r => r.classList.remove("selected"));
      tr.classList.add("selected");
      selectedIndex = i;
    };

    tableBody.appendChild(tr);
  });
}

/* ===== MOVE UP ===== */
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

/* ===== MOVE DOWN ===== */
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

/* ===== STUBS (kept for later) ===== */
window.addCategory = () => alert("Add modal coming next");
window.editCategory = () => alert("Edit modal coming next");
window.deleteCategory = () => alert("Delete modal coming next");