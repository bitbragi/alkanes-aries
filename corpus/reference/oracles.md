---
title: Alkanes Oracles — Registry & Read Interfaces
source_url: https://alkanescan.org/oracles.php
---

# Alkanes Oracles — Registry & Read Interfaces

Alkanes oracles are WASM contracts on Bitcoin L1 that expose verifiable on-chain
data other contracts (and `alkanes_simulate` callers) can read. Every read below
is a **staticcall-safe view** — call it with `aries_oracle_read` (opcode first,
args after) or `aries_simulate` (`inputs:[opcode, ...args]`), then decode the
returned `execution.data`, which is **little-endian**.

These are published as **patterns/templates**: you deploy your own instance and
get an alkane id `{block, tx}`. There is no single canonical mainnet id — pass
the id of the instance you want to read. As specific deployments become known,
add them here.

## BTC/USD Price Feed — Chainlink-style aggregator

One authorized operator pushes signed price updates; **reads need no auth**. The
same WASM powers any pair (name set at deploy); prices are 1e8-scaled. Round-based
history + a staleness heartbeat. Source: <https://alkanescan.org/oracle-price-feed.php>
· contract pattern: `orddao/stocks-price-oracle` (corpus/orddao/stocks-price-oracle.md).

| Opcode | Method | Inputs | Returns (LE) | `decode` |
|---|---|---|---|---|
| 10 | GetPrice | `[symbol_id]` | price(16) ‖ price_block(8) ‖ updated_block(8) = 32B | `price` |
| 11 | GetSymbolInfo | `[symbol_id]` | decimals(1) ‖ tlen(1) ‖ ticker(tlen) | `raw` |
| 12 | GetOwner | — | 32B pubkey | `raw` |
| 13 | GetPaused | — | 1B (0/1) | `bool` |
| 14 | GetNonce | — | u64 | `u64` |
| 15 | GetSymbolCount | — | u32 | `u32` |
| 16 | IsSymbolRegistered | `[symbol_id]` | 1B (0/1) | `bool` |

`aries_oracle_price {block, tx, symbolId}` wraps opcode 10 and decodes the 32-byte
answer into `{ priceE8, price, priceBlock, updatedBlock, ageBlocks }`.

## Block Header / Time Oracle

Pure on-chain, no operator, no admin keys. Exposes Bitcoin block height / time /
hash / header, the halving schedule, and time/height predicates (vesting,
halving-aware emissions, streaming payments). Source:
<https://alkanescan.org/oracle-block-header.php> · contract:
`orddao/block-header-oracle` (corpus/orddao/block-header-oracle.md).

| Opcode | Method | Inputs | Returns (LE) | `decode` |
|---|---|---|---|---|
| 10 | current_height | — | u64 | `u64` |
| 11 | current_timestamp | — | u64 (unix s) | `u64` |
| 12 | current_block_hash | — | 32B | `raw` |
| 13 | current_header | — | 80B header | `raw` |
| 20 | current_subsidy_sats | — | u64 | `u64` |
| 21 | subsidy_at_height | `[height]` | u64 | `u64` |
| 22 | next_halving_height | — | u64 | `u64` |
| 23 | blocks_until_halving | — | u64 | `u64` |
| 30 | is_after_timestamp | `[ts]` | 1B (0/1) | `bool` |
| 31 | is_after_height | `[h]` | 1B (0/1) | `bool` |
| 41 | get_header_at | `[height]` | 80B (cached; errors if not snapshotted) | `raw` |
| 42 | get_timestamp_at | `[height]` | u64 | `u64` |
| 43 | time_elapsed | `[from, to]` | i64 (seconds) | `u64` |
| 99 | snapshot_count | — | u128 | `u128` |

Opcode 40 `snapshot` **writes** state (caches the current header) — not a read;
do not call it from a view.

## Random Number Oracle

Verifiable pseudo-random numbers from block-hash entropy + caller-supplied salt
(NFT mints, game outcomes, lotteries). Trustless. Source:
<https://alkanescan.org/oracle.php?id=random> · see corpus/oracles/random-number.md
for its opcode interface.

## Delay Vault

Time-locks any Alkanes token for N blocks — send the token in, withdraw it after
the delay (~20 min for 2 blocks). No admin keys, no rug risk. Source:
<https://alkanescan.org/oracle-delay-vault.php> · see corpus/oracles/delay-vault.md.

## Reading any oracle

1. Find the oracle's read opcode + decode here (or in corpus/oracles/ / the
   orddao READMEs in corpus/orddao/).
2. `aries_oracle_read { block, tx, opcode, inputs:[...args], decode }` — or
   `aries_simulate` with `inputs:[opcode, ...args]`.
3. `execution.data` is little-endian; decode per the table's `decode` column.
