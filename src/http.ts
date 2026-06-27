// Hosted Streamable HTTP transport for Aries.
//
// This is an ADDITIONAL launch mode (selected by ARIES_TRANSPORT=http); the
// local stdio server in index.ts is untouched. Every MCP session gets a fresh
// server from createAriesServer(), so the 21 tools behave identically to stdio.
//
// Design notes:
//   - Auth is a single choke point (checkAuth -> auth.ts) that verifies the
//     request's Bearer key with Unkey and returns 401/503 BEFORE any transport
//     handling. Fail-closed. Phase 4 enforces per-tier limits at the same seam.
//   - The Subfrost key is read server-side by rpc.ts from SUBFROST_API_KEY and
//     only ever leaves as an outbound `x-subfrost-api-key` header. It, the Unkey
//     root key, and presented customer keys are never logged or echoed.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createAriesServer } from "./server.js";
import { hasApiKey } from "./rpc.js";
import { incidentCount, pendingCount, storePaths } from "./incidents.js";
import { log } from "./log.js";
import { verifyRequestKey, unkeyConfigured, type AuthResult } from "./auth.js";
import { enforceCustomerLimits } from "./ratelimit.js";

const PORT = Number(process.env.ARIES_HTTP_PORT ?? 8810);
const HOST = process.env.ARIES_HTTP_HOST ?? "0.0.0.0";
const MCP_PATH = process.env.ARIES_HTTP_PATH ?? "/mcp";
const MAX_BODY = 4_000_000; // 4 MB cap on a single JSON-RPC request body

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

// Active MCP sessions, keyed by the server-issued Mcp-Session-Id. In-memory is
// fine: sessions are cheap to recreate and hold no durable state of their own.
const sessions = new Map<string, Session>();

/**
 * Auth gate — the ONE place request authorization is decided.
 *
 * Verifies `Authorization: Bearer <unkey_key>` with Unkey (see auth.ts) and, on
 * success, resolves the caller's tier. FAIL CLOSED: with Unkey unconfigured or a
 * missing/invalid key, /mcp returns 401 for everything — never silently open.
 * (/healthz is handled before this gate and stays unauthenticated.)
 *
 * Phase 4 will ENFORCE the per-tier limits carried on a successful result; this
 * phase only needs verification to pass and the tier to be readable.
 */
function checkAuth(req: IncomingMessage): Promise<AuthResult> {
  return verifyRequestKey(req);
}

