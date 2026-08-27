// auth-guard.js
// Central login + role-based access control for every protected page.
//
// This replaces the old pattern where each page trusted a plain
// localStorage flag (e.g. `isLoggedIn === "true"`) that anyone could set
// by hand in devtools with no real login at all. Every protected page
// must now call requireRole() and await it before rendering or fetching
// anything sensitive — it re-verifies against Firebase Auth + the user's
// Firestore profile (role + active status) on every page load.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

export const ROLES = {
  CASHIER: "cashier",
  ADMIN: "admin",        // store / shift manager
  IT_ADMIN: "it_admin"   // manages staff accounts, roles and access
};

const LOGIN_PAGE = "index.html";
const IDLE_LOGOUT_MS = 20 * 60 * 1000; // 20 min idle auto-logout

let idleTimer = null;
let currentProfile = null;

function scheduleIdleLogout() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    signOut(auth).finally(() => {
      alert("You were signed out after 20 minutes of inactivity.");
      window.location.replace(LOGIN_PAGE);
    });
  }, IDLE_LOGOUT_MS);
}

function armIdleLogout() {
  ["click", "keydown", "touchstart", "mousemove"].forEach(evt =>
    document.addEventListener(evt, scheduleIdleLogout, { passive: true })
  );
  scheduleIdleLogout();
}

/**
 * Gate a page behind a real, fresh login + role check.
 *
 * Resolves with the user's profile once access is confirmed. If the user
 * isn't signed in, their account is deactivated, or their role isn't in
 * `allowedRoles`, this redirects away and the returned promise never
 * resolves (the page navigates away before any caller code can run).
 */
export function requireRole(allowedRoles, { redirectTo = "order.html" } = {}) {
  return new Promise(resolve => {
    onAuthStateChanged(auth, async user => {
      if (!user) {
        window.location.replace(LOGIN_PAGE);
        return;
      }

      let snap;
      try {
        snap = await getDoc(doc(db, "users", user.uid));
      } catch (err) {
        console.error("Profile lookup failed:", err);
        window.location.replace(LOGIN_PAGE);
        return;
      }

      if (!snap.exists()) {
        window.location.replace(LOGIN_PAGE);
        return;
      }

      const profile = snap.data();

      if (profile.active !== true) {
        alert("This account has been deactivated. Contact your IT admin.");
        await signOut(auth);
        window.location.replace(LOGIN_PAGE);
        return;
      }

      if (!allowedRoles.includes(profile.role)) {
        window.location.replace(redirectTo);
        return;
      }

      currentProfile = { ...profile, uid: user.uid };

      // Cached for UI convenience only (e.g. "Hi, Jane" labels) — never
      // treat these as authoritative. Every access-control decision goes
      // through requireRole()/getIdToken(), not these cached values.
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("staff_id", profile.staff_id || "");
      localStorage.setItem("userEmail", profile.email || user.email || "");
      localStorage.setItem("userName", profile.name || "");
      localStorage.setItem("userPosition", profile.role || "");
      localStorage.setItem("userLocation", profile.location || "");
      localStorage.setItem("canPOS", String(profile.can_pos ?? ""));

      armIdleLogout();
      resolve(currentProfile);
    });
  });
}

export function getCurrentProfile() {
  return currentProfile;
}

/** Current user's Firebase ID token — send as `Authorization: Bearer <token>`
 *  to a backend that verifies it server-side. */
export async function getIdToken() {
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

/** Merge an Authorization: Bearer <idToken> header into fetch() options. */
export async function withAuth(options = {}) {
  const token = await getIdToken();
  if (!token) return options;
  return {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
  };
}

export function logout() {
  clearTimeout(idleTimer);
  localStorage.clear();
  sessionStorage.clear();
  return signOut(auth).then(() => window.location.replace(LOGIN_PAGE));
}

/**
 * Drop-in replacement for fetch() against the Apps Script backend that
 * attaches the current user's Firebase ID token so the backend can verify
 * who's actually calling — Apps Script web apps can't read custom request
 * headers, so the token travels as a normal `id_token` param instead of
 * an Authorization header.
 *
 * Works with both call styles already used across this codebase:
 *   authFetch(API_URL, { method: "POST", body: new URLSearchParams({...}) })
 *   authFetch(`${API_URL}?action=...&foo=bar`)
 */
export async function authFetch(url, options = {}) {
  const token = await getIdToken();

  if (options.body instanceof URLSearchParams) {
    if (token) options.body.set("id_token", token);
    return fetch(url, options);
  }

  if (token) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}id_token=${encodeURIComponent(token)}`;
  }
  return fetch(url, options);
}
