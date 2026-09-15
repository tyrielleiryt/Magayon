// supabase-config.js
// Single shared source of Supabase config, mirroring firebase-config.js.
// Only data/*.js modules import `supabase` from here — views/order.js
// call those, never this file directly, so the backend can change again
// without touching every view.
//
// Phase 1 only (see supabase/migrations/): locations, categories,
// products, product_ingredients, inventory_items. Everything else still
// goes through API_URL (firebase-config.js) / Apps Script for now.
//
// Version pinned exactly (not @2, which floats) to match the
// @supabase/supabase-js devDependency in package.json — that npm copy is
// never shipped to the browser (this app still has no bundler/build
// step), it exists purely so `npm run typecheck` can resolve real types
// for this CDN import via jsconfig.json's `paths` mapping. Bump both
// together.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm";
import { getIdToken } from "./auth-guard.js";

// Supabase project URL + anon public key are not secrets (same trust
// level as the Firebase apiKey above) — real access control is Row Level
// Security (see supabase-schema.sql), enforced server-side per request,
// not by hiding these values. Fill these in after creating the project
// (Project Settings → API).
export const SUPABASE_URL = "https://gpopkiotqhqihhbhebrz.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_iwZwst4nZy8RI4sp3jhYpQ_9m1jQP0o";

// Firebase Third-Party Auth: every request Supabase receives carries the
// same Firebase ID token already used against Apps Script via authFetch()
// (auth-guard.js) — Supabase verifies it directly against the Firebase
// project configured in its dashboard (Authentication → Sign In /
// Providers → Firebase, project id "magayon"). No separate Supabase login.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  accessToken: async () => (await getIdToken()) ?? undefined
});
