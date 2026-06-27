<div align="center">

# Aries

**Make your AI assistant fluent in building on Alkanes + Subfrost.**

Aries is a [Model Context Protocol](https://modelcontextprotocol.io) server that
gives any MCP-capable AI — Claude Code, Claude Desktop, Cursor — a knowledge +
live-chain-data layer for the Alkanes metaprotocol and the Subfrost network. It
runs on **your** machine with **your** Subfrost key.

[![MCP](https://img.shields.io/badge/Model_Context_Protocol-server-blue)](https://modelcontextprotocol.io)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Read-only](https://img.shields.io/badge/wallet-read--only-success)](#safety--read-only-by-design)
[![License](https://img.shields.io/badge/license-MIT-black)](#license)

</div>

---

Building on Alkanes means juggling protocol docs, a JSON-RPC gateway, contract
bytecode, and a pile of `block:tx` ids — and your AI assistant knows none of it
out of the box. Aries fixes that. Point your assistant at one server and it can
**read the docs, query the live chain, and scaffold contracts** without leaving
the editor.

## What you get

Three capability layers, **21 tools**, one local server:

- 🧠 **Knowledge** — a searchable corpus of **75 curated docs**: the Alkanes
  metaprotocol, the Subfrost JSON-RPC/REST reference, alkanes-rs, step-by-step
  tutorials, oracle docs, and reference contracts.
  → `aries_search`, `aries_doc`, `aries_full_doc`, `aries_catalog`, `aries_tutorials`
- 🔗 **Live chain data** — read-only queries against the Subfrost gateway:
  token holdings, contract metadata, bytecode, `simulate`, frBTC peg + DIESEL
  status, oracle reads, AMM pools, and a guarded RPC passthrough.
  → `aries_tokens_by_address`, `aries_token`, `aries_contract_meta`, `aries_bytecode`,
    `aries_simulate`, `aries_frbtc_status`, `aries_diesel_status`, `aries_oracle_read`,
    `aries_oracle_price`, `aries_pools`, `aries_pool_info`, `aries_rpc`
- 🛠️ **Dev scaffolds** — protocol constants and contract templates, including
  `orbital` NFTs.
  → `aries_constants`, `aries_scaffold`

Plus a **local learning loop** (`aries_incident_report` / `aries_incident_query`)
that records gotchas to your own machine as you work — nothing is shared.

### Ask your assistant things like

> *"Is the frBTC peg live, who's the signer, and how much frBTC exists?"*
> *"What Alkanes tokens does `bc1p…` hold?"*
> *"Show the AMM pools and a pool's reserves."*
> *"How do I build a token / oracle / stablecoin / AMM / Orbital?"*
> *"Scaffold an Orbital NFT contract."*

## Local vs. hosted

This repo is the **open, bring-your-own-key edition**. It ships the full static
baseline knowledge and runs entirely on your machine.

| | **Local (this repo)** | **Hosted — [aries.bragi.build](https://aries.bragi.build)** |
| --- | --- | --- |
| All 21 tools | ✅ | ✅ |
| 75-doc baseline knowledge | ✅ | ✅ |
| Your own Subfrost key | ✅ | managed for you |
| Setup | clone + build | connect a URL |
| **Living corpus of real-world lessons** | — | ✅ continuously learning |

The hosted instance keeps a **growing corpus of real-world incidents** —
hard-won lessons contributed by every connected agent — that a fresh local clone
simply doesn't have. If you want the living brain without self-hosting, point
your client at the hosted endpoint. Otherwise, everything below gets you running
locally in a couple of minutes.

## Quickstart

**Requirements:** [Node.js](https://nodejs.org) ≥ 20 and a Subfrost API key.

```bash
git clone https://github.com/bitbragi/alkanes-aries.git
cd alkanes-aries
npm install
cp .env.example .env        # then edit .env — see "Bring your own key" below
npm run build
```

### Bring your own key

Aries talks to the Subfrost gateway with **your** key — get one at
[api.subfrost.io](https://api.subfrost.io), then set it in `.env`:

```bash
SUBFROST_API_KEY=your-key-here
# optional override:
# SUBFROST_RPC=https://mainnet.subfrost.io/v4/jsonrpc
```

The key is sent as the `x-subfrost-api-key` header (never in a URL) and never
leaves your machine except as that outbound header. `.env` is gitignored.

### Connect your MCP client

**Claude Code**

```bash
claude mcp add --scope local --transport stdio aries \
  -e SUBFROST_API_KEY=YOUR_KEY \
  -- node /absolute/path/to/alkanes-aries/dist/index.js
```

Verify with `claude mcp list`, then `/mcp` in a session. (`--` separates Claude's
flags from the launch command; keep `-e KEY=value` right before `--` — it's
variadic and will otherwise swallow the server name.)

**Claude Desktop / Cursor** (any client that takes a JSON server config)

```json
{
  "mcpServers": {
    "aries": {
      "command": "node",
      "args": ["/absolute/path/to/alkanes-aries/dist/index.js"],
      "env": { "SUBFROST_API_KEY": "your-key-here" }
    }
  }
}
```

That's it — your assistant now has all 21 Aries tools.

## Safety — read-only by design

Aries is **analytics only**. It never signs, broadcasts, or touches wallets or
keys:

- The `aries_rpc` passthrough is **allowlisted to read methods** and explicitly
  blocks broadcast / spend / admin calls.
- Scaffolds and constants are emitted for **you** to run in your own `alkanes`
  CLI, where you hold the keys.
- The local incident loop writes only to your machine and sanitizes secrets,
  keys, and paths out of any report.

Your keys stay yours. Aries only reads and advises.

## Configuration

| Var | Purpose |
| --- | --- |
| `SUBFROST_API_KEY` | **Required** — auth for the live chain-data tools. |
| `SUBFROST_RPC` / `SUBFROST_REST` | Optional gateway overrides (default to mainnet JSON-RPC / REST). |
| `ARIES_INCIDENTS_PATH` | Optional path for your local incident store (default `data/incidents.jsonl`, gitignored). |

Logs go to **stderr** only — stdout is the MCP protocol channel. The doc index
is built from `corpus/` at startup.

## Good to know

- Alkane ids are `{block, tx}` / `block:tx`. frBTC = `32:0`, DIESEL (genesis) =
  `2:0`. Protocol tag is always `1`.
- Read contract state with `aries_simulate`: the opcode goes in `inputs`
  (e.g. `[103]`), not `data`.
- **Orbitals** (Alkanes NFTs) are a `Token` with total supply 1 + opcode `1000`
  = media; read them with `aries_oracle_read`, scaffold one with
  `aries_scaffold orbital`.
- Extend the corpus by editing `corpus/` or adding URLs to `scripts/ingest.ts`
  (HTML cleaned via turndown + jsdom; raw `.md`/`.rs` taken verbatim).

## Links

- 🌐 Hosted, continuously-learning Aries: **[aries.bragi.build](https://aries.bragi.build)**
- 📖 Model Context Protocol: **[modelcontextprotocol.io](https://modelcontextprotocol.io)**
- 🔑 Subfrost API keys: **[api.subfrost.io](https://api.subfrost.io)**

## License

MIT
