function saveTodayInventory() {
  const inputs = document.querySelectorAll("#dailyItemsBody input");
  const items = [];

  inputs.forEach(input => {
    const qty = Number(input.value);
    if (qty > 0) {
      const capital = qty * Number(input.dataset.cap);
      const total = qty * Number(input.dataset.price);

      items.push({
        item_id: input.dataset.id,
        qty,
        capital,
        total,
        earnings: total - capital
      });
    }
  });

  if (!items.length) {
    alert("Please enter at least one item");
    return;
  }

  // 🔒 Disable save button to prevent double submit
  const saveBtn = document.getElementById("saveTodayInv");
  if (saveBtn) saveBtn.disabled = true;

  const params = new URLSearchParams({
    action: "addDailyInventory",
    date: new Date().toISOString().slice(0, 10),
    created_by: "ADMIN",
    // ✅ MUST stringify + encode JSON
    items: JSON.stringify(items)
  });

  // ✅ CORS-SAFE REQUEST (IMAGE BEACON)
  const img = new Image();

  img.onload = () => {
    closeModal();
    alert("Daily inventory saved successfully ✅");
    if (saveBtn) saveBtn.disabled = false;
  };

  img.onerror = () => {
    alert("Failed to save daily inventory ❌");
    if (saveBtn) saveBtn.disabled = false;
  };

  img.src = API_URL + "?" + params.toString();
}