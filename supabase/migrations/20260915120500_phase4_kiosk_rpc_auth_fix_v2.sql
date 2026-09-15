-- Corrects 20260915120000_phase4_kiosk_rpc_auth_fix.sql: that migration
-- swapped the kiosk RPCs' auth check from auth.role() = 'authenticated'
-- to auth.uid() is not null, but auth.uid() casts the JWT's `sub` claim
-- to Postgres's uuid type — which THROWS (not just returns null) for
-- Firebase's non-UUID user IDs (e.g. "2lFmuhxLvoT5ObPMaD6DaSvJa9f1"),
-- breaking every call through these RPCs, not just anonymous ones.
-- Confirmed via scripted testing immediately after the first fix was
-- pushed (a fresh migration, not an edit to the applied one, since
-- `supabase db push` tracks migrations by filename and won't re-apply
-- an already-recorded one even if its content changes).
--
-- Correct check: (auth.jwt() ->> 'sub') is not null — extracts `sub`
-- as plain text, no uuid cast, same safe pattern Phase 1/2's own
-- `(auth.jwt() ->> 'app_role')` checks already use.

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
  if (auth.jwt() ->> 'sub') is null then
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
  if (auth.jwt() ->> 'sub') is null then
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
