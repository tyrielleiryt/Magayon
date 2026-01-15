function openCloseDayModal(date, location) {
  document.getElementById("closeDayDate").textContent = date;
  document.getElementById("closeDayLocation").textContent = location;

  const checkbox = document.getElementById("confirmCloseDayCheckbox");
  const confirmBtn = document.getElementById("confirmCloseDayBtn");

  checkbox.checked = false;
  confirmBtn.disabled = true;

  document.getElementById("closeDayModal").classList.remove("hidden");

  loadInventorySummary(date, location);
}

async function loadInventorySummary(date, location) {
  const listEl = document.getElementById("inventorySummaryList");
  const countEl = document.getElementById("inventorySummaryCount");

  listEl.innerHTML = "<div class='muted'>Loading…</div>";
  countEl.textContent = "0";

  try {
    const res = await fetch(
      `${API_URL}?type=dailyInventoryItems&date=${date}&location=${location}`
    );
    const items = await res.json();

    listEl.innerHTML = "";

    if (!items.length) {
      listEl.innerHTML = "<div class='muted'>No inventory items found.</div>";
      return;
    }

    let total = 0;

    items.forEach(it => {
      total++;

      const row = document.createElement("div");
      row.className = "summary-row";

      if (Number(it.remaining) === 0) {
        row.classList.add("zero-stock");
      }

      row.innerHTML = `
        <span>${it.item_name}</span>
        <span>${it.remaining}</span>
      `;

      listEl.appendChild(row);
    });

    countEl.textContent = total;

  } catch (err) {
    listEl.innerHTML =
      "<div class='error'>Failed to load inventory summary.</div>";
    console.error(err);
  }
}