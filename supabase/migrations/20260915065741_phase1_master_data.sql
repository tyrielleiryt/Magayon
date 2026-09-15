-- Magayon Supabase migration — Phase 1: master/reference data
-- (locations, categories, products, product_ingredients, inventory_items)
--
-- Column shapes were taken directly from the live production API responses
-- (type=locations / categories / products / allProductRecipes / inventoryItems),
-- not guessed.
--
-- Applied via `supabase db push` (see docs/supabase-migration.md), not by
-- hand-pasting into the SQL Editor — this file is the source of truth from
-- here on; any future schema change is a new migration file, not an edit
-- to this one.

create table if not exists locations (
  location_id   text primary key,
  location_name text not null,
  address       text,
  active        boolean not null default true
);

create table if not exists categories (
  category_id   text primary key,
  category_name text not null
);

create table if not exists products (
  product_id    text primary key,
  product_code  text not null,
  product_name  text not null,
  category_id   text references categories (category_id) on delete set null,
  description   text default '',
  price         numeric not null default 0,
  image_url     text default '',
  active        boolean not null default true
);

create table if not exists inventory_items (
  item_id               text primary key,
  item_name             text not null,
  description           text default '',
  quantity_per_serving  numeric default 0,
  unit                  text default '',
  capital               numeric default 0,
  selling_price         numeric default 0,
  reorder_level         numeric default 0,
  active                boolean not null default true
);

-- One row per ingredient line of a product's recipe. `allProductRecipes`
-- (Apps Script) returns this same data pre-grouped by product_id; the
-- frontend's data/products.js re-groups it client-side, same shape the
-- views already expect.
create table if not exists product_ingredients (
  id         bigint generated always as identity primary key,
  product_id text not null references products (product_id) on delete cascade,
  item_id    text not null references inventory_items (item_id) on delete cascade,
  qty_used   numeric not null default 0
);

create index if not exists product_ingredients_product_id_idx on product_ingredients (product_id);
create index if not exists product_ingredients_item_id_idx on product_ingredients (item_id);
create index if not exists products_category_id_idx on products (category_id);

-- ================= ROW LEVEL SECURITY =================
-- Real role-based policies, not "any logged-in user can do anything."
-- Firebase custom claims (synced by functions/index.js's onUserRoleWrite
-- trigger, mirroring Firestore users/{uid}.role) land as flat top-level
-- fields on the verified Firebase ID token — Supabase's Third-Party Auth
-- integration exposes them via auth.jwt(), so (auth.jwt() ->> 'app_role')
-- reads the claim directly (no app_metadata nesting — that's a
-- Supabase-native-auth convention, not Firebase's).
--
-- Named "app_role", NOT "role": Supabase reserves the literal `role` JWT
-- claim to assign the Postgres session role itself (authenticated/anon)
-- — see https://supabase.com/docs/guides/auth/third-party/firebase-auth.
-- A Firebase custom claim also named `role` (e.g. "cashier") would
-- collide with that and silently misassign the Postgres role instead of
-- carrying our app-level role, breaking access in a hard-to-spot way.
-- Confirmed via Supabase's own docs before writing this, not assumed.
--
-- Scope: SELECT is open to any authenticated user (cashiers need to read
-- products/inventory for the POS grid). INSERT/UPDATE/DELETE require a
-- non-cashier role — this mirrors how these 5 tables are actually used
-- today (only admin-panel roles ever call their write actions), not a
-- 1:1 port of the dynamic, page-level Firestore rolePermissions matrix,
-- which is out of scope for 5 reference tables.

alter table locations enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table inventory_items enable row level security;
alter table product_ingredients enable row level security;

drop policy if exists "authenticated read" on locations;
create policy "authenticated read" on locations
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-cashier write" on locations;
create policy "non-cashier write" on locations
  for all using ((auth.jwt() ->> 'app_role') <> 'cashier')
  with check ((auth.jwt() ->> 'app_role') <> 'cashier');

drop policy if exists "authenticated read" on categories;
create policy "authenticated read" on categories
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-cashier write" on categories;
create policy "non-cashier write" on categories
  for all using ((auth.jwt() ->> 'app_role') <> 'cashier')
  with check ((auth.jwt() ->> 'app_role') <> 'cashier');

drop policy if exists "authenticated read" on products;
create policy "authenticated read" on products
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-cashier write" on products;
create policy "non-cashier write" on products
  for all using ((auth.jwt() ->> 'app_role') <> 'cashier')
  with check ((auth.jwt() ->> 'app_role') <> 'cashier');

drop policy if exists "authenticated read" on inventory_items;
create policy "authenticated read" on inventory_items
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-cashier write" on inventory_items;
create policy "non-cashier write" on inventory_items
  for all using ((auth.jwt() ->> 'app_role') <> 'cashier')
  with check ((auth.jwt() ->> 'app_role') <> 'cashier');

drop policy if exists "authenticated read" on product_ingredients;
create policy "authenticated read" on product_ingredients
  for select using (auth.role() = 'authenticated');
drop policy if exists "non-cashier write" on product_ingredients;
create policy "non-cashier write" on product_ingredients
  for all using ((auth.jwt() ->> 'app_role') <> 'cashier')
  with check ((auth.jwt() ->> 'app_role') <> 'cashier');
