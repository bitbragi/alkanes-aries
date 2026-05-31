# Aries

**The ultimate AI companion for building on Alkanes + Subfrost.**

Aries is a local [Model Context Protocol](https://modelcontextprotocol.io) server
that turns any MCP-capable AI assistant — Claude Code, Claude Desktop, and friends —
into a fluent Alkanes/Subfrost builder. One stdio server, three layers: your
assistant can **read the docs, query the live chain, and scaffold contracts**
without ever leaving the editor.

- **Knowledge** — a searchable Alkanes + Subfrost docs corpus. `aries_search`, `aries_doc` (TOC-first reads), `aries_full_doc`, `aries_catalog`. Works offline, no API key.
- **Chain data** — live, read-only queries against the Subfrost JSON-RPC gateway. `aries_tokens_by_address`, `aries_contract_meta`, `aries_bytecode`, `aries_simulate`, `aries_frbtc_status`, `aries_rpc`.
- **Dev** — constants and contract scaffolds on tap. `aries_constants`, `aries_scaffold`.

### Ask it things like

- *"Is the frBTC peg live, who's the signer, and how much frBTC exists?"* → `aries_frbtc_status`
- *"What Alkanes tokens does `bc1p…` hold?"* → `aries_tokens_by_address`
- *"Decode this Alkanes contract's metadata, or simulate an opcode view."* → `aries_contract_meta`, `aries_simulate`
- *"How do I structure a wrap protostone?"* → `aries_search` + `aries_scaffold wrap`

## Safety model

v1 is **read-only / analytics**. No signing, no broadcast, no wallet keys — those
stay in the `alkanes` CLI, where you hold the keys. The `aries_rpc` passthrough is
allowlisted to read methods and explicitly blocks broadcast/spend/admin calls.

## Setup

```bash
npm install
cp .env.example .env        # add your SUBFROST_API_KEY
npm run build
npm run ingest              # optional: pull fuller docs into corpus/ (needs network)
```

The doc index is built from `corpus/` at startup. Logs go to **stderr** only
(stdout is the MCP protocol channel — never print to it).

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
- Alkane ids are `{block, tx}` / `block:tx`. frBTC = `32:0`. Protocol tag is always `1`.
- Read contract state with `alkanes_simulate`: the opcode goes in `inputs` (e.g. `[103]`), not `data`.
- Extend the corpus by editing `corpus/` or adding URLs to `scripts/ingest.ts`.
- Tool descriptions are the prompt the model reads — keep them crisp when you add tools.
