---
title: 🔮 How to make an Alkanes oracle contract
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-oracle.php
---

Tutorial 4 · 16 min read

# 🔮 How to make an Alkanes oracle contract

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

Smart contracts on Bitcoin cannot “look up” the weather or coin prices by themselves. An **oracle** is a contract that **publishes answers on-chain** so games, markets, and vaults can read them trustlessly.

## What is an oracle? (simple)

Imagine a teacher who writes the answer on the board every day. Everyone in class copies the same answer. An oracle is that teacher — but the “board” is Bitcoin + Alkanes, and the answer is stored in contract state or returned from a read opcode.

Unlike many Ethereum oracles that rely on off-chain nodes signing data, Alkanes oracles are **WASM programs on L1**. Other contracts call your oracle’s opcodes inside the same execution model.

## Types of oracles you can build

-   **Randomness** — Mix block hash + user salt → pseudo-random bytes (games, lotteries). See [Random Oracle](oracle.php?id=random).
-   **Block / time** — Expose height, timestamp, difficulty from Bitcoin context. See [Block Header Oracle](oracle-block-header.php).
-   **Price feeds** — BTC/USD or pool ratios, updated by trusted updater or derived from on-chain state. See [Oracles hub](oracles.php).
-   **Custom anchors** — Any bytes you want verifiable (e.g. commitment to external data with hash posted on-chain).

💡 Tip

Start with a **read-only oracle** (one opcode that returns bytes). No token transfers = fewer ways to lose funds while learning.

## Design principles

### Make answers verifiable

Users should see _why_ they can trust the number. Block-header oracles tie answers to Bitcoin blocks everyone validates. Random oracles should document entropy sources (never claim “true random” unless you mean it).

### Version your interface

Opcode 1 = `GetPrice` today. If you change byte layout, add opcode 2 = `GetPriceV2` instead of silently breaking callers.

### Fail closed

If data is stale or missing, revert with a clear error — do not return zero price and cause liquidations.

## Building step by step

1

**Define the question**

What bytes do consumers need? (u64 price, 32-byte hash, struct pack?)

2

**Write update + read opcodes**

Updater (if any) writes storage; getter returns LE bytes consumers parse.

3

**Initialize config**

Owner pubkey, heartbeat interval, max staleness blocks.

4

**Deploy**

Paste your oracle code into [Deploy](deploy.php), or study the live examples on [Oracles](oracles.php) first.

5

**Document consumer cellpack**

“Call `[oracle_block, oracle_tx, 1]` to read price.”

## How other contracts use your oracle

A prediction market might:

1.  Call your oracle in the same transaction flow (or read cached value you stored)
2.  Parse returned bytes into a price or random value
3.  Apply its rules (pay winners, settle round)

Your oracle id (`2:N`) becomes part of their config at Initialize — hardcode it only in test; use Initialize args in production so deployers can point at the right oracle.

## Example oracles on AlkaneScan

Explore working demos — each page explains what the oracle does and how to call it:

-   [Random Number Oracle](oracle.php?id=random) — verifiable on-chain randomness
-   [Block Header Oracle](oracle-block-header.php) — Bitcoin block height, time, and hash data
-   [BTC/USD Price Feed](oracle-price-feed.php) — on-chain price updates for lending and stablecoins

Browse all oracle types on the [Oracles hub](oracles.php), then adapt a pattern in [Deploy](deploy.php) for your own contract.

⚠️ Trusted updater risk

If one private key can set any price, you have a central point of failure. Document who holds that key, use multisig, or derive prices from on-chain pools where possible.

[← All tutorials](tutorials/)