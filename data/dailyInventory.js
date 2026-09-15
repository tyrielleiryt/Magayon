// @ts-check
import { supabase } from "../supabase-config.js";
import { withRetry } from "./_shared.js";

/**
 * @typedef {Object} DailyInventoryDay
 * @property {number} id
 * @property {string} date
 * @property {string} location_id
 * @property {string} location - alias of location_id, matching Apps Script's original dailyInventory field name
 * @property {"OPEN"|"CLOSED"} status
 * @property {string|null} created_by
 * @property {string|null} closed_at
 * @property {number} petty_cash_fund
 */

/**
 * @typedef {Object} DailyInventoryItemRow
 * @property {string} item_id
 * @property {string} item_name
 * @property {number} qty_added
 * @property {number} remaining
 */

/**
 * Paginated, matching the shape every existing call site already
 * expects from Apps Script's own `type=dailyInventory&limit=&offset=`.
 * @param {{limit: number, offset: number}} params
 * @returns {Promise<{rows: DailyInventoryDay[], hasMore: boolean}>}
 */
export async function listDailyInventoryDays({ limit, offset }) {
  const rows = await withRetry(() =>
    supabase
      .from("daily_inventory")
      .select("*")
      .order("date", { ascending: false })
      .range(offset, offset + limit) // one extra row, used only to detect hasMore
  );
  const page = rows ?? [];
  // Apps Script's dailyInventory rows used `location`, not `location_id`,
  // for the day's location reference (its own inconsistency with the
  // locations table's own `location_id` field) — matched here rather
  // than touched in every view that already reads `.location`.
  const mapped = page.map(r => ({ ...r, location: r.location_id }));
  return { rows: mapped.slice(0, limit), hasMore: mapped.length > limit };
}

/**
 * Matches the shape Apps Script's `type=dailyInventoryItems` returned
 * ({status, items}) — every existing call site expects exactly this.
 * @param {string} date
 * @param {string} location
 * @returns {Promise<{status: "OPEN"|"CLOSED"|null, items: DailyInventoryItemRow[]}>}
 */
export async function getDailyInventoryItems(date, location) {
  const days = await withRetry(() =>
    supabase.from("daily_inventory").select("id, status").eq("date", date).eq("location_id", location)
  );
  const day = (days ?? [])[0];
  if (!day) return { status: null, items: [] };

  const rows = await withRetry(() =>
    supabase
      .from("daily_inventory_items")
      .select("item_id, qty_added, remaining, inventory_items(item_name)")
      .eq("daily_inventory_id", day.id)
  );

  const items = (rows ?? []).map(r => ({
    item_id: r.item_id,
    // @ts-ignore — PostgREST embeds the related row under the table name
    item_name: r.inventory_items?.item_name ?? r.item_id,
    qty_added: Number(r.qty_added) || 0,
    remaining: Number(r.remaining) || 0
  }));

  return { status: day.status, items };
}

/**
 * @param {string} date
 * @param {string} location
 * @param {string} createdBy
 * @param {{item_id: string, qty: number}[] | null} carryItems
 */
export async function startInventoryDay(date, location, createdBy, carryItems) {
  const { data, error } = await supabase.rpc("start_inventory_day", {
    p_date: date,
    p_location: location,
    p_created_by: createdBy,
    p_carry_items: carryItems && carryItems.length ? carryItems : null
  });
  if (error) throw new Error(error.message);
  return data;
}

/** @param {string} date @param {string} location */
export async function closeInventoryDay(date, location) {
  const { data, error } = await supabase.rpc("close_inventory_day", { p_date: date, p_location: location });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * @param {string} date
 * @param {string} location
 * @param {string} createdBy
 * @param {{item_id: string, qty: number}[]} items
 */
export async function addDailyInventory(date, location, createdBy, items) {
  const { data, error } = await supabase.rpc("add_daily_inventory", {
    p_date: date,
    p_location: location,
    p_created_by: createdBy,
    p_items: items
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Matches Apps Script's `type=pettyCashSummary` shape — derived from
 * daily_inventory + expenses rather than stored, since Phase 2 never
 * denormalized remaining_petty_cash onto the day row itself.
 * @param {string} date
 * @param {string} location
 */
export async function getPettyCashSummary(date, location) {
  const days = await withRetry(() =>
    supabase.from("daily_inventory").select("id, petty_cash_fund").eq("date", date).eq("location_id", location)
  );
  const day = (days ?? [])[0];
  if (!day) return { success: false, error: "No inventory day found for today" };

  const expenseRows = await withRetry(() =>
    supabase.from("expenses").select("id, description, amount, remarks").eq("daily_inventory_id", day.id)
  );
  const expenses = expenseRows ?? [];
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return {
    success: true,
    daily_id: day.id,
    petty_cash_fund: Number(day.petty_cash_fund) || 0,
    expenses,
    total_expenses: totalExpenses,
    remaining_petty_cash: (Number(day.petty_cash_fund) || 0) - totalExpenses
  };
}

/** @param {number} dailyId @param {number} pettyCashFund */
export async function updateDailyFinance(dailyId, pettyCashFund) {
  const { data, error } = await supabase.rpc("update_daily_finance", {
    p_daily_id: dailyId,
    p_petty_cash_fund: pettyCashFund
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * @param {number} dailyId
 * @param {string} description
 * @param {number} amount
 * @param {string} remarks
 */
export async function addExpense(dailyId, description, amount, remarks) {
  const { data, error } = await supabase.rpc("add_expense", {
    p_daily_id: dailyId,
    p_description: description,
    p_amount: amount,
    p_remarks: remarks
  });
  if (error) throw new Error(error.message);
  return data;
}
