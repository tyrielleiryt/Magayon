-- Fix: the kiosk RPCs (get_staff_status, enroll_biometric, clock_in_out)
-- checked auth.role() = 'authenticated', on the assumption that any
-- valid Firebase JWT maps to Supabase's 'authenticated' Postgres role
-- by default. Verified false via scripted testing: Supabase only grants
-- 'authenticated' when the JWT actually carries a role:"authenticated"
-- claim, which only the Phase 1 Cloud Function sets — and only on a
-- Firestore users/{uid} write. An anonymous Firebase sign-in (the
-- kiosk's whole trust model) never gets a Firestore profile, so it
-- never gets that claim, and auth.role() came back 'anon' — every kiosk
-- call was silently unreachable even with Anonymous Auth enabled.
--
-- Fix: check auth.uid() is not null instead — it reads the JWT's `sub`
-- claim, present for any validly-signed Firebase token regardless of
-- the `role` claim, so it works for both a real staff login and a bare
-- anonymous session alike.
--
-- CORRECTED in 20260915120500_phase4_kiosk_rpc_auth_fix_v2.sql: this
-- auth.uid() is not null passed for a real Firebase UID (which happens
-- to not collide with uuid syntax) but was never actually tested
-- against a genuinely uuid-hostile input before pushing. Scripted
-- testing right after this shipped caught that auth.uid() casts `sub`
-- to Postgres's uuid type, which throws for some Firebase user IDs —
-- breaking every call through these RPCs, not just anonymous ones. Left
-- as-applied here (not edited in place) since `supabase db push` tracks
-- migrations by filename and won't re-apply one whose content changed
-- after the fact — the v2 file is what's actually live.

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
  if auth.uid() is null then
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
  if auth.uid() is null then
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
  if auth.uid() is null then
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
