import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { report, query } from "../incidents.js";

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

export function registerIncidentTools(server: McpServer): void {
  server.registerTool(
    "aries_incident_report",
    {
      description:
        "Record a mistake, bug, rule violation, or pitfall you hit while working with Alkanes/Subfrost, so future sessions can learn from it. Stored locally and read back via aries_incident_query. File one whenever you make an error worth not repeating. SECURITY: never include secrets, API keys, seed phrases, private keys, local file paths, or hostnames — reports are treated as shareable; use placeholders like <REDACTED>. (Inputs are also auto-sanitized on the way in.)",
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
        const inc = report(input);
        return ok({ stored: inc.id, ts: inc.ts, note: "Recorded locally for cross-session learning." });
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_incident_query",
    {
      description:
        "Query past incident reports to avoid repeating known mistakes — call this before non-trivial Alkanes/Subfrost work. actions: recent (newest first, default), search (free-text + filters), stats (aggregate counts), get (by incident id).",
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
