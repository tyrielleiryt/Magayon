-- Magayon Supabase migration — Phase 2 extension: petty cash + expenses
--
-- Discovered while building the historical backfill script: Apps Script
-- stores petty_cash_fund and expenses directly on the SAME daily_inventory
-- row (keyed by daily_id), and the POS's Petty Cash Fund modal
-- (updateDailyFinance/addExpense) reads/writes that same row. Once
-- startNewInventoryDay moves to Supabase, Apps Script stops creating that
-- row in Sheets at all — Petty Cash Fund would break on cutover day
-- regardless of whether its own code changes. See docs/supabase-migration.md.

alter table daily_inventory add column if not exists petty_cash_fund numeric not null default 0;

create table if not exists expenses (
  id                 bigint generated always as identity primary key,
  daily_inventory_id bigint not null references daily_inventory (id) on delete cascade,
  description        text not null,
  amount             numeric not null,
  remarks            text default '',
  created_at         timestamptz not null default now()
);

create index if not exists expenses_daily_inventory_id_idx on expenses (daily_inventory_id);

alter table expenses enable row level security;

drop policy if exists "authenticated read" on expenses;
create policy "authenticated read" on expenses
  for select using (auth.role() = 'authenticated');

-- Cashier-accessible, same as add_daily_inventory/checkout_order — the
-- Petty Cash Fund modal is a POS (cashier) feature, not admin-only.

create or replace function update_daily_finance(
  p_daily_id bigint,
  p_petty_cash_fund numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_rows int;
begin
  if (auth.jwt() ->> 'app_role') is null then
    raise exception 'Not authorized';
  end if;

  update daily_inventory set petty_cash_fund = p_petty_cash_fund where id = p_daily_id;
  get diagnostics v_updated_rows = row_count;

  if v_updated_rows = 0 then
    raise exception 'Inventory day not found';
  end if;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function add_expense(
  p_daily_id bigint,
  p_description text,
  p_amount numeric,
  p_remarks text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'app_role') is null then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from daily_inventory where id = p_daily_id) then
    raise exception 'Inventory day not found';
  end if;

  insert into expenses (daily_inventory_id, description, amount, remarks)
  values (p_daily_id, p_description, p_amount, coalesce(p_remarks, ''));

  return jsonb_build_object('success', true);
end;
$$;
