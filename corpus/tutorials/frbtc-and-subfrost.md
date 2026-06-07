---
title: ₿ What is frBTC and Subfrost?
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-frbtc-subfrost.php
---

Tutorial 13 · 13 min read

# ₿ What is frBTC and Subfrost?

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

**Subfrost** is a DeFi stack on Alkanes. **frBTC** is its wrapped Bitcoin — BTC locked in a protocol design, represented as an alkane token you can swap, pool, and use in smart contracts.

## What is “wrapped BTC”? (simple)

Imagine putting your gold bar in a vault and getting a **receipt ticket** you can trade faster. Wrapped BTC is that ticket on Bitcoin layers: you lock real BTC (or follow a mint rule), you hold a token that **represents** BTC for apps.

It is not magic free BTC — value comes from the backing / mint mechanism the protocol defines. Always read how frBTC is minted and redeemed.

## What is frBTC?

**frBTC** (frost BTC) is Subfrost’s wrapped BTC asset on Alkanes. It has its own alkane id (check live app for current id — not hardcoded here because deployments can version).

-   Used in **Subfrost AMM pools** (swap frBTC ↔ DIESEL, etc.)
-   Used as **collateral or routing asset** in DeFi flows
-   Displayed on [app.subfrost.io](https://app.subfrost.io) with wrap/unwrap actions

## What is Subfrost?

**Subfrost** is the app + contracts that bring liquidity and wrapped BTC to Alkanes:

-   **app.subfrost.io** — User interface for wrap, swap, pools
-   **Smart contracts** — WASM on Alkanes (mint frBTC, pool math, fees)
-   **Ecosystem glue** — Connects BTC ↔ alkane DeFi ↔ DIESEL

Think of Subfrost as a **marketplace + bank counter** sitting on top of Bitcoin, powered by Alkanes robots instead of a separate blockchain.

## Wrap & unwrap flow (typical)

1

**Wrap (BTC → frBTC)**

Send BTC through Subfrost’s mint/wrap path. Sign with UniSat. Receive frBTC alkane to your address.

2

**Use in DeFi**

Swap frBTC for DIESEL or project tokens on Subfrost or OYL pools.

3

**Unwrap (frBTC → BTC)**

When supported, burn/return frBTC via protocol to receive BTC back — read live UI for fees, delays, limits.

Exact mechanics follow Subfrost contract opcodes — this tutorial explains concepts; always confirm on the app before large transfers.

## How frBTC connects to DIESEL

Many users path: **BTC → frBTC → DIESEL** on [app.subfrost.io](https://app.subfrost.io) instead of buying DIESEL only on idclub. Liquidity pools link wrapped BTC to the rest of the ecosystem.

See: [How to buy DIESEL](tutorials/tutorial-buy-diesel.php) · [AlkaneScan Pools](pools.php)

⚠️ Risks

Wrapped assets depend on contract correctness and liquidity for unwrap. Smart contract bugs, pauses, or illiquid pools can delay exit. Start small; read Subfrost docs and audit status.

## Tips

-   Verify you interact with **app.subfrost.io** (bookmark it)
-   Track wrap/unwrap txs on [espo.sh](tutorials/tutorial-espo.php)
-   Compare pool prices before big swaps — slippage matters
-   frBTC id ≠ BTC — wallets show alkane balance separately from sat balance

[← All tutorials](tutorials/)