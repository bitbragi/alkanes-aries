// Rate-limit enforcement: per-customer (req/min + daily) and a GLOBAL outbound
// Subfrost self-throttle. Both ride Unkey's standalone ratelimit buckets.
import { rateCheck } from "./unkey.js";
import { log } from "./log.js";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000; // rolling 24h window (not calendar-day; avoids midnight double-spend)

// ── Per-customer enforcement (Phase 2) ──────────────────────────────────────
// Counted per inbound MCP request, identified by the customer's keyId.

export type CustomerVerdict =
  | { ok: true }
  | { ok: false; which: "req/min" | "daily"; reset: number };

/**
 * Enforce the customer's req/min then daily cap. Order matters: a request blocked
 * by req/min does NOT consume from the daily bucket. Each bucket consumes 1.
 */
export async function enforceCustomerLimits(
  identifier: string,
  reqPerMin: number,
  dailyCap: number,
): Promise<CustomerVerdict> {
  const rpm = await rateCheck("aries:rpm", identifier, reqPerMin, MINUTE);
  if (!rpm.success) return { ok: false, which: "req/min", reset: rpm.reset };

  const daily = await rateCheck("aries:daily", identifier, dailyCap, DAY);
  if (!daily.success) return { ok: false, which: "daily", reset: daily.reset };

  return { ok: true };
}

// ── Per-key incident-submission flood-stop ──────────────────────────────────
// Collection is aggressive (Aries actively solicits reports), so cap how fast a
// single key can fill the PENDING queue. Lenient by design — a flood-stop, not a
// throttle — and on its own namespace so it never touches the request budget.

function submissionCap(): number {
  const v = Number(process.env.ARIES_INCIDENT_SUBMIT_CAP);
  return Number.isFinite(v) && v > 0 ? v : 60; // submissions per key per hour
}

/** Consume 1 from the per-key incident-submission bucket. Fails open on infra error. */
export async function enforceSubmissionLimit(
  identifier: string,
): Promise<{ ok: boolean; reset: number }> {
  const r = await rateCheck("aries:incident:submit", identifier, submissionCap(), HOUR);
  return { ok: r.success, reset: r.reset };
}

// ── Global Subfrost self-throttle (Phase 3) ─────────────────────────────────
// Counts ACTUAL outbound Subfrost calls (hooked in rpc.ts) into ONE shared
// bucket so total Aries→Subfrost stays well under Flex's 50M/day Business quota.
// Ceilings are env-tunable (no rebuild needed; set tiny for live tests).

const GLOBAL_ID = "global";

function subfrostDailyCap(): number {
  const v = Number(process.env.GLOBAL_SUBFROST_DAILY_CAP);
  return Number.isFinite(v) && v > 0 ? v : 30_000_000; // 60% of 50M, headroom for Bragi + safety
}
function subfrostRpm(): number {
  const v = Number(process.env.GLOBAL_SUBFROST_RPM);
  return Number.isFinite(v) && v > 0 ? v : 500; // PLACEHOLDER per-minute aggregate backstop
}

/**
 * Thrown when the global Subfrost ceiling is hit; surfaced as a clean capacity
 * message. Both the message AND the class name are deliberately neutral — the
 * MCP layer can serialize the error name into tool output, so it must NOT reveal
 * the upstream (Subfrost) or that this is upstream-quota protection.
 */
export class CapacityError extends Error {
  constructor() {
    super("Service temporarily at capacity, please try again shortly.");
    this.name = "CapacityError";
  }
}

/**
 * Assert there is global Subfrost budget for ONE outbound call. Throws
 * CapacityError when a ceiling is hit, logging it PROMINENTLY (operator
 * signal: investigate / raise the cap). Should essentially never fire at launch.
 */
export async function assertSubfrostBudget(): Promise<void> {
  const rpm = await rateCheck("aries:subfrost:rpm", GLOBAL_ID, subfrostRpm(), MINUTE);
  if (!rpm.success) {
    log(`!!! GLOBAL SUBFROST CEILING HIT (rpm=${subfrostRpm()}/min) — refusing outbound call. Investigate / raise GLOBAL_SUBFROST_RPM.`);
    throw new CapacityError();
  }
  const daily = await rateCheck("aries:subfrost:daily", GLOBAL_ID, subfrostDailyCap(), DAY);
  if (!daily.success) {
    log(`!!! GLOBAL SUBFROST CEILING HIT (daily=${subfrostDailyCap()}/24h) — refusing outbound call. Investigate / raise GLOBAL_SUBFROST_DAILY_CAP.`);
    throw new CapacityError();
  }
}