/** Buffer and JSON-parse a request body, with a hard size cap. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  if (res.headersSent) return;
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

function jsonRpcError(status: number, code: number, message: string) {
  return {
    res: { jsonrpc: "2.0" as const, error: { code, message }, id: null },
    status,
  };
}

async function openSession(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  keyId: string | undefined,
): Promise<void> {
  // Bind the session's incident attribution to the customer key that opened it.
  const server = createAriesServer({ keyId });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id: string) => {
      sessions.set(id, { transport, server });
      log(`http session ${id.slice(0, 8)}… open (${sessions.size} active)`);
    },
  });
  transport.onclose = () => {
    const id = transport.sessionId;
    if (id && sessions.delete(id)) {
      log(`http session ${id.slice(0, 8)}… closed (${sessions.size} active)`);
    }
  };
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");

  // Liveness probe for the container healthcheck — no MCP, no auth, no secrets.
  if (req.method === "GET" && url.pathname === "/healthz") {
    sendJson(res, 200, {
      ok: true,
      transport: "streamable-http",
      tools: 21,
      // Reports only PRESENCE of the key, never its value.
      subfrostKeyConfigured: hasApiKey(),
      sessions: sessions.size,
    });
    return;
  }

  if (url.pathname !== MCP_PATH) {
    sendJson(res, 404, jsonRpcError(404, -32601, "not found").res);
    return;
  }

  const auth = await checkAuth(req);
  if (!auth.ok) {
    sendJson(res, auth.status, jsonRpcError(auth.status, -32001, auth.message).res);
    return;
  }
  // auth.ok: tier + effective limits resolved. keyId is non-sensitive per Unkey;
  // the key itself is never logged. Enforce per-customer rate limits on inbound
  // MCP requests (POST). GET/DELETE are session SSE/teardown — auth only, no
  // metered request. Order: verify -> req/min -> daily -> proceed.
  if (req.method === "POST") {
    log(
      `authorized: tier=${auth.tier} plugin=${auth.pluginAccess} key=${auth.keyId ?? "?"} (${auth.reqPerMin}/min, ${auth.dailyCap}/24h)`,
    );
    const verdict = await enforceCustomerLimits(
      auth.keyId ?? "nokeyid",
      auth.reqPerMin,
      auth.dailyCap,
    );
    if (!verdict.ok) {
      const retryAfter =
        verdict.reset > 0 ? Math.max(1, Math.ceil((verdict.reset - Date.now()) / 1000)) : undefined;
      const window = verdict.which === "daily" ? "rolling 24h" : "per minute";
      const msg =
        `Rate limit exceeded on the ${auth.display} tier (${verdict.which}, ${window}).` +
        (retryAfter ? ` Retry in ~${retryAfter}s.` : " Retry shortly.");
      log(`rate-limited: tier=${auth.tier} which=${verdict.which} key=${auth.keyId ?? "?"}`);
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (retryAfter) headers["retry-after"] = String(retryAfter);
      if (!res.headersSent) {
        res.writeHead(429, headers);
        res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32029, message: msg }, id: null }));
      }
      return;
    }
  }

  const sid = req.headers["mcp-session-id"] as string | undefined;

  try {
    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const existing = sid ? sessions.get(sid) : undefined;

      if (existing) {
        await existing.transport.handleRequest(req, res, body);
        return;
      }
      if (sid) {
        // A session id was supplied but we don't know it (expired/never ours).
        sendJson(res, 404, jsonRpcError(404, -32001, "Unknown or expired session").res);
        return;
      }
      if (!isInitializeRequest(body)) {
        sendJson(
          res,
          400,
          jsonRpcError(400, -32000, "No valid session; send an initialize request first").res,
        );
        return;
      }
      await openSession(req, res, body, auth.keyId);
      return;
    }

    // GET (server->client SSE stream) and DELETE (session teardown) require an
    // established session.
    if (req.method === "GET" || req.method === "DELETE") {
      const existing = sid ? sessions.get(sid) : undefined;
      if (!existing) {
        sendJson(res, 400, jsonRpcError(400, -32000, "Missing or invalid session id").res);
        return;
      }
      await existing.transport.handleRequest(req, res);
      return;
    }

    sendJson(res, 405, jsonRpcError(405, -32000, "Method not allowed").res);
  } catch (err) {
    // err strings from rpc.ts are already sanitized of the key; we still never
    // pass the raw error to the client.
    log("http handler error", String(err));
    sendJson(res, 500, jsonRpcError(500, -32603, "Internal server error").res);
  }
}

export async function startHttpServer(): Promise<void> {
  log(
    `incident store: ${incidentCount()} trusted / ${pendingCount()} pending (data dir ${storePaths().dataDir})`,
  );
  if (!hasApiKey()) {
    log(
      "WARNING: SUBFROST_API_KEY not set — chain-data tools will fail until it is. Docs/dev tools work offline.",
    );
  }
  if (unkeyConfigured()) {
    log("auth: Unkey per-customer key verification + rate limits ACTIVE on /mcp");
  } else {
    log("auth: Unkey NOT configured (UNKEY_ROOT_KEY/UNKEY_API_ID unset) — /mcp is CLOSED (fail-closed). /healthz stays open.");
  }
  log(
    `subfrost self-throttle: ${process.env.GLOBAL_SUBFROST_DAILY_CAP ?? "30000000"} /24h, ${process.env.GLOBAL_SUBFROST_RPM ?? "500"} /min (global)`,
  );

  const httpServer = createServer((req, res) => {
    handle(req, res).catch((err) => {
      log("http top-level error", String(err));
      if (!res.headersSent) {
        sendJson(res, 500, jsonRpcError(500, -32603, "Internal server error").res);
      }
    });
  });

  const shutdown = (sig: string) => {
    log(`received ${sig}, shutting down`);
    for (const { transport } of sessions.values()) {
      transport.close().catch(() => {});
    }
    httpServer.close(() => process.exit(0));
    // Failsafe if connections linger.
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, HOST, () => {
      log(`ready (streamable-http) on http://${HOST}:${PORT}${MCP_PATH}`);
      resolve();
    });
  });
}
