---
title: 💧 How to build an AMM on Alkanes (OYL Swap / iDclub)
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-amm.php
---

Tutorial 21 · 24 min read

# 💧 How to build an AMM on Alkanes (OYL Swap / iDclub)

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

This guide explains how to **build an AMM on Alkanes** the same way **OYL Swap**, **iDclub** pool trading, and **Subfrost** swaps work: a **Uniswap-style constant-product DEX** with a **factory** contract, one **pool alkane** per token pair, and **LP tokens** minted by each pool.

The canonical open-source reference is [Oyl-Wallet/oyl-amm](https://github.com/Oyl-Wallet/oyl-amm) (Rust WASM). Wallet and app integration lives in [oyl-sdk](https://github.com/Oyl-Wallet/oyl-sdk) under `src/amm/`.

⚠️ Not the same as ledger-style “swap in one token contract”

Some AlkaneScan demos embed swap logic inside a single project token (ledger keys, tax, etc.). The OYL / iDclub / Subfrost model is different: **separate factory + pool contracts**, reserves held _inside the pool alkane_, and swaps routed through the factory with attached input tokens.

## What this AMM is (simple)

A **liquidity pool** holds two alkanes — e.g. DIESEL `2:0` and your token `2:N`. Traders swap against the pool; the price moves with reserve ratio. Liquidity providers deposit both sides and receive **LP tokens** (the pool’s own alkane id). Swaps pay a fee (default **1%**, configurable per pool).

-   **Permissionless pairs** — Anyone can create a new pool for two alkanes (sorted by id).
-   **On-chain reserves** — Pool balance sheet = reserves; no off-chain order book.
-   **Same pools everywhere** — OYL wallet, iDclub swap UI, Subfrost, and integrators using oyl-sdk hit the same factory/pool ids on mainnet.

To _use_ existing pools (not build them), see [swap on Subfrost](tutorials/tutorial-swap-subfrost.php), [buy DIESEL](tutorials/tutorial-buy-diesel.php), and [AlkaneScan Pools](pools.php).

## Factory + pool architecture

User wallet
    │
    ├─ Create pool ──► Factory alkane (e.g. 2:1 on examples)
    │                    opcode CreateNewPool + attach token A + token B
    │                    └──► new Pool alkane 2:P (LP token = pool id)
    │
    ├─ Add liquidity ──► Factory AddLiquidity (or call pool directly)
    │                    attach both tokens ──► receive LP alkane 2:P
    │
    ├─ Swap ───────────► Factory SwapExactTokensForTokens
    │                    attach input token ──► receive output token
    │
    └─ Remove LP ──────► Pool WithdrawAndBurn
                         attach LP tokens ──► receive both underlying tokens

Indexer (Metashrew / Sandshrew) tracks alkane balances on each pool id.

**Two WASM contracts:**

-   `alkanes/factory` — registry, routing, high-level add/remove/swap (Uniswap router style).
-   `alkanes/pool` — pair logic: reserves, mint/burn LP, low-level `Swap`, `PoolDetails`.

Shared math and locking live in `alkanes/oylswap-library`. Runtime traits: `alkanes-runtime-factory`, `alkanes-runtime-pool`.

## Constant product & fees

Reserves `x` and `y` satisfy `x · y = k` (after fees). Output amount for a sell of `amount_in` into reserve `reserve_in` / `reserve_out`:

// oyl-sdk src/amm/utils.ts — same formula as oylswap-library
amount\_in\_with\_fee = amount\_in \* (1000 - fee\_per\_1000)
amount\_out = (amount\_in\_with\_fee \* reserve\_out) / (reserve\_in \* 1000 + amount\_in\_with\_fee)

Defaults from `oylswap-library`:

-   `DEFAULT_TOTAL_FEE_AMOUNT_PER_1000 = 10` → **1.0%** swap fee
-   `PROTOCOL_FEE_AMOUNT_PER_1000 = 2` → portion of LP fee growth reserved for protocol / factory collection
-   `MINIMUM_LIQUIDITY = 1000` → first mint burns 1000 LP wei (Uniswap-style anti-inflation attack)

First liquidity mint: `liquidity = sqrt(amount_a * amount_b) - MINIMUM_LIQUIDITY`. Later mints: proportional to existing reserves and LP supply.

## Contract crates & opcodes

### Factory (`alkanes/factory/src/lib.rs`)

#\[derive(MessageDispatch)\]
pub enum AMMFactoryMessage {
    #\[opcode(0)\]  InitFactory { pool\_factory\_id, beacon\_id },
    #\[opcode(1)\]  CreateNewPool { token\_a, token\_b, amount\_a, amount\_b },
    #\[opcode(2)\]  FindExistingPoolId { alkane\_a, alkane\_b },
    #\[opcode(3)\]  GetAllPools,
    #\[opcode(11)\] AddLiquidity { token\_a, token\_b, amount\_a\_desired, amount\_b\_desired,
                                  amount\_a\_min, amount\_b\_min, deadline },
    #\[opcode(12)\] Burn { token\_a, token\_b, liquidity, amount\_a\_min, amount\_b\_min, deadline },
    #\[opcode(13)\] SwapExactTokensForTokens { path, amount\_in, amount\_out\_min, deadline },
    #\[opcode(14)\] SwapTokensForExactTokens { path, amount\_out, amount\_in\_max, deadline },
    #\[opcode(29)\] SwapExactTokensForTokensImplicit { path, amount\_out\_min, deadline },
    // … fee collection, SetPoolFactoryId, etc.
}

