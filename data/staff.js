// @ts-check
import { supabase } from "../supabase-config.js";
import { withRetry } from "./_shared.js";

/**
 * @typedef {Object} StaffMember
 * @property {string} staff_id
 * @property {string} last_name
 * @property {string} first_name
 * @property {string} email
 * @property {string|null} location_id
 * @property {string} position
 * @property {string|null} start_date
 * @property {boolean} can_pos
 * @property {boolean} active
 * @property {number} rate
 * @property {string|null} credential_id
 */

/** @returns {Promise<StaffMember[]>} */
export async function listStaff() {
  const rows = await withRetry(() => supabase.from("staff").select("*").order("last_name"));
  return rows ?? [];
}

/**
 * Upsert — omit `staff_id` (or pass falsy) to create a new one.
 * @param {{staff_id?: string, last_name: string, first_name: string, position: string, location_id?: string, rate?: number, email?: string}} input
 * @returns {Promise<StaffMember>}
 */
export async function saveStaff(input) {
  const staff_id = input.staff_id || `STAFF-${Date.now()}`;
  const row = {
    staff_id,
    last_name: input.last_name,
    first_name: input.first_name,
    position: input.position,
    location_id: input.location_id || null,
    rate: Number(input.rate) || 0,
    ...(input.email !== undefined ? { email: input.email } : {})
  };
  const saved = await withRetry(() => supabase.from("staff").upsert(row).select().single());
  if (!saved) throw new Error("Supabase upsert returned no row");
  return saved;
}

/**
 * Soft delete (sets active=false) — matches the existing admin UI's own
 * "Deactivate" language for this action.
 * @param {string} staffId
 */
export async function deactivateStaff(staffId) {
  await withRetry(() => supabase.from("staff").update({ active: false }).eq("staff_id", staffId));
}
