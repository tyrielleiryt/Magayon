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
    let statusCell, actionCell;
    const name = (s.name || "").replace(/'/g, "\\'");

    if (!s.enrolled) {
      statusCell = "Not enrolled";
      actionCell = `<button onclick="window.kioskEnrollStaff('${s.staff_id}', '${name}')">${icon("fingerprint", { size: 14 })} Enroll</button>`;
    } else if (s.status === "IN") {
      statusCell = `In since ${s.clock_in_time || "—"}`;
      actionCell = `<button onclick="window.kioskClockInOut('${s.staff_id}', '${s.credential_id}', 'clockOut')">${icon("log-out", { size: 14 })} Clock Out</button>`;
    } else {
      statusCell = s.clock_out_time ? `Out (last: ${s.clock_out_time})` : "Not clocked in today";
      actionCell = `<button onclick="window.kioskClockInOut('${s.staff_id}', '${s.credential_id}', 'clockIn')">${icon("log-in", { size: 14 })} Clock In</button>`;
    }

    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${s.name}${s.location_name ? `<br><small class="muted">${s.location_name}</small>` : ""}</td>
        <td>${statusCell}</td>
        <td>${actionCell}</td>
      </tr>
    `);
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
window.kioskEnrollStaff = kioskEnrollStaff;

async function kioskClockInOut(staffId, credentialId, action) {
  if (!window.PublicKeyCredential) {
    alert("This device/browser doesn't support biometric verification.");
    return;
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{
          type: "public-key",
          id: base64urlToBuffer(credentialId),
          transports: ["internal"]
        }],
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
    alert("Verification failed — try again");
  }
}
window.kioskClockInOut = kioskClockInOut;
