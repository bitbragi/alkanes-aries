import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fullDoc } from "../search/index.js";

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

export function registerDevTools(server: McpServer): void {
  server.registerTool(
    "aries_constants",
    {
      description:
        "Return the key Alkanes/frBTC constants instantly: frBTC contract id, wrap/unwrap/get-signer opcodes, genesis block, protocol tag.",
      inputSchema: {},
    },
    async () => text(fullDoc("reference/constants.md")),
  );

  server.registerTool(
    "aries_scaffold",
    {
      description:
        "Return a scaffold/recipe: 'wrap' (mint frBTC protostone), 'unwrap' (burn frBTC), or 'contract' (alkanes-rs WASM contract skeleton). These are starting templates, not audited code.",
      inputSchema: {
        kind: z.enum(["wrap", "unwrap", "contract"]),
      },
    },
    async ({ kind }) => text(fullDoc(`reference/scaffolds/${kind}.md`)),
  );
}
