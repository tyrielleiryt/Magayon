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

// Every view's modal HTML calls closeModal()/openModal() via inline
// onclick="..." attributes, which resolve against the global scope, not
// this module's own imports — ES module bindings aren't visible to
// window by default. Previously only views/products.js happened to set
// window.closeModal as a side effect of its own unrelated code, so
// Cancel/close buttons silently threw "closeModal is not defined" in
// every other view unless Products had already been loaded this session.
window.openModal = openModal;
window.closeModal = closeModal;

/* ================= HARD RESET (ON PAGE LOAD) ================= */
overlay.classList.add("hidden");
box.innerHTML = "";
box.classList.remove("large");