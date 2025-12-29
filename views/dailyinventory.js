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

  const params = new URLSearchParams({
    action: "addDailyInventory",
    date: new Date().toISOString().slice(0, 10),
    created_by: "ADMIN",
    items: JSON.stringify(items)
  });

  // ✅ CORS-SAFE REQUEST (DO NOT USE FETCH)
  const img = new Image();
  img.src = API_URL + "?" + params.toString();

  closeModal();
  alert("Daily inventory saved");
}