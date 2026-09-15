// @ts-check
import { supabase } from "../supabase-config.js";
import { withRetry } from "./_shared.js";

/**
 * @typedef {Object} ChatMessage
 * @property {string} sender_role
 * @property {string} sender_id
 * @property {string} location_id
 * @property {string} message
 */

/**
 * Matches `type=chatMessages`'s shape — every message for one location,
 * oldest first. `location === "ALL"` (the admin panel's aggregate view
 * across every location — never a real `location_id`) skips the filter
 * entirely rather than matching a literal "ALL" row.
 * @param {string} location
 * @returns {Promise<ChatMessage[]>}
 */
export async function listChatMessages(location) {
  const rows = await withRetry(() => {
    let query = supabase
      .from("chat_messages")
      .select("sender_role, sender_id, location_id, message")
      .order("created_at", { ascending: true });
    if (location !== "ALL") query = query.eq("location_id", location);
    return query;
  });
  return rows ?? [];
}

/**
 * @param {string} senderRole
 * @param {string} senderId
 * @param {string} location
 * @param {string} message
 */
export async function sendChatMessage(senderRole, senderId, location, message) {
  const saved = await withRetry(() =>
    supabase
      .from("chat_messages")
      .insert({ sender_role: senderRole, sender_id: senderId, location_id: location, message })
      .select()
      .single()
  );
  if (!saved) throw new Error("Supabase insert returned no row");
  return saved;
}
