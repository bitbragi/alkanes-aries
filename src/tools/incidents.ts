import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { report, query, type ReportContext } from "../incidents.js";
import { enforceSubmissionLimit } from "../ratelimit.js";

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});
const fail = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
  isError: true,
});

const SEVERITY = ["critical", "high", "medium", "low", "info"] as const;
const CATEGORY = [
  "security",
  "bad_code",
  "rule_violation",
  "exploit",
  "misunderstanding",
  "performance",
  "data_loss",
] as const;

/**
 * Register the incident tools.
 *
 * `ctx.keyId` is the verified Unkey keyId of the customer who opened this MCP
 * session (threaded from the auth seam in http.ts). It is recorded as ATTRIBUTION
 * on every pending submission so the operator knows who contributed. Undefined on
 * the local stdio path (no auth) — submissions there are simply unattributed.
 */
export function registerIncidentTools(server: McpServer, ctx: ReportContext = {}): void {
  server.registerTool(
    "aries_incident_report",
    {
      description:
        "Record a mistake, bug, rule violation, or pitfall you hit while working with Alkanes/Subfrost, so future sessions can learn from it. File one whenever you make an error worth not repeating, hit a surprising behaviour, or learn a non-obvious gotcha — contributing makes Aries smarter for every user. Submissions enter a review queue and become searchable once an operator approves them. SECURITY: never include secrets, API keys, seed phrases, private keys, local file paths, or hostnames — reports are treated as shareable; use placeholders like <REDACTED>. (Inputs are also auto-sanitized on the way in.)",
      inputSchema: {
        severity: z.enum(SEVERITY),
        category: z.enum(CATEGORY),
        title: z.string().describe("Short title describing the incident"),
        description: z.string().describe("What happened"),
        root_cause: z.string().describe("WHY it happened — root-cause analysis"),
        correction: z.string().describe("What SHOULD have been done instead"),
        rules_violated: z.string().optional().describe("Comma-separated rules that were violated"),
        affected_files: z.string().optional().describe("Comma-separated file paths"),
        bad_code: z.string().optional().describe("Offending snippet (auto-sanitized before storage)"),
        tags: z.string().optional().describe('Comma-separated keywords for search, e.g. "simulate,opcode,decode"'),
        agent_id: z.string().optional().describe("Reporting agent identifier"),
      },
    },
    async (input) => {
      try {
        const limited = await enforceSubmissionLimit(ctx.keyId ?? "local");
        if (!limited.ok) {
          return fail("Incident-submission rate limit reached for this key; please try again later.");
        }
        const inc = report(input, ctx);
        return ok({
          stored: inc.id,
          status: inc.status,
          ts: inc.ts,
          note: "Queued for operator review (pending). Thanks for contributing — vetted reports become searchable for everyone.",
        });
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_incident_query",
    {
      description:
        "Query the TRUSTED incident corpus to avoid repeating known mistakes — call this BEFORE non-trivial Alkanes/Subfrost work. Serves only operator-vetted incidents (pending submissions are not returned). actions: recent (newest first, default), search (free-text + filters), stats (aggregate counts), get (by incident id).",
      inputSchema: {
        action: z.enum(["recent", "search", "stats", "get"]).optional(),
        search_text: z.string().optional().describe("Free-text across title/description/root_cause/correction"),
        tags: z.string().optional().describe("Comma-separated tags to match"),
        category: z.enum(CATEGORY).optional(),
        severity: z.enum(SEVERITY).optional().describe("Minimum severity threshold"),
        incident_id: z.string().optional().describe("For action=get (e.g. INC-...)"),
        affected_files: z.string().optional().describe("Comma-separated file paths to match"),
        limit: z.number().int().optional().describe("Max results (default 10, max 50)"),
      },
    },
    async (opts) => {
      try {
        return ok(query(opts));
      } catch (e) {
        return fail(String(e));
      }
    },
  );
}
