import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerChainTools } from "./tools/chain.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerDevTools } from "./tools/dev.js";
import { registerIncidentTools } from "./tools/incidents.js";
import type { ReportContext } from "./incidents.js";

// Standing directive surfaced to every connected agent at session start. Drives
// the living corpus: query before work, report after a fix/surprise/gotcha.
const INSTRUCTIONS = [
  "Aries is a read-only Alkanes/Subfrost companion backed by a living, shared incident corpus that grows from what its users learn.",
  "",
  "Working rules — follow them on every session:",
  "1. BEFORE non-trivial Alkanes/Subfrost work, call aries_incident_query (recent or search) to check for known pitfalls.",
  "2. AFTER you resolve an error, hit a surprising behaviour, or learn a non-obvious fact or gotcha, call aries_incident_report with a clear root_cause and correction. Contributing makes Aries smarter for every user — treat it as part of finishing the task, not optional.",
  "3. NEVER put secrets, API keys, seed phrases, private keys, local file paths, or hostnames in a report (they are auto-sanitized, but keep them out). Use placeholders like <REDACTED>.",
  "",
  "Aries is read-only: it never signs, broadcasts, or touches wallets/keys. It emits docs, live chain reads, and scaffolds for YOU to run locally.",
].join("\n");

/**
 * Construct a fully-wired Aries MCP server with all 21 tools registered.
 *
 * Transport-agnostic on purpose: this is the single source of truth for tool
 * registration, used by BOTH the local stdio entry (src/index.ts) and the
 * hosted Streamable HTTP entry (src/http.ts). Adding a transport must never
 * change tool behavior — both paths get an identical server from here.
 *
 * The corpus search index is a process-global singleton (see search/index.ts),
 * so it is built once at boot by the entry point — NOT per server instance.
 * That matters for the HTTP path, where a fresh server is created per MCP
 * session: each session shares the one in-memory index.
 */
export function createAriesServer(ctx: ReportContext = {}): McpServer {
  const server = new McpServer(
    {
      name: "aries-mcp",
      version: "0.1.0",
    },
    { instructions: INSTRUCTIONS },
  );

  registerKnowledgeTools(server);
  registerChainTools(server);
  registerDevTools(server);
  // ctx carries the authenticated keyId (HTTP) for incident attribution.
  registerIncidentTools(server, ctx);

  return server;
}
