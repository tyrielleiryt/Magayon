import { bindDataBoxScroll } from "../admin.js";
import { API_URL } from "../firebase-config.js";

/* Attendance — a cross-location, read-only view of who's clocked in/out
   right now (or on a past day). The POS kiosk (order.js) is where the
   actual biometric clock-in/out happens, scoped to one location's
   tablet; this tab is purely for monitoring across every location at
   once, so it has no editable/actionable controls. */

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function loadAttendanceView() {
  renderActionBar();
  renderLayout();
  loadAttendance();
}

function renderActionBar() {
  document.getElementById("actionBar").innerHTML = `
    <div class="set-action-bar">
      <div class="set-action-field">
        <label for="attDate">Date</label>
        <input type="date" id="attDate" value="${todayStr()}" />
      </div>
      <button class="category-action-btn" id="attLoadBtn">Load</button>
    </div>
  `;
  document.getElementById("attLoadBtn").onclick = loadAttendance;
}

function renderLayout() {
  document.getElementById("contentBox").innerHTML = `
    <div class="tracker-card" style="height:100%">
      <h3>🕐 Attendance</h3>
      <div id="attContent" class="data-scroll" style="padding:12px">
        <div style="text-align:center;color:#888">Loading…</div>
      </div>
    </div>
  `;
}

function loadAttendance() {
  const date = document.getElementById("attDate").value || todayStr();
  const content = document.getElementById("attContent");
  content.innerHTML = `<div style="text-align:center;color:#888;padding:24px">Loading…</div>`;

  const callback = "handleAttendanceOverview";
  delete window[callback];

  window[callback] = data => {
    renderAttendance(data);
  };

  const old = document.getElementById("attJsonpScript");
  if (old) old.remove();

  const script = document.createElement("script");
  script.id = "attJsonpScript";
  script.src = `${API_URL}?type=attendanceOverview&date=${date}&callback=${callback}`;
  script.onerror = () => {
    content.innerHTML = `<div style="text-align:center;color:#888;padding:24px">Failed to load</div>`;
  };
  document.body.appendChild(script);
}

function renderAttendance(data) {
  const content = document.getElementById("attContent");

  if (!data || !data.success) {
    content.innerHTML = `<div style="text-align:center;color:#888;padding:24px">${data?.error || "Failed to load"}</div>`;
    return;
  }

  const staff = data.staff || [];
  const inCount = staff.filter(s => s.status === "IN").length;

  const rowsHtml = staff.length
    ? staff.map(s => `
      <tr>
        <td>${s.location_name}</td>
        <td>${s.name}</td>
        <td>
          ${s.status === "IN"
            ? `<span style="color:#16a34a;font-weight:700">● In since ${s.clock_in_time || "—"}</span>`
            : s.clock_out_time
              ? `<span style="color:#64748b">Out (last: ${s.clock_out_time})</span>`
              : `<span style="color:#94a3b8">Not clocked in</span>`
          }
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" class="set-empty-row">No active staff found</td></tr>`;

  content.innerHTML = `
    <p class="set-month-label">${data.date} — ${inCount} of ${staff.length} currently clocked in</p>
    <table class="set-table">
      <thead><tr><th>Location</th><th>Staff</th><th>Status</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;

  bindDataBoxScroll(document.querySelector(".tracker-card"));
}
