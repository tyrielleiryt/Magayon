export function ensureModal() {
  if (document.getElementById("modalOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "modalOverlay";
  overlay.className = "hidden";
  overlay.innerHTML = `<div id="modalBox"></div>`;
  document.body.appendChild(overlay);
}

export function openModal(html) {
  ensureModal();
  document.getElementById("modalBox").innerHTML = html;
  document.getElementById("modalOverlay").classList.remove("hidden");
}

export function closeModal() {
  document.getElementById("modalOverlay")?.classList.add("hidden");
  document.getElementById("modalBox").innerHTML = "";
}