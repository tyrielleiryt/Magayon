const API_URL =
  "https://script.google.com/macros/s/AKfycbzoh8yabZEaJBbqEbMtPOncsOSR6FClSUQzNEs0LRBNNhoyFih2L42s1d7ZW5Z2Ry7q/exec";

/* ===== DATE & TIME ===== */
function updateDateTime() {
  document.getElementById("datetime").textContent =
    new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
}
updateDateTime();
setInterval(updateDateTime, 60000);

/* ===== STATE ===== */
let categories = [];
let selectedIndex = null;

/* ===== LOAD ===== */
async function loadCategories() {
  const res = await fetch(API_URL);
  categories = await res.json();
  selectedIndex = null;
  renderTable();
}
loadCategories();

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

/* ===== MODAL HELPERS ===== */
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");

function openModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.classList.remove("hidden");
}
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.innerHTML = "";
}

/* ===== MOVE UP ===== */
async function moveUp() {
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
}

/* ===== MOVE DOWN ===== */
async function moveDown() {
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
}

/* ===== DELETE ===== */
async function deleteCategory() {
  if (selectedIndex === null) {
    alert("Select a category first");
    return;
  }

  const cat = categories[selectedIndex];

  openModal(`
    <div class="modal-header danger">⚠ Delete Category</div>
    <p>Are you sure you want to delete:</p>
    <input value="${cat.category_name}" disabled>
    <div class="modal-actions">
      <button class="btn-danger" id="confirmDel">Delete</button>
      <button class="btn-back" id="cancelDel">Back</button>
    </div>
  `);

  document.getElementById("cancelDel").onclick = closeModal;

  document.getElementById("confirmDel").onclick = async () => {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "delete",
        rowIndex: selectedIndex
      })
    });

    closeModal();
    loadCategories();
  };
}