const overlay = document.getElementById("modalOverlay");
const box = document.getElementById("modalBox");

/* ================= OPEN MODAL ================= */
export function openModal(html, large = false) {
  box.innerHTML = html;

  box.classList.toggle("large", large);

  overlay.classList.remove("hidden");
}

/* ================= CLOSE MODAL ================= */
export function closeModal() {
  box.innerHTML = "";
  box.classList.remove("large");

  overlay.classList.add("hidden");
}

/* ================= HARD RESET (ON PAGE LOAD) ================= */
overlay.classList.add("hidden");
box.innerHTML = "";
box.classList.remove("large");