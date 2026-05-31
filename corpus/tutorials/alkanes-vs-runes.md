---
title: 🪨 Alkanes vs Runes — what's the difference?
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-alkanes-vs-runes.php
---

Tutorial 15 · 12 min read

# 🪨 Alkanes vs Runes — what's the difference?

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

**Runes** and **Alkanes** are both ways to create fungible tokens on Bitcoin — but Runes focus on simple transfer format, while Alkanes adds **full smart contracts**.

## Two Bitcoin token stories (simple)

After Ordinals, the Bitcoin community wanted fungible tokens that don’t bloat the chain with tons of inscriptions. **Runes** (by Casey Rodarmor, OP\_RETURN based) became the “official feeling” fungible standard. **Alkanes** came as a metaprotocol for **WASM programs + tokens + composability** on the same Bitcoin UTXO model.

## What are Runes?

Runes encode token mints and transfers in **OP\_RETURN** outputs using a compact protocol (edicts, terms, etc.). Indexers track rune balances per UTXO.

-   **Strength:** Simple fungible tokens, wallet support growing, efficient for pure transfers
-   **Limit:** Not a general smart contract platform — no arbitrary Rust/WASM logic in the Rune itself
-   **Id:** Rune name / number (e.g. UNCOMMON•GOODS) — different from `2:N`

## What are Alkanes?

Alkanes deploy **WebAssembly contracts** with opcodes (Initialize, Mint, Swap, Vote…). Tokens are often implemented _inside_ those contracts. Everything speaks via protostones/cellpacks in Bitcoin txs.

-   **Strength:** DeFi, DAOs, oracles, games, stablecoins — any logic you can write in Rust
-   **Limit:** More complex deploy (commit/reveal), audit burden, smaller but growing tooling
-   **Id:** `block:tx` e.g. DIESEL `2:0`

## Comparison table

Feature

Runes

Alkanes

Data carrier

OP\_RETURN runestone

Protostone / WASM deploy

Programmability

Transfer + mint terms

Full smart contracts

Typical use

Memecoins, community tokens

Apps, AMM, lending, prediction markets

Deploy complexity

Lower (etch + mint)

Higher (compile + commit/reveal)

Explorers

Rune explorers / Ordiscan runes

[Ordiscan Alkanes](https://ordiscan.com/alkanes), espo.sh

## When to use which?

-   **Choose Runes** if you only need a fungible token with mint/transfer and wide simple wallet support — no custom on-chain logic
-   **Choose Alkanes** if you need rules: AMM pricing, collateralized debt, random oracle, DAO votes, taxed transfers, etc.

## Can they work together?

As a **user**, you may hold Runes and Alkanes in parallel in Bitcoin-aware wallets. As a **developer**, they are separate protocols — you generally build on one stack. A bridge between them would be its own custom contract + indexer story (not built-in).

💡 Learn more on AlkaneScan

[What is Alkanes?](tutorials/tutorial-what-is-alkanes.php) · [Make a token](tutorials/tutorial-token.php) · [Alkanes vs BRC-20](tutorials/tutorial-alkanes-vs-brc20.php)

[← All tutorials](tutorials/)