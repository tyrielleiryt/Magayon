// @ts-check
import { supabase } from "../supabase-config.js";
import { withRetry } from "./_shared.js";

/**
 * Apps Script returned clock_in_time/clock_out_time as pre-formatted PH
 * time strings ("8:03 AM"), not timestamps — every view just prints
 * `s.clock_in_time` directly with no formatting of its own. Matched here
 * rather than touched in every view that reads it.
 * @param {string | null} isoTimestamp
 * @returns {string | null}
 */
function formatPHTime(isoTimestamp) {
  if (!isoTimestamp) return null;
  return new Date(isoTimestamp).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

/**
 * Matches `type=clockInKioskData`'s shape. Works for both the
 * no-login kiosk screen (anonymous Firebase session) and a signed-in
 * cashier's own Clock In/Out modal — same RPC either way.
 * @returns {Promise<{success: boolean, staff: Array<{staff_id: string, name: string, location_name: string|null, enrolled: boolean, credential_id: string|null, status: string, clock_in_time: string|null, clock_out_time: string|null}>}>}
 */
export async function getStaffStatus() {
  const { data, error } = await supabase.rpc("get_staff_status");
  if (error) throw new Error(error.message);
  return {
    ...data,
    staff: (data.staff ?? []).map((/** @type {any} */ s) => ({
      ...s,
      clock_in_time: formatPHTime(s.clock_in_time),
      clock_out_time: formatPHTime(s.clock_out_time)
    }))
  };
}

/**
 * @param {string} staffId
 * @param {string} credentialId
 */
export async function enrollBiometric(staffId, credentialId) {
  const { data, error } = await supabase.rpc("enroll_biometric", {
    p_staff_id: staffId,
    p_credential_id: credentialId
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * @param {string} staffId
 * @param {"clockIn"|"clockOut"} action
 */
export async function clockInOut(staffId, action) {
  const { data, error } = await supabase.rpc("clock_in_out", {
    p_staff_id: staffId,
    p_action: action
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Matches `type=attendanceOverview`'s shape — every location, one date.
 * @param {string} date
 */
export async function getAttendanceOverview(date) {
  const rows = await withRetry(() =>
    supabase.from("attendance_records").select("staff_id, clock_in_time, clock_out_time").eq("date", date)
  );
  return {
    success: true,
    staff: (rows ?? []).map(r => ({
      staff_id: r.staff_id,
      clock_in_time: formatPHTime(r.clock_in_time),
      clock_out_time: formatPHTime(r.clock_out_time)
    }))
  };
}

/**
 * Matches `type=employeeDTR`'s shape.
 * @param {string} staffId
 * @param {string} startDate
 * @param {string} endDate
 */
export async function getEmployeeDTR(staffId, startDate, endDate) {
  const rows = await withRetry(() =>
    supabase
      .from("attendance_records")
      .select("date, clock_in_time, clock_out_time")
      .eq("staff_id", staffId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date")
  );
  return {
    success: true,
    records: (rows ?? []).map(r => ({
      date: r.date,
      clock_in_time: formatPHTime(r.clock_in_time),
      clock_out_time: formatPHTime(r.clock_out_time)
    }))
  };
}
