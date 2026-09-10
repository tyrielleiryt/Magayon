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

  // Appended alongside every view's own modal markup (not replaced by it)
  // so showModalLoader()/hideModalLoader() always find it, regardless of
  // what each view puts in the modal body.
  box.innerHTML = html + `
    <div id="modalLoadingOverlay" class="modal-loading-overlay hidden">
      <div class="spinner"></div>
      <div class="modal-loading-text">Loading…</div>
    </div>
  `;
  box.classList.toggle("large", large);

  overlay.classList.remove("hidden");
}

/* ================= MODAL-SCOPED LOADER =================
   The page-level #globalLoader sits behind the modal overlay (lower
   z-index, on purpose — it's meant to block the page, not a modal on
   top of it), so showing it while a modal is open renders invisible
   behind that modal. Use these instead for anything happening while a
   modal is open (loading its data, saving its form) — the indicator
   stays contained to the modal window itself, not the whole screen. */
export function showModalLoader(text = "Loading…") {
  const el = document.getElementById("modalLoadingOverlay");
  if (!el) return;
  el.querySelector(".modal-loading-text").textContent = text;
  el.classList.remove("hidden");
}

export function hideModalLoader() {
  const el = document.getElementById("modalLoadingOverlay");
  if (!el) return;
  el.classList.add("hidden");
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