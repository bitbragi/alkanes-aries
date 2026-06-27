---
title: 🔁 How to swap tokens on iDclub
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-swap-idclub.php
---

Tutorial 18 · 10 min read

# 🔁 How to swap tokens on iDclub

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

**iDclub** ([idclub.io](https://idclub.io/marketplace)) is a **marketplace** for Alkanes tokens on Bitcoin. You trade with other users’ listings — not an AMM pool. This guide covers buying, selling, and effectively “swapping” tokens there.

## How trading works on iDclub (simple)

On a DEX you swap against a pool. On iDclub you usually:

-   **Buy** — Pay BTC to take someone’s sell listing and receive their alkane token
-   **Sell** — List your alkane for BTC; a buyer fills your listing

To “swap” token A for token B, you typically **sell A for BTC**, then **buy B with BTC** (two steps, unless iDclub adds a direct swap UI). Prices come from listings, not pool math.

AlkaneScan pulls market data from iDclub — browse tokens on the [Market](index.php) before you trade.

## Before you trade

-   **Wallet** — UniSat on **Bitcoin mainnet**
-   **Taproot address** — Many Alkanes flows use `bc1p…`
-   **BTC for buys + fees** — Purchases and network fees both need plain BTC
-   **Verify alkane id** — Every token has an id like `2:77595`. Match name + id on [Ordiscan](https://ordiscan.com/alkanes), not just the ticker
-   **Compare prices** — Check [Pools](pools.php) and [Subfrost](https://app.subfrost.io/) for the same token — marketplace vs pool prices can differ

## Buy a token (BTC → alkane)

1

**Open marketplace**

Go to [idclub.io/marketplace](https://idclub.io/marketplace).

2

**Find the token**

Search by name or browse. Confirm the listing shows the correct **alkane id** (e.g. DIESEL = `2:0`).

3

**Compare listings**

Check price per unit, minimum order, and seller if shown. Cheapest is not always best if listing size is tiny.

4

**Connect wallet**

Connect UniSat when prompted. Confirm mainnet.

5

**Buy**

Choose amount, review total BTC + fees, sign in wallet.

6

**Wait & verify**

After confirmation, check balance in UniSat or on [espo.sh](https://espo.sh).

## Sell a token (alkane → BTC)

1

**Hold the token**

You need the alkane in your wallet (from mint, buy, or transfer).

2

**Create listing**

On iDclub, choose sell / list and pick the token + amount + BTC price.

3

**Sign listing tx**

Follow iDclub’s flow — may lock or transfer tokens per their marketplace rules.

4

**Wait for buyer**

Listing stays until filled or cancelled. You receive BTC when someone buys.

Listing mechanics can change with iDclub updates — always read the on-screen instructions on [idclub.io](https://idclub.io/marketplace) before signing.

## Swap token A → token B (two-step)

iDclub is listing-based, so a direct “swap” UI may not exist for every pair. Typical path:

1.  **Sell token A** for BTC (create or fill a sell listing)
2.  **Buy token B** with the BTC you received

For one-click pool swaps (e.g. frBTC ↔ DIESEL), use [Subfrost swap tutorial](tutorials/tutorial-swap-subfrost.php) instead.

Buying DIESEL specifically? See also [How to buy DIESEL](tutorials/tutorial-buy-diesel.php).

⚠️ Scams & wrong tokens

Scammers reuse popular names with different alkane ids. Always verify `2:N` on Ordiscan. Only use the official [idclub.io](https://idclub.io/marketplace) domain.

## Tips & safety

-   **Start small** — Test buy/sell with a tiny amount first
-   **Compare venues** — iDclub vs Subfrost vs pool prices before large trades
-   **UTXO hygiene** — Crowded wallets can make txs fail; consolidate fee UTXOs when needed
-   **Track txs** — [espo.sh tutorial](tutorials/tutorial-espo.php) for confirmation issues
-   **Market data** — [AlkaneScan Market](index.php) shows volume and prices sourced from iDclub and other venues

[← All tutorials](tutorials/)