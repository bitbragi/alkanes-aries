---
title: Orbitals — Alkanes NFTs (standard, reading, and OPNet → Alkanes migration)
source_url: https://github.com/kungfuflex/alkanes-rs/tree/master/crates/alkanes-std-orbital
---

# Orbitals — Alkanes NFTs

"Orbitals" are the community NFT standard on Alkanes. An Orbital is **not an
inscription** — it's a normal Alkanes contract (a `Token`) whose total supply is
**1**, plus a view opcode that returns the media bytes. The NFT logic (rendering,
traits, swaps) lives in the WASM contract. Canonical reference:
`alkanes-std-orbital` in alkanes-rs (corpus/orbitals/std-orbital.md).

## The standard opcode interface (verified from alkanes-std-orbital)

The reference Orbital dispatches an `OrbitalMessage` enum:

| Opcode | Method | Returns | Notes |
|---|---|---|---|
| 0 | Initialize | — | one-time; sets total_supply = 1 and mints 1 unit of itself |
| 99 | GetName | String | token name |
| 100 | GetSymbol | String | token symbol |
| 101 | GetTotalSupply | u128 (LE) | 1 for a single Orbital |
| 1000 | GetData | bytes | the media — reference returns a 1×1 PNG; "NFT data can be anything" (PNG/SVG/…) |

So an Orbital = "a Token (99/100/101) + GetData (1000)". This mirrors the
fungible-token convention (cf. frBTC: 99/100 name/symbol) — an NFT is just supply-1.

## Reading an Orbital with Aries (works today, read-only)

Given an Orbital's alkane id `{block, tx}`:

- name → `aries_oracle_read { block, tx, opcode: 99, decode: "utf8" }`
- symbol → `aries_oracle_read { block, tx, opcode: 100, decode: "utf8" }`
- supply → `aries_oracle_read { block, tx, opcode: 101, decode: "u128" }`
- **media** → `aries_oracle_read { block, tx, opcode: 1000, decode: "raw" }` (hex
  bytes; PNG/SVG) — or `aries_simulate` with `inputs:[1000]`.

No new tool needed — the existing simulate / oracle-read path reads Orbitals.

## Reference repos (mirrored into the corpus)

- **alkanes-std-orbital** — canonical minimal Orbital → corpus/orbitals/std-orbital.md
- **nft-launchpad-alkanes** (0xsupersimon) — production-shaped launchpad:
  - `alkanes-collection` — collection contract → corpus/orbitals/collection-contract.md
  - `alkanes-nft` — per-NFT factory contract → corpus/orbitals/nft-contract.md
  - `nft-generator` — Rust SVG generator from traits/templates → corpus/orbitals/svg-generator.md
  - build / deploy / trace commands → corpus/orbitals/launchpad-readme.md

## Build & deploy (Oyl CLI)

```bash
# build the contract to WASM
cargo build --target wasm32-unknown-unknown --release
# deploy (Oyl CLI) — networks: signet, oylnet, mainnet
yarn oyl alkane new-contract -c ./target/wasm32-unknown-unknown/release/<name>.wasm -data 1,0 -p signet
# trace a deployed contract's tx
yarn oyl provider alkanes --method trace -params '{"txid":"<txid>","vout":3}' -p signet
```

Contracts deploy via witness envelopes (Ordinals-style), gzipped as `*.wasm.gz`,
and are indexed by Metashrew. Alkanes mainnet genesis block is 880000.

## OPNet → Alkanes (Orbitals) migration notes

- **Not 1:1.** OPNet and Alkanes are different runtimes. Rewrite contracts in
  **Rust → `wasm32-unknown-unknown`**, implement the `Token` trait + `GetData`
  (opcode 1000) for NFT media.
- **State:** use the runtime's `StoragePointer` / `KeyValuePointer` (see
  std-orbital), not OPNet storage primitives.
- **Collection vs single:** a collection contract mints child NFT alkanes (see
  nft-launchpad `alkanes-collection` + `alkanes-nft`), or use one supply-1 Orbital
  per token for simpler cases.
- **Media:** render on-chain (SVG generator) or embed bytes in `GetData`. The 1×1
  PNG in the reference is just a placeholder.
- **Test path:** regtest → signet / oylnet → mainnet.
- Start from `aries_scaffold orbital`, and see `aries_tutorials`:
  make-smart-contract, make-token, deploy-contract, audit, security-issues.
```

