-- Multi-device biometric enrollment. `staff.credential_id` only ever
-- held ONE WebAuthn credential — enrolling a second tablet silently
-- overwrote the first, breaking clock-in on whichever device wasn't
-- enrolled most recently. WebAuthn platform credentials (Face
-- ID/fingerprint/Windows Hello) are bound to the specific device's own
-- secure hardware and can never be exported or reused elsewhere — so
-- "one credential per staff member" can never really work; it has to
-- be "one credential per (staff member, device)" instead.
--
-- The fix doesn't need anything clever client-side: WebAuthn's own
-- assertion request already accepts a LIST of allowed credential ids
-- (allowCredentials) — the browser matches whichever one actually
-- exists in that device's own authenticator and ignores the rest. So
-- enrolling a new device just adds another row here; clocking in sends
-- every credential id the staff member has ever enrolled, anywhere.

create table if not exists staff_credentials (
  id            bigint generated always as identity primary key,
  staff_id      text not null references staff (staff_id),
  credential_id text not null unique,
  enrolled_at   timestamptz not null default now()
);

create index if not exists staff_credentials_staff_id_idx on staff_credentials (staff_id);

-- Carry over whatever was already enrolled under the old single-column
-- scheme, so nobody's existing device stops working.
insert into staff_credentials (staff_id, credential_id)
select staff_id, credential_id from staff
where credential_id is not null
on conflict (credential_id) do nothing;

alter table staff_credentials enable row level security;

drop policy if exists "app user read" on staff_credentials;
create policy "app user read" on staff_credentials
  for select using ((auth.jwt() ->> 'app_role') is not null);

-- ================= RPCs =================

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
  if (auth.jwt() ->> 'sub') is null then
    raise exception 'Not authorized';
  end if;

  select jsonb_agg(jsonb_build_object(
    'staff_id', s.staff_id,
    'name', trim(s.first_name || ' ' || s.last_name),
    'location_name', l.location_name,
    'enrolled', coalesce(c.credential_ids, '[]'::jsonb) <> '[]'::jsonb,
    'credential_ids', coalesce(c.credential_ids, '[]'::jsonb),
    'status', case when ar.clock_in_time is not null and ar.clock_out_time is null then 'IN' else 'OUT' end,
    'clock_in_time', ar.clock_in_time,
    'clock_out_time', ar.clock_out_time
  ))
  into v_result
  from staff s
  left join locations l on l.location_id = s.location_id
  left join attendance_records ar on ar.staff_id = s.staff_id and ar.date = v_today
  left join (
    select staff_id, jsonb_agg(credential_id) as credential_ids
    from staff_credentials
    group by staff_id
  ) c on c.staff_id = s.staff_id
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
  if (auth.jwt() ->> 'sub') is null then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from staff where staff_id = p_staff_id) then
    raise exception 'Staff member not found';
  end if;

  insert into staff_credentials (staff_id, credential_id)
  values (p_staff_id, p_credential_id)
  on conflict (credential_id) do nothing;

  return jsonb_build_object('success', true);
end;
$$;
