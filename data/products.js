// @ts-check
import { supabase } from "../supabase-config.js";
import { withRetry } from "./_shared.js";

/**
 * @typedef {Object} Product
 * @property {string} product_id
 * @property {string} product_code
 * @property {string} product_name
 * @property {string|null} category_id
 * @property {string} description
 * @property {number} price
 * @property {string} image_url
 * @property {boolean} active
 */

/**
 * @typedef {Object} RecipeLine
 * @property {string} item_id
 * @property {number} qty_used
 */

/** @returns {Promise<Product[]>} */
export async function listProducts() {
  const rows = await withRetry(() =>
    supabase.from("products").select("*").order("product_code")
  );
  return rows ?? [];
}

/**
 * Mirrors the shape Apps Script's `type=allProductRecipes` already
 * returned (product_id -> recipe lines) — order.js and
 * views/categoriesProducts.js consume exactly this grouping, so this
 * swap needs no rendering-code changes.
 * @returns {Promise<Record<string, RecipeLine[]>>}
 */
export async function listAllRecipes() {
  const rows = await withRetry(() =>
    supabase.from("product_ingredients").select("product_id, item_id, qty_used")
  );
  /** @type {Record<string, RecipeLine[]>} */
  const grouped = {};
  for (const row of rows ?? []) {
    (grouped[row.product_id] ??= []).push({
      item_id: row.item_id,
      qty_used: Number(row.qty_used) || 0
    });
  }
  return grouped;
}

/**
 * Upserts the product row, then replaces its recipe entirely
 * (delete-then-insert) — matches `saveProduct`'s existing all-or-nothing
 * nested-recipe submission in views/categoriesProducts.js. Not wrapped
 * in a DB transaction for Phase 1 (a rare admin-only edit, same
 * practical risk as today's two-sheet-writes-in-a-row Apps Script
 * behavior) — can be hardened into a Postgres RPC function later.
 * @param {{product_id?: string, product_code: string, product_name: string, category_id?: string|null, description?: string, price: number, image_url?: string}} product
 * @param {RecipeLine[]} recipe
 * @returns {Promise<Product>}
 */
export async function saveProduct(product, recipe) {
  const product_id = product.product_id || `PROD-${Date.now()}`;
  const row = {
    product_id,
    product_code: product.product_code,
    product_name: product.product_name,
    category_id: product.category_id || null,
    description: product.description || "",
    price: Number(product.price) || 0,
    image_url: product.image_url || ""
  };

  const saved = await withRetry(() =>
    supabase.from("products").upsert(row).select().single()
  );
  if (!saved) throw new Error("Supabase upsert returned no row");

  await withRetry(() =>
    supabase.from("product_ingredients").delete().eq("product_id", product_id)
  );

  if (recipe.length) {
    await withRetry(() =>
      supabase.from("product_ingredients").insert(
        recipe.map(r => ({
          product_id,
          item_id: r.item_id,
          qty_used: Number(r.qty_used) || 0
        }))
      )
    );
  }

  return saved;
}

/**
 * Hard delete — cascades to product_ingredients (`ON DELETE CASCADE`).
 * @param {string} productId
 */
export async function deleteProduct(productId) {
  await withRetry(() =>
    supabase.from("products").delete().eq("product_id", productId)
  );
}

/**
 * @param {string} productId
 * @param {boolean} active
 */
export async function toggleProductStatus(productId, active) {
  await withRetry(() =>
    supabase.from("products").update({ active }).eq("product_id", productId)
  );
}
