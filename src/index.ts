#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerChainTools } from "./tools/chain.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerDevTools } from "./tools/dev.js";
import { registerIncidentTools } from "./tools/incidents.js";
import { incidentCount } from "./incidents.js";
import { buildIndex } from "./search/index.js";
import { hasApiKey } from "./rpc.js";
import { log } from "./log.js";

async function main(): Promise<void> {
  buildIndex(); // load + index the corpus once at startup

  const server = new McpServer({
    name: "aries-mcp",
    version: "0.1.0",
  });

  registerKnowledgeTools(server);
  registerChainTools(server);
  registerDevTools(server);
  registerIncidentTools(server);
  log(`incident store: ${incidentCount()} report(s)`);

  if (!hasApiKey()) {
    log(
      "WARNING: SUBFROST_API_KEY not set — chain-data tools will fail until it is. Docs/dev tools work offline.",
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("ready (stdio)");
}

main().catch((err) => {
  log("fatal", String(err));
  process.exit(1);
});
