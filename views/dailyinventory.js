import { bindDataBoxScroll } from "../admin.js";

export default function loadDailyInventoryView() {
  const actionBar = document.getElementById("actionBar");
  const contentBox = document.getElementById("contentBox");

  actionBar.innerHTML = `
    <button>+ Add today's Inventory</button>
    <button>+/- Edit Inventory Details</button>
    <button>Inventory Items List</button>
  `;

  contentBox.innerHTML = `
    <div class="data-box">

      <div class="data-scroll">
        <table class="category-table" style="min-width: 1200px">
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
              <td>1</td><td>—</td><td>—</td><td>—</td><td>—</td>
              <td><button>View</button></td>
              <td>—</td><td>—</td><td>—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="data-scroll-controls">
        <button class="scroll-left">◀</button>
        <button class="scroll-right">▶</button>
      </div>

    </div>
  `;

  bindDataBoxScroll(contentBox.querySelector(".data-box"));
}