// Unkey-backed authorization for the hosted Aries MCP endpoint.
//
// A request presents `Authorization: Bearer <unkey_key>`; we verify it with
// Unkey and, on success, resolve the customer's TIER (+ any per-key limit
// overrides + the plugin-access flag) from the key's metadata. Per-customer
// rate-limit ENFORCEMENT happens in ratelimit.ts at the same seam.
//
// Secrets: UNKEY_ROOT_KEY / UNKEY_API_ID are env-only; the presented key, the
// root key, and the Subfrost key are never logged or echoed.
import type { IncomingMessage } from "node:http";
import { unkeyClient, unkeyConfigured } from "./unkey.js";
import { log } from "./log.js";

export { unkeyConfigured };

/**
 * The locked tier ladder. `slug` is the STABLE identifier stored in key metadata
 * (never rename without migrating keys). `display` is PROVISIONAL marketing copy
 * — swappable, and never used as a load-bearing identifier. Limits are MCP
 * requests per customer. `pluginIncluded` = the Aries plugin add-on is BUNDLED
 * with the tier (Production/Enterprise); for lower tiers the add-on is purchased
 * separately and lives in the per-key `pluginAccess` flag (see mint-key).
 */
export interface Tier {
  slug: string;
  display: string;
  reqPerMin: number;
  dailyCap: number;
  pluginIncluded: boolean;
}

export const TIERS: Record<string, Tier> = {
  free: { slug: "free", display: "Free", reqPerMin: 10, dailyCap: 150, pluginIncluded: false },
  hobby: { slug: "hobby", display: "Hobby", reqPerMin: 30, dailyCap: 10_000, pluginIncluded: false },
  builder: { slug: "builder", display: "Builder", reqPerMin: 60, dailyCap: 50_000, pluginIncluded: false },
  pro: { slug: "pro", display: "Pro", reqPerMin: 100, dailyCap: 150_000, pluginIncluded: false },
  production: { slug: "production", display: "Production", reqPerMin: 250, dailyCap: 1_000_000, pluginIncluded: true },
  enterprise: { slug: "enterprise", display: "Enterprise", reqPerMin: 500, dailyCap: 5_000_000, pluginIncluded: true },
};

export const DEFAULT_TIER = "free";

/** Resolve a tier slug (case-insensitive) to its config, falling back to free. */
export function tier(slug: string | undefined): Tier {
  return TIERS[(slug ?? "").toLowerCase()] ?? TIERS[DEFAULT_TIER];
}

/** Whether a tier bundles plugin access (Production/Enterprise). */
export function tierIncludesPlugin(slug: string): boolean {
  return tier(slug).pluginIncluded;
}

export interface AuthOk {
  ok: true;
  tier: string; // slug
  display: string;
  keyId?: string;
  /** Effective limits after applying any per-key overrides. */
  reqPerMin: number;
  dailyCap: number;
  /** Read + logged this phase; NOT enforced until the plugin exists (Phase 8). */
  pluginAccess: boolean;
}
export interface AuthFail {
  ok: false;
  status: number;
  message: string;
}
export type AuthResult = AuthOk | AuthFail;

function bearer(req: IncomingMessage): string {
  const h = req.headers["authorization"];
  return typeof h === "string" && h.startsWith("Bearer ") ? h.slice("Bearer ".length).trim() : "";
}

/** A positive finite override value from key metadata, else undefined. */
function numOverride(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * Verify the request's Bearer key with Unkey and resolve tier + effective limits.
 *
 * FAIL CLOSED: unconfigured Unkey, missing/empty key, or an invalid key all
 * return 401; an Unkey infra failure returns 503 (deny). The key is never logged.
 */
export async function verifyRequestKey(req: IncomingMessage): Promise<AuthResult> {
  if (!unkeyConfigured()) {
    return { ok: false, status: 401, message: "Authorization not configured (endpoint closed)" };
  }
  const key = bearer(req);
  if (!key) {
    return { ok: false, status: 401, message: "Missing API key" };
  }
  const uk = unkeyClient();
  if (!uk) {
    return { ok: false, status: 401, message: "Authorization not configured (endpoint closed)" };
  }

  try {
    const res = await uk.keys.verifyKey({ key });
    const data = res.data;
    if (!data.valid) {
      // Non-leaky: surface only Unkey's machine code (NOT_FOUND/EXPIRED/…), never the key.
      return { ok: false, status: 401, message: `Key rejected (${data.code ?? "INVALID"})` };
    }
    const meta = (data.meta ?? {}) as Record<string, unknown>;
    const t = tier(typeof meta.tier === "string" ? meta.tier : DEFAULT_TIER);
    // Per-key overrides (primarily enterprise custom deals) win over tier defaults.
    const reqPerMin = numOverride(meta.rpm) ?? t.reqPerMin;
    const dailyCap = numOverride(meta.daily) ?? t.dailyCap;
    // Plugin access is an independent flag stored on the key (decoupled from tier).
    const pluginAccess = typeof meta.pluginAccess === "boolean" ? meta.pluginAccess : t.pluginIncluded;
    return {
      ok: true,
      tier: t.slug,
      display: t.display,
      keyId: data.keyId,
      reqPerMin,
      dailyCap,
      pluginAccess,
    };
  } catch (err) {
    log("unkey verify error:", err instanceof Error ? err.message : String(err));
    return { ok: false, status: 503, message: "Authorization service temporarily unavailable" };
  }
}
