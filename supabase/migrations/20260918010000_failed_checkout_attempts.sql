-- Cross-device visibility for checkout failures. Previously these only
-- ever lived in that device's own localStorage (pendingOrders/
-- failedOrders in order.js) — recoverable on that same tablet via its
-- own "Sync" button, but invisible to an admin on any other device.
-- This mirrors the client-side record into a real table any admin can
-- see, without touching how the local retry queue itself works (that
-- stays as the actual retry mechanism; this is purely for visibility +
-- manual review across devices).

create table if not exists failed_checkout_attempts (
  id          bigint generated always as identity primary key,
  ref_id      text not null,
  staff_id    text,
  location_id text references locations (location_id),
  items       jsonb not null,
  payment     jsonb,
  error       text not null,
  created_at  timestamptz not null default now(),
  resolved    boolean not null default false,
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists failed_checkout_attempts_resolved_idx
  on failed_checkout_attempts (resolved, created_at);

alter table failed_checkout_attempts enable row level security;

-- Read-only for any real app user (cashier included — they should be
-- able to see their own device's failures reflected here too). All
-- writes go through the two RPCs below, same RPC-only pattern as every
-- other transactional table in this schema.
drop policy if exists "app user read" on failed_checkout_attempts;
create policy "app user read" on failed_checkout_attempts
  for select using ((auth.jwt() ->> 'app_role') is not null);

create or replace function record_failed_checkout(
  p_ref_id text,
  p_staff_id text,
  p_location text,
  p_items jsonb,
  p_payment jsonb,
  p_error text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Any real app user, cashier included — they're the one whose
  -- checkout just failed and needs this recorded.
  if (auth.jwt() ->> 'app_role') is null then
    raise exception 'Not authorized';
  end if;

  insert into failed_checkout_attempts (ref_id, staff_id, location_id, items, payment, error)
  values (p_ref_id, p_staff_id, p_location, p_items, p_payment, p_error);

  return jsonb_build_object('success', true);
end;
$$;

create or replace function resolve_failed_checkout(
  p_id bigint,
  p_resolved_by text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'app_role') is null or (auth.jwt() ->> 'app_role') = 'cashier' then
    raise exception 'Not authorized';
  end if;

  update failed_checkout_attempts
  set resolved = true, resolved_at = now(), resolved_by = p_resolved_by
  where id = p_id;

  return jsonb_build_object('success', true);
end;
$$;
