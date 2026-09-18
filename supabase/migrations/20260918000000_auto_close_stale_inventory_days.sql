-- Auto-close any inventory day still OPEN once its calendar date has
-- passed (PH time). Closing a day has always been a manual admin
-- action — a day left open overnight blocks the next one from
-- starting (start_inventory_day's own guard: "already open for this
-- location — close it first") until someone manually closes it, which
-- has now caused real morning friction two days running. This closes
-- it automatically at the moment it becomes stale, so a new day is
-- always startable first thing.

create extension if not exists pg_cron with schema cron;

create or replace function auto_close_stale_inventory_days()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update daily_inventory
  set status = 'CLOSED', closed_at = now()
  where status = 'OPEN'
    and date < ((now() at time zone 'Asia/Manila'))::date;
end;
$$;

-- pg_cron's scheduler runs in UTC — 16:00 UTC is 00:00 Asia/Manila
-- (UTC+8) the same instant. Re-running this (e.g. a future migration
-- push) safely reschedules the same named job rather than duplicating
-- it, per cron.schedule's own upsert-by-name behavior.
select cron.schedule(
  'auto-close-stale-inventory-days',
  '0 16 * * *',
  $$select auto_close_stale_inventory_days();$$
);
