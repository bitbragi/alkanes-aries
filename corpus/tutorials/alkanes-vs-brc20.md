---
title: ⚖️ Alkanes vs BRC-20 — what's the difference?
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-alkanes-vs-brc20.php
---

Tutorial 14 · 11 min read

# ⚖️ Alkanes vs BRC-20 — what's the difference?

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

**BRC-20** and **Alkanes** are two different ways to put tokens and logic on Bitcoin. Both use Bitcoin transactions — but they work very differently under the hood.

## Both live on Bitcoin (simple)

Neither is a separate chain like Ethereum. Miners still confirm Bitcoin blocks. Wallets still hold UTXOs. The difference is **what extra data** you attach and **how indexers interpret it**.

## What is BRC-20?

BRC-20 is a token standard built on **Ordinals inscriptions** — mostly JSON text inscribed on satoshis saying things like “mint 1000 ORDI” or “transfer 50 to address X”. Indexers (UniSat, etc.) agree on rules and track balances.

-   **Pros:** Simple, popular for memecoins, lots of marketplace support
-   **Cons:** Limited programmability — no full smart contract logic in one unified WASM model; rules are indexer conventions + inscriptions

## What is Alkanes?

Alkanes runs **WASM smart contracts** with opcodes, storage, and protostones/cellpacks. Tokens can be built-in to contracts (mint/burn rules in Rust) or deployed as dedicated alkane ids `2:N`.

-   **Pros:** Real contract logic (DAOs, oracles, AMMs, games), composable calls between alkanes
-   **Cons:** Steeper learning curve (Rust, deploy flow, audit)

Start here: [What is Alkanes?](tutorials/tutorial-what-is-alkanes.php)

## Side-by-side comparison

Topic

BRC-20

Alkanes

Token creation

Inscribe deploy/mint JSON

Deploy WASM contract / factory

Smart contracts

Very limited

Full Rust → WASM programs

Id format

Ticker (e.g. ordi)

`2:N` alkane id

DeFi (AMM, lending)

Mostly off-indexer hacks

Native in contracts (Subfrost, OYL, USDa)

Tooling on AlkaneScan

Not focus

Launch, Deploy, Audit, Market

## When to use which?

-   **BRC-20** — Simple fungible meme token, inscription culture, existing BRC marketplaces
-   **Alkanes** — Apps, DeFi, governance, oracles, games, anything needing **custom code**

You can hold both in the same wallet ecosystem on Bitcoin — they are not mutually exclusive for users, but **developers pick one stack per project**.

## Tips for newcomers

-   Don’t assume BRC-20 ticker “DIESEL” equals Alkanes DIESEL `2:0` — verify id/protocol
-   Alkanes deploy costs BTC data fees — budget more than a tiny BRC inscription
-   Bridge BRC-20 into Alkanes: [wrapped token tutorial](tutorials/tutorial-wrapped-token.php) (wORDI / wSATS pattern)
-   Read [Alkanes vs Runes](tutorials/tutorial-alkanes-vs-runes.php) too — Runes is another Bitcoin token standard

[← All tutorials](tutorials/)