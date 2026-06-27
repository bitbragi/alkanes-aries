# Alkanes Aries

**A local, read-only AI companion for building on Alkanes + Subfrost — bring your own key.**

Aries is a [Model Context Protocol](https://modelcontextprotocol.io) server that
turns any MCP-capable assistant — Claude Code, Claude Desktop, and friends — into
a fluent Alkanes/Subfrost builder. One stdio server, four layers: your assistant
can **read the docs, query the live chain, scaffold contracts, and learn from
past mistakes** — without ever leaving the editor.

This is the **open, bring-your-own-key edition.** It ships with the full static
baseline knowledgebase (75 curated docs) and runs entirely on your machine with
your own Subfrost API key. It does **not** include the hosted instance's
accumulated, continuously-learning incident corpus.

> **Local vs. hosted.** This repo gives you the *static baseline knowledge* plus
> your own key — a complete, self-contained companion. The hosted edition at
> **[aries.bragi.build](https://aries.bragi.build)** adds a *living corpus* that
> keeps getting smarter from what every connected agent learns. Same tools;
> hosted just remembers more over time.

## What you get

- **Knowledge** — a searchable corpus of protocol docs, the Subfrost
  JSON-RPC/REST reference, alkanes-rs, step-by-step tutorials, oracle docs, and
  reference contracts: `aries_search`, `aries_doc` (TOC-first), `aries_full_doc`,
  `aries_catalog`, `aries_tutorials`.
- **Chain data** — live, read-only queries against the Subfrost gateway:
  `aries_tokens_by_address`, `aries_token`, `aries_contract_meta`,
  `aries_bytecode`, `aries_simulate`, `aries_frbtc_status`,
  `aries_diesel_status`, `aries_oracle_read`, `aries_oracle_price`,
  `aries_pools`, `aries_pool_info`, `aries_rpc`.
- **Dev** — constants + contract scaffolds (incl. `orbital` NFTs):
  `aries_constants`, `aries_scaffold`.
- **Learning** — a **local** incident loop so Aries improves as *you* use it:
  `aries_incident_report`, `aries_incident_query`. Reports are written only to
  your own machine — nothing is shared.

### Ask it things like

- *"Is the frBTC peg live, who's the signer, and how much frBTC exists?"* → `aries_frbtc_status`
- *"What Alkanes tokens does `bc1p…` hold?"* → `aries_tokens_by_address`
- *"Show the AMM pools / a pool's reserves."* → `aries_pools`, `aries_pool_info`
- *"How do I build a token / oracle / stablecoin / AMM / Orbital?"* → `aries_tutorials` + `aries_scaffold`

## Safety model

Aries is **read-only / analytics**. No signing, no broadcast, no wallet keys —
those stay in the `alkanes` CLI, where you hold the keys. The `aries_rpc`
passthrough is allowlisted to read methods and explicitly blocks
broadcast/spend/admin calls. The incident loop writes only to a **local** store
(never the chain) and sanitizes secrets / keys / paths out of reports on the way
in.

## Setup

You need [Node.js](https://nodejs.org) ≥ 20 and your own Subfrost API key.

```bash
git clone https://github.com/bitbragi/alkanes-aries.git
cd alkanes-aries
npm install
cp .env.example .env        # then edit .env and set SUBFROST_API_KEY
npm run build
```

### Bring your own Subfrost key

Aries talks to the Subfrost gateway with **your** key. Get one at
<https://api.subfrost.io>, then put it in `.env` (see `.env.example`):

```bash
SUBFROST_API_KEY=your-key-here
# optional: SUBFROST_RPC=https://mainnet.subfrost.io/v4/jsonrpc
```

The key is sent as the `x-subfrost-api-key` header (never in the URL path) and
never leaves your machine except as that outbound header. `.env` is gitignored.

## Run it locally (stdio)

### Claude Code

```bash
claude mcp add --scope local --transport stdio aries \
  -e SUBFROST_API_KEY=YOUR_KEY \
  -- node /absolute/path/to/alkanes-aries/dist/index.js
```

Verify with `claude mcp list`, then `/mcp` inside a session. `--` separates
Claude's flags from the launch command; keep `-e KEY=value` right before `--`
(it's variadic and will otherwise swallow the server name).

### Claude Desktop

```json
{
  "mcpServers": {
    "aries": {
      "command": "node",
      "args": ["/absolute/path/to/alkanes-aries/dist/index.js"],
      "env": { "SUBFROST_API_KEY": "..." }
    }
  }
}
```

Logs go to **stderr** only (stdout is the MCP protocol channel — never print to
it). The doc index is built from `corpus/` at startup.

### Environment

- `SUBFROST_API_KEY` — required for chain-data tools.
- `SUBFROST_RPC` / `SUBFROST_REST` — optional gateway overrides (default to the
  mainnet JSON-RPC / REST endpoints).
- `ARIES_INCIDENTS_PATH` — optional path for your local incident store (default
  `data/incidents.jsonl`, gitignored).

## Notes

- Alkane ids are `{block, tx}` / `block:tx`. frBTC = `32:0`, DIESEL (genesis) =
  `2:0`. Protocol tag is always `1`.
- Read contract state with `aries_simulate`: the opcode goes in `inputs`
  (e.g. `[103]`), not `data`.
- **Orbitals** (Alkanes NFTs) are a `Token` with total supply 1 + opcode `1000`
  = media; read them with `aries_oracle_read`, and scaffold one with
  `aries_scaffold orbital`.
- Extend the corpus by editing `corpus/` or adding URLs to `scripts/ingest.ts`
  (HTML cleaned via turndown+jsdom; raw `.md`/`.rs` taken verbatim).
- Tool descriptions are the prompt the model reads — keep them crisp when you
  add tools.

## License

MIT
