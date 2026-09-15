-- Magayon Supabase migration — Phase 4: staff, attendance/biometric
-- clock-in, chat, OPEX, payroll deductions.
--
-- Column shapes taken from live production API responses, not guessed.

-- ================= TABLES =================

create table if not exists staff (
  staff_id    text primary key,
  last_name   text not null,
  first_name  text not null,
  email       text default '',
  location_id text references locations (location_id),
  position    text not null,
  start_date  date,
  can_pos     boolean not null default true,
  active      boolean not null default true,
  rate        numeric not null default 0,
  -- WebAuthn credential id for this device's biometric clock-in —
  -- null/absent means "not enrolled". Never re-verified cryptographically
  -- server-side, same trust model as today: a resolved
  -- navigator.credentials.get() is treated as proof of identity.
  credential_id text
);

-- One row per staff per day — this app's clock-in model is a single
-- in/out pair per day, not a list of sessions, matching the existing
-- "In since X" / "Out (last: Y)" UI.
create table if not exists attendance_records (
  id              bigint generated always as identity primary key,
  staff_id        text not null references staff (staff_id),
  date            date not null,
  clock_in_time   timestamptz,
  clock_out_time  timestamptz,
  unique (staff_id, date)
);

create table if not exists chat_messages (
  id          bigint generated always as identity primary key,
  sender_role text not null,
  sender_id   text not null,
  location_id text not null references locations (location_id),
  message     text not null,
  created_at  timestamptz not null default now()
);

create table if not exists opex_items (
  opex_id     text primary key,
  item_name   text not null,
  amount_month numeric not null,
  location_id text not null references locations (location_id)
);

create table if not exists payroll_deductions (
  deduction_id    text primary key,
  week_start_date date not null,
  location_id     text not null references locations (location_id),
  staff_id        text not null references staff (staff_id),
  amount          numeric not null,
  notes           text default ''
);

create index if not exists attendance_records_staff_date_idx on attendance_records (staff_id, date);
create index if not exists chat_messages_location_created_idx on chat_messages (location_id, created_at);
create index if not exists opex_items_location_idx on opex_items (location_id);
create index if not exists payroll_deductions_week_location_idx on payroll_deductions (week_start_date, location_id);

-- ================= RLS =================

alter table staff enable row level security;
alter table attendance_records enable row level security;
alter table chat_messages enable row level security;
alter table opex_items enable row level security;
alter table payroll_deductions enable row level security;

-- staff / opex_items / payroll_deductions: ordinary reference-style CRUD,
-- same shape as Phase 1's tables. Direct table access requires a real
-- app_role claim (excludes the kiosk's anonymous sessions entirely —
-- they only ever get in through the narrow RPCs below). Cashier can
-- read (needed for the POS's own clock-in modal and staff pickers) but
-- not write.
drop policy if exists "app user read" on staff;
create policy "app user read" on staff
  for select using ((auth.jwt() ->> 'app_role') is not null);
drop policy if exists "non-cashier write" on staff;
create policy "non-cashier write" on staff
  for all using ((auth.jwt() ->> 'app_role') is not null and (auth.jwt() ->> 'app_role') <> 'cashier')
  with check ((auth.jwt() ->> 'app_role') is not null and (auth.jwt() ->> 'app_role') <> 'cashier');

drop policy if exists "app user read" on opex_items;
create policy "app user read" on opex_items
  for select using ((auth.jwt() ->> 'app_role') is not null);
drop policy if exists "non-cashier write" on opex_items;
create policy "non-cashier write" on opex_items
  for all using ((auth.jwt() ->> 'app_role') is not null and (auth.jwt() ->> 'app_role') <> 'cashier')
  with check ((auth.jwt() ->> 'app_role') is not null and (auth.jwt() ->> 'app_role') <> 'cashier');

drop policy if exists "app user read" on payroll_deductions;
create policy "app user read" on payroll_deductions
  for select using ((auth.jwt() ->> 'app_role') is not null);
drop policy if exists "non-cashier write" on payroll_deductions;
create policy "non-cashier write" on payroll_deductions
  for all using ((auth.jwt() ->> 'app_role') is not null and (auth.jwt() ->> 'app_role') <> 'cashier')
  with check ((auth.jwt() ->> 'app_role') is not null and (auth.jwt() ->> 'app_role') <> 'cashier');

-- chat_messages: any real app user (cashier included — they're the
-- other half of every conversation) can read and send.
drop policy if exists "app user read/write" on chat_messages;
create policy "app user read/write" on chat_messages
  for all using ((auth.jwt() ->> 'app_role') is not null)
  with check ((auth.jwt() ->> 'app_role') is not null);

-- attendance_records: readable by any real app user; no direct writes
-- at all — clock in/out only ever happens through the RPCs below, since
-- those are the only path that also needs to work for the kiosk's
-- anonymous sessions (which have no app_role claim to check here).
drop policy if exists "app user read" on attendance_records;
create policy "app user read" on attendance_records
  for select using ((auth.jwt() ->> 'app_role') is not null);

-- ================= RPCs =================
-- These three intentionally check only auth.role() = 'authenticated'
-- (true for a real staff login AND for the kiosk's silent anonymous
-- Firebase sign-in alike) rather than requiring an app_role claim —
-- that's what lets the kiosk clock-in flow work with no staff login at
-- all, exactly like it does today, while still requiring some verified
-- token rather than none. Scope stays narrow specifically because these
-- are the ONLY write path into attendance_records / staff.credential_id
-- — an anonymous session can't reach anything else.

create or replace function get_staff_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := ((now() at time zone 'Asia/Manila'))::date;
  v_result jsonb;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorized';
  end if;

  select jsonb_agg(jsonb_build_object(
    'staff_id', s.staff_id,
    'name', trim(s.first_name || ' ' || s.last_name),
    'location_name', l.location_name,
    'enrolled', s.credential_id is not null,
    'credential_id', s.credential_id,
    'status', case when ar.clock_in_time is not null and ar.clock_out_time is null then 'IN' else 'OUT' end,
    'clock_in_time', ar.clock_in_time,
    'clock_out_time', ar.clock_out_time
  ))
  into v_result
  from staff s
  left join locations l on l.location_id = s.location_id
  left join attendance_records ar on ar.staff_id = s.staff_id and ar.date = v_today
  where s.active = true;

  return jsonb_build_object('success', true, 'staff', coalesce(v_result, '[]'::jsonb));
end;
$$;

create or replace function enroll_biometric(
  p_staff_id text,
  p_credential_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorized';
  end if;

  update staff set credential_id = p_credential_id where staff_id = p_staff_id;

  if not found then
    raise exception 'Staff member not found';
  end if;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function clock_in_out(
  p_staff_id text,
  p_action text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := ((now() at time zone 'Asia/Manila'))::date;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorized';
  end if;

  if p_action = 'clockIn' then
    insert into attendance_records (staff_id, date, clock_in_time)
    values (p_staff_id, v_today, now())
    on conflict (staff_id, date) do update set clock_in_time = now();
  elsif p_action = 'clockOut' then
    update attendance_records set clock_out_time = now()
    where staff_id = p_staff_id and date = v_today;
    if not found then
      insert into attendance_records (staff_id, date, clock_out_time)
      values (p_staff_id, v_today, now());
    end if;
  else
    raise exception 'Invalid action';
  end if;

  return jsonb_build_object('success', true);
end;
$$;
