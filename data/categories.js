// @ts-check
import { supabase } from "../supabase-config.js";
import { withRetry } from "./_shared.js";

/**
 * @typedef {Object} Category
 * @property {string} category_id
 * @property {string} category_name
 */

/** @returns {Promise<Category[]>} */
export async function listCategories() {
  const rows = await withRetry(() =>
    supabase.from("categories").select("*").order("category_name")
  );
  return rows ?? [];
}

/**
 * Upsert — omit `category_id` (or pass falsy) to create a new one.
 * @param {{category_id?: string, category_name: string}} input
 * @returns {Promise<Category>}
 */
export async function saveCategory(input) {
  const category_id = input.category_id || `CAT-${Date.now()}`;
  const row = { category_id, category_name: input.category_name };
  const saved = await withRetry(() =>
    supabase.from("categories").upsert(row).select().single()
  );
  if (!saved) throw new Error("Supabase upsert returned no row");
  return saved;
}

/**
 * Hard delete — products referencing this category fall back to
 * Uncategorized via the migration's `ON DELETE SET NULL`, matching the
 * existing admin UI's own stated behavior for this action.
 * @param {string} categoryId
 */
export async function deleteCategory(categoryId) {
  await withRetry(() =>
    supabase.from("categories").delete().eq("category_id", categoryId)
  );
}