### Pool (`alkanes/pool/src/lib.rs`)

#\[derive(MessageDispatch)\]
pub enum AMMPoolMessage {
    #\[opcode(0)\]  InitPool { alkane\_a, alkane\_b, factory },
    #\[opcode(1)\]  AddLiquidity,              // attach both pair tokens
    #\[opcode(2)\]  WithdrawAndBurn,           // attach LP (pool id) tokens
    #\[opcode(3)\]  Swap { amount\_0\_out, amount\_1\_out, to, data },
    #\[opcode(10)\] CollectFees {},
    #\[opcode(20)\] GetTotalFee {},
    #\[opcode(21)\] SetTotalFee { total\_fee\_per\_1000 },
    #\[opcode(97)\] GetReserves,
    #\[opcode(99)\] GetName,
    #\[opcode(999)\] PoolDetails,              // binary PoolInfo blob for indexers
}

`PoolDetails` returns token ids, reserves, LP total supply, and pool name — decoded by `AlkanesAMMPoolDecoder` in oyl-sdk (see `src/amm/pool.ts`).

## LP tokens & liquidity

1.  **Create pool** — Call factory `CreateNewPool` with initial `amount_a` and `amount_b` (both > 0). Factory deploys or initializes a pool alkane; you receive LP tokens.
2.  **Add more** — Attach both tokens in the correct ratio (factory `AddLiquidity` or pool opcode 1). Pool mints LP alkanes to you.
3.  **Remove** — Attach LP tokens to pool opcode `WithdrawAndBurn` (2). Pool burns LP and returns pro-rata share of both reserves.

LP token id **is** the pool alkane id (`2:P`). Holders earn swap fees via supply rebasing (`_mint_fee` in pool runtime when `k` grows).

## Swaps & routing

Most apps call the **factory**, not the pool directly:

-   **Single hop** — `SwapExactTokensForTokens` with `path = [token_in, token_out]`.
-   **Multi-hop** — Path length ≥ 2 (e.g. TOKEN → DIESEL → frBTC). Factory resolves each pool via `FindExistingPoolId`.
-   **Implicit amount** — Opcode 29 uses attached alkane amount as `amount_in`.
-   **Deadline** — Block height; transaction reverts if current height > deadline (MEV / stale tx protection).

Low-level pool `Swap` (opcode 3) specifies exact `amount_0_out` / `amount_1_out` and optional callback `data` (flash-swap pattern via `SWAP_EXTCALL_OPCODE`). Integrators normally use factory opcodes 13/14.

## PSBT / protostone integration

Alkanes actions are Bitcoin transactions with a **protostone** output encoding a cellpack. oyl-sdk builds PSBTs for you:

-   `createNewPool` / `addLiquidity` — `splitAlkaneUtxos` + edicts route attached tokens into the virtual output, then factory calldata in `ProtoStone.message`.
-   `swapPsbt` — Select UTXOs holding the input alkane; attach amount; encode factory swap calldata.
-   `removeLiquidityPsbt` — Attach LP alkane UTXOs; pool/factory burn calldata.

### Example swap calldata (oyl CLI)

