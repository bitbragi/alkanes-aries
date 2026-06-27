---
title: Broadcasting Alkanes protostone txs — non-standard relay on regtest vs hosted gateway
source: reference
source_url: ""
---

# Broadcasting Alkanes protostone txs — regtest vs the hosted gateway

Field notes on the one thing that silently blocks a local Alkanes stack: an Alkanes
transaction carries its protostone in an **`OP_RETURN` marked with `OP_PUSHNUM_13`**
(protocol tag 13). That OP_RETURN shape is **non-standard** to a default Bitcoin Core
node, so the node will build/sign the tx fine but **refuse to accept or relay it** —
and the failure surfaces at broadcast, not at construction.

For the cellpack deploy/register/resolve **wire format** (block-3 reserve namespace,
`[3,<reserve>,0,…]` deploy, `[<id_block>,<id_tx>,<opcode>,…]` call, string→u128 packing),
see `reference/deploy-and-gateway-gotchas.md`. This entry is only about **getting the
signed bytes accepted**.

## The relay problem

- A protostone tx has an extra `OP_RETURN` output whose payload begins with the
  `OP_PUSHNUM_13` opcode. Standardness rules reject multiple/oversized/odd `OP_RETURN`s.
- Symptom on `sendrawtransaction`: `non-mandatory-script-verify-flag`, `scriptpubkey`
  (non-standard output), or `tx-size`/`dust` style rejections — i.e. the node treats the
  protostone output as non-standard. The tx is valid consensus-wise; it's *policy* that
  blocks it.

## Regtest: accept non-standard locally

Run the regtest `bitcoind` with **`-acceptnonstdtxn=1`** so `sendrawtransaction` accepts
the protostone tx into the mempool. Then confirm it (a block has to be mined for the
indexer to pick it up):

- Pair `-acceptnonstdtxn=1` with an **auto-miner sidecar** that mines every few seconds
  (or on demand), so deploy → register → resolve actually advances state. With no miner,
  the tx sits in the mempool and the indexer never sees it.
- The indexer (Metashrew) only reflects **confirmed** state; a mempool-only tx will not
  show up in `metashrew_view` reads. Always mine, then read.

## Signet / mainnet: broadcast through the gateway

You can't assume default peers will relay a non-standard tx. Use the **hosted gateway's
`btc_sendrawtransaction`** (Subfrost JSON-RPC) instead of your own node's relay — the
gateway accepts and propagates protostone txs. See `subfrost-api/jsonrpc-bitcoind.md`.

Rule of thumb: **regtest = `-acceptnonstdtxn=1` + local miner; signet/mainnet =
gateway broadcast.** Same signed bytes either way; only the relay path changes.

## Fee / vbytes gotcha

Protostone txs are slightly larger than a plain transfer (the extra OP_RETURN + any
taproot reveal). A register tx came out ~**257 vbytes**; a hardcoded estimate of 200
vbytes underpaid and tripped **`min relay fee not met`**. Estimate vbytes from the real
output set (or pad generously, e.g. 400) rather than a guessed constant — an underpaid
non-standard tx fails at the same `sendrawtransaction` step and looks like the relay
problem above.

## The loop that proves the stack

1. **Deploy** the registry (reserve namespace) → contract lands at `{4,<reserve>}`.
2. **Register** a name: opcode 1 with the username words + x-only key (hi/lo u128s).
3. **Resolve**: opcode 2 via `metashrew_view` `simulate` → returns the stored key/address.

If resolve returns empty after a register that "succeeded," you almost always **didn't
mine** (mempool-only) or the broadcast was silently rejected as non-standard.
