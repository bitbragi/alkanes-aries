import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { search, doc, fullDoc, catalog } from "../search/index.js";

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

// Curated index of the AlkaneScan tutorials ingested into corpus/tutorials/.
// Read any of them with aries_doc (TOC-first) or aries_full_doc using `path`.
const TUTORIALS = [
  { title: "What is the Alkanes protocol?", summary: "Bitcoin + tiny on-chain programs — no extra blockchain.", minutes: 12, path: "tutorials/what-is-alkanes.md" },
  { title: "How to make an Alkanes smart contract", summary: "Write Rust, add opcodes, compile to WASM.", minutes: 18, path: "tutorials/make-smart-contract.md" },
  { title: "How to audit an Alkanes smart contract", summary: "Find bugs before real money is at risk.", minutes: 15, path: "tutorials/audit-smart-contract.md" },
  { title: "How to make an Alkanes oracle contract", summary: "Publish trusted data other contracts can read.", minutes: 16, path: "tutorials/make-oracle.md" },
  { title: "How to make a DAO on Alkanes", summary: "On-chain voting without a single boss.", minutes: 17, path: "tutorials/make-dao.md" },
  { title: "How to make a token on Alkanes", summary: "Launch with one click or code your own rules.", minutes: 14, path: "tutorials/make-token.md" },
  { title: "How to deploy an Alkanes smart contract", summary: "Commit, wait, reveal — go live on mainnet.", minutes: 16, path: "tutorials/deploy-contract.md" },
  { title: "How to buy DIESEL tokens", summary: "idclub, Subfrost, and OYL AMM — where to get 2:0.", minutes: 10, path: "tutorials/buy-diesel.md" },
  { title: "How to mint DIESEL tokens", summary: "What DIESEL is and how new units are created.", minutes: 11, path: "tutorials/mint-diesel.md" },
  { title: "How to use espo.sh to track contract activity", summary: "Look up txs, alkanes, and what your contract did.", minutes: 12, path: "tutorials/espo-track-activity.md" },
  { title: "How to view Alkanes contracts on Ordiscan", summary: "Browse alkanes, holders, and activity in a block explorer.", minutes: 10, path: "tutorials/view-on-ordiscan.md" },
  { title: "What is frBTC and Subfrost?", summary: "Wrapped BTC and the Subfrost app on Alkanes.", minutes: 13, path: "tutorials/frbtc-and-subfrost.md" },
  { title: "How to create a stablecoin on Alkanes", summary: "CDP vaults, oracles, collateral, and USDa patterns.", minutes: 18, path: "tutorials/make-stablecoin.md" },
  { title: "Alkanes vs BRC-20 — what's the difference?", summary: "Two ways to put tokens on Bitcoin, compared.", minutes: 11, path: "tutorials/alkanes-vs-brc20.md" },
  { title: "Alkanes vs Runes — what's the difference?", summary: "Runes vs the Alkanes metaprotocol — tokens and programs.", minutes: 12, path: "tutorials/alkanes-vs-runes.md" },
  { title: "How to swap tokens on Subfrost", summary: "Trade alkanes on app.subfrost.io — pools, slippage, wallet.", minutes: 10, path: "tutorials/swap-on-subfrost.md" },
  { title: "How to swap tokens on iDclub", summary: "Buy and sell alkanes on the idclub.io marketplace.", minutes: 10, path: "tutorials/swap-on-idclub.md" },
  { title: "Security issues in Alkanes smart contracts", summary: "Common bugs, exploits, and how to avoid them.", minutes: 16, path: "tutorials/security-issues.md" },
  { title: "Alkanes indexers — what they are and how they work", summary: "How explorers and apps read Alkanes from Bitcoin blocks.", minutes: 13, path: "tutorials/indexers.md" },
  { title: "How to make a wrapped BRC-20 token on Alkanes", summary: "wORDI / wSATS pattern — contract + bridge server.", minutes: 22, path: "tutorials/wrapped-brc20-token.md" },
  { title: "How to build an AMM on Alkanes (OYL Swap / iDclub)", summary: "Factory + pool, LP tokens, constant product.", minutes: 24, path: "tutorials/build-an-amm.md" },
];

export function registerKnowledgeTools(server: McpServer): void {
  server.registerTool(
    "aries_search",
    {
      description:
        "Search the Alkanes + Subfrost documentation corpus (protocol docs, Subfrost API/JSON-RPC reference, alkanes-rs CLI, step-by-step tutorials, oracle docs, reference contracts). Returns path + heading + preview for each hit. Call aries_doc next to read a section.",
      inputSchema: {
        query: z.string(),
        limit: z.number().int().optional(),
      },
    },
    async ({ query, limit }) => text(JSON.stringify(search(query, limit ?? 8), null, 2)),
  );

  server.registerTool(
    "aries_doc",
    {
      description:
        "Read a corpus doc token-efficiently. Without `section`, returns the doc's heading list (TOC). With `section`, returns just that section's body. Use the `path` values from aries_search / aries_catalog / aries_tutorials.",
      inputSchema: {
        path: z.string().describe('Corpus path, e.g. "subfrost/alkanes.md"'),
        section: z.string().optional(),
      },
    },
    async ({ path, section }) => text(doc(path, section)),
  );

  server.registerTool(
    "aries_full_doc",
    {
      description:
        "Return the complete, untruncated markdown of a corpus doc by path. Use when you need the whole file in one shot.",
      inputSchema: { path: z.string() },
    },
    async ({ path }) => text(fullDoc(path)),
  );

  server.registerTool(
    "aries_catalog",
    {
      description:
        "List every doc in the corpus grouped by source (subfrost, subfrost-api, alkanes-rs, tutorials, oracles, orddao, reference).",
      inputSchema: {},
    },
    async () => text(JSON.stringify(catalog(), null, 2)),
  );

  server.registerTool(
    "aries_tutorials",
    {
      description:
        "List the step-by-step Alkanes/Subfrost tutorials available in the corpus (title, summary, read-time, doc path). Use this to pick the right tutorial for a build task, then read it with aries_doc (TOC-first) or aries_full_doc. Covers making/deploying/auditing contracts, tokens, DAOs, oracles, stablecoins, AMMs, wrapped BRC-20, frBTC/Subfrost, DIESEL, swapping, indexers, and security.",
      inputSchema: {},
    },
    async () => text(JSON.stringify({ count: TUTORIALS.length, tutorials: TUTORIALS }, null, 2)),
  );
}
