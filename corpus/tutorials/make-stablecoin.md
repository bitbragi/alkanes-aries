---
title: 💵 How to create a stablecoin on Alkanes
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-stablecoin.php
---

Tutorial 14 · 18 min read

# 💵 How to create a stablecoin on Alkanes

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

A **stablecoin on Alkanes** is usually a smart contract that mints a $1-target token when users lock **collateral** (often DIESEL or BTC-backed alkanes) and burns it when they repay. The contract + token are often the **same alkane id**.

## What is a stablecoin? (simple)

Imagine a pawn shop that gives you stable receipts worth ~$1 when you leave a gold watch worth $1.50. If the watch price drops too much, someone else can liquidate the shop. On-chain stablecoins work similarly with **collateral ratios** and **oracles** for prices.

## CDP model (collateralized debt position)

1.  **Deposit collateral** — Lock DIESEL (or frBTC-linked asset) in the contract
2.  **Mint stablecoin** — Borrow USDa against collateral if health factor OK (e.g. 150% collateralization)
3.  **Repay** — Send stablecoin back; debt goes down; supply burns
4.  **Withdraw collateral** — When debt is low enough, pull collateral out
5.  **Liquidate** — Third parties repay unhealthy positions for a bonus + seized collateral

## Pieces you need to build one

-   **Oracle contract** — Publishes collateral/USD price (see [oracle tutorial](tutorials/tutorial-oracle.php), [Oracles](oracles.php))
-   **Collateral alkane** — e.g. DIESEL `2:0`
-   **Rust WASM contract** — Opcodes: Initialize, Deposit, Mint, Repay, Withdraw, Liquidate, admin pause
-   **Parameters** — Min CR, liquidation CR, fees, debt cap, max staleness
-   **Audit** — [AlkaneScan Audit](audit.php) + human review before mainnet TVL

## USDa design reference

AlkaneScan documents a full **USDa** stablecoin pattern you can use as a blueprint:

-   Token: **USDa**, 8 decimals (`100000000` = 1.00 USDa)
-   Default collateral: **DIESEL 2:0**
-   Oracle: e.g. `2:77597` GetPrice opcode 10
-   Initialize packs owner, collateral id, oracle id, ratios, fees, name/symbol
-   User opcodes: DepositCollateral, Mint, Repay, WithdrawCollateral, Liquidate

The summary below covers the main settings and opcodes. For advanced byte layouts and mainnet defaults, work with your developer or [contact us](contact.php) before going live.

1

**Deploy price oracle**

Or use existing mainnet oracle id — stablecoin reads price on each mint/liquidate.

2

**Customize the contract code**

Adjust collateral, fees, caps, and symbol (USDa → your brand) in your Rust source, then run [Audit](audit.php).

3

**Audit & test**

Focus on oracle staleness, liquidation math, and owner keys.

4

**Deploy on mainnet**

Use [Deploy](deploy.php) for simple setups. USDa-style binary Initialize (like ICO) may need developer help until the web UI adds a stablecoin form.

5

**Publish docs**

Min CR, oracle id, liquidation bonus — transparency builds trust.

⚠️ Not a toy

Stablecoins hold other people’s collateral. Bugs cause permanent loss. Automated audit is not enough for high TVL — get professional review and gradual rollout.

## Deploy on AlkaneScan

Simple u128 Initialize fields work in [Deploy](deploy.php) for basic tokens. Advanced stablecoin deploys use the same commit → reveal flow as the [deploy tutorial](tutorials/tutorial-deploy.php).

## Tips

-   Set **debt cap** and **max supply** at launch; raise later via governance
-   Monitor oracle heartbeat — stale price = wrong mint/liquidate
-   Keep liquidation bonus attractive so underwater vaults clear quickly
-   Compare to MakerDAO / CDP concepts — same economics, Alkanes execution

[← All tutorials](tutorials/)