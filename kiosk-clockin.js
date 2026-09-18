/* ================= LOGIN-SCREEN CLOCK IN/OUT =================
   Lets any staff member (including server/cook, who have no login at
   all) clock in/out from the login screen, without needing a cashier
   to sign into the POS first. Fingerprint/Face ID is the only real
   identity check — there's no staff login involved, so this signs in
   silently and anonymously to Firebase just to get a token Supabase's
   RPCs will accept (they only require `auth.role() = 'authenticated'`,
   true for an anonymous session too — never `app_role`, which an
   anonymous session has no way to carry). Location isn't picked here
   either: the RPCs attribute the clock event to whatever location that
   staff member is already assigned to in the Staff Tab.

   Requires Firebase Anonymous Auth enabled in the Firebase Console
   (Authentication → Sign-in method → Anonymous) — until then,
   ensureAnonymousAuth() below will throw. */

import { auth } from "./firebase-config.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { icon } from "./icons.js";
import { getStaffStatus, enrollBiometric, clockInOut } from "./data/attendance.js";

async function ensureAnonymousAuth() {
  if (auth.currentUser) return;
  await signInAnonymously(auth);
}

function base64urlToBuffer(base64url) {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(base64url.length + (4 - base64url.length % 4) % 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function el(id) {
  return document.getElementById(id);
}

export function openKioskClockIn() {
  el("kioskClockInModal").classList.remove("hidden");
  loadKioskClockInData();
}

export function closeKioskClockIn() {
  el("kioskClockInModal").classList.add("hidden");
}

async function loadKioskClockInData() {
  const tbody = el("kioskClockInTable");
  tbody.innerHTML = "<tr><td colspan='3'>Loading…</td></tr>";

  try {
    await ensureAnonymousAuth();
    const data = await getStaffStatus();
    renderKioskClockInTable(data);
  } catch (err) {
    console.error(err);
    tbody.innerHTML = "<tr><td colspan='3'>Failed to load staff.</td></tr>";
  }
}

function renderKioskClockInTable(data) {
  const tbody = el("kioskClockInTable");

  if (!data || !data.success) {
    tbody.innerHTML = `<tr><td colspan='3'>${data?.error || "Failed to load staff."}</td></tr>`;
    return;
  }

  const staff = data.staff || [];
  if (!staff.length) {
    tbody.innerHTML = "<tr><td colspan='3'>No active staff found.</td></tr>";
    return;
  }

  tbody.innerHTML = "";
  staff.forEach(s => {
    const statusCell = !s.enrolled
      ? "Not enrolled"
      : s.status === "IN"
        ? `In since ${s.clock_in_time || "—"}`
        : (s.clock_out_time ? `Out (last: ${s.clock_out_time})` : "Not clocked in today");

    // Enrolled staff always get BOTH a clock in/out action and an
    // "Enroll this device" fallback — WebAuthn credentials are bound to
    // one specific device each, so being enrolled somewhere else
    // doesn't mean this particular tablet will recognize them yet.
    const clockAction = s.status === "IN" ? "clockOut" : "clockIn";
    const clockLabel = s.status === "IN" ? "Clock Out" : "Clock In";
    const clockIcon = s.status === "IN" ? "log-out" : "log-in";

    const actionCell = `
      ${s.enrolled ? `<button class="kiosk-clockinout-btn" data-staff-id="${s.staff_id}" data-creds='${JSON.stringify(s.credential_ids || [])}' data-action="${clockAction}">${icon(clockIcon, { size: 14 })} ${clockLabel}</button>` : ""}
      <button class="kiosk-enroll-btn" data-staff-id="${s.staff_id}" data-name="${(s.name || "").replace(/"/g, "&quot;")}">${icon("fingerprint", { size: 14 })} ${s.enrolled ? "Enroll this device" : "Enroll"}</button>
    `;

    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${s.name}${s.location_name ? `<br><small class="muted">${s.location_name}</small>` : ""}</td>
        <td>${statusCell}</td>
        <td>${actionCell}</td>
      </tr>
    `);
  });

  tbody.querySelectorAll(".kiosk-clockinout-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const credentialIds = JSON.parse(btn.dataset.creds || "[]");
      kioskClockInOut(btn.dataset.staffId, credentialIds, btn.dataset.action);
    });
  });
  tbody.querySelectorAll(".kiosk-enroll-btn").forEach(btn => {
    btn.addEventListener("click", () => kioskEnrollStaff(btn.dataset.staffId, btn.dataset.name));
  });
}

async function kioskEnrollStaff(staffId, name) {
  if (!window.PublicKeyCredential) {
    alert("This device/browser doesn't support biometric enrollment.");
    return;
  }

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Magayon POS" },
        user: {
          id: new TextEncoder().encode(staffId),
          name: staffId,
          displayName: name || staffId
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        attestation: "none",
        timeout: 60000
      }
    });

    if (!credential) throw new Error("Enrollment was cancelled");

    await ensureAnonymousAuth();
    await enrollBiometric(staffId, credential.id);

    await loadKioskClockInData();
  } catch (err) {
    console.error(err);
    alert("Enrollment failed: " + (err.message || "unknown error"));
  }
}

/**
 * @param {string} staffId
 * @param {string[]} credentialIds every device this staff member has
 *   ever enrolled — the browser matches whichever one actually exists
 *   on THIS device's authenticator and ignores the rest.
 * @param {string} action
 */
async function kioskClockInOut(staffId, credentialIds, action) {
  if (!window.PublicKeyCredential) {
    alert("This device/browser doesn't support biometric verification.");
    return;
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: credentialIds.map(id => ({
          type: "public-key",
          id: base64urlToBuffer(id),
          transports: ["internal"]
        })),
        userVerification: "required",
        timeout: 60000
      }
    });

    if (!assertion) throw new Error("Verification was cancelled");

    await ensureAnonymousAuth();
    await clockInOut(staffId, action);

    await loadKioskClockInData();
  } catch (err) {
    console.error(err);
    alert("Verification failed — this device may not be enrolled yet for this person. Try \"Enroll this device\" instead.");
  }
}
