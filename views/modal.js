const overlay = document.getElementById("modalOverlay");
const box = document.getElementById("modalBox");
 
/* =========================================================
   LOADER HELPERS (SAFE IMPORT-LESS VERSION)
   - modal.js should NOT depend on admin.js imports
========================================================= */
function hideLoaderIfVisible() {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  // Prevent loader + modal overlap
  loader.classList.add("hidden");
}

/* ================= OPEN MODAL ================= */
export function openModal(html, large = false) {
  // 🔒 Safety: never show loader over modal
  hideLoaderIfVisible();

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