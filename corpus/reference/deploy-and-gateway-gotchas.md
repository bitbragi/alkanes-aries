---
title: Alkanes deploy format, version skew, and Subfrost gateway gotchas
source: reference
source_url: ""
---

# Alkanes deploy format, version skew, and Subfrost gateway gotchas

Hard-won field notes from deploying a contract to hosted Subfrost signet and verifying it.
These cover the cellpack deploy/register wire format, a tool↔indexer version-skew failure
mode, and how to reliably read state on the hosted gateway.

## Deploy / register cellpack format

Alkanes deploys use the **block-3 reserve namespace**, NOT `[1,0,0,…]`:

- **Deploy (reserve):** `alkanes execute "[3,<reserve>,0,<…init args>]:v0:v0" --envelope <wasm>`
  - Target `{block:3, tx:<reserve>}` is `CREATERESERVED` → instantiates the contract at
    **`{4,<reserve>}`**. Opcode `0` = `Initialize`, so deploy + init are **atomic** (the
    Initialize args ride in the same cellpack).
  - The wasm goes in the **reveal tx input-0 witness** as an envelope:
    `OP_FALSE OP_IF push("BIN") push(BODY_TAG) <gzip chunks> OP_ENDIF`.
  - `[1,0,0,…]` is the standard `CREATE` namespace (→ `{2,<next_sequence>}`); a deploy with
    `[1,0,0]` confirms on bitcoin but is easy to mis-verify. Prefer the reserve form when you
    want a known id.
- **Call / register (existing contract):** `[<id_block>,<id_tx>,<opcode>,<…args>]:v0:v0`
  e.g. register against `{4,31337}` opcode 1 = `[4,31337,1,<username words>,<key_hi>,<key_lo>]`.
- **String args** pack to u128 words via `string_to_u128_list` (16-byte LE, null-trimmed).
  Pass a 32-byte x-only taproot key as **two u128 words** (hi||lo big-endian), never the
  62-char bech32 string (that bloats the protostone).
- **BTC-fee-to-treasury** contracts (e.g. a paid registry) require a **fee output ≥ price
  paying the treasury scriptPubKey in the same tx**; the contract checks it via
  `transaction_object()`. Change back to the treasury also satisfies it when treasury == payer.

The protostone rides in the runestone OP_RETURN under Runestone tag `16383` (Protocol),
protocol_tag `1` (ALKANES), with `ProtoPointer(91)`, `Refund(93)`, `Message(81)` fields.

## Tool ↔ indexer VERSION SKEW (a silent deploy failure)

A **byte-perfect** deploy tx (correct reserve cellpack, valid envelope, protocol_tag 1) can
confirm on bitcoin yet instantiate **no alkane** if the **indexer version differs from the
tool that built the tx**. Observed: a tx built by alkanes-cli **v10.0.0** was rejected by a
hosted **signet** indexer (older) — it produced **no trace and no `{4,reserve}`**.

Why no trace: in `alkanes-rs/src/message.rs`, `run_special_cellpacks(...)?` returns its error
**before** the trace is initialized (`save_trace` only runs in the post-execution closures).
So a failure at/ before protostone extraction or special-cellpack resolution (cenotaph, or
"no binary found in witness") yields **zero trace** — distinct from a revert, which *does*
trace. **No trace at all ⇒ the indexer never processed your protostone as a message.**

Confirm it's version skew, not a bug: run the same deploy through an **in-process v10.0.0
indexer** (the `alkanes-integ-tests` wasmtime harness — `test_data/alkanes.wasm` = v2.1.6
regtest). If it instantiates + Initialize runs there but signet rejects it, the hosted signet
indexer is the outlier. Fix: **match the hosted indexer's version** (build the tool/contract
against it) or run a local stack of that version. (Contract wasm version matters less — a
contract built against an older alkanes-rs runs fine on a newer indexer; the **tx encoding**
the tool emits is what an older indexer may reject.)

## Subfrost hosted-gateway gotchas — verify by STATE, not by trace

- **`getbytecode` PANICS for every id**, including known-good DIESEL `{2,0}` (a `None.unwrap`
  in the view). It is **not** a validity signal — never infer "not deployed" from its panic.
- **`traceblock` ignores its height argument** on the hosted gateway: `traceblock(308114)`
  and `traceblock(952960)` return byte-identical blobs (a fixed cached block whose txids match
  neither candidate). Unusable for a specific bitcoin height.
- **Per-outpoint `trace` works** (protobuf `Outpoint{txid, vout}`; txid in **little-endian**
  internal byte order; vout = the protostone shadow vout = `tx.output.len() + 1` for the first
  protostone). Empty `0x` = no trace for that outpoint. A populated trace contains readable
  `ALKANES: revert: …` strings on failure.
- **metashrew internal height ≠ bitcoin height** (~953003 vs ~308157); the offset is not a
  reliable constant — don't map between them.
- **The reliable existence/state check is `alkanes_simulate` by alkane-id** (endianness-
  independent): call a view opcode; `gasUsed > 0` and empty `error` ⇒ the alkane exists and
  executed. A never-instantiated id returns `error:"unexpected end of file"`, `gasUsed 0`.
  Calibrate against a known-good (DIESEL `{2,0}`) and a known-empty id (`{4,99999}`).

## In-process verification (cheap regtest rung)

The `alkanes-integ-tests` crate runs the indexer wasm under wasmtime **in-process** — no
bitcoind/rockshrew/docker, and **traces work**. Build the cli's real tx via the harness block
builders (`create_block_with_deploys`, `create_block_with_protostones`), `index_block`, then
read state with `simulate`/`trace` views. Notes: the tests need rustc **1.91** (wasmtime 43);
`cargo test` debug builds are huge (wasmtime debuginfo) — set `CARGO_PROFILE_DEV_DEBUG=0`.
The `CliBridge`/`MockProvider` path cannot drive a real envelope commit/reveal (returns
`mock_txid_0`); use the harness block builders, which use the same protostone/envelope
primitives the cli emits.
