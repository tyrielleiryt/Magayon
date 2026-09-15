// functions/index.js
// Syncs each user's role (Firestore users/{uid}.role — already this
// app's single source of truth, read by auth-guard.js's requireRole() on
// every page load) into Firebase Auth custom claims so it travels inside
// the user's existing ID token. That's what lets Supabase's Row Level
// Security policies (see supabase/migrations/) tell a cashier apart from
// an admin, since RLS can only see what's actually in the verified JWT —
// it has no other way to reach into Firestore itself.
//
// Two claims are set together, for two different reasons:
//
// - `role: "authenticated"` — Supabase's own Third-Party Auth setup docs
//   require this exact claim/value on every user for Supabase to
//   recognize them as logged in at all. Without it, Postgres treats
//   every request as the `anon` role regardless of how valid the
//   Firebase login is — this was caught and added before deployment,
//   not discovered as a live bug after the fact.
// - `app_role` — this app's own role ("cashier", "admin", ...), read by
//   the Phase 1 RLS policies via auth.jwt()->>'app_role'. Deliberately
//   NOT named `role` — that name is the one above, reserved by Supabase
//   for Postgres role assignment; reusing it would silently misassign
//   the Postgres role instead of carrying our app-level one.
//
// Only fires when `role` actually changed — every other edit to a
// user's profile (name, position, location, ...) skips the Admin SDK
// call entirely.

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

exports.onUserRoleWrite = onDocumentWritten("users/{uid}", async event => {
  const uid = event.params.uid;
  const beforeRole = event.data?.before?.data()?.role ?? null;
  const afterRole = event.data?.after?.data()?.role ?? null;

  if (beforeRole === afterRole) return;

  const auth = getAuth();

  if (afterRole === null) {
    // User doc deleted, or its role field cleared — drop every custom
    // claim rather than leave a stale one (including `role`) behind.
    await auth.setCustomUserClaims(uid, null);
    return;
  }

  await auth.setCustomUserClaims(uid, { role: "authenticated", app_role: afterRole });
});
