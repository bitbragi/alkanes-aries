---
title: 🚀 How to deploy an Alkanes smart contract
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-deploy.php
---

Tutorial 7 · 16 min read

# 🚀 How to deploy an Alkanes smart contract

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

Deploying puts your WASM contract on Bitcoin mainnet and gives you a new alkane id `2:N`. Alkanes uses a **commit → reveal** pattern (two transactions) — like sealing an envelope, then opening it.

## Two-step deploy (deep but simple)

### Step 1 — Commit (prepare)

You pay BTC fees and commit to the hash of your contract code + init data. The network locks this commitment in a UTXO. Think: letter goes into a locked drop box.

**Wait ~10 minutes** (confirmations). Do not skip this — reveal needs the commit tx visible on-chain.

### Step 2 — Reveal (go live)

You publish the actual WASM and run Initialize if configured. Your contract gets a fresh id. Think: opening the drop box and registering the robot officially.

Why two steps?

Bitcoin block space and commit/reveal patterns help align fees with data size and prevent certain malleability issues during inscription-style deploys. You experience it as “prepare, wait, go live.”

## Before you start

-   **UniSat wallet** on Bitcoin mainnet
-   **Taproot address** (`bc1p…`) — required for deploy PSBTs
-   **Plain BTC** for fees — amount depends on WASM size (large contracts = higher data fees)
-   **Finished lib.rs** — audited via [Audit](audit.php) recommended
-   **Initialize values** ready (token settings, DAO params, etc.)

💡 Consolidate UTXOs

If deploy says “insufficient balance” but you have enough BTC total, you may have many tiny UTXOs. Send most BTC to your own `bc1p…` in one payment, wait for confirmation, retry.

## AlkaneScan Deploy wizard (step by step)

1

**Paste code**

Open [Deploy](deploy.php), paste `lib.rs`, or load an example.

2

**Analyze**

Checks Alkanes patterns + Grok verification. Fix blockers before continuing.

3

**Token settings**

Fill Initialize args — name, DAO params, ICO fields, etc.

4

**Connect wallet**

Set fee rate (1–3 sat/vB common). Higher = faster confirmation.

5

**Compile + prepare tx**

Server compiles Rust → WASM, builds prepare PSBT. Sign in UniSat.

6

**Wait**

Copy commit txid. Wait for confirmations (~10 min).

7

**Reveal**

Step 5 in UI — sign go-live tx. Initialize runs here if atomic mode.

8

**Find your id**

Look up reveal tx on [espo.sh](https://espo.sh) — note new `2:N`.

## Fees & UTXOs

You pay:

-   **Commit fee** — Bitcoin miner fee for prepare tx
-   **Reveal / data fee** — Scales with compressed WASM size (bigger contract = more sats)

The wizard estimates before you sign. ICO-sized contracts can need **tens of thousands of sats** or more — keep a buffer.

Only **plain BTC UTXOs** pay fees. UTXOs carrying inscriptions or other alkanes are excluded automatically.

## Atomic vs deploy-only

-   **Deploy + set up in one go (atomic)** — Recommended. Cellpack `[1, 0, 0, …init args]` runs Initialize on reveal.
-   **Deploy only** — Cellpack `[1, 0]`. Contract exists but uninitialized until you send a separate Initialize call later (advanced).

## Troubleshooting

-   **Compile failed** — Read error log; often missing import (`to_arraybuffer_layout`) or syntax error
-   **Expected Point / taproot** — Disconnect UniSat, reconnect, retry
-   **Insufficient balance** — More BTC or consolidate UTXOs; try fee rate 1
-   **Reveal fails** — Commit tx not confirmed yet; wait longer
-   **Initialize reverts** — Wrong init args or attached tokens; double-check Step 2 settings on Deploy and your contract’s Initialize rules

Server health: Deploy page checks the compiler on our backend. If red, the server may be temporarily unavailable — your code can still be valid; try again later or [contact us](contact.php) if it persists.

[← All tutorials](tutorials/)