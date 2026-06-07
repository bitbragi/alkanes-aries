# Aries

**The ultimate AI companion for building on Alkanes + Subfrost.**

Aries is a local [Model Context Protocol](https://modelcontextprotocol.io) server
that turns any MCP-capable AI assistant — Claude Code, Claude Desktop, and friends —
into a fluent Alkanes/Subfrost builder. One stdio server, four layers: your
assistant can **read the docs, query the live chain, scaffold contracts, and learn
from past mistakes** — without ever leaving the editor.

- **Knowledge** — a searchable corpus of protocol docs, the Subfrost JSON-RPC/REST reference, alkanes-rs, 21 step-by-step tutorials, oracle docs, and reference contracts: `aries_search`, `aries_doc` (TOC-first), `aries_full_doc`, `aries_catalog`, `aries_tutorials`.
- **Chain data** — live, read-only queries against the Subfrost gateway: `aries_tokens_by_address`, `aries_token`, `aries_contract_meta`, `aries_bytecode`, `aries_simulate`, `aries_frbtc_status`, `aries_diesel_status`, `aries_oracle_read`, `aries_oracle_price`, `aries_pools`, `aries_pool_info`, `aries_rpc`.
- **Dev** — constants + contract scaffolds (incl. `orbital` NFTs): `aries_constants`, `aries_scaffold`.
- **Learning** — a local incident loop so Aries improves as you use it: `aries_incident_report`, `aries_incident_query`.

### Ask it things like

- *"Is the frBTC peg live, who's the signer, and how much frBTC exists?"* → `aries_frbtc_status`
- *"What Alkanes tokens does `bc1p…` hold?"* → `aries_tokens_by_address`
- *"Read this token's / Orbital's metadata (and media)."* → `aries_token`, `aries_oracle_read` (opcode 1000)
- *"Show the AMM pools / a pool's reserves."* → `aries_pools`, `aries_pool_info`
- *"How do I build a token / oracle / stablecoin / AMM / Orbital?"* → `aries_tutorials` + `aries_scaffold`
- *"Have we hit this bug before?"* → `aries_incident_query`

## Safety model

v1 is **read-only / analytics**. No signing, no broadcast, no wallet keys — those
stay in the `alkanes` CLI, where you hold the keys. The `aries_rpc` passthrough is
allowlisted to read methods and explicitly blocks broadcast/spend/admin calls. The
incident loop writes only to a **local** store (never the chain) and sanitizes
secrets / keys / paths out of reports on the way in.

## Setup

```bash
npm install
cp .env.example .env        # add your SUBFROST_API_KEY
npm run build
npm run ingest              # optional: pull fuller docs into corpus/ (needs network)
```

The doc index is built from `corpus/` at startup. Logs go to **stderr** only
(stdout is the MCP protocol channel — never print to it).

### Environment

- `SUBFROST_API_KEY` — required for chain-data tools (sent as the `x-subfrost-api-key` header).
- `SUBFROST_RPC` / `SUBFROST_REST` — optional gateway overrides (default to the mainnet JSON-RPC / REST endpoints).
- `ARIES_INCIDENTS_PATH` — optional path for the local incident store (default `data/incidents.jsonl`, gitignored).

## Register with Claude Code (stdio)

```bash
claude mcp add --scope local --transport stdio aries \
  -e SUBFROST_API_KEY=YOUR_KEY \
  -- node /absolute/path/to/aries-mcp/dist/index.js
```

Verify with `claude mcp list`, then `/mcp` inside a session. `--` separates
Claude's flags from the launch command. Note: `-e KEY=value` is variadic — put
the server name *before* it and keep `-e …` right before `--`, or it will
swallow the name.

## Claude Desktop

```json
{
  "mcpServers": {
    "aries": {
      "command": "node",
      "args": ["/absolute/path/to/aries-mcp/dist/index.js"],
      "env": { "SUBFROST_API_KEY": "..." }
    }
  }
}
```

## Notes

- API key is sent as the `x-subfrost-api-key` header, never in the URL path.
- Alkane ids are `{block, tx}` / `block:tx`. frBTC = `32:0`, DIESEL (genesis) = `2:0`. Protocol tag is always `1`.
- Read contract state with `alkanes_simulate`: the opcode goes in `inputs` (e.g. `[103]`), not `data`.
- **Orbitals** (Alkanes NFTs) are a `Token` with total supply 1 + opcode `1000` = media; read them with `aries_oracle_read`, and scaffold one with `aries_scaffold orbital`. See `aries_doc reference/orbitals.md`.
- The **incident loop** improves Aries as you use it: agents file `aries_incident_report` on mistakes and `aries_incident_query` before non-trivial work. Local now; swappable to a shared backend later.
- Extend the corpus by editing `corpus/` or adding URLs to `scripts/ingest.ts` (HTML cleaned via turndown+jsdom; raw `.md`/`.rs` taken verbatim).
- Tool descriptions are the prompt the model reads — keep them crisp when you add tools.
