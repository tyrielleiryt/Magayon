const API_URL = "https://script.google.com/macros/s/AKfycbyk6FRUvT3tALi0LSvDtH8dRxX9mdv1MRJDKZo3e-iqxJdMiQRK5-lkjTk1v2u5xdHz/exec";


/* ELEMENTS */
const tableBody = document.getElementById("categoryTableBody");
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const addBtn = document.getElementById("addCategoryBtn");
const editBtn = document.getElementById("editCategoryBtn");

/* STATE */
let categories = [];
let pendingCategory = null;

/* LOAD DATA */
async function loadCategories() {
  try {
    const res = await fetch(API_URL);
    categories = await res.json();
    renderTable();
  } catch {
    alert("Failed to load categories");
  }
}
loadCategories();

/* DATE TIME */
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

/* RENDER TABLE */
function renderTable() {
  tableBody.innerHTML = "";
  categories.forEach((c, i) => {
    tableBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${c.category_name}</td>
        <td>${c.description}</td>
        <td>—</td>
      </tr>`;
  });
}

/* ADD CATEGORY */
addBtn.onclick = () => {
  modalOverlay.classList.remove("hidden");
  modalBox.innerHTML = `
    <div class="modal-header"><h3>➕ Add Category</h3></div>
    <div class="modal-body">
      <label>Category Name</label>
      <input id="catName">
      <label>Description</label>
      <textarea id="catDesc"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-confirm" id="confirmAdd">Confirm</button>
      <button class="btn-back" id="closeModal">Back</button>
    </div>
  `;

  document.getElementById("closeModal").onclick = closeModal;
  document.getElementById("confirmAdd").onclick = async () => {
    const name = catName.value.trim();
    const desc = catDesc.value.trim();
    if (!name) return alert("Name required");

    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ category_name: name, description: desc })
    });

    closeModal();
    loadCategories();
  };
};

/* EDIT CATEGORY */
editBtn.onclick = () => {
  modalOverlay.classList.remove("hidden");
  modalBox.innerHTML = `
    <div class="modal-header"><h3>✏ Edit Category</h3></div>
    <div class="modal-body">
      <label>Select Category</label>
      <select id="catSelect">
        ${categories.map((c,i)=>`<option value="${i}">${c.category_name}</option>`).join("")}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn-confirm" id="editNext">Edit</button>
      <button class="btn-back" id="closeModal">Back</button>
    </div>
  `;

  closeModalBtn();
  document.getElementById("editNext").onclick = () => {
    const i = catSelect.value;
    openEditForm(i);
  };
};

function openEditForm(i) {
  const c = categories[i];
  modalBox.innerHTML = `
    <div class="modal-header"><h3>✏ Edit Category</h3></div>
    <div class="modal-body">
      <label>Category Name</label>
      <input id="editName" value="${c.category_name}">
      <label>Description</label>
      <textarea id="editDesc">${c.description}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-confirm" id="saveEdit">Confirm</button>
      <button class="btn-back" id="closeModal">Back</button>
    </div>
  `;

  closeModalBtn();
  document.getElementById("saveEdit").onclick = async () => {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "edit",
        index: i,
        category_name: editName.value,
        description: editDesc.value
      })
    });

    closeModal();
    loadCategories();
  };
}

/* CLOSE MODAL */
function closeModalBtn() {
  document.getElementById("closeModal").onclick = closeModal;
}
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.innerHTML = "";
}