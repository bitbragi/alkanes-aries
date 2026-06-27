#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAriesServer } from "./server.js";
import { incidentCount } from "./incidents.js";
import { buildIndex } from "./search/index.js";
import { hasApiKey } from "./rpc.js";
import { log } from "./log.js";
import { startHttpServer } from "./http.js";

async function main(): Promise<void> {
  buildIndex(); // load + index the corpus once at startup (shared by all sessions)

  // Launch mode is selected by env: ARIES_TRANSPORT=http runs the hosted
  // Streamable HTTP server; anything else (default) runs the local stdio server
  // exactly as before. The stdio path below is unchanged — local Aries keeps
  // working identically.
  const mode = (process.env.ARIES_TRANSPORT ?? "stdio").toLowerCase();
  if (mode === "http") {
    await startHttpServer();
    return;
  }

  const server = createAriesServer();
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
