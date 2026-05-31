# Aries — Alkanes + Subfrost MCP

A local **stdio** MCP server that does for the **Alkanes metaprotocol + Subfrost**
what OPNet's Bob does for OPNet: one server bundling three layers —

- **Knowledge** — searchable docs corpus (`aries_search`, `aries_doc`, `aries_full_doc`, `aries_catalog`)
- **Chain data** — live reads via the Subfrost JSON-RPC gateway (`aries_tokens_by_address`, `aries_contract_meta`, `aries_bytecode`, `aries_simulate`, `aries_frbtc_status`, `aries_rpc`)
- **Dev** — constants + scaffolds (`aries_constants`, `aries_scaffold`)

v1 is **read-only / analytics**. No signing, no broadcast — keys stay in the
`alkanes` CLI. The `aries_rpc` passthrough is allowlisted to read methods and
explicitly blocks broadcast.

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
