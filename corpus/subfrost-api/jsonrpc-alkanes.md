---
title: Subfrost API — alkanes_* Methods
source_url: https://api.subfrost.io/docs/jsonrpc/alkanes
---

# Subfrost API — alkanes_* Methods

Alkanes are smart contracts on Bitcoin indexed via Metashrew. The alkanes_*
methods are convenience wrappers over metashrew_view. Protocol tag is always "1".

## alkanes_protorunesbyaddress

Params: [ { address, protocolTag:"1" }, blockTag? ]. Returns outpoints, each
with the runes (id {block,tx} + amount) held at that outpoint.

## alkanes_meta

Params: [ { target: { block, tx } }, blockTag? ]. The id must be wrapped in
`target` — a bare { block, tx } errors with "Missing or invalid 'target'
parameter". Returns { name, symbol, decimals, totalSupply } for contracts that
implement the `meta` view. Some contracts (e.g. frBTC 32:0) do not implement it
and panic; read their fields via opcode views with alkanes_simulate instead
(frBTC: 99 = name, 100 = symbol, 103 = get-signer).

## alkanes_getbytecode

Params: [ { block, tx }, blockTag? ]. Returns { bytecode } (hex WASM).

## alkanes_simulate

Params: [ { alkaneId:{block,tx}, inputs:[], target:{block,tx}, pointer,
refundPointer, vout, data }, blockTag? ]. Simulates a view call without
broadcasting — used to read contract state by invoking an opcode.

## Identifiers and protocol tag

Alkane id = { block, tx }, string form block:tx (e.g. 32:0 = frBTC).
For Alkanes, protocolTag is always "1".
