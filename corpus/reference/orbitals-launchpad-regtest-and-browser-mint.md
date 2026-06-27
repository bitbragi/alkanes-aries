---
title: Orbitals launchpad on regtest — deploy gotchas + in-browser mint (field notes)
source_url: https://github.com/0xsupersimon/nft-launchpad-alkanes
---

# Orbitals launchpad on regtest — field notes

Hard-won lessons from porting the `nft-launchpad-alkanes` (collection + nft-factory + SVG
generator) onto a local alkanes regtest stack with `alkanes-cli`, and building a browser
launchpad that mints client-side. Complements `deploy-and-gateway-gotchas.md` and
`verification-layer-blind-spots.md`.

## Building the contracts
- A fresh `cargo build --target wasm32-unknown-unknown --release` of an alkanes contract can
  FAIL on an older toolchain (e.g. 1.86): transitive deps (`darling`, `serde_with`, `time-core`,
  `time-macros`, `wasip2`) raised their MSRV to 1.87/1.88. Fix: build with a newer toolchain
  (`cargo +1.91 build …`) — the contract's `build.rs` spawns a nested `cargo`, and RUSTUP_TOOLCHAIN
  from the outer `+1.91` propagates — or commit a Cargo.lock pinning older dep versions.
- Contract wasm compiler version is low-risk for the indexer (older-runtime contract runs on a
  newer indexer). It's the TOOL's tx encoding an older indexer may reject (see version-skew note).

## Deploying with alkanes-cli (the OYL `new-contract` equivalent)
- Reserve-deploy cellpack: `alkanes execute "[3,<reserve>,0,<init args>]:v0:v0" --envelope <wasm>`
  → instantiates at `{4,<reserve>}`, opcode 0 Initialize runs atomically.
- **`--envelope` takes the RAW `.wasm`** — the CLI gzips it itself. Passing the build's `.wasm.gz`
  DOUBLE-gzips; the deploy confirms but the contract reverts at load with
  `"magic header not detected: bad magic number (at offset 0x0)"` (the inner decompress yields a
  gzip stream `1f 8b…`, not wasm `00 61 73 6d`).
- **Factory/template pattern (collection mints child NFTs):** the collection clones via cellpack
  target `{block:6, tx:TEMPLATE_ID}`. In alkanes, `block 6` resolves the template at `{4, TEMPLATE_ID}`
  (block 5 → `{2, tx}`). So deploy the nft-factory as a reserve at `{4, TEMPLATE_ID}` and set the
  collection's `ORBITAL_TEMPLATE_ID` to that reserve; `{6,TEMPLATE_ID}` then copies its bytecode into
  a fresh `{2,seq}` per mint.
- **A reserve, once a deploy's `create_alkane` runs, is TAKEN.** Re-deploying the same reserve fails
  SILENTLY (no trace at all, since the reserved-branch error precedes trace init) — pick a fresh reserve.

## Verifying a deploy/mint (don't trust the obvious signals)
- **`getbytecode {4,reserve}` returns `0x` even for a LIVE factory/reserve deploy** — it is NOT a
  reliable liveness signal. And "no trace" can mislead. Verify by STATE: `alkanes reflect-alkane
  4:<reserve>` (calls the view opcodes 99/100/101). Mint success = the collection's GetTotalSupply
  (opcode 101, = instances × 1e8) advanced, or the minter holds a new `{2,seq}` orbital.
- Regtest tuning before deploy: a hardcoded `MINT_START_BLOCK` far above the regtest height gates all
  public minting (set it to 0); set `MAX_MINTS` ≤ the generated trait-array length so high-index
  GetData never panics.

## jsonrpc proxy: batched-lua "Script not found for hash"
- A unified regtest proxy may serve batched-UTXO queries as named lua scripts addressed BY HASH. The
  wallet/deploy path calls `sandshrew_evalsaved <hash>`; if the proxy's in-mem registry dropped the
  script you get `-32603 Script not found for hash: <h>`. `sandshrew_evalscript` RUNS a full script
  but does NOT persist it — only `sandshrew_savescript` registers it. Re-register each `/lua/*.lua`
  body via `sandshrew_savescript` before deploying. (The 128MB LRU means one save sticks for the session.)

## Minting from the browser (no CLI, no proxy-lua)
- An Orbitals mint is just an alkanes `execute` of a cellpack `[4, COLLECTION, <mint opcode>]` — same
  shape as any contract call. Build it client-side: cellpack → protostone → runestone OP_RETURN
  (`6a 5d …`, protocol_tag 1), output layout `[carrier-dust (pointer=0, receives the orbital),
  OP_RETURN, change]`, sign the taproot inputs BIP86 key-path with `@scure/btc-signer`
  (`tx.sign(privKey)` applies the tweak), broadcast via `sendrawtransaction`.
- **Fetch UTXOs from esplora REST** (`/address/<addr>/utxo`) and broadcast via `sendrawtransaction` —
  both bypass the proxy's batched-lua path entirely, so the in-browser mint has NO lua-script dependency
  (the deploy-side gotcha above doesn't apply to it).
- A burner taproot key (32 random bytes → `schnorr.getPublicKey` → p2tr) funded by the regtest faucet
  is enough to mint; persist it in localStorage. REGTEST ONLY.
- The collection embeds the trait JSONs and renders SVG on-chain (opcode 1000 GetData). A browser
  gallery can render the SAME bytes instantly by bundling the same trait data and mirroring the
  decoder — the on-chain GetData output and the client render are byte-for-byte the same art.
