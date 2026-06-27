---
title: Alkanes Oracles
source: oracles
source_url: https://alkanescan.org/oracles.php
---

# Alkanes Oracles

On-chain data feeds and oracle smart contracts built on the Alkanes metaprotocol

What are Alkanes Oracles?

Alkanes oracles are WebAssembly smart contracts deployed on Bitcoin L1 using the Alkanes metaprotocol. They expose verifiable, on-chain data that other Alkanes contracts can consume — including random numbers, Bitcoin block data, price feeds, and external data anchors. Unlike Ethereum oracles that rely on off-chain nodes, Alkanes oracles are fully deterministic and verifiable by any Bitcoin node.

[

🎲

Random Number Oracle

Verifiable on-chain randomness

Generates verifiable pseudo-random numbers on Bitcoin L1 using block hash entropy and caller-supplied salt. Suitable for NFT mints, game outcomes, and lotteries.

Randomness Open Source Trustless

](oracle.php?id=random)[

⏰

Block Header Oracle

Bitcoin block & time data

Exposes block height, timestamp, hash, halving schedule, and time predicates. Powers vesting contracts, halving-aware emissions, and streaming payments.

Time & Block Open Source Trustless

](oracle-block-header.php)[

📈

BTC/USD Price Feed

Chainlink-style on-chain price oracle

Operator pushes signed prices on-chain; any Alkanes contract reads the latest answer or historical rounds via staticcall. Powers lending, synthetics, and stablecoins.

Price Feed Open Source Permissioned write

](oracle-price-feed.php)[

⌛

Delay Vault

Time-lock any token for N blocks

Send DIESEL (or any Alkanes token) to the vault; withdraw it automatically after 2 Bitcoin blocks (~20 min). No admin keys, no rug risk.

Time-Lock Open Source Trustless

](oracle-delay-vault.php)

⚡

Entropy Beacon

Block-by-block entropy

Soon

Publishes a deterministic entropy value each Bitcoin block, derived from the block hash chain. Designed for commit-reveal schemes.

How Alkanes Oracles Work

1

Deploy

Oracle is deployed as a WASM binary on Bitcoin using the Alkanes metaprotocol. Gets a permanent Alkane ID.

2

Request

A caller contract invokes the oracle's opcode, passing any required arguments in the Cellpack inputs.

3

Execute

The WASM runtime executes the oracle logic deterministically using Bitcoin block data as the data source.

4

Consume

The return value is available to the calling contract within the same transaction execution context.