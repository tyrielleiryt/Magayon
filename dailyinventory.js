export default function loadDailyInventoryView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <button id="addTodayBtn">+ Add today's Inventory</button>
    <button id="editTodayBtn">+/- Edit Inventory Details</button>
    <button id="itemsListBtn">Inventory Items List</button>
  `;

  contentBox.innerHTML = `
    <div class="daily-scroll-wrapper">

      <button class="daily-scroll-btn" id="scrollLeft">◀</button>

      <div class="daily-scrollable" id="dailyInventoryScroller">
        <table class="category-table" style="min-width: 1200px;">
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

      <button class="daily-scroll-btn" id="scrollRight">▶</button>

    </div>
  `;

  bindDailyScroll();
}

function bindDailyScroll() {
  const scroller = document.getElementById("dailyInventoryScroller");

  document.getElementById("scrollLeft").onclick = () => {
    scroller.scrollLeft -= 300;
  };

  document.getElementById("scrollRight").onclick = () => {
    scroller.scrollLeft += 300;
  };
}