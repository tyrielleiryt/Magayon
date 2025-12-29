export default function loadDailyInventoryView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  /* ================= ACTION BAR ================= */
  actionBar.innerHTML = `
    <button id="addTodayBtn">+ Add Today's Inventory</button>
    <button id="editTodayBtn">+/- Edit Inventory Details</button>
    <button id="itemsListBtn">Inventory Items List</button>
  `;

  /* ================= MAIN CONTENT ================= */
  contentBox.innerHTML = `
    <div class="view-body">

      <!-- SCROLLABLE TABLE -->
      <div class="table-scroll" id="dailyInventoryScroll">
        <table class="category-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>DN</th>
              <th>Receiver</th>
              <th>Position</th>
              <th>Inventory</th>
              <th>Location</th>
              <th>Created By</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td><button>View</button></td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- SCROLL CONTROLS (BOTTOM) -->
      <div class="scroll-controls">
        <button class="scroll-btn" id="scrollLeft">◀</button>
        <button class="scroll-btn" id="scrollRight">▶</button>
      </div>

    </div>
  `;

  bindScrollButtons();
}

/* ================= SCROLL LOGIC ================= */
function bindScrollButtons() {
  const scrollArea = document.getElementById("dailyInventoryScroll");

  document.getElementById("scrollLeft").onclick = () => {
    scrollArea.scrollBy({ left: -300, behavior: "smooth" });
  };

  document.getElementById("scrollRight").onclick = () => {
    scrollArea.scrollBy({ left: 300, behavior: "smooth" });
  };
}