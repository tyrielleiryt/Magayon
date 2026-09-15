-- Magayon Supabase migration — Phase 1: master/reference data
-- (locations, categories, products, product_ingredients, inventory_items)
--
-- Paste this into the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- and run it once, after creating the project. Safe to re-run — every
-- statement uses IF NOT EXISTS / OR REPLACE.
--
-- Column shapes were taken directly from the live production API responses
-- (type=locations / categories / products / allProductRecipes / inventoryItems),
-- not guessed.

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
-- frontend re-groups it client-side after switching to Supabase, same
-- shape the views already expect.
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
-- Phase 1 baseline: any request carrying a valid Firebase-issued JWT
-- (verified by Supabase's Firebase Third-Party Auth integration) may
-- read and write every table below. This matches today's actual
-- enforcement level — role gating currently lives in the frontend's
-- allowedPages checks, not fine-grained backend RBAC — so it is not a
-- security regression. Tightening this to per-role policies (using
-- Firebase custom claims) is a later, optional hardening step.

alter table locations enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table inventory_items enable row level security;
alter table product_ingredients enable row level security;

drop policy if exists "authenticated read/write" on locations;
create policy "authenticated read/write" on locations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated read/write" on categories;
create policy "authenticated read/write" on categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated read/write" on products;
create policy "authenticated read/write" on products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated read/write" on inventory_items;
create policy "authenticated read/write" on inventory_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated read/write" on product_ingredients;
create policy "authenticated read/write" on product_ingredients
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
