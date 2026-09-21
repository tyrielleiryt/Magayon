-- Extends the midnight auto-close job to also auto-start each active
-- location's next day, carrying over the full catalog the same way
-- the admin's own Start Inventory Day flow does (every item, pre-
-- filled with whatever its most recent closed day left as remaining,
-- 0 if never tracked). Auto-close alone left a real gap: 9/20 never
-- got a day at all because nobody manually started one that morning,
-- which is exactly the daily-friction this eliminates.
--
-- Kept in the SAME function as the close step (not a second cron job)
-- so close-then-open always happens atomically, in order, at the one
-- midnight trigger — no race between two independently-scheduled jobs.

create or replace function auto_close_stale_inventory_days()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := ((now() at time zone 'Asia/Manila'))::date;
  v_loc record;
  v_new_day_id bigint;
  v_prev_day_id bigint;
begin
  -- Close anything left open from a previous day.
  update daily_inventory
  set status = 'CLOSED', closed_at = now()
  where status = 'OPEN'
    and date < v_today;

  -- Start today's day for every active location that doesn't already
  -- have one.
  for v_loc in select location_id from locations where active <> false loop
    if exists (select 1 from daily_inventory where location_id = v_loc.location_id and date = v_today) then
      continue;
    end if;

    insert into daily_inventory (date, location_id, status, created_by)
    values (v_today, v_loc.location_id, 'OPEN', 'auto')
    returning id into v_new_day_id;

    -- Most recent CLOSED day for this location, whenever that was —
    -- not assumed to be literally yesterday, so a skipped day doesn't
    -- lose the real carry-over trail.
    select id into v_prev_day_id
    from daily_inventory
    where location_id = v_loc.location_id and status = 'CLOSED' and date < v_today
    order by date desc
    limit 1;

    insert into daily_inventory_items (daily_inventory_id, item_id, qty_added, remaining)
    select
      v_new_day_id,
      ii.item_id,
      coalesce(prev.remaining, 0),
      coalesce(prev.remaining, 0)
    from inventory_items ii
    left join daily_inventory_items prev
      on prev.daily_inventory_id = v_prev_day_id and prev.item_id = ii.item_id
    where ii.active <> false;
  end loop;
end;
$$;
