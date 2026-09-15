// @ts-check
import { supabase } from "../supabase-config.js";
import { withRetry } from "./_shared.js";

/**
 * @typedef {Object} OpexItem
 * @property {string} opex_id
 * @property {string} item_name
 * @property {number} amount_month
 * @property {string} location_id
 */

/** @param {string} location @returns {Promise<{items: OpexItem[]}>} */
export async function listOpexItems(location) {
  const rows = await withRetry(() =>
    supabase.from("opex_items").select("*").eq("location_id", location).order("item_name")
  );
  return { items: rows ?? [] };
}

/**
 * @param {string} itemName
 * @param {number} amountMonth
 * @param {string} location
 */
export async function saveOpexItem(itemName, amountMonth, location) {
  const opex_id = `OPEX-${Date.now()}`;
  const saved = await withRetry(() =>
    supabase
      .from("opex_items")
      .insert({ opex_id, item_name: itemName, amount_month: amountMonth, location_id: location })
      .select()
      .single()
  );
  if (!saved) throw new Error("Supabase insert returned no row");
  return saved;
}

/** @param {string} opexId */
export async function deleteOpexItem(opexId) {
  await withRetry(() => supabase.from("opex_items").delete().eq("opex_id", opexId));
}
