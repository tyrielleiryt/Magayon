// supabase-config.js
// Single shared source of Supabase config, mirroring firebase-config.js.
// Every migrated view imports `supabase` from here instead of creating
// its own client.
//
// Phase 1 only (see supabase-schema.sql): locations, categories, products,
// product_ingredients, inventory_items. Everything else still goes through
// API_URL (firebase-config.js) / Apps Script for now.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { getIdToken } from "./auth-guard.js";

// Supabase project URL + anon public key are not secrets (same trust
// level as the Firebase apiKey above) — real access control is Row Level
// Security (see supabase-schema.sql), enforced server-side per request,
// not by hiding these values. Fill these in after creating the project
// (Project Settings → API).
export const SUPABASE_URL = "REPLACE_WITH_YOUR_PROJECT_URL";
export const SUPABASE_ANON_KEY = "REPLACE_WITH_YOUR_ANON_PUBLIC_KEY";

// Firebase Third-Party Auth: every request Supabase receives carries the
// same Firebase ID token already used against Apps Script via authFetch()
// (auth-guard.js) — Supabase verifies it directly against the Firebase
// project configured in its dashboard (Authentication → Sign In /
// Providers → Firebase, project id "magayon"). No separate Supabase login.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  accessToken: async () => (await getIdToken()) ?? undefined
});
