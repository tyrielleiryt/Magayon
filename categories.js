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

/* ===== ELEMENTS ===== */
const addBtn = document.getElementById("addCategoryBtn");
const modal = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const tableBody = document.getElementById("categoryTableBody");

/* ===== STATE ===== */
let categories = [];
let pending = null;

/* ===== OPEN MODAL ===== */
addBtn.addEventListener("click", () => {
  modal.style.display = "flex";
  modal.style.pointerEvents = "auto";

  modalBox.innerHTML = `
    <h3>Add Category</h3>

    <label>Category Name</label>
    <input id="catName">

    <label>Description</label>
    <textarea id="catDesc"></textarea>

    <div class="modal-actions">
      <button id="confirm">Confirm</button>
      <button id="cancel">Back</button>
    </div>
  `;

  document.getElementById("cancel").onclick = closeModal;

  document.getElementById("confirm").onclick = () => {
    const name = document.getElementById("catName").value.trim();
    const desc = document.getElementById("catDesc").value.trim();
    if (!name) return alert("Category name required");

    pending = { name, desc };
    confirmModal();
  };
});

/* ===== CONFIRM ===== */
function confirmModal() {
  modalBox.innerHTML = `
    <h3>Confirm Add</h3>

    <p>Are you sure you want to add:</p>

    <input value="${pending.name}" disabled>

    <div class="modal-actions">
      <button id="final">Confirm</button>
      <button id="back">Back</button>
    </div>
  `;

  document.getElementById("back").onclick = () => addBtn.click();

  document.getElementById("final").onclick = () => {
    categories.push(pending);
    pending = null;
    closeModal();
    render();
  };
}

/* ===== TABLE ===== */
function render() {
  tableBody.innerHTML = "";
  categories.forEach((c, i) => {
    tableBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${c.name}</td>
        <td>${c.desc}</td>
        <td>—</td>
      </tr>
    `;
  });
}

/* ===== CLOSE ===== */
function closeModal() {
  modal.style.display = "none";
  modal.style.pointerEvents = "none";
  modalBox.innerHTML = "";
}