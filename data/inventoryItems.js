// @ts-check
import { supabase } from "../supabase-config.js";
import { withRetry } from "./_shared.js";

/**
 * @typedef {Object} InventoryItem
 * @property {string} item_id
 * @property {string} item_name
 * @property {string} description
 * @property {number} quantity_per_serving
 * @property {string} unit
 * @property {number} capital
 * @property {number} selling_price
 * @property {number} reorder_level
 * @property {boolean} active
 */

/** @returns {Promise<InventoryItem[]>} */
export async function listInventoryItems() {
  const rows = await withRetry(() =>
    supabase.from("inventory_items").select("*").order("item_name")
  );
  return rows ?? [];
}

/**
 * Upsert — omit `item_id` (or pass falsy) to create a new one.
 * @param {{item_id?: string, item_name: string, description?: string, quantity_per_serving?: number, unit?: string, capital?: number, selling_price?: number, reorder_level?: number}} input
 * @returns {Promise<InventoryItem>}
 */
export async function saveInventoryItem(input) {
  const item_id = input.item_id || `INV-${Date.now()}`;
  const row = {
    item_id,
    item_name: input.item_name,
    description: input.description || "",
    quantity_per_serving: Number(input.quantity_per_serving) || 0,
    unit: input.unit || "",
    capital: Number(input.capital) || 0,
    selling_price: Number(input.selling_price) || 0,
    reorder_level: Number(input.reorder_level) || 0
  };
  const saved = await withRetry(() =>
    supabase.from("inventory_items").upsert(row).select().single()
  );
  if (!saved) throw new Error("Supabase upsert returned no row");
  return saved;
}

/**
 * Hard delete — cascades to that item's product_ingredients rows (see
 * the Phase 1 migration's `ON DELETE CASCADE`), consistent with the
 * ingredient no longer existing.
 * @param {string} itemId
 */
export async function deleteInventoryItem(itemId) {
  await withRetry(() =>
    supabase.from("inventory_items").delete().eq("item_id", itemId)
  );
}
