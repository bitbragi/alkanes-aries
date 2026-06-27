import { log } from "./log.js";
import { assertSubfrostBudget } from "./ratelimit.js";

const ENDPOINT =
  process.env.SUBFROST_RPC ?? "https://mainnet.subfrost.io/v4/jsonrpc";
const REST_ENDPOINT =
  process.env.SUBFROST_REST ?? ENDPOINT.replace(/\/jsonrpc\/?$/, "/api");
const API_KEY = process.env.SUBFROST_API_KEY;

let counter = 0;

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Single JSON-RPC 2.0 call against the Subfrost gateway.
 * Auth is the x-subfrost-api-key HEADER — never the /v4/<key> path form,
 * which would leak the key into URLs, logs, and referrers.
 */
export async function rpc<T = unknown>(
  method: string,
  params: unknown[] = [],
  timeoutMs = 20_000,
): Promise<T> {
  // Global self-throttle: count this real outbound Subfrost call against the
  // shared budget BEFORE spending it. Throws CapacityError at the ceiling.
  await assertSubfrostBudget();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(API_KEY ? { "x-subfrost-api-key": API_KEY } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: ++counter }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Subfrost RPC HTTP ${res.status}: ${body.slice(0, 500)}`);
    }
    const json = (await res.json()) as {
      result?: T;
      error?: RpcError;
    };
    if (json.error) {
      throw new Error(
        `Subfrost RPC error ${json.error.code}: ${json.error.message}`,
      );
    }
    return json.result as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Subfrost RPC timeout after ${timeoutMs}ms (${method})`);
    }
    log("rpc failed", method, String(err));
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST to the Subfrost REST API (https://…/v4/api). Used by the read-only AMM
 * pool tools. Returns the unwrapped `data` field. Header auth, like rpc().
 */
export async function restPost<T = unknown>(
  path: string,
  body: unknown,
  timeoutMs = 20_000,
): Promise<T> {
  // Global self-throttle (same shared bucket as rpc()): REST hits Subfrost too.
  await assertSubfrostBudget();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${REST_ENDPOINT}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(API_KEY ? { "x-subfrost-api-key": API_KEY } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Subfrost REST HTTP ${res.status}: ${t.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: T };
    return (json.data ?? json) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Subfrost REST timeout after ${timeoutMs}ms (${path})`);
    }
    log("rest failed", path, String(err));
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function hasApiKey(): boolean {
  return Boolean(API_KEY);
}

/**
 * Passthrough guard. The namespaced passthrough tools (esplora/ord/btc/
 * metashrew) let the model reach a lot of the gateway, so we allowlist the
 * method PREFIXES we intend to permit. This is a read-only analytics server:
 * we never want a passthrough to reach a wallet/broadcast/admin method.
 */
const ALLOWED_PREFIXES = [
  "esplora_",
  "ord_",
  "metashrew_",
  "btc_get", // read-only Bitcoin Core getters only (getblock, getrawtransaction, …)
  "btc_decode",
  "alkanes_",
  "brc20_",
];

// Explicit denylist beats prefix match — keep spend/relay/control off-limits.
const DENIED = [
  "btc_sendrawtransaction",
  "btc_send",
  "esplora_broadcast",
];

export function assertAllowed(method: string): void {
  if (DENIED.includes(method)) {
    throw new Error(`Method "${method}" is blocked (write/broadcast).`);
  }
  if (!ALLOWED_PREFIXES.some((p) => method.startsWith(p))) {
    throw new Error(
      `Method "${method}" is not on the read-only allowlist. ` +
        `Allowed prefixes: ${ALLOWED_PREFIXES.join(", ")}.`,
    );
  }
}
