---
title: 🔎 How to view Alkanes contracts on Ordiscan
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-ordiscan.php
---

Tutorial 12 · 10 min read

# 🔎 How to view Alkanes contracts on Ordiscan

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

**Ordiscan** is a Bitcoin explorer that includes an **Alkanes** section — browse tokens, view balances, and explore protocol activity. AlkaneScan links to it from config as https://ordiscan.com/alkanes.

## What is Ordiscan? (simple)

If espo.sh is a zoom lens on _one transaction_, Ordiscan is more like a _phone book + map_ for alkanes — find an asset by id, see who holds it, skim recent activity. Great for research before you buy a token or integrate a contract.

## Open the Alkanes section

1

**Go to**

[https://ordiscan.com/alkanes](https://ordiscan.com/alkanes)

2

**Browse listings**

See indexed alkanes — names, ids, activity summaries (UI updates over time).

3

**Use filters**

Sort by popularity, recency, or search ticker if available.

## Search by id or address

### By alkane id (e.g. `2:77595`)

-   Enter `block:tx` format or use site’s id search
-   Open token/contract page — metadata, supply hints, links
-   Check it matches what the project website claims (anti-scam)

### By Bitcoin address

-   Paste your `bc1p…` address
-   View alkane balances attached to UTXOs or account views
-   Useful to confirm you received DIESEL `2:0` or your launch premine

## Inspect a smart contract (not just a token)

Contracts are alkanes too — they have ids like `2:N`. On Ordiscan you can:

-   Confirm the contract exists and was deployed (not vaporware)
-   See interaction volume — are others calling it?
-   Cross-check deploy tx with [espo.sh](tutorials/tutorial-espo.php)
-   Read linked metadata if the deployer registered name/symbol

For **opcode-level debugging** (which Mint failed), espo transaction view is often deeper. Use both tools together.

## Ordiscan vs espo.sh — when to use which

Quick guide

-   **Ordiscan** — Discovery, balances, “what is this token?”
-   **espo.sh** — “What exactly happened in tx abc123…?”
-   **AlkaneScan Market** — Prices, volume, pools aggregation

⚠️ Verify contract id

Scammers clone names. Always verify `2:N` on Ordiscan matches the official link from the team — not just the ticker “USDa” or “DIESEL”.

## Tips

-   Bookmark canonical DIESEL as `2:0`
-   After [deploy](tutorials/tutorial-deploy.php), search your new id within a few blocks
-   Compare holder count vs claimed “community size” for red flags

[← All tutorials](tutorials/)