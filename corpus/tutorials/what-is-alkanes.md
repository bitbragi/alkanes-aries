---
title: 🧱 What is the Alkanes protocol?
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-what-is-alkanes.php
---

Tutorial 1 · 12 min read

# 🧱 What is the Alkanes protocol?

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

**Imagine Bitcoin is a giant notebook.** Everyone can see when Alice sends Bob money. That notebook is amazing at moving BTC — but it does not run apps by itself. **Alkanes** adds small programs (smart contracts) and tokens that live on Bitcoin through a system called a _metaprotocol_.

## The simple idea

Think of each Alkanes smart contract as a **tiny robot in a box**. You give the box a number like `2:77595`. When someone sends a Bitcoin transaction with the right secret message, the robot wakes up, reads the message, and follows the rules you programmed — mint a token, record a vote, pay a winner, etc.

The robot’s brain is written in **Rust**, compiled to **WebAssembly (WASM)**, and stored on Bitcoin as part of the deploy process. No separate blockchain. No Ethereum. Same Bitcoin network you already know.

💡 Tip for beginners

You do not need to understand metaprotocol indexing on day one. Start with: “I deploy code → I get an id → I send messages to that id.”

## Bitcoin vs Alkanes — what each layer does

-   **Bitcoin layer** — Moves satoshis (BTC). Miners confirm transactions. UTXOs hold your balance.
-   **Alkanes layer** — Interprets special data in those transactions as program calls. Tracks token balances per alkane id. Runs WASM when rules say so.

Your wallet still signs normal Bitcoin transactions. UniSat and similar wallets can sign the PSBTs AlkaneScan tools build for you. You pay **miner fees in BTC** like any other transaction.

## What does `2:N` mean?

Every alkane (token or contract) has an id with two numbers: **block** and **tx**. Example: `2:77595` means block `2`, transaction index `77595`.

New contracts you deploy usually land at the next free slot on block `2` — so your brand-new contract might become `2:80001` after go-live. Famous tokens like DIESEL use `2:0`.

On AlkaneScan you’ll see these ids on the [Market](index.php), in pool pages, and in demo apps like [Predict](predict.php) or [Dice](dice.php).

⚠️ Common mistake

Do not confuse a **Bitcoin address** (`bc1p…`) with an **alkane id** (`2:N`). Addresses hold BTC. Alkane ids identify tokens and contracts.

## How you “talk” to a contract (cellpacks)

When you want the robot to do something, you attach a message called a **protostone** with a **cellpack** inside. Think of it as pressing buttons on a vending machine:

-   `[1, 0]` — Deploy a new contract (factory call)
-   `[1, 0, 0, …args]` — Deploy _and_ run Initialize (opcode 0) in one go (“atomic deploy”)
-   `[2, N, opcode, …args]` — Call opcode on existing contract `2:N`

Each number in the cellpack is encoded as a **u128 cell** (a big integer). Simple contracts use plain numbers for settings. Complex ones (like ICO) pack bytes across many cells — the deploy wizard helps with that.

## Tokens on Alkanes

Tokens are alkanes too — same `2:N` id system. A free-mint token might let anyone call `Mint` for a fixed price. A premine token sends the whole supply to the deployer at Initialize.

Most templates use **8 decimal places** (like Bitcoin sats): `100000000` = 1.0 token. Always check the contract you use — decimals are not universal unless the template says so.

## Who is Alkanes for?

-   **Users** — Hold tokens, play apps, trade on marketplaces.
-   **Creators** — Launch tokens via [Launch Token](launch-token.php) without coding.
-   **Developers** — Write Rust contracts, deploy via [Deploy](deploy.php), audit via [Audit](audit.php).

## What to learn next

Pick your path:

-   Want to **launch a token**? → [How to make a token](tutorials/tutorial-token.php)
-   Want to **write code**? → [How to make a smart contract](tutorials/tutorial-smart-contract.php)
-   Want to **go live**? → [How to deploy](tutorials/tutorial-deploy.php)

[← All tutorials](tutorials/)