---
title: 🪙 How to make a token on Alkanes
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-token.php
---

Tutorial 6 · 14 min read

# 🪙 How to make a token on Alkanes

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

An Alkanes token is a fungible asset with an id like `2:N`. Wallets and explorers show your **name**, **symbol**, and **balance** — similar to ERC-20 on Ethereum, but native to Bitcoin via Alkanes.

## What is an Alkanes token? (simple)

Think of digital stickers with your logo. Each sticker type has a serial number (`2:N`). Everyone can see how many stickers each address holds. Sending stickers = Bitcoin transaction with alkane transfer data.

Two common flavors:

-   **Premine** — All tokens minted to deployer at birth
-   **Free mint** — Users pay BTC/DIESEL to mint up to a cap

## Easy path: Launch Token (no code)

Best for first-time creators:

1

**Open [Launch Token](launch-token.php)**

Uses a battle-tested free-mint template (same family as template `4:797`).

2

**Enter name & symbol**

Plain text — e.g. name `mytoken`, symbol `MYTK`.

3

**Set supply**

Premine amount to your wallet (default 1M tokens with 8 decimals).

4

**Connect UniSat**

Taproot `bc1p…` address, enough BTC for miner fees.

5

**Sign & wait**

After confirmation, note your new id on espo.sh / market listings.

## Custom token contract (developers)

When Launch Token is not enough — custom mint rules, fees, bonding curves, DAO integration:

1.  Start from the **Free-mint token** example on [Deploy](deploy.php) (or paste code from your developer)
2.  Edit Initialize fields: `token_units`, `value_per_mint`, `cap`, name/symbol encoding
3.  Add opcodes: pause, owner mint, burn, etc.
4.  [Audit](audit.php) → [Deploy](tutorials/tutorial-deploy.php)

ICO sale contracts sell a _different_ token you deployed first — see the **ICO sale** example on [Deploy](deploy.php) and the [DAO tutorial](tutorials/tutorial-dao.php) for governance patterns.

## Decimals & amounts

Most AlkaneScan templates use **8 decimals** (like BTC sats):

-   `1` = 0.00000001 token
-   `100000000` = 1.0 token
-   `100000000000000` = 1,000,000 tokens

Always tell your community which decimals you use. UI on marketplaces may assume 8 — mismatch causes “wrong balance” confusion.

⚠️ UTXO hygiene

Keep plain BTC UTXOs for fees separate from inscription / alkane UTXOs. Crowded wallets (100+ UTXOs) can make deploy transactions fail or cost extra — consolidate when needed.

## After launch

-   List on market trackers (AlkaneScan indexes many tokens automatically)
-   Add liquidity on DEX pools if you want trading
-   Share contract id `2:N` — that’s the canonical identifier
-   Never share seed phrase; only share public id and website

## Tips

-   Pick a unique symbol — check [Market](index.php) first
-   Test with minimum supply on mainnet before big premine
-   Document tokenomics on your website or socials so holders know the rules
-   If you enable public mint, set a **cap** so supply cannot grow forever by surprise

[← All tutorials](tutorials/)