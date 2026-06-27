// Shared Unkey client + low-level ratelimit helper.
//
// One memoized client serves both key verification (auth.ts) and the standalone
// ratelimit buckets (ratelimit.ts). Root key is env-only; never logged.
import { Unkey } from "@unkey/api";
import { log } from "./log.js";

let client: Unkey | null = null;

/** True only when both Unkey env vars are present (used for fail-closed auth). */
export function unkeyConfigured(): boolean {
  return Boolean(process.env.UNKEY_ROOT_KEY && process.env.UNKEY_API_ID);
}

/** Lazily build (and memoize) the Unkey client from env. null if no root key. */
export function unkeyClient(): Unkey | null {
  if (client) return client;
  const rootKey = process.env.UNKEY_ROOT_KEY;
  if (!rootKey) return null;
  client = new Unkey({ rootKey });
  return client;
}

export interface RateResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // unix ms when the window resets (for Retry-After)
}

/**
 * Check (and consume 1 from) one Unkey ratelimit bucket.
 *
 * FAIL OPEN on infra error: rate limiting is a soft control, and AUTH already
 * gates every request on Unkey availability upstream (a request only reaches a
 * ratelimit check after its key verified against the same Unkey). So a transient
 * ratelimit hiccup should not take the service down — we allow and log.
 *
 * Note: Unkey's ratelimiter is optimistic and may allow a brief burst (~+1)
 * beyond `limit` under rapid succession before it denies steadily. Immaterial at
 * production cap sizes; documented so the boundary isn't mistaken for a bug.
 */
export async function rateCheck(
  namespace: string,
  identifier: string,
  limit: number,
  duration: number,
): Promise<RateResult> {
  const uk = unkeyClient();
  if (!uk) return { success: true, limit, remaining: limit, reset: 0 };
  try {
    const res = await uk.ratelimit.limit({ namespace, identifier, limit, duration });
    const d = res.data;
    return { success: d.success, limit: d.limit, remaining: d.remaining, reset: d.reset };
  } catch (err) {
    log("ratelimit infra error (fail-open):", namespace, err instanceof Error ? err.message : String(err));
    return { success: true, limit, remaining: limit, reset: 0 };
  }
}
