const overlay = document.getElementById("modalOverlay");
const box = document.getElementById("modalBox");

/* ================= OPEN MODAL ================= */
export function openModal(html, large = false) {
  if (!overlay || !box) {
    console.error("Modal elements not found in DOM");
    return;
  }

  box.innerHTML = html;

  // size control
  if (large) {
    box.classList.add("large");
  } else {
    box.classList.remove("large");
  }

  overlay.classList.remove("hidden");

  // prevent background scroll
  document.body.style.overflow = "hidden";
}

/* ================= CLOSE MODAL ================= */
export function closeModal() {
  if (!overlay || !box) return;

  box.innerHTML = "";
  box.classList.remove("large");

  overlay.classList.add("hidden");

  // restore background scroll
  document.body.style.overflow = "";
}

/* ================= CLICK OUTSIDE TO CLOSE ================= */
overlay.addEventListener("click", e => {
  if (e.target === overlay) {
    closeModal();
  }
});

/* ================= ESC KEY TO CLOSE ================= */
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
    closeModal();
  }
});