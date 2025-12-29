export default function loadDailyInventoryView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <button id="addTodayBtn">+ Add today's Inventory</button>
    <button id="editTodayBtn">+/- Edit Inventory Details</button>
    <button id="itemsListBtn">Inventory Items List</button>
  `;

  contentBox.innerHTML = `
    <div class="scroll-wrapper">
      <button class="scroll-btn left" id="scrollLeft">◀</button>

      <div class="view-body scrollable" id="dailyInventoryTableWrapper">
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

      <button class="scroll-btn right" id="scrollRight">▶</button>
    </div>
  `;

  bindScrollButtons();
}

function bindScrollButtons() {
  const wrapper = document.getElementById("dailyInventoryTableWrapper");

  document.getElementById("scrollLeft").onclick = () => {
    wrapper.scrollLeft -= 200;
  };

  document.getElementById("scrollRight").onclick = () => {
    wrapper.scrollLeft += 200;
  };
}