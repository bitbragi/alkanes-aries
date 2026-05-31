---
title: 📡 How to use espo.sh to track contract activity
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-espo.php
---

Tutorial 10 · 12 min read

# 📡 How to use espo.sh to track contract activity

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

**espo.sh** is an explorer for Bitcoin transactions that show **Alkanes activity** — deploys, token moves, and contract calls. AlkaneScan links to it after you deploy or launch a token.

## What is espo.sh? (simple)

Think of a **security camera replay** for your Bitcoin tx. You paste the transaction id (txid) and see what happened: BTC moved, which alkanes transferred, which opcodes ran. It helps answer “Did my deploy work?” and “Where is my new `2:N` id?”

## Look up a transaction

1

**Copy txid**

From UniSat after you sign — 64-character hex string.

2

**Open**

[espo.sh](https://espo.sh) → paste into search or go to `https://espo.sh/tx/YOUR_TXID`

3

**Read status**

Confirmed vs pending. Check block height and time.

4

**Alkanes section**

Look for protostone / alkane transfers / factory deploy events in the tx detail view.

## Find your new contract id after deploy

When you **reveal** a deploy (step 2 of [deploy tutorial](tutorials/tutorial-deploy.php)):

1.  Open the **reveal tx** on espo.sh (not always the prepare/commit tx)
2.  Find the **factory deploy** or new alkane creation event
3.  Note the assigned id — usually `2:N` where N is the tx index of your contract
4.  Save that id on your website, socials, and market listings

Prepare (commit) tx only locks the commitment — your contract id appears on **reveal**.

## Track contract activity over time

For ongoing monitoring:

-   **Bookmark** your contract’s alkane page if espo exposes id-level views
-   **Watch txs** that call your opcodes — Mint, Buy, Vote, etc.
-   **Compare** with [Ordiscan](tutorials/tutorial-ordiscan.php) for holder balances and index-level browse
-   **AlkaneScan Market** — [Market](index.php) for price/volume once your token is tracked

Developers: log txids from your app’s PSBT broadcasts, then audit each on espo when users report failures.

## Common espo checks

**Launch token**

Confirm premine minted to your address

**Deploy contract**

Reveal tx shows WASM deploy + Initialize

**Swap / buy DIESEL**

DIESEL 2:0 credited to wallet

**Failed tx**

Revert reason sometimes visible in trace — fix args and retry

💡 Tip

AlkaneScan Deploy shows espo links after commit and reveal — use those instead of typing txids by hand when possible.

## Tips

-   Wait for **confirmations** before reveal — commit must be on-chain
-   Same txid format as mempool.space — you can cross-check BTC leg there
-   If espo is slow, wait and refresh — new txs index after a block

[← All tutorials](tutorials/)