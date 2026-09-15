-- Magayon Supabase migration — Phase 2: transactional core
-- (daily inventory day lifecycle, checkout, void-with-restore)
--
-- See docs/supabase-migration.md for the coupling discovery that led to
-- scoping this as one cluster: dailyInventoryItems.remaining is
-- decremented by every checkout, so tracking and deduction have to move
-- together or the numbers go stale from the first sale after cutover.

-- ================= TABLES =================

create table if not exists daily_inventory (
  id          bigint generated always as identity primary key,
  date        date not null,
  location_id text not null references locations (location_id),
  status      text not null check (status in ('OPEN', 'CLOSED')),
  created_by  text,
  closed_at   timestamptz,
  unique (date, location_id)
);

create table if not exists daily_inventory_items (
  id                 bigint generated always as identity primary key,
  daily_inventory_id bigint not null references daily_inventory (id) on delete cascade,
  item_id            text not null references inventory_items (item_id),
  qty_added          numeric not null default 0,
  remaining          numeric not null default 0,
  unique (daily_inventory_id, item_id)
);

create table if not exists orders (
  ref_id         text primary key,
  staff_id       text,
  location_id    text not null references locations (location_id),
  order_date     date not null,
  total_bill     numeric not null default 0,
  amount_paid    numeric not null default 0,
  change         numeric not null default 0,
  payment_method text,
  gcash_payment  boolean not null default false,
  gcash_ref      text,
  payment_status text,
  created_at     timestamptz not null default now()
);

create table if not exists order_items (
  id         bigint generated always as identity primary key,
  ref_id     text not null references orders (ref_id) on delete cascade,
  product_id text not null references products (product_id),
  qty        numeric not null,
  price      numeric not null,
  total      numeric not null,
  voided     boolean not null default false,
  voided_at  timestamptz
);

-- Snapshotted at checkout time, not recomputed from the recipe later —
-- the recipe can change after the sale, but voiding must restore
-- exactly what THIS order line actually consumed.
create table if not exists order_item_consumption (
  id             bigint generated always as identity primary key,
  order_item_id  bigint not null references order_items (id) on delete cascade,
  item_id        text not null references inventory_items (item_id),
  qty_consumed   numeric not null default 0
);

create index if not exists daily_inventory_date_location_idx on daily_inventory (date, location_id);
create index if not exists daily_inventory_items_daily_inventory_id_idx on daily_inventory_items (daily_inventory_id);
create index if not exists orders_location_date_idx on orders (location_id, order_date);
create index if not exists order_items_ref_id_idx on order_items (ref_id);
create index if not exists order_item_consumption_order_item_id_idx on order_item_consumption (order_item_id);

-- ================= RLS =================
-- No direct INSERT/UPDATE/DELETE policy on any of these 5 tables — on
-- purpose. These aren't simple CRUD rows like Phase 1's reference data;
-- they're multi-step atomic operations (deduct stock across several
-- ingredients, or none of them). Every write goes through the
-- SECURITY DEFINER RPCs below, which do their own validation and role
-- checks and then bypass RLS internally. Reads stay open to any
-- authenticated user — cashiers need today's stock and their own
-- sales, admins need history and reports.

alter table daily_inventory enable row level security;
alter table daily_inventory_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_consumption enable row level security;

drop policy if exists "authenticated read" on daily_inventory;
create policy "authenticated read" on daily_inventory
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated read" on daily_inventory_items;
create policy "authenticated read" on daily_inventory_items
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated read" on orders;
create policy "authenticated read" on orders
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated read" on order_items;
create policy "authenticated read" on order_items
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated read" on order_item_consumption;
create policy "authenticated read" on order_item_consumption
  for select using (auth.role() = 'authenticated');

-- ================= RPCs =================

