# Supabase migration

## Why

Magayon's backend has always been a Google Apps Script Web App in front of Google Sheets. That's worked, but it has a hard ceiling: Apps Script gives a consumer account a limited daily execution-time budget and a limited number of simultaneous executions. On 2026-09-15, live burst-testing the production `exec` URL (a real browser User-Agent, no code changes) reproduced this directly:

- `type=locations` — a single tiny sheet, a 102-byte response — hung for 95s and then 39.5s before finally failing with a `404`, twice in a row, in a four-request burst.
- `type=posInit` (the combined call the POS makes on every load) succeeded every time in the same burst, but with latency ranging from 4.6s to 58.4s.
- The failure shape is consistent: a long hang followed by a `404` from `script.googleusercontent.com`, not a fast client-side error. That matches Google queuing or dropping Apps Script executions once too many are in flight for the account — not a slow query, not a large payload.

The conclusion that shapes this whole migration: **swapping the database under Apps Script would not fix this.** Apps Script's own per-account execution ceiling is the bottleneck, independent of what data store sits behind it. The fix has to get traffic out of Apps Script entirely for the calls that matter most — which is what this migration does, one bounded phase at a time, starting with the reference data every POS load depends on.

## Phase 1 scope

Five tables: `locations`, `categories`, `products`, `product_ingredients` (recipes), `inventory_items`. These are exactly the reads `admin.js`'s `getCached()` cache and the POS's combined `posInit` call bundle together — the highest-frequency, lowest-risk data in the app (rarely written, read on every single page load).

**`staff` was deliberately cut from this phase**, caught before any code was written for it. The same Apps Script `staff` sheet also backs `clockInKioskData`, `enrollBiometric`, `employeeDTR`, and `attendanceOverview` — none of which are moving yet. Migrating just the admin CRUD half would split that sheet across two sources of truth: a staff member added or edited in the admin panel would silently never show up at the POS clock-in kiosk. `staff` moves as a unit with the rest of attendance/clock-in/payroll in Phase 4.

Also excluded, for a different reason: `dailyInventory`/`dailyInventoryItems` (today's live stock — an open/close-day workflow) and `checkoutOrder`/orders (offline queue, `ref_id` idempotency, atomic inventory deduction on every sale). These need a real atomic write model — a Postgres function, not a sequence of client-side upserts — before they can move safely. See Roadmap.

## Architecture decisions

### Auth: Firebase stays, Supabase trusts it directly

No parallel login system, no user migration. Supabase's Third-Party Auth feature lets it verify JWTs issued by Firebase Authentication directly — configured once in the Supabase dashboard (Authentication → Sign In / Providers → Firebase, project `magayon`). The frontend already fetches a Firebase ID token everywhere via `getIdToken()` (`auth-guard.js`); `supabase-config.js` wires that same token in as `supabase-js`'s `accessToken` callback.

### Real role-based RLS — and a naming collision worth documenting

Row Level Security can only see what's in the verified JWT. A bare Firebase ID token doesn't carry this app's notion of role, so a Cloud Function (`functions/index.js`) mirrors Firestore's `users/{uid}.role` — already the single source of truth `requireRole()` reads on every page load — into a Firebase custom claim on that user's token, via a Firestore trigger. No existing admin UI that edits roles needed to change.

Two claims are set together, for two different reasons. `role: "authenticated"` is required by Supabase's own Third-Party Auth setup for it to recognize a Firebase user as logged in at all — without it, every request is treated as the `anon` Postgres role no matter how valid the Firebase login is. The app-level role lives in a **second, separate claim: `app_role`, not `role`** — reusing `role` for it would collide with the value Supabase expects there and silently misassign the Postgres role instead. Both of these were caught by reading Supabase's docs closely before deployment, not discovered as live bugs afterward.

RLS policy shape (`supabase/migrations/*_phase1_master_data.sql`): `SELECT` is open to any authenticated user — cashiers need to read products/inventory to render the POS grid. `INSERT`/`UPDATE`/`DELETE` require `(auth.jwt() ->> 'app_role') <> 'cashier'`. This is scoped to how these five tables are actually used today, not a full port of the dynamic, page-level Firestore `rolePermissions` matrix — reproducing that inside Postgres isn't justified for five reference tables.

Deploying the Cloud Function requires the Firebase project to be on the Blaze (pay-as-you-go) plan — a real, deliberate cost decision, not something a migration script should do on anyone's behalf. Usage here stays within Firebase's free tier either way.

Known, accepted limitation: a role change takes effect in Supabase once the user's Firebase ID token next refreshes (automatic within the hour, or their next login) — fine for a rare admin action.

### Schema as versioned migrations

`supabase/migrations/*.sql`, applied via the Supabase CLI (`supabase link` once, then `supabase db push`) instead of hand-pasting SQL into a dashboard editor. Schema changes from here on are new migration files, reviewable in a diff, not silent edits to a live database.

### A typed data-access layer, not raw calls scattered across views

`data/*.js` — one module per table family (`locations`, `categories`, `inventoryItems`, `products` — which also owns `product_ingredients`, since `saveProduct` always writes both together). `views/*.js` and `order.js` import from here, never from `supabase-config.js` directly, so the backend can change again without touching every view that happens to need this data.

Every file is `// @ts-check` with JSDoc `@typedef`/`@param`/`@returns`, checked via a root `jsconfig.json` (`npm run typecheck`) — real editor autocomplete and compile-time checking with zero build step, matching this app's existing all-static, no-bundler deployment to GitHub Pages. (`auth-guard.js` and `firebase-config.js` are marked `// @ts-nocheck` — pre-existing untyped files the new layer transitively imports; retrofitting the entire legacy codebase with types is out of scope for this migration.)

## Migration workflow

```bash
npm install                                   # pulls the pinned Supabase CLI + typecheck tooling
npx supabase login                            # one-time, opens your browser
npx supabase link --project-ref <ref>
npx supabase db push                          # applies supabase/migrations/*.sql
npm run typecheck                             # tsc --noEmit over data/*.js
```

The one-time data backfill (reading the five live Apps Script endpoints and upserting into Supabase) and the role-claims backfill for existing users are separate, disposable local scripts — never committed, run once with temporary credentials.

## Roadmap

- **Phase 2** — `dailyInventory`/`dailyInventoryItems` (today's live stock, start/close-day). Needs an atomic write model (a Postgres function) to replace Apps Script's deduction logic.
- **Phase 3** — `checkoutOrder`/orders. The highest-stakes path: offline queue, `ref_id` idempotency, atomic inventory deduction on every sale. Needs a Postgres RPC mirroring the current logic exactly before cutover.
- **Phase 4** — expenses/OPEX/payroll/attendance/clock-in/chat, including `staff` (see above). Lower traffic, can move opportunistically once the pattern from Phases 1-3 is proven.
- Once everything has moved, Apps Script + Sheets can be retired, or kept as a cold backup.
