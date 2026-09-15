// @ts-check
import { supabase } from "../supabase-config.js";
import { withRetry } from "./_shared.js";

/**
 * @typedef {Object} Location
 * @property {string} location_id
 * @property {string} location_name
 * @property {string} address
 * @property {boolean} active
 */

/** @returns {Promise<Location[]>} */
export async function listLocations() {
  const rows = await withRetry(() =>
    supabase.from("locations").select("*").order("location_name")
  );
  return rows ?? [];
}

/**
 * Upsert — omit `location_id` (or pass falsy) to create a new one.
 * @param {{location_id?: string, location_name: string, address?: string}} input
 * @returns {Promise<Location>}
 */
export async function saveLocation(input) {
  const location_id = input.location_id || `LOC-${Date.now()}`;
  const row = {
    location_id,
    location_name: input.location_name,
    address: input.address || ""
  };
  const saved = await withRetry(() =>
    supabase.from("locations").upsert(row).select().single()
  );
  if (!saved) throw new Error("Supabase upsert returned no row");
  return saved;
}

/**
 * Soft delete (sets active=false), not a hard DELETE — matches the
 * existing admin UI's own description of this action ("Staff already
 * assigned here keep their assignment"), which only makes sense if the
 * row survives.
 * @param {string} locationId
 */
export async function deleteLocation(locationId) {
  await withRetry(() =>
    supabase.from("locations").update({ active: false }).eq("location_id", locationId)
  );
}
