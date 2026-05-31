---
title: 🔍 How to audit an Alkanes smart contract
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-audit.php
---

Tutorial 3 · 15 min read

# 🔍 How to audit an Alkanes smart contract

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

Deploying a bug is like leaving your vault door unlocked on the internet. An **audit** finds problems in your Rust contract _before_ users trust it with real BTC and tokens.

## Why audit?

Smart contracts are immutable once live. You cannot “push a hotfix” like a website. If Initialize sets the wrong owner, or Mint has no cap, or withdraw has no auth check — that mistake is permanent unless you deploy a whole new contract and migrate users manually.

Auditing combines:

-   **Automated scans** — fast pattern matching (missing imports, unwrap, etc.)
-   **AI review** — Grok reads your logic and suggests exploit paths
-   **Human review** — still gold standard for high-value contracts

## Issue categories (what each type means)

AlkaneScan Audit labels every finding with a type so you know what kind of problem it is:

-   **Security** — Someone could steal funds or break trust (reentrancy-style bugs, forged signatures)
-   **Access control** — Admin functions callable by anyone (pause, withdraw, set owner)
-   **Logic bug** — Wrong rules (cap not enforced, wrong token id, bad rounding)
-   **Integer overflow** — Unchecked math wraps or silently wrong balances
-   **Token economics** — Unfair mint, infinite supply, broken pricing
-   **Alkanes protocol** — Missing `observe_initialization`, wrong MessageDispatch, bad incoming\_alkanes handling
-   **Syntax & compile** — Won’t build, missing `metashrew_support` import, external mod files
-   **Deployment & init** — Wrong Initialize calldata packing (especially ICO binary layout)
-   **Panic risk** — `unwrap()` / `expect()` that kill the transaction

## Manual checklist (do this even after AI)

1

**Every privileged opcode**

Who can call pause, withdraw, mint admin, upgrade? Prove it in code.

2

**Every balance change**

Trace token in/out. Does total supply match?

3

**Initialize once**

Can Initialize run twice? Should it revert the second time?

4

**External calls**

When you call another alkane, what if it fails or sends unexpected tokens back?

5

**Edge cases**

Zero amounts, max u128, empty attachments, expired deadlines.

## Alkanes-specific checks

-   `declare_alkane!` present and matches your Message enum
-   Opcode numbers in enum match what your docs say
-   Initialize uses `observe_initialization()`
-   Token ids compared correctly (`AlkaneId { block, tx }`)
-   DIESEL `2:0` handled explicitly where needed
-   Treasury / BTC outputs verified if contract sends sats

⚠️ Limits of automated audit

AlkaneScan Audit is a strong first pass, not a certificate of safety. Novel bugs, economic attacks, and composability risks with other contracts still need human experts for serious treasuries.

## Using AlkaneScan Audit

1.  Open [Audit](audit.php)
2.  Paste full `lib.rs`
3.  Optional: add focus (“check withdraw auth”)
4.  Click **Run audit**
5.  Fix critical → high → medium; re-run until score and risk look acceptable

Filter by severity or issue type. Read the green “Fix” line on each card first — that’s the actionable part.

## Recommended workflow

**Write → Audit → Fix → Audit again → Deploy small → Monitor → Scale.**

Never skip audit because “it’s just a test.” Mainnet test deployments still hold real BTC in UTXOs and real tokens if you premine.

[← All tutorials](tutorials/)