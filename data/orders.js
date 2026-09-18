// @ts-check
import { supabase } from "../supabase-config.js";
import { withRetry } from "./_shared.js";

/**
 * @typedef {Object} OrderLineForDisplay
 * @property {string} order_item_id
 * @property {string} product_name
 * @property {number} qty
 * @property {number} total
 * @property {boolean} gcash_payment
 * @property {boolean} voided
 * @property {boolean} restored
 */

/**
 * @typedef {Object} OrderForDisplay
 * @property {string} ref_id
 * @property {string} datetime
 * @property {number} total
 * @property {string} location
 * @property {string} cashier
 * @property {OrderLineForDisplay[]} items
 */

/**
 * Checkout — used both for an online, immediate checkout and for
 * replaying a queued offline order. Deliberately does NOT throw for a
 * definite server-side rejection (insufficient stock, day closed,
 * ...) — it returns {success:false, error} instead, same contract
 * checkoutPOS()/syncPendingOrders() already branch on in order.js, so
 * the offline queue can keep telling "the server said no" (move to
 * failedOrders, never retried) apart from "the request never made it
 * there at all" (stays queued for retry) — this DOES throw for that
 * second case, matching what a failed fetch() used to do.
 * @param {string} refId
 * @param {string} staffId
 * @param {string} location
 * @param {{product_id: string, qty: number, price: number, total: number}[]} items
 * @param {Record<string, unknown>} payment
 */
export async function checkoutOrder(refId, staffId, location, items, payment) {
  const { data, error } = await supabase.rpc("checkout_order", {
    p_ref_id: refId,
    p_staff_id: staffId,
    p_location: location,
    p_items: items,
    p_payment: payment
  });

  if (error) {
    // error.code present means Postgres/PostgREST actually answered
    // (a real rejection, e.g. our own RAISE EXCEPTION) — no code means
    // the request never completed (genuine network failure).
    if (error.code) return { success: false, error: error.message };
    throw new Error(error.message);
  }

  return data;
}

/**
 * @param {number} orderItemId
 * @param {boolean} restore
 */