\# oyl alkane swap -data "…" -deadline 3 -feeRate 4 -p bitcoin
\# Fields (before deadline block appended by CLI):
factory\_block, factory\_tx, opcode,
path\_length,
token1\_block, token1\_tx,
token2\_block, token2\_tx,
amount\_in,
min\_amount\_out

### Simulate before broadcast

\# Factory: simulate create pool
oyl alkane simulate -target "2:1" -inputs "1,2,6,2,7" \\
  -tokens "2:6:1000,2:7:2000" -decoder "factory"

\# Pool: read reserves / TVL (opcode 999)
oyl alkane simulate -target "2:POOL\_TX" -inputs "999" -decoder "pool"

\# List all pools from factory
oyl alkane pools -target "2:1"

Use `swapBuyAmount()` in oyl-sdk for off-chain quotes matching on-chain math when you already have reserves from `PoolDetails`.

## Build & deploy

1

**Clone & build**

`git clone https://github.com/Oyl-Wallet/oyl-amm`  
`rustup target add wasm32-unknown-unknown`  
`cargo build --release`

2

**Regtest dry run**

Follow `DEPLOYMENT.md` — `./deploy-oyl-amm.sh -p regtest --sandshrew-rpc-url …` deploys factory proxy, pool beacon, test tokens, and sample pools.

3

**Mainnet factory**

Production uses the live factory alkane (commonly referenced as `2:1` in oyl-sdk examples — **always verify** on [Ordiscan](https://ordiscan.com/alkanes) / simulate `GetAllPools` before relying on an id).

4

**Create YOUR pair**

After your project token `2:N` is deployed, call `CreateNewPool` with DIESEL or another base pair + seed liquidity.

5

**Index pools**

Run or use [alkanes-contract-indexer](https://github.com/Oyl-Wallet/alkanes-contract-indexer) with `FACTORY_BLOCK_ID` / `FACTORY_TX_ID` so your UI can list TVL and volume (like [pools.php](pools.php)).

## Integrate in your app

Typical stack for a swap UI (PHP/Node/React):

1.  **Sandshrew RPC** — `alkanes.simulate` for quotes and pool discovery.
2.  **oyl-sdk** — `swapPsbt`, `addLiquidityPsbt`, decoders in `src/amm/`.
3.  **Wallet** — UniSat / OYL sign PSBT; user pays BTC fee UTXOs separately from alkane inputs.
4.  **Slippage UI** — Compute `min_amount_out` from simulated quote × (1 − slippage%).

// Quote (oyl-sdk utils.ts)
import { swapBuyAmount } from '@oyl/sdk/amm/utils'

const { buyAmount } = swapBuyAmount({
  sellAmount: 1\_000\_000n,
  sellTokenReserve: pool.token0Amount,
  buyTokenReserve: pool.token1Amount,
  feeRate: 5n,  // 0.5% if pool fee is 5 per 1000
})

## Security checklist

-   **Slippage bounds** — Always pass `amount_out_min` / `amount_in_max`; never infinite tolerance on mainnet.
-   **Deadline** — Short deadline + user-visible expiry block; retry with fresh quote if mempool stalls.
-   **Verify pool id** — Call `FindExistingPoolId` or read `PoolDetails`; do not trust UI labels alone.
-   **Attached alkanes** — Wrong token or short attach amount → revert or bad fill. Pre-simulate with same UTXO set when possible.
-   **Reentrancy** — Pool uses `Lock` (`/lock` storage) around add/remove/swap; custom pool forks must keep this.
-   **Fee-on-transfer tokens** — Standard AMM math assumes full amount arrives; deflationary tokens break `k` checks — disallow or wrap.
-   **Audit** — Run [AlkaneScan Audit](audit.php) on any fork; read [security issues](tutorials/tutorial-security-issues.php).

## Where to go next

-   Source: [oyl-amm](https://github.com/Oyl-Wallet/oyl-amm) · [oyl-sdk AMM module](https://github.com/Oyl-Wallet/oyl-sdk/tree/main/src/amm)
-   Deploy your token first: [token tutorial](tutorials/tutorial-token.php) · [deploy tutorial](tutorials/tutorial-deploy.php)
-   End-user swap guides: [Subfrost](tutorials/tutorial-swap-subfrost.php) · [buy DIESEL](tutorials/tutorial-buy-diesel.php)
-   Track activity: [espo.sh](tutorials/tutorial-espo.php) · [Pools dashboard](pools.php)

[← All tutorials](tutorials/)