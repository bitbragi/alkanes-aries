---
title: 🏭 How to mint DIESEL tokens
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-mint-diesel.php
---

Tutorial 9 · 11 min read

# 🏭 How to mint DIESEL tokens

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

**DIESEL (`2:0`)** is special — it is the oldest / canonical alkane slot on block 2, tx 0. “Minting” means **creating new DIESEL units** through the protocol’s allowed rules — not the same as launching your own token on [Launch Token](launch-token.php).

## What “minting” DIESEL means (simple)

Imagine a fountain that only turns on when you follow exact rules (pay BTC, call the right opcode, use the official factory). **Minting** = new DIESEL coins come out of that fountain. **Buying** = someone else already has coins and sells them to you.

Most users get DIESEL by **buying or swapping** — see [How to buy DIESEL](tutorials/tutorial-buy-diesel.php). Minting matters when the protocol opens a public mint window or when you use an official app that creates DIESEL from BTC/frBTC.

## Mint vs buy — which should I use?

-   **Buy on idclub / AMM** — Fast, no mint logic to understand; price set by market
-   **Mint via official app** — Sometimes better rate during promotions; must follow exact UI steps
-   **Launch Token** — Creates _your_ token at `2:N`, **not** DIESEL `2:0`

## Protocol mint (understanding 2:0)

DIESEL is not deployed like a normal free-mint token. It lives at the fixed id `2:0`. New supply (when the protocol allows it) comes from:

-   Official Alkanes / Subfrost contracts with a **Mint** or **Claim** opcode
-   Paying BTC or wrapped BTC as input, receiving DIESEL as output
-   Rules encoded in WASM — if you send wrong amounts, the tx **reverts** (you lose fee only)

Always use the **current official interface** linked from trusted community channels — mint parameters (price, cap, pause) can change with upgrades.

1

**Open official mint UI**

Often on [app.subfrost.io](https://app.subfrost.io) or protocol docs — look for “Mint DIESEL” or “Acquire DIESEL”.

2

**Connect UniSat**

Mainnet, Taproot address with BTC for fees (+ mint cost if any).

3

**Enter amount**

Read cost in BTC or frBTC and expected DIESEL out (8 decimal base units).

4

**Sign & confirm**

Wait for Bitcoin confirmation.

5

**Verify balance**

DIESEL should appear as alkane `2:0` in wallet.

## Via Subfrost (common path)

Subfrost connects wrapped BTC (**frBTC**) and DIESEL liquidity. Some flows mint or route DIESEL when you:

-   Wrap BTC → frBTC, then swap to DIESEL
-   Use a direct “mint DIESEL” action if the app exposes it

Read [frBTC & Subfrost tutorial](tutorials/tutorial-frbtc-subfrost.php) for the full picture.

## Verify you received DIESEL

1.  Wallet alkane balance for `2:0`
2.  Transaction on [espo.sh](https://espo.sh) — alkane transfers in outputs
3.  [Ordiscan Alkanes](https://ordiscan.com/alkanes) — search your address or tx

💡 Tip

DIESEL uses **8 decimals** like many Alkanes tokens — `100000000` base units = 1.0 DIESEL in UIs that show human amounts.

## Tips

-   If mint is **paused**, use marketplace or AMM instead
-   Never mint from random links in DMs — phishing steals BTC
-   Consolidate UTXOs if mint tx fails with “insufficient balance” despite having BTC

[← All tutorials](tutorials/)