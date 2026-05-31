---
title: 🔄 How to swap tokens on Subfrost
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-swap-subfrost.php
---

Tutorial 16 · 10 min read

# 🔄 How to swap tokens on Subfrost

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

**Subfrost** is a DeFi app on Alkanes where you can **swap one alkane token for another** using on-chain liquidity pools — similar to a DEX on Ethereum, but settled on Bitcoin. This guide walks through swapping on [app.subfrost.io](https://app.subfrost.io/).

## What is a swap on Subfrost? (simple)

A **swap** trades token A for token B in one transaction. Subfrost pools hold both sides (e.g. frBTC + DIESEL). When you swap, the pool math updates balances and sends you the output token.

This is different from a marketplace listing — you trade against a **pool**, not a single seller’s ask price. Price moves with trade size (slippage).

New to wrapped BTC or DIESEL? Read [What is frBTC and Subfrost?](tutorials/tutorial-frbtc-subfrost.php) first.

## Before you swap

-   **Wallet** — UniSat (or another Alkanes-capable wallet) on **Bitcoin mainnet**
-   **Taproot address** — Most flows use `bc1p…`
-   **Input token** — You need the token you are swapping _from_ (e.g. frBTC, DIESEL, or another alkane in a live pool)
-   **BTC for fees** — Every swap is a Bitcoin transaction; keep plain BTC UTXOs for miner fees
-   **Verify alkane ids** — Check `2:N` on [Ordiscan](https://ordiscan.com/alkanes) or [AlkaneScan Market](index.php) before large trades

## Swap step by step on app.subfrost.io

1

**Open the app**

Go to [app.subfrost.io](https://app.subfrost.io/) in your browser. Use the official URL only — bookmark it.

2

**Connect wallet**

Click connect and approve UniSat. Confirm you are on **mainnet**, not testnet.

3

**Open Swap / Trade**

Find the swap tab in the Subfrost UI (wording may be “Swap”, “Trade”, or similar).

4

**Pick tokens**

Select **You pay** (input) and **You receive** (output). Example: frBTC → DIESEL `2:0`, or DIESEL → another project token if the pool exists.

5

**Enter amount**

Type how much to swap. Read the estimated output and **price impact** — big trades move the price more in thin pools.

6

**Set slippage**

Slippage is how much worse a price you accept if the pool moves before confirmation. Start with a modest setting (e.g. 0.5–1%). Raise only if swaps fail in volatile moments.

7

**Review & sign**

Double-check both token names and alkane ids. Approve the transaction in UniSat. Wait for Bitcoin confirmation.

8

**Confirm receipt**

Check your wallet balance or look up the tx on [espo.sh](https://espo.sh).

## Common swap paths

-   **BTC → frBTC → DIESEL** — Wrap BTC first (Subfrost wrap flow), then swap frBTC into DIESEL in a pool
-   **DIESEL ↔ frBTC** — Core ecosystem pair; check live liquidity on Subfrost and [AlkaneScan Pools](pools.php)
-   **Project token ↔ DIESEL** — Many tokens trade against DIESEL if a pool was created

Available pairs change as liquidity is added. If a pair is missing, you may need another venue — see [swap on iDclub](tutorials/tutorial-swap-idclub.php) or [buy DIESEL](tutorials/tutorial-buy-diesel.php).

## After the swap

-   Save the transaction id if you need support or tax records
-   Use received tokens in AlkaneScan apps (Dice, Predict, etc.) once you hold the correct alkane id
-   Compare your effective price to [Market](index.php) data — large deviations may mean thin liquidity or high slippage

⚠️ Wrong token or fake site

Always verify alkane ids (`2:N`). Phishing copies of DeFi sites exist. Only use [app.subfrost.io](https://app.subfrost.io/). Canonical DIESEL is `2:0`.

## Tips & safety

-   **Start small** — Test with a tiny swap before moving size
-   **Watch price impact** — Split large trades or use deeper pools
-   **Keep fee UTXOs** — Do not spend your last sat on the swap input; fees are paid in BTC
-   **Failed swap** — Often slippage too low or pool moved; retry with updated quote or higher slippage
-   **Track txs** — [espo.sh tutorial](tutorials/tutorial-espo.php) for debugging

[← All tutorials](tutorials/)