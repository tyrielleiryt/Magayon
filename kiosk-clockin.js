/* ================= LOGIN-SCREEN CLOCK IN/OUT =================
   Lets any staff member (including server/cook, who have no login at
   all) clock in/out from the login screen, without needing a cashier
   to sign into the POS first. Fingerprint/Face ID is the only real
   identity check — there's no staff login involved, so this calls the
   backend directly (no Firebase auth token). Location isn't picked
   here either: the backend attributes the clock event to whatever
   location that staff member is already assigned to in the Staff Tab. */

import { API_URL } from "./firebase-config.js";
import { icon } from "./icons.js";

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

function loadKioskClockInData() {
  const tbody = el("kioskClockInTable");
  tbody.innerHTML = "<tr><td colspan='3'>Loading…</td></tr>";

  return new Promise(resolve => {
    const callbackName = "kioskClockInCallback_" + Date.now();

    window[callbackName] = data => {
      delete window[callbackName];
      script.remove();
      renderKioskClockInTable(data);
      resolve();
    };

    const script = document.createElement("script");
    // No &location= — omitting it returns every active staff member
    // across every location, since this tablet isn't tied to one.
    script.src = `${API_URL}?type=clockInKioskData&callback=${callbackName}`;

    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      tbody.innerHTML = "<tr><td colspan='3'>Failed to load staff.</td></tr>";
      resolve();
    };

    document.body.appendChild(script);
  });
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

    const res = await fetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "enrollBiometric",
        staff_id: staffId,
        credential_id: credential.id
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "Enrollment failed");

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

    const res = await fetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action,
        staff_id: staffId
        // No location_id — the backend uses this staff member's own
        // assigned location instead.
      })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || "Failed to record");

    await loadKioskClockInData();
  } catch (err) {
    console.error(err);
    alert("Verification failed — try again");
  }
}
window.kioskClockInOut = kioskClockInOut;
