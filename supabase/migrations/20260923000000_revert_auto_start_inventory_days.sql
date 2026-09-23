-- Reverts 20260922000000_auto_start_inventory_days.sql back to close-only
-- — starting a new day goes back to being a manual admin action via
-- the app's own Start Inventory Day flow. Auto-close (the original
-- 20260918000000 behavior) stays as-is; only the auto-start half added
-- on top of it is removed here.

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
