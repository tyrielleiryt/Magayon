/* ================= ICON SET =================
   Minimal line-icon set (24x24 viewBox, stroke-based) matching the
   monochrome, thin-stroke look of SF Symbols. Apple's actual icon font
   isn't licensed for use outside Apple platforms, so this is a
   same-style substitute rather than the real thing. */

const ICONS = {
  "layout-dashboard": `<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>`,
  "calculator": `<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><circle cx="8" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="19" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>`,
  "tag": `<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83Z"/><circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" stroke="none"/>`,
  "package": `<path d="M12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>`,
  "store": `<path d="M4 10V21h16V10"/><path d="M2 10l2-6h16l2 6"/><path d="M9 21v-6h6v6"/>`,
  "users": `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17" cy="9" r="2.8"/><path d="M15.5 14.2c2.7.4 4.9 2.6 4.9 5.8"/>`,
  "user": `<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>`,
  "clock": `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>`,
  "archive": `<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><line x1="10" y1="13" x2="14" y2="13"/>`,
  "clipboard-list": `<rect x="6" y="3" width="12" height="18" rx="2"/><rect x="9" y="1.5" width="6" height="3" rx="1"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>`,
  "list-checks": `<polyline points="3,6 4.5,7.5 7.5,4.5"/><line x1="10" y1="6" x2="21" y2="6"/><polyline points="3,13 4.5,14.5 7.5,11.5"/><line x1="10" y1="13" x2="21" y2="13"/><line x1="3" y1="20" x2="21" y2="20"/>`,
  "receipt": `<path d="M6 2h12v19l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>`,
  "banknote": `<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="6" y1="10" x2="6" y2="10.01"/><line x1="18" y1="14" x2="18" y2="14.01"/>`,
  "trending-up": `<polyline points="3,17 9,11 13,15 21,6"/><polyline points="14,6 21,6 21,13"/>`,
  "trending-down": `<polyline points="3,7 9,13 13,9 21,18"/><polyline points="14,18 21,18 21,11"/>`,
  "shield": `<path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5z"/>`,
  "map-pin": `<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>`,
  "trophy": `<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H4v2a4 4 0 0 0 4 4"/><path d="M16 5h4v2a4 4 0 0 1-4 4"/><line x1="12" y1="13" x2="12" y2="17"/><path d="M8 21h8"/><path d="M10 17h4v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2z"/>`,
  "alert-triangle": `<path d="M12 3 2 20h20z"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17.3" r="1" fill="currentColor" stroke="none"/>`,
  "save": `<path d="M5 3h11l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v6h8V3"/><rect x="7" y="13" width="10" height="8"/>`,
  "settings": `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/>`,
  "utensils": `<path d="M4 2v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"/><path d="M6 11v11"/><path d="M18 2c-1.5 3-1.5 7 0 9v11"/>`,
  "message-circle": `<path d="M12 21a9 9 0 1 0-7.5-4L3 21l4-1a9 9 0 0 0 5 1z"/>`,
  "log-out": `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
  "log-in": `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10,17 15,12 10,7"/><line x1="15" y1="12" x2="3" y2="12"/>`,
  "lock": `<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
  "sunrise": `<line x1="12" y1="3" x2="12" y2="7"/><path d="M5.5 12.5a6.5 6.5 0 0 1 13 0"/><line x1="2" y1="18" x2="22" y2="18"/><polyline points="8,15 12,11 16,15"/>`,
  "plus": `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
  "pencil": `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>`,
  "trash-2": `<polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`,
  "x": `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  "check": `<polyline points="20,6 9,17 4,12"/>`,
  "check-circle": `<circle cx="12" cy="12" r="9"/><polyline points="8,12 11,15 16,9"/>`,
  "minus": `<line x1="5" y1="12" x2="19" y2="12"/>`,
  "refresh-cw": `<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21,3 21,9 15,9"/>`,
  "bar-chart-3": `<line x1="4" y1="20" x2="4" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="20" y1="20" x2="20" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>`,
  "fingerprint": `<path d="M12 4a8 8 0 0 0-8 8c0 2.5.7 4 1.5 5.5"/><path d="M12 4a8 8 0 0 1 8 8c0 2-.3 3.6-1 5"/><path d="M12 8a4 4 0 0 0-4 4c0 3 1 5 2 7"/><path d="M12 8a4 4 0 0 1 4 4c0 1.7-.3 3-1 4.5"/><line x1="12" y1="11" x2="12" y2="15"/>`,
  "flask-conical": `<path d="M9 2h6"/><path d="M10 2v6l-6 10a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-6-10V2"/><line x1="7" y1="15" x2="17" y2="15"/>`,
  "smartphone": `<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>`,
  "dollar-sign": `<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 6.5c0-2-2-3-5-3s-5 1.3-5 3.2c0 4 10 2 10 6.2 0 2-2 3.1-5 3.1s-5-1.3-5-3.3"/>`,
  "calendar": `<rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="8" y1="2.5" x2="8" y2="6.5"/><line x1="16" y1="2.5" x2="16" y2="6.5"/>`,
  "more-horizontal": `<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>`
};

export function icon(name, opts = {}) {
  const body = ICONS[name];
  if (!body) return "";
  const size = opts.size ?? 16;
  const stroke = opts.stroke ?? 2;
  const cls = opts.class ? ` class="${opts.class}"` : "";
  const style = `vertical-align:-3px;flex-shrink:0${opts.style ? ";" + opts.style : ""}`;
  return `<svg${cls} style="${style}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/* For static HTML markup (main.html / order.html) that isn't built via JS
   template strings — sweeps every <i data-icon="name"> placeholder and
   fills it in. Call once after the page's DOM is parsed. */
export function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach(el => {
    const name = el.getAttribute("data-icon");
    const size = el.getAttribute("data-icon-size");
    el.innerHTML = icon(name, size ? { size: Number(size) } : {});
  });
}
