---
title: Subfrost API — JSON-RPC Gateway
source_url: https://api.subfrost.io/docs
---

# Subfrost API — JSON-RPC Gateway

Unified JSON-RPC over Bitcoin Core, Esplora, Ord, BRC20, and Alkanes, plus
server-side Lua. JSON-RPC endpoint: https://mainnet.subfrost.io/v4/jsonrpc
(or /v4/<api-key> path form). REST: https://mainnet.subfrost.io/v4/api/<route>.

## Auth

API key via x-subfrost-api-key header (preferred) or /v4/<apikey> path; CORS
domain registration for browsers; alias routes.

## Namespaces

- esplora_*  — Electrs/Esplora explorer API
- ord_*      — Ordinals (inscriptions, runes, sats)
- metashrew_* — Metashrew indexer views
- alkanes_*  — Alkanes protocol methods (wrappers over metashrew_view)
- btc_*      — Bitcoin Core RPC passthrough
- brc20_*    — BRC20 / OPI
- lua_*      — server-side Lua execution

## Method path mapping

Methods map to REST paths: namespace preserved, ':' separates path segments,
'::' marks where a param is inserted (esplora_address::txs with [addr] ->
/address/addr/txs). Trailing params appended to the path.
