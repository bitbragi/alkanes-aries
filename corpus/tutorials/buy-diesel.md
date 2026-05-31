---
title: ⛽ How to buy DIESEL tokens
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-buy-diesel.php
---

Tutorial 8 · 10 min read

# ⛽ How to buy DIESEL tokens

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

**DIESEL** is the main utility token of the Alkanes ecosystem. Its id is `2:0`. You need DIESEL for many apps (dice, pools, swaps, fees) — this guide shows **three common places to buy it**.

## What is DIESEL? (simple)

Think of DIESEL like **arcade tokens** for Alkanes apps on Bitcoin. BTC pays miners; DIESEL often pays for in-protocol actions, staking in demos, or trading on AMMs. It is _not_ the same as BTC — always check you are buying alkane `2:0`, not a look-alike name on another system.

On AlkaneScan you will see DIESEL on the [Market](index.php) and in apps like [Dice](dice.php) and [Panda Strategy](panda-strategy.php).

## Before you buy

-   **Wallet** — UniSat (or another Alkanes-capable wallet) on **Bitcoin mainnet**
-   **Taproot address** — Many flows use `bc1p…`
-   **Some BTC** — For marketplace purchases and miner fees
-   **Verify the token id** — Real DIESEL is `2:0`

## Buy on idclub.io (marketplace)

1

**Open the marketplace**

Go to [idclub.io/marketplace](https://idclub.io/marketplace) (also linked from AlkaneScan config).

2

**Search DIESEL**

Find listings for alkane `2:0` or “DIESEL”. Check price per unit and seller reputation if shown.

3

**Connect wallet**

Connect UniSat when prompted. Confirm network is mainnet.

4

**Buy listing**

Pay BTC (and fees). Wait for confirmation.

5

**Check balance**

Verify DIESEL in wallet or on [espo.sh](https://espo.sh) / [Ordiscan](https://ordiscan.com/alkanes).

Marketplace prices follow supply and demand — compare to AMM prices before large buys. Full guide: [How to swap tokens on iDclub](tutorials/tutorial-swap-idclub.php).

## Buy on app.subfrost.io (Subfrost app)

**Subfrost** is a DeFi hub on Alkanes (swaps, wrapped BTC, liquidity). To buy DIESEL there:

1

**Open [app.subfrost.io](https://app.subfrost.io)**

Use a supported wallet (typically UniSat).

2

**Go to Swap / Trade**

Pick a pair that gives you DIESEL — e.g. swap frBTC or another alkane **into DIESEL 2:0** (exact pairs depend on live pools).

3

**Set amount & slippage**

Start small for your first swap. Read estimated output.

4

**Sign transaction**

Approve in wallet. Wait for confirmation.

See also: [What is frBTC and Subfrost?](tutorials/tutorial-frbtc-subfrost.php) · [How to swap on Subfrost](tutorials/tutorial-swap-subfrost.php)

## Swap on OYL AMM

**OYL** provides AMM (automated market maker) swaps on Alkanes — constant-product pools like Uniswap-style trading.

-   Find a pool that includes **DIESEL (2:0)** and the token you hold (BTC-backed alkane, project token, etc.)
-   Connect wallet via the OYL interface or integrator that routes to OYL pools
-   Swap input token → DIESEL; pay BTC miner fee on the Bitcoin transaction
-   Check price impact — thin pools move price more on big trades

AlkaneScan [Pools](pools.php) page tracks DEX liquidity — useful to see where DIESEL trades before you swap.

⚠️ Scams & wrong tokens

Only trust `2:0` for canonical DIESEL. Random “DIESEL” tickers on unrelated chains or inscriptions are not the same. Bookmark official sites.

## Tips & safety

-   **Compare venues** — idclub vs Subfrost vs AMM; best price changes hourly
-   **Start small** — Test with a tiny buy before moving size
-   **Keep fee UTXOs** — Leave plain BTC for future transactions; don’t spend your last sat on fees
-   **Track txs** — [espo.sh tutorial](tutorials/tutorial-espo.php) for confirmation debugging

[← All tutorials](tutorials/)