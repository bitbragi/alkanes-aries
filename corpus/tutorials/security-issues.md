---
title: 🛡️ Security issues in Alkanes smart contracts
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-security-issues.php
---

Tutorial 18 · 16 min read

# 🛡️ Security issues in Alkanes smart contracts

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

Once an Alkanes contract is live on Bitcoin, you **cannot patch it like a website**. This guide lists the most common **security issues** in Alkanes smart contracts — for developers who write them and users who trust them with money.

Want a step-by-step audit workflow? See [How to audit an Alkanes smart contract](tutorials/tutorial-audit.php) and use [AlkaneScan Audit](audit.php).

## Why security matters on Alkanes

Alkanes contracts are WASM programs triggered by Bitcoin transactions. A single bug can:

-   Let anyone drain a treasury or mint unlimited tokens
-   Lock user funds forever (no admin escape hatch)
-   Accept the wrong token id and treat scam tokens as real
-   Revert every transaction (denial of service) via panics

There is no “undo button.” Fixes mean deploying a **new** contract and asking users to migrate.

## Access control failures

The #1 class of exploits: functions that should be admin-only but are callable by anyone.

-   **Missing owner check** — `withdraw`, `set_fee`, or `pause` without verifying the caller is the stored owner pubkey
-   **Wrong comparison** — Comparing pubkeys or alkane ids incorrectly (byte order, wrong field)
-   **Initialize sets attacker as owner** — If Initialize takes owner from user input with no validation, first caller wins
-   **“Anyone can execute” by design** — DAO `execute` is public (good) but proposal calldata must not allow arbitrary drains without vote checks (bad)

⚠️ Real-world pattern

Attacker calls `withdraw_all` because the contract never checked `msg_sender == owner`. Treasury gone in one block.

## Initialize & deployment traps

-   **Initialize runs twice** — Second call resets owner, caps, or oracle id. Use `observe_initialization()` and reject re-init
-   **Deploy-only without init** — Contract exists but uninitialized; attacker initializes with their settings first
-   **Wrong Initialize calldata** — ICO-style binary packing: one wrong byte sets wrong sale token id or price
-   **Missing attached tokens** — Initialize expects premine tokens in the same tx; without them, state is wrong or tx reverts confusingly

Always test Initialize on mainnet with **minimum values** before pointing real TVL at the contract.

## Token & attachment bugs

-   **Wrong alkane id** — Contract accepts `2:99999` when it meant `2:0` DIESEL; users lose value
-   **incoming\_alkanes ignored** — User sends tokens with the call but contract never credits them (stuck) or credits without checking amount
-   **Outgoing transfer bugs** — Sends more than intended, or sends to wrong recipient field from calldata
-   **No verification of attached token type** — “Pay with any token” when you meant one specific id

Users: verify the alkane id on [Ordiscan](https://ordiscan.com/alkanes) before approving large transfers.

## Math & logic errors

-   **Integer overflow / underflow** — Unchecked `+` / `-` on balances wraps in Rust unless you use `checked_add`
-   **Division by zero** — Pool or price math panics and bricks the contract for that call
-   **Rounding favors attacker** — Mint rounds down, redeem rounds up — slow drain over many txs
-   **Cap not enforced** — `cap` stored but Mint never reads it — infinite supply
-   **Off-by-one on time** — Voting ends one block early/late; unfair governance

## Oracle & external data risk

-   **Single key updates price** — Compromised key sets fake price → unfair mint or liquidation
-   **Stale price accepted** — Old oracle value used while market moved; vault becomes undercollateralized
-   **Oracle id hardcoded wrong** — Contract reads dead or malicious oracle at deploy
-   **Trusting user-supplied “oracle” address** — Attacker points contract at their fake feed

Stablecoins and lending are especially sensitive — see [stablecoin tutorial](tutorials/tutorial-stablecoin.php) and [oracle tutorial](tutorials/tutorial-oracle.php).

## Economic & game-theory attacks

Not always “code bugs” — sometimes the rules allow profitable abuse:

-   **Flash-style composability** — Borrow → manipulate pool → repay in same flow if your design allows it
-   **Governance capture** — Low quorum + whale stake passes malicious proposal
-   **First depositor / empty pool** — Classic AMM edge cases if minimum liquidity not locked
-   **Fee bypass** — Opcode path that skips fee logic used by integrators by mistake
-   **MEV on Bitcoin** — Block order and frontrunning still matter for competitive mints or auctions

## Alkanes-specific pitfalls

-   **Missing `observe_initialization()`** — Factory deploy assumptions broken; replay or spoof init
-   **Opcode mismatch** — Docs say opcode 5; enum uses 6 — integrators call wrong function
-   **Cellpack encoding errors** — u128 layout wrong; args read as garbage
-   **Panics (`unwrap`)** — User input triggers panic → tx fails, fees lost, no clear error
-   **BTC outputs** — Contract sends sats to wrong script or without checking output count
-   **DIESEL `2:0` assumptions** — Hardcoded id breaks if testing on different deployment

## How to protect yourself

**For developers:**

1.  Run [AlkaneScan Audit](audit.php) before every deploy
2.  Walk the manual checklist in the [audit tutorial](tutorials/tutorial-audit.php)
3.  Deploy small, test every opcode on mainnet with tiny amounts
4.  Get human review before serious TVL
5.  Publish clear docs: opcodes, ids, Initialize fields, required attachments

**For users:**

-   Verify alkane ids and official app URLs
-   Start with small test amounts
-   Prefer audited, time-tested contracts for large holdings
-   Track txs on [espo.sh](tutorials/tutorial-espo.php) when something looks wrong

💡 Remember

“Works in my test” ≠ secure. Attackers think in edge cases, wrong ids, and maximum u128 values — design and audit for those too.

[← All tutorials](tutorials/)