---
title: 🤖 How to make an Alkanes smart contract
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-smart-contract.php
---

Tutorial 2 · 18 min read

# 🤖 How to make an Alkanes smart contract

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

An Alkanes smart contract is one Rust file (`lib.rs`) that becomes a WASM program on Bitcoin. You define **what buttons exist** (opcodes) and **what happens when each is pressed**.

## Anatomy of `lib.rs`

Almost every Alkanes contract includes:

1.  A **struct** — your contract’s empty shell, e.g. `struct MyToken(());`
2.  **AlkaneResponder** — hooks into the runtime
3.  A **Message** enum with `#[derive(MessageDispatch)]` and `#[opcode(N)]` on each variant
4.  **Handler methods** — `fn mint(&self)`, `fn initialize(&self)`, etc.
5.  `declare_alkane!` — registers everything for WASM export

Web deploy on AlkaneScan uses a **single Rust file** pasted into [Deploy](deploy.php). If your developer split code across multiple files, ask them to merge everything into one file before you deploy on the website.

## Opcodes & MessageDispatch

Each public action gets a number. Users (or other contracts) send that number in the cellpack:

-   `#[opcode(0)] Initialize` — runs once when contract is born
-   `#[opcode(1)] Mint` — user-facing action
-   `#[opcode(100)] GetBalance` — read-only queries (often higher numbers)

The method name must match the enum variant. The runtime routes incoming calls to the right handler automatically when you use `MessageDispatch`.

💡 Tip

Reserve low opcodes (0–20) for core logic. Put read-only getters at 20+ so you can tell “state change” vs “query” at a glance.

## Initialize — setting up on birth

Most contracts use opcode **0** to configure name, owner, caps, linked token ids, etc. Two patterns:

-   **Simple** — `Initialize { token_units: u128, cap: u128, … }` — each field becomes one u128 in the cellpack
-   **Binary** — `Initialize,` with no fields; handler reads raw bytes from calldata (ICO-style)

Always call `self.observe_initialization()?;` at the start of Initialize. That tells the runtime “this contract was properly deployed through the factory” and prevents replay tricks.

⚠️ Attached alkanes at Initialize

Some contracts expect tokens sent _with_ the reveal transaction (`incoming_alkanes`). If yours does, document it clearly — wrong attachments make the tx revert and confuse users.

## Storage & state

Contracts persist data in a key-value store (often string keys like `"/owner"`, `"/cap"`). Patterns you’ll see:

-   `write_u128` / `read_u128` for numbers
-   `write_bytes` for pubkeys, scripts, names
-   Maps for per-user balances (key includes user id)

Think ahead: every field you write at Initialize should have a clear read opcode or getter for debugging on mainnet.

## Safe math & errors

On Alkanes, a **panic aborts the whole transaction** — user loses fees, nothing updates. Avoid:

-   `.unwrap()` and `.expect()` on user input
-   Raw `a + b` on token amounts — use `checked_add` or `saturating_add`
-   Division before checking divisor is non-zero

Return `Err(anyhow!("clear message"))` instead. Good error messages save hours when testing on mainnet.

## Compile to WASM

AlkaneScan [Deploy](deploy.php) compiles your code on our server — you do not need Rust installed in your browser. Developers who test locally use Rust with the `wasm32-unknown-unknown` target.

Flow: edit `lib.rs` → Analyze (checks structure + Grok) → Deploy (compile + commit + reveal).

## Pro tips

1

**Start from an example**

Load free-mint, DAO, or ICO in Deploy. Change one opcode at a time.

2

**Audit before deploy**

Run [Audit](audit.php) on the same source.

3

**Test with dust**

First mainnet deploy with minimal fees and tiny amounts.

4

**Document opcodes**

Future you (and users) need a table of opcode → args → effect.

[← All tutorials](tutorials/)