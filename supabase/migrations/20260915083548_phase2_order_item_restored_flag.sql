-- Magayon Supabase migration — Phase 2 fix: track whether a voided
-- line's stock was actually restored.
--
-- views/dailySales.js shows "VOIDED, restocked" vs. plain "VOIDED"
-- depending on this — a real UI distinction, not decorative — and
-- void_order_item() already knows the answer at the moment it runs, so
-- store it instead of losing it.

alter table order_items add column if not exists restored boolean not null default false;

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

  if not exists (select 1 from order_items where id = p_order_item_id and voided = false) then
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

  update order_items set voided = true, voided_at = now(), restored = v_restored
  where id = p_order_item_id;

  return jsonb_build_object('success', true, 'restored', v_restored);
end;
$$;
