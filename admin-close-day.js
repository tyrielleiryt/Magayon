function openCloseDayModal(date, location) {
  document.getElementById("closeDate").textContent = date;
  document.getElementById("closeLocation").textContent = location;
  document.getElementById("closeDayModal").classList.remove("hidden");
}

async function confirmCloseDay() {
  if (
    !document.getElementById("confirmSales").checked ||
    !document.getElementById("confirmIrreversible").checked
  ) {
    alert("Please confirm all warnings.");
    return;
  }

  const adminUser = document.getElementById("adminUser").value.trim();
  const adminPin  = document.getElementById("adminPin").value.trim();
  if (!adminUser || !adminPin) {
    alert("Admin credentials required.");
    return;
  }

  const modeEl = document.querySelector('input[name="nextMode"]:checked');
  if (!modeEl) {
    alert("Please select how to start the next day.");
    return;
  }
  const mode = modeEl.value;

  const date = document.getElementById("closeDate").textContent;
  const loc  = document.getElementById("closeLocation").textContent;

  try {
    await apiCall("closeInventoryDay", {
      date,
      location: loc,
      adminUser
    });

    await apiCall("startNewInventoryDay", {
      date: getNextDate(date),
      location: loc,
      adminUser,
      mode
    });

    alert("Inventory closed successfully.");
    window.location.reload();

  } catch (err) {
    alert(err.message || "Close day failed.");
  }
}

function getNextDate(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}