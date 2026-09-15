// @ts-check
// Shared helper for every data/*.js module — not imported directly by
// views/order.js.

/**
 * Retries a Supabase call a few times on failure before giving up —
 * mirrors fetchJSONWithRetry (order.js/admin.js), applied here mostly as
 * cheap insurance: Supabase's hosted API doesn't share Apps Script's
 * quota/concurrency ceiling (the whole reason for this migration), but a
 * flaky tablet/mobile connection can still drop a request.
 *
 * Retries indiscriminately (doesn't distinguish "transient network blip"
 * from "RLS denied this" or "unique constraint violated") — a known
 * Phase 1 simplification. A permanent failure just costs a couple of
 * wasted retries (~1.6s) before surfacing, which is an acceptable
 * tradeoff for how rarely these writes happen.
 *
 * `data` is returned exactly as Supabase gives it back — `null` is a
 * legitimate, successful result for a delete/update call that never
 * asked for `.select()` back, not an error. Callers that need a
 * guaranteed value (reads, upserts with `.select().single()`) handle
 * that themselves — see the `?? []` / cast patterns in locations.js,
 * categories.js, etc. (an earlier version threw on any null here,
 * which was wrong: it made every delete/update call — which
 * legitimately returns null — look like a failure.)
 *
 * @template T
 * @param {() => PromiseLike<{data: T | null, error: {message: string} | null}>} fn
 * @param {number} [attempts]
 * @param {number} [delayMs]
 * @returns {Promise<T | null>}
 */
export async function withRetry(fn, attempts = 3, delayMs = 800) {
  /** @type {{message: string} | null} */
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await fn();
    if (!error) return data;
    lastErr = error;
    if (i < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(lastErr?.message || "Supabase request failed");
}