export async function voidOrderItem(orderItemId, restore) {
  const { data, error } = await supabase.rpc("void_order_item", {
    p_order_item_id: orderItemId,
    p_restore: restore
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Matches Apps Script's `type=dailySalesReport` shape exactly — used by
 * both the POS's own "Today's Sales" and the admin's transaction list /
 * live sales feed. Pass `location` to scope to one location (the POS
 * always does); omit it for the dashboard's cross-location live feed.
 * @param {string} date
 * @param {string} [location]
 * @returns {Promise<OrderForDisplay[]>}
 */
export async function listTodaySales(date, location) {
  let query = supabase
    .from("orders")
    .select("ref_id, created_at, total_bill, location_id, staff_id, gcash_payment, order_items(id, product_id, qty, total, voided, restored, products(product_name))")
    .eq("order_date", date)
    .order("created_at", { ascending: false });
  if (location) query = query.eq("location_id", location);

  const rows = await withRetry(() => query);

  // gcash_payment lives on the order, not the line, in this schema —
  // Apps Script duplicated it onto every item, so every existing view
  // that reads item.gcash_payment keeps working unchanged.
  return (rows ?? []).map(o => ({
    ref_id: o.ref_id,
    datetime: o.created_at,
    total: Number(o.total_bill) || 0,
    location: o.location_id,
    cashier: o.staff_id,
    items: (o.order_items ?? []).map(i => ({
      order_item_id: String(i.id),
      // @ts-ignore — PostgREST embeds the related row under the table name
      product_name: i.products?.product_name ?? i.product_id,
      qty: Number(i.qty) || 0,
      total: Number(i.total) || 0,
      gcash_payment: o.gcash_payment,
      voided: i.voided,
      restored: i.restored
    }))
  }));
}

/**
 * All-locations aggregate for a single date — matches
 * `type=dailySalesAnalytics`, which never took a location param either.
 * @param {string} date
 */
export async function getDailySalesAnalytics(date) {
  const rows = await withRetry(() =>
    supabase.from("orders").select("total_bill").eq("order_date", date)
  );
  const orders = rows ?? [];
  const gross = orders.reduce((sum, o) => sum + (Number(o.total_bill) || 0), 0);
  return {
    gross,
    orders: orders.length,
    average: orders.length ? gross / orders.length : 0
  };
}

/** @param {string} date */
export async function getTopSellers(date) {
  const rows = await withRetry(() =>
    supabase
      .from("order_items")
      .select("qty, total, product_id, voided, products(product_name), orders!inner(order_date)")
      .eq("orders.order_date", date)
      .eq("voided", false)
  );

  /** @type {Record<string, {product_name: string, qty_sold: number, total_sales: number}>} */
  const byProduct = {};
  for (const row of rows ?? []) {
    const key = row.product_id;
    // @ts-ignore
    const name = row.products?.product_name ?? row.product_id;
    byProduct[key] ??= { product_name: name, qty_sold: 0, total_sales: 0 };
    byProduct[key].qty_sold += Number(row.qty) || 0;
    byProduct[key].total_sales += Number(row.total) || 0;
  }

  return Object.values(byProduct).sort((a, b) => b.qty_sold - a.qty_sold);
}

/**
 * Items at or below their reorder level, across every location's
 * currently-open day for the given date — matches `type=lowStockAlerts`,
 * which took no location param.
 * @param {string} date
 */
export async function getLowStockAlerts(date) {
  const days = await withRetry(() =>
    supabase.from("daily_inventory").select("id").eq("date", date)
  );
  const dayIds = (days ?? []).map(d => d.id);
  if (!dayIds.length) return [];

  const rows = await withRetry(() =>
    supabase
      .from("daily_inventory_items")
      .select("remaining, inventory_items!inner(item_name, reorder_level)")
      .in("daily_inventory_id", dayIds)
  );

  return (rows ?? [])
    // @ts-ignore
    .filter(r => Number(r.remaining) <= Number(r.inventory_items?.reorder_level ?? 0))
    .map(r => ({
      // @ts-ignore
      item_name: r.inventory_items?.item_name,
      remaining: Number(r.remaining) || 0
    }));
}

/**
 * Rough days-of-stock-remaining estimate: average daily consumption
 * (qty_added - remaining) over each item's last 7 CLOSED days, applied
 * to its current remaining stock. Apps Script's own formula isn't
 * visible to compare against (Code.gs can't be read directly) — this is
 * a reasonable, clearly-scoped estimate, not a guaranteed match.
 * @param {string} date
 */
export async function getStockDaysRemaining(date) {
  const recentDays = await withRetry(() =>
    supabase
      .from("daily_inventory")
      .select("id, date")
      .eq("status", "CLOSED")
      .lte("date", date)
      .order("date", { ascending: false })
      .limit(7)
  );
  const dayIds = (recentDays ?? []).map(d => d.id);

  const todayDay = await withRetry(() =>
    supabase.from("daily_inventory").select("id").eq("date", date)
  );
  const todayIds = (todayDay ?? []).map(d => d.id);
  if (!todayIds.length) return [];

  const [historyRows, todayRows] = await Promise.all([
    dayIds.length
      ? withRetry(() =>
          supabase
            .from("daily_inventory_items")
            .select("item_id, qty_added, remaining, inventory_items(item_name, unit)")
            .in("daily_inventory_id", dayIds)
        )
      : Promise.resolve([]),
    withRetry(() =>
      supabase
        .from("daily_inventory_items")
        .select("item_id, remaining, inventory_items(item_name, unit)")
        .in("daily_inventory_id", todayIds)
    )
  ]);

  /** @type {Record<string, {consumed: number, days: number}>} */
  const consumption = {};
  for (const row of historyRows ?? []) {
    const c = Number(row.qty_added) - Number(row.remaining);
    consumption[row.item_id] ??= { consumed: 0, days: 0 };
    consumption[row.item_id].consumed += Math.max(0, c);
    consumption[row.item_id].days += 1;
  }

  return (todayRows ?? [])
    .map(row => {
      const hist = consumption[row.item_id];
      const avgDaily = hist && hist.days ? hist.consumed / hist.days : 0;
      const remaining = Number(row.remaining) || 0;
      const days = avgDaily > 0 ? remaining / avgDaily : Infinity;
      return {
        // @ts-ignore
        name: row.inventory_items?.item_name ?? row.item_id,
        remaining,
        // @ts-ignore
        unit: row.inventory_items?.unit ?? "",
        days
      };
    })
    .filter(r => Number.isFinite(r.days))
    .sort((a, b) => a.days - b.days);
}

/**
 * Matches `type=dailySalesReportSummary`'s shape. Beginning/ending stock
 * come from daily_inventory_items (already migrated); sales totals are
 * computed from orders for that date+location.
 * @param {string} date
 * @param {string} location
 */
export async function getDailySalesReportSummary(date, location) {
  const days = await withRetry(() =>
    supabase.from("daily_inventory").select("id, petty_cash_fund").eq("date", date).eq("location_id", location)
  );
  const day = (days ?? [])[0];
  if (!day) return { success: false, error: "No inventory day found for that date" };

  const [itemRows, orderRows, expenseRows] = await Promise.all([
    withRetry(() =>
      supabase
        .from("daily_inventory_items")
        .select("qty_added, remaining, inventory_items(item_name, unit, quantity_per_serving)")
        .eq("daily_inventory_id", day.id)
    ),
    withRetry(() =>
      supabase.from("orders").select("total_bill, gcash_payment").eq("order_date", date).eq("location_id", location)
    ),
    withRetry(() =>
      supabase.from("expenses").select("amount").eq("daily_inventory_id", day.id)
    )
  ]);

  const orders = orderRows ?? [];
  const totalSales = orders.reduce((sum, o) => sum + (Number(o.total_bill) || 0), 0);
  const gcashPayment = orders.filter(o => o.gcash_payment).reduce((sum, o) => sum + (Number(o.total_bill) || 0), 0);
  const cashSales = totalSales - gcashPayment;
  const totalExpenses = (expenseRows ?? []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const pettyCashFund = Number(day.petty_cash_fund) || 0;

  const items = (itemRows ?? []).map(i => {
    // @ts-ignore
    const perServing = Number(i.inventory_items?.quantity_per_serving) || 0;
    return {
      // @ts-ignore
      item_name: i.inventory_items?.item_name,
      // @ts-ignore
      unit: i.inventory_items?.unit ?? "",
      beginning_stock: Number(i.qty_added) || 0,
      beginning_yield: (Number(i.qty_added) || 0) * perServing,
      ending_stock: Number(i.remaining) || 0,
      ending_yield: (Number(i.remaining) || 0) * perServing
    };
  });

  return {
    success: true,
    petty_cash_fund: pettyCashFund,
    cash_on_hand: pettyCashFund + cashSales - totalExpenses,
    total_sales: totalSales,
    gcash_payment: gcashPayment,
    items
  };
}

/**
 * Itemized expenses for one day — the equivalent slice of
 * `type=salesExpensesMonth` that views/dailySales.js picks out client
 * side; done here as a direct per-day query instead, since there's no
 * reason to fetch a whole month to read one day once expenses live in
 * their own table.
 * @param {string} date
 * @param {string} location
 */
export async function getDayExpenses(date, location) {
  const days = await withRetry(() =>
    supabase.from("daily_inventory").select("id").eq("date", date).eq("location_id", location)
  );
  const day = (days ?? [])[0];
  if (!day) return [];

  const rows = await withRetry(() =>
    supabase.from("expenses").select("description, amount, remarks").eq("daily_inventory_id", day.id)
  );
  return rows ?? [];
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Mirrors `views/salesExpensesTracker.js`'s own `getBusinessWeeks` exactly
 * (Monday-start, 6-day Mon–Sat weeks, keeping a week iff its Monday falls
 * in the target month even when the Saturday rolls into the next one) —
 * this runs in the same browser/local-timezone context as that view, so
 * plain local-`Date` arithmetic is correct here (unlike the Node backfill
 * scripts, which needed pure-UTC arithmetic instead).
 * @param {string} month - "YYYY-MM"
 */
function getBusinessWeeks(month) {
  const [year, mo] = month.split("-").map(Number);
  const monthIndex = mo - 1;
  const weeks = [];
  const cursor = new Date(year, monthIndex, 1);
  const offset = (1 - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + offset);
  while (cursor.getMonth() === monthIndex) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + 5);
    weeks.push({ start, end });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

/** @param {Date} d */
function fmtLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Matches `views/salesExpensesTracker.js`'s expected `payroll_weeks` shape:
 * one entry per business week in the month, each with a per-staff
 * attendance row (`mon`..`sat` booleans + `weekly_total` = rate × days
 * worked) and that week's itemized deductions.
 * @param {string} month - "YYYY-MM"
 * @param {string} location
 */
async function getPayrollWeeks(month, location) {
  const weeks = getBusinessWeeks(month);
  if (!weeks.length) return [];

  const weekDayDates = weeks.map(w =>
    DAY_KEYS.map((_, i) => {
      const d = new Date(w.start);
      d.setDate(d.getDate() + i);
      return fmtLocalDate(d);
    })
  );
  const weekStartStrs = weeks.map(w => fmtLocalDate(w.start));
  const rangeStart = weekStartStrs[0];
  const rangeEnd = fmtLocalDate(weeks[weeks.length - 1].end);

  const staffRows = await withRetry(() =>
    supabase.from("staff").select("staff_id, first_name, last_name, rate").eq("location_id", location).eq("active", true).order("last_name")
  );
  const staffList = staffRows ?? [];
  const staffIds = staffList.map(s => s.staff_id);

  const [attendanceRows, deductionRows] = await Promise.all([
    staffIds.length
      ? withRetry(() =>
          supabase
            .from("attendance_records")
            .select("staff_id, date, clock_in_time")
            .in("staff_id", staffIds)
            .gte("date", rangeStart)
            .lte("date", rangeEnd)
        )
      : Promise.resolve([]),
    withRetry(() =>
      supabase
        .from("payroll_deductions")
        .select("deduction_id, week_start_date, staff_id, amount, notes")
        .eq("location_id", location)
        .in("week_start_date", weekStartStrs)
    )
  ]);

  /** @type {Record<string, Set<string>>} staff_id -> set of dates worked */
  const workedByStaff = {};
  for (const a of attendanceRows ?? []) {
    if (!a.clock_in_time) continue;
    (workedByStaff[a.staff_id] ??= new Set()).add(a.date);
  }

  /** @type {Record<string, {first_name: string, last_name: string}>} */
  const staffMap = {};
  for (const s of staffList) staffMap[s.staff_id] = s;

  /** @type {Record<string, {deduction_id: string, staff_id: string, first_name: string, last_name: string, amount: number, notes: string}[]>} */
  const deductionsByWeek = {};
  for (const dd of deductionRows ?? []) {
    const staff = staffMap[dd.staff_id];
    (deductionsByWeek[dd.week_start_date] ??= []).push({
      deduction_id: dd.deduction_id,
      staff_id: dd.staff_id,
      first_name: staff?.first_name ?? "",
      last_name: staff?.last_name ?? "",
      amount: Number(dd.amount) || 0,
      notes: dd.notes ?? ""
    });
  }

  return weeks.map((w, wi) => {
    const dayDates = weekDayDates[wi];
    const weekStartStr = weekStartStrs[wi];
    const rows = staffList.map(s => {
      const worked = workedByStaff[s.staff_id] ?? new Set();
      /** @type {any} */
      const row = { staff_id: s.staff_id, first_name: s.first_name, last_name: s.last_name, rate: Number(s.rate) || 0 };
      let daysWorked = 0;
      DAY_KEYS.forEach((k, i) => {
        const didWork = worked.has(dayDates[i]);
        row[k] = didWork;
        if (didWork) daysWorked++;
      });
      row.weekly_total = row.rate * daysWorked;
      return row;
    });
    return { week_start_date: weekStartStr, rows, deductions: deductionsByWeek[weekStartStr] || [] };
  });
}

/**
 * @param {string} weekStartDate
 * @param {string} location
 * @param {string} staffId
 * @param {number} amount
 * @param {string} notes
 */
export async function addPayrollDeduction(weekStartDate, location, staffId, amount, notes) {
  const deduction_id = `PRDD-${Date.now()}`;
  const saved = await withRetry(() =>
    supabase
      .from("payroll_deductions")
      .insert({ deduction_id, week_start_date: weekStartDate, location_id: location, staff_id: staffId, amount, notes })
      .select()
      .single()
  );
  if (!saved) throw new Error("Supabase insert returned no row");
  return saved;
}

/** @param {string} deductionId */
export async function deletePayrollDeduction(deductionId) {
  await withRetry(() => supabase.from("payroll_deductions").delete().eq("deduction_id", deductionId));
}

/**
 * Matches `type=salesExpensesMonth`'s shape — one row per day in the
 * month with its Cash/GCash sales split, petty cash, and itemized
 * expenses, plus `payroll_weeks` (attendance-derived payroll + itemized
 * deductions per business week). Queries run in parallel, not one per day.
 * @param {string} month - "YYYY-MM"
 * @param {string} location
 */
export async function getSalesExpensesMonth(month, location) {
  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const nextMonthStart = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  const days = await withRetry(() =>
    supabase
      .from("daily_inventory")
      .select("id, date, status, petty_cash_fund")
      .eq("location_id", location)
      .gte("date", monthStart)
      .lt("date", nextMonthStart)
      .order("date", { ascending: true })
  );
  const dayRows = days ?? [];
  if (!dayRows.length) {
    return { success: true, month, location, days: [], payroll_weeks: await getPayrollWeeks(month, location) };
  }

  const dayIds = dayRows.map(d => d.id);

  const [orderRows, expenseRows, payrollWeeks] = await Promise.all([
    withRetry(() =>
      supabase
        .from("orders")
        .select("order_date, total_bill, gcash_payment")
        .eq("location_id", location)
        .gte("order_date", monthStart)
        .lt("order_date", nextMonthStart)
    ),
    withRetry(() =>
      supabase.from("expenses").select("daily_inventory_id, description, amount, remarks").in("daily_inventory_id", dayIds)
    ),
    getPayrollWeeks(month, location)
  ]);

  /** @type {Record<string, {cash: number, gcash: number}>} */
  const salesByDate = {};
  for (const o of orderRows ?? []) {
    salesByDate[o.order_date] ??= { cash: 0, gcash: 0 };
    if (o.gcash_payment) salesByDate[o.order_date].gcash += Number(o.total_bill) || 0;
    else salesByDate[o.order_date].cash += Number(o.total_bill) || 0;
  }

  /** @type {Record<number, {description: string, amount: number, remarks: string}[]>} */
  const expensesByDayId = {};
  for (const e of expenseRows ?? []) {
    (expensesByDayId[e.daily_inventory_id] ??= []).push({
      description: e.description,
      amount: Number(e.amount) || 0,
      remarks: e.remarks
    });
  }

  const dayResults = dayRows.map(d => {
    const sales = salesByDate[d.date] || { cash: 0, gcash: 0 };
    const expenses = expensesByDayId[d.id] || [];
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const pettyCashFund = Number(d.petty_cash_fund) || 0;
    return {
      date: d.date,
      daily_id: d.id,
      status: d.status,
      cash_sales: sales.cash,
      gcash_sales: sales.gcash,
      petty_cash_fund: pettyCashFund,
      total_expenses: totalExpenses,
      remaining_petty_cash: pettyCashFund - totalExpenses,
      expenses
    };
  });

  return { success: true, month, location, days: dayResults, payroll_weeks: payrollWeeks };
}

/**
 * @typedef {Object} FailedCheckoutAttempt
 * @property {number} id
 * @property {string} ref_id
 * @property {string} staff_id
 * @property {string} location_id
 * @property {{product_id: string, qty: number, price: number, total: number}[]} items
 * @property {Record<string, unknown>} payment
 * @property {string} error
 * @property {string} created_at
 */

/**
 * Mirrors a checkout failure server-side, for cross-device admin
 * visibility — the actual retry/local-review mechanism stays the
 * localStorage pendingOrders/failedOrders queue in order.js; this is
 * purely so an admin on a different device can see it too. Deliberately
 * doesn't throw on failure — this is a best-effort side record, never
 * something that should block or mask the checkout flow's own handling.
 * @param {string} refId
 * @param {string} staffId
 * @param {string} location
 * @param {{product_id: string, qty: number, price: number, total: number}[]} items
 * @param {Record<string, unknown>} payment
 * @param {string} error
 */
export async function recordFailedCheckout(refId, staffId, location, items, payment, error) {
  const { error: rpcErr } = await supabase.rpc("record_failed_checkout", {
    p_ref_id: refId,
    p_staff_id: staffId,
    p_location: location,
    p_items: items,
    p_payment: payment,
    p_error: error
  });
  if (rpcErr) throw new Error(rpcErr.message);
}

/** @returns {Promise<FailedCheckoutAttempt[]>} */
export async function listUnresolvedFailedCheckouts() {
  const rows = await withRetry(() =>
    supabase
      .from("failed_checkout_attempts")
      .select("*")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
  );
  return rows ?? [];
}

/**
 * @param {number} id
 * @param {string} resolvedBy
 */
export async function resolveFailedCheckout(id, resolvedBy) {
  const { error } = await supabase.rpc("resolve_failed_checkout", {
    p_id: id,
    p_resolved_by: resolvedBy
  });
  if (error) throw new Error(error.message);
}
