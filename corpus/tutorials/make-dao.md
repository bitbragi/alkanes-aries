---
title: 🏛️ How to make a DAO on Alkanes
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-dao.php
---

Tutorial 5 · 17 min read

# 🏛️ How to make a DAO on Alkanes

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

A **DAO** is a club treasury on Bitcoin where members vote before money moves. No single admin can drain it after setup — rules are in the contract.

## What is a DAO? (simple)

Imagine a piggy bank with a slot for proposals. Members drop in voting tokens to get a voice. If enough people vote “yes” after a waiting period, the bank sends BTC or tokens as written. If not, nothing happens.

AlkaneScan’s DAO example follows **stake → propose → vote → execute** patterns similar to Aragon / DAOstack. Main opcodes include `stake`, `create_proposal`, `vote`, and `execute`, plus read-only getters — load the **DAO governance** example on [Deploy](deploy.php) to explore the full template.

## The pieces

-   **Governance token** — Who can vote (e.g. DIESEL `2:0` or your own token)
-   **Stake** — Lock tokens to get voting power (often 1:1)
-   **Proposals** — “Call contract X opcode Y with arg Z and attach N tokens from treasury”
-   **Quorum** — Minimum % of total stake that must participate
-   **Approval** — Minimum % of votes that must be “yes”
-   **Execution delay** — Timelock after voting ends before anyone can execute
-   **Treasury** — Tokens the DAO holds (from donations or protocol fees)

## Proposal lifecycle

1

**create\_proposal**

Proposer specifies target contract, opcode, args, and optional token transfer from treasury.

2

**vote**

Members vote FOR / AGAINST / ABSTAIN during voting period. Stake may lock until vote ends (anti flash-vote).

3

**Wait**

Voting ends + execution delay passes.

4

**execute**

Anyone can trigger execution if quorum + approval met. DAO calls target with attached treasury tokens.

## Initialize settings (8 u128 fields)

When you load the DAO example on [Deploy](deploy.php), Step 2 fills:

-   **Gov token block / tx** — Which token counts for voting (default DIESEL `2:0`)
-   **Voting period** — Blocks proposals stay open for votes
-   **Quorum %** — e.g. 20 = 20% of stake must vote
-   **Approval %** — e.g. 51 = majority of votes cast must be FOR
-   **Execution delay** — Extra blocks after vote before execute
-   **Proposal lifetime** — When inactive proposals expire
-   **Min proposal stake** — Minimum stake to create a proposal

💡 Tip

Use **long execution delays** for treasuries holding serious value — gives community time to react if a bad proposal passes.

## Deploy on AlkaneScan

1.  Deploy or choose governance token first
2.  Load **DAO example** on Deploy → Analyze
3.  Adjust Initialize numbers in Step 2
4.  Connect UniSat → prepare → wait → reveal
5.  Call `stake` with governance tokens to activate voting
6.  Test tiny proposal before real treasury

## Tips & pitfalls

-   **No admin keys** after Initialize — design is intentional; you cannot “recover” a typo except via new DAO migration
-   **Proposal targets** — A malicious proposal could call a dangerous opcode; voters must understand calldata
-   **Low quorum** — Lets small groups pass proposals; set quorum realistically for your community size
-   **Audit** — Run [Audit](audit.php) if you modify DAO code beyond the example

[← All tutorials](tutorials/)