-- Manila is UTC+8 year-round (no DST) — matches getPHDate() in
-- order.js/admin.js, which every date param this migration touches is
-- already expressed in.
create or replace function checkout_order(
  p_ref_id text,
  p_staff_id text,
  p_location text,
  p_items jsonb,
  p_payment jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_daily_id bigint;
  v_item jsonb;
  v_recipe record;
  v_needed numeric;
  v_updated_rows int;
  v_order_item_id bigint;
  v_today date := ((now() at time zone 'Asia/Manila'))::date;
begin
  if (auth.jwt() ->> 'app_role') is null then
    raise exception 'Not authorized';
  end if;

  -- Idempotent: a repeat call with the same ref_id (e.g. a retried
  -- offline-queue sync) returns the existing order instead of
  -- double-charging inventory or erroring.
  select * into v_existing from orders where ref_id = p_ref_id;
  if found then
    return jsonb_build_object('success', true, 'ref_id', v_existing.ref_id, 'already_processed', true);
  end if;

  select id into v_daily_id
  from daily_inventory
  where location_id = p_location and status = 'OPEN' and date = v_today;

  if v_daily_id is null then
    raise exception 'Inventory is closed for this location today';
  end if;

  insert into orders (
    ref_id, staff_id, location_id, order_date,
    total_bill, amount_paid, change, payment_method, gcash_payment, gcash_ref, payment_status
  ) values (
    p_ref_id, p_staff_id, p_location, v_today,
    coalesce((p_payment ->> 'total_bill')::numeric, 0),
    coalesce((p_payment ->> 'amount_paid')::numeric, 0),
    coalesce((p_payment ->> 'change')::numeric, 0),
    p_payment ->> 'payment_method',
    coalesce((p_payment ->> 'gcash_payment')::boolean, false),
    p_payment ->> 'gcash_ref',
    p_payment ->> 'payment_status'
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (ref_id, product_id, qty, price, total)
    values (
      p_ref_id,
      v_item ->> 'product_id',
      (v_item ->> 'qty')::numeric,
      (v_item ->> 'price')::numeric,
      (v_item ->> 'total')::numeric
    )
    returning id into v_order_item_id;

    for v_recipe in
      select item_id, qty_used from product_ingredients where product_id = v_item ->> 'product_id'
    loop
      v_needed := v_recipe.qty_used * (v_item ->> 'qty')::numeric;

      update daily_inventory_items
      set remaining = remaining - v_needed
      where daily_inventory_id = v_daily_id
        and item_id = v_recipe.item_id
        and remaining >= v_needed;

      get diagnostics v_updated_rows = row_count;

      if v_updated_rows = 0 then
        raise exception 'Insufficient stock for item %', v_recipe.item_id;
      end if;

      insert into order_item_consumption (order_item_id, item_id, qty_consumed)
      values (v_order_item_id, v_recipe.item_id, v_needed);
    end loop;
  end loop;

  return jsonb_build_object('success', true, 'ref_id', p_ref_id);
end;
$$;

-- Voids one order line. If p_restore and the line's order's day is
-- still OPEN, adds back everything order_item_consumption recorded for
-- it. Returns whether restore actually happened, so the UI can show
-- "stock wasn't restored, day already closed" same as it does today.
create or replace function void_order_item(
  p_order_item_id bigint,
  p_restore boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_id bigint;
  v_status text;
  v_consumption record;
  v_restored boolean := false;
begin
  if (auth.jwt() ->> 'app_role') = 'cashier' then
    raise exception 'Not authorized';
  end if;

  update order_items set voided = true, voided_at = now()
  where id = p_order_item_id and voided = false;

  if not found then
    raise exception 'Order item not found or already voided';
  end if;

  if p_restore then
    select di.id, di.status into v_daily_id, v_status
    from order_items oi
    join orders o on o.ref_id = oi.ref_id
    join daily_inventory di on di.location_id = o.location_id and di.date = o.order_date
    where oi.id = p_order_item_id;

    if v_status = 'OPEN' then
      for v_consumption in
        select item_id, qty_consumed from order_item_consumption where order_item_id = p_order_item_id
      loop
        update daily_inventory_items
        set remaining = remaining + v_consumption.qty_consumed
        where daily_inventory_id = v_daily_id and item_id = v_consumption.item_id;
      end loop;
      v_restored := true;
    end if;
  end if;

  return jsonb_build_object('success', true, 'restored', v_restored);
end;
$$;

create or replace function start_inventory_day(
  p_date date,
  p_location text,
  p_created_by text,
  p_carry_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_id bigint;
  v_item jsonb;
begin
  if (auth.jwt() ->> 'app_role') = 'cashier' then
    raise exception 'Not authorized';
  end if;

  if exists (select 1 from daily_inventory where date = p_date and location_id = p_location) then
    raise exception 'Inventory day already exists for this date and location';
  end if;

  if exists (select 1 from daily_inventory where location_id = p_location and status = 'OPEN') then
    raise exception 'An inventory day is already open for this location — close it first';
  end if;

  insert into daily_inventory (date, location_id, status, created_by)
  values (p_date, p_location, 'OPEN', p_created_by)
  returning id into v_daily_id;

  if p_carry_items is not null then
    for v_item in select * from jsonb_array_elements(p_carry_items)
    loop
      insert into daily_inventory_items (daily_inventory_id, item_id, qty_added, remaining)
      values (
        v_daily_id,
        v_item ->> 'item_id',
        (v_item ->> 'qty')::numeric,
        (v_item ->> 'qty')::numeric
      )
      on conflict (daily_inventory_id, item_id) do update
        set qty_added = daily_inventory_items.qty_added + excluded.qty_added,
            remaining = daily_inventory_items.remaining + excluded.remaining;
    end loop;
  end if;

  return jsonb_build_object('success', true, 'daily_inventory_id', v_daily_id);
end;
$$;

create or replace function close_inventory_day(
  p_date date,
  p_location text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_rows int;
begin
  if (auth.jwt() ->> 'app_role') = 'cashier' then
    raise exception 'Not authorized';
  end if;

  update daily_inventory
  set status = 'CLOSED', closed_at = now()
  where date = p_date and location_id = p_location and status = 'OPEN';

  get diagnostics v_updated_rows = row_count;

  if v_updated_rows = 0 then
    raise exception 'No open inventory day found for this date and location';
  end if;

  return jsonb_build_object('success', true);
end;
$$;

-- Used by both the admin's mid-day top-up and the POS's own Add
-- Inventory menu item — cashier-accessible, unlike start/close/void.
create or replace function add_daily_inventory(
  p_date date,
  p_location text,
  p_created_by text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_id bigint;
  v_item jsonb;
begin
  if (auth.jwt() ->> 'app_role') is null then
    raise exception 'Not authorized';
  end if;

  select id into v_daily_id
  from daily_inventory
  where date = p_date and location_id = p_location and status = 'OPEN';

  if v_daily_id is null then
    raise exception 'No open inventory day found for this date and location';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into daily_inventory_items (daily_inventory_id, item_id, qty_added, remaining)
    values (
      v_daily_id,
      v_item ->> 'item_id',
      (v_item ->> 'qty')::numeric,
      (v_item ->> 'qty')::numeric
    )
    on conflict (daily_inventory_id, item_id) do update
      set qty_added = daily_inventory_items.qty_added + excluded.qty_added,
          remaining = daily_inventory_items.remaining + excluded.remaining;
  end loop;

  return jsonb_build_object('success', true);
end;
$$;
