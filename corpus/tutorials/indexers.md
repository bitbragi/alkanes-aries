---
title: 📚 Alkanes indexers — what they are and how they work
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-indexers.php
---

Tutorial 19 · 13 min read

# 📚 Alkanes indexers — what they are and how they work

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

Bitcoin nodes store blocks and UTXOs — but they do not natively show “you hold 500 DIESEL” or “this contract ran opcode 3.” **Indexers** are services that read Bitcoin + Alkanes data and build the views you see in wallets, explorers, and sites like AlkaneScan.

## What is an Alkanes indexer? (simple)

Imagine a librarian who reads every new page of the Bitcoin notebook and keeps a **separate card catalog**:

-   Who holds which alkane token
-   Which contracts were deployed at which `2:N` id
-   What each transaction did (mint, swap, vote, etc.)

That catalog is the **indexed state**. Wallets and websites query indexers (or run their own) instead of re-scanning the entire chain from genesis every time you open a page.

## Bitcoin vs Alkanes state

A full Bitcoin node knows:

-   Blocks, transactions, scripts, UTXOs
-   Sats at each address

It does _not_ natively label “this UTXO carries alkane `2:77595` amount 100000000” in a user-friendly API. Alkanes rules live in a **metaprotocol** layer: protostones, cellpacks, WASM execution. Indexers implement those rules and expose results.

Your wallet balance for an alkane token is **indexer interpretation** of chain data — usually correct when the indexer matches the official Alkanes spec, but worth understanding when debuggers disagree.

## How indexing works (step by step)

1

**Follow Bitcoin blocks**

The indexer connects to Bitcoin (full node or trusted source) and watches new blocks.

2

**Find Alkanes-bearing txs**

Scan transactions for protostones / witness data that invoke Alkanes (deploy, call, transfer).

3

**Apply protocol rules**

Parse cellpack inputs, run or simulate WASM where needed, update balances and contract storage according to the Alkanes spec.

4

**Store derived state**

Database of alkane ids, holders, contract metadata, event history — optimized for search.

5

**Serve APIs & UIs**

Explorers (espo, Ordiscan), market sites (AlkaneScan), and wallets query this database.

Different products may index **different subsets** — one site focuses on market volume, another on raw tx traces, another on holder lists.

## What gets indexed?

Data

Example use

**Alkane ids** `2:N`

Market listings, contract links

**Token balances**

Wallet UI, holder rankings on Ordiscan

**Deploy events**

Finding your new contract after reveal

**Opcode calls**

Debugging Mint/Swap failures on espo

**Market / pool stats**

AlkaneScan price & volume (from iDclub, UniSat, etc.)

## Who runs indexers you already use?

-   **[espo.sh](https://espo.sh)** — Transaction-level Alkanes explorer (see [espo tutorial](tutorials/tutorial-espo.php))
-   **[Ordiscan Alkanes](https://ordiscan.com/alkanes)** — Browse alkanes, holders, activity (see [Ordiscan tutorial](tutorials/tutorial-ordiscan.php))
-   **AlkaneScan** — Market and pool data aggregated for [Market](index.php) and [Pools](pools.php)
-   **Wallets (e.g. UniSat)** — Show alkane balances by indexing or querying upstream services
-   **Marketplaces (iDclub, etc.)** — Index listings and trades for their UI

None of these replace a Bitcoin full node for consensus — they **interpret** chain data for humans and apps.

## Sync lag & when indexers disagree

-   **Block delay** — Right after your tx confirms, an explorer may need seconds to minutes to show it
-   **Reorgs** — Rare Bitcoin reorgs can temporarily show wrong state until indexers rewind
-   **Version skew** — Indexer not updated for newest Alkanes spec may miss new tx types
-   **Different scope** — espo shows tx trace; Ordiscan shows holders; AlkaneScan shows market — all valid, not identical

💡 If balance looks wrong

Wait a few blocks, refresh the explorer, check the same tx on both [espo.sh](https://espo.sh) and [Ordiscan](https://ordiscan.com/alkanes). If wallet and explorer disagree, the chain tx is still the source of truth — contact wallet or indexer support with the txid.

## Why users should care

-   **Confirmations** — “Indexed” on espo means your action is visible to the ecosystem, not just in your wallet
-   **Verify ids** — Use explorers to confirm you bought real `2:0` DIESEL, not a look-alike name
-   **Due diligence** — Holder count and activity on Ordiscan helps spot dead or scam tokens
-   **Patience** — Deploy reveal tx may exist on-chain before every site lists your new token

## Tips for developers

-   After deploy, link users to **reveal txid** on espo — indexers pick up from chain, not from your server alone
-   Do not assume AlkaneScan Market lists instantly — indexing + scraping pipelines take time
-   Emit clear, standard opcodes so indexers can classify activity (custom opaque bytes are harder to display)
-   Test that your contract’s transfers show correctly on espo before announcing launch
-   Security note: indexers show _public_ chain data — never put secrets in calldata (see [security issues tutorial](tutorials/tutorial-security-issues.php))

Related: [What is Alkanes?](tutorials/tutorial-what-is-alkanes.php) · [How to deploy](tutorials/tutorial-deploy.php) · [Track activity on espo.sh](tutorials/tutorial-espo.php)

[← All tutorials](tutorials/)