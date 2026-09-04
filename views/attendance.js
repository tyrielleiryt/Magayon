import { bindDataBoxScroll, getCached } from "../admin.js";
import { API_URL } from "../firebase-config.js";

/* Attendance — a cross-location, read-only view of who's clocked in/out
   right now (or on a past day), plus a per-employee DTR (Daily Time
   Record) lookup for any date range. The POS kiosk (order.js) is where
   the actual biometric clock-in/out happens, scoped to one location's
   tablet; this tab is purely for monitoring/reporting, so it has no
   editable/actionable controls. */

let staffList = [];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function staffLabel(s) {
  return `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.staff_id;
}

export default async function loadAttendanceView() {
  try {
    staffList = (await getCached("staff")).filter(s => s.active !== false);
  } catch (err) {
    console.warn("Failed to load staff", err);
  }

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
  const staffOptions = staffList
    .map(s => `<option value="${s.staff_id}">${staffLabel(s)}</option>`)
    .join("");

  document.getElementById("contentBox").innerHTML = `
    <div class="tracker-card" style="height:100%">
      <h3>🕐 Attendance</h3>
      <div class="data-scroll" style="padding:12px">

        <div class="set-section">
          <h4 class="set-section-title">📍 Live Status</h4>
          <p class="set-section-hint">Who's clocked in/out, across every location, for the date picked above.</p>
          <div id="attContent">
            <div style="text-align:center;color:#888;padding:24px">Loading…</div>
          </div>
        </div>

        <div class="set-section">
          <h4 class="set-section-title">📋 Daily Time Record (DTR)</h4>
          <p class="set-section-hint">Pull one employee's clock in/out history for any date range.</p>
          <div class="set-form-row">
            <div>
              <label>Employee</label><br>
              <select id="dtrStaff" style="min-width:200px">
                <option value="">Select an employee…</option>
                ${staffOptions}
              </select>
            </div>
            <div>
              <label>From</label><br>
              <input type="date" id="dtrStart" value="${firstOfMonthStr()}">
            </div>
            <div>
              <label>To</label><br>
              <input type="date" id="dtrEnd" value="${todayStr()}">
            </div>
            <button class="category-action-btn" id="dtrLoadBtn" style="align-self:flex-end">Load DTR</button>
          </div>
          <div id="dtrContent" style="margin-top:12px"></div>
        </div>

      </div>
    </div>
  `;

  document.getElementById("dtrLoadBtn").onclick = loadDTR;
  bindDataBoxScroll(document.querySelector(".tracker-card"));
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
    <p class="set-month-label" style="margin-bottom:8px">${data.date} — ${inCount} of ${staff.length} currently clocked in</p>
    <table class="set-table">
      <thead><tr><th>Location</th><th>Staff</th><th>Status</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function loadDTR() {
  const staffId = document.getElementById("dtrStaff").value;
  const startDate = document.getElementById("dtrStart").value;
  const endDate = document.getElementById("dtrEnd").value;
  const content = document.getElementById("dtrContent");

  if (!staffId) {
    alert("Please select an employee");
    return;
  }

  content.innerHTML = `<div style="text-align:center;color:#888;padding:24px">Loading…</div>`;

  const callback = "handleEmployeeDTR";
  delete window[callback];

  window[callback] = data => {
    renderDTR(data, staffId);
  };

  const old = document.getElementById("dtrJsonpScript");
  if (old) old.remove();

  const script = document.createElement("script");
  script.id = "dtrJsonpScript";
  script.src =
    `${API_URL}?type=employeeDTR&staff_id=${encodeURIComponent(staffId)}` +
    `&start_date=${startDate}&end_date=${endDate}&callback=${callback}`;
  script.onerror = () => {
    content.innerHTML = `<div style="text-align:center;color:#888;padding:24px">Failed to load</div>`;
  };
  document.body.appendChild(script);
}

function renderDTR(data, staffId) {
  const content = document.getElementById("dtrContent");

  if (!data || !data.success) {
    content.innerHTML = `<div style="text-align:center;color:#888;padding:16px">${data?.error || "Failed to load"}</div>`;
    return;
  }

  const staff = staffList.find(s => s.staff_id === staffId);
  const records = data.records || [];

  const rowsHtml = records.length
    ? records.map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.clock_in_time || "—"}</td>
        <td>${r.clock_out_time || "—"}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" class="set-empty-row">No attendance records in this range</td></tr>`;

  content.innerHTML = `
    <p style="font-weight:600;margin-bottom:8px">${staff ? staffLabel(staff) : staffId} — ${records.length} day(s) recorded</p>
    <table class="set-table">
      <thead><tr><th>Date</th><th>Time In</th><th>Time Out</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}
