---
title: PandaStrategy Token (`panda_strategy_token`)
source: orddao
source_url: https://raw.githubusercontent.com/orddao/PandaStrategy/main/README.md
---

# PandaStrategy Token (`panda_strategy_token`)

Pure-ledger **PANDASTR** with **transfer tax** (default **15%**, owner up to **25%**) and a built-in **DIESEL ↔ PANDASTR** AMM.

Any wallet, site, or bot can call **SwapBuy** / **SwapSell** — no authorized swap contract.

**SellPanda** lets users attach **Alkane Pandas (`2:614`)** and receive **DIESEL** at the owner-set price. The contract converts accumulated **fee PANDASTR** through the internal AMM at sell time (no pre-funded vault).

---

## Opcodes

| Op | Name | Notes |
|----|------|-------|
| 0 | Initialize | owner, fee_bps, pool_panda, founder, name, symbol + optional seed **DIESEL** |
| 1 | Transfer | signed; fee on amount |
| 2 | SwapBuy | attach **DIESEL** → PANDASTR ledger (permissionless) |
| 3 | SwapSell | signed; PANDASTR → **DIESEL** out (permissionless) |
| 4 | SellPanda | attach **Panda `2:614`** → **DIESEL** out (converts `/fee_p` on the fly) |
| 6 | SetPaused | owner |
| 7 | SetFeeBps | owner |
| 8 | SetPandaPrice | owner — DIESEL per Panda (`0` = buyback off) |
| 9 | WithdrawFees | owner — `/fee_p` → owner ledger |

### Views

| Op | Returns |
|----|---------|
| 20 | GetBalance(pk) |
| 21 | GetPoolPanda |
| 22 | GetFeeState — fee_bal(16) ‖ fee_bps(4) |
| 23 | GetPoolState — diesel(16) ‖ panda(16) |
| 24 | GetBuybackState — price(16) ‖ fee_p(16) ‖ panda_bought(16) ‖ pool_d(16) ‖ pool_p(16) |
| 25 | GetPandaPrice — diesel per Panda (u128) |
| 26 | GetAdminNonce — owner nonce (u64) |
| 101–103 | name, symbol, total supply |

---

## Initialize calldata

| Offset | Field |
|--------|--------|
| 0 | owner (32 B) |
| 32 | fee_bps (4) — `1500` = 15% |
| 36 | pool_pandrastr (16) — AMM inventory (ledger) |
| 52 | founder_amount (16) — credit owner ledger |
| 68+ | name, symbol |

Attach optional seed **DIESEL `2:0`** in the same tx for initial `pool_diesel`.

Panda buyback price starts at **0** (disabled) until owner calls **SetPandaPrice**.

---

## AMM

```
x = pool_diesel (attached alkanes on this contract)
y = pool_pandrastr (ledger)
out = (y × Δx) / (x + Δx)
```

15% tax applies on the PANDASTR leg (buy and sell), same as Transfer.

---

## SellPanda (opcode 4) — convert on sell

Calldata: `min_diesel(16)`  
Attach: one or more **Alkane Panda `2:614`** (amount = count; typically `1` per NFT).

Flow:

1. `diesel_pay = panda_count × /panda_price`
2. Contract sells enough **PANDASTR from `/fee_p`** through the AMM (no second tax) to free ≥ `diesel_pay` DIESEL from `/pool_d`
3. User receives **`diesel_pay` DIESEL**; Pandas stay on the contract UTXO
4. Fails if `/fee_p` too low, pool too thin, or price is `0`

Example: price = `100000000` (1 DIESEL in 8-decimal base units), attach 1 Panda → user gets 1 DIESEL if fees + pool can support conversion.

---

## SetPandaPrice (opcode 8)

Calldata: `owner(32) ‖ sig(64) ‖ nonce(8) ‖ price_u128(16)`

Domain `PSTR_PANDAPRICE`, action = `price(16)`.

Set **`0`** to disable buyback.

### Read / update price (scripts)

```bash
# Read current price (DIESEL base units)
TOKEN=2:N node get-panda-price.mjs
TOKEN=2:N FULL=1 node get-panda-price.mjs   # + full buyback state

# Owner update price (1 DIESEL = 100000000 base units if 8 decimals)
MNEMONIC="..." TOKEN=2:N PANDA_PRICE_DIESEL=100000000 CONFIRM=yes node set-panda-price.mjs

# Disable buyback
MNEMONIC="..." TOKEN=2:N PANDA_PRICE_DIESEL=0 CONFIRM=yes node set-panda-price.mjs
```

On-chain views: opcode **25** `GetPandaPrice`, opcode **8** `SetPandaPrice` (owner-signed).

## SwapBuy (opcode 2)

Calldata: `min_pandrastr_out(16) ‖ buyer_pk(32)`  
Attach: **DIESEL** to token contract.

---

## SwapSell (opcode 3)

Calldata: `user_pk(32) ‖ amount(16) ‖ min_diesel(16) ‖ nonce(8) ‖ sig(64)`

Domain `PSTR_SWAPSELL`, action = `amount(16) ‖ min_diesel(16)`, per-user nonce `/u/{pk}`.

Outgoing: **DIESEL** to tx pointer.

---

## Transfer signature

Domain `PSTR_TRANSFER`, action = `to(32) ‖ amount(16)`, per-user nonce `/u/{pk}`.

---

## Deploy

```bash
cd contracts/panda_strategy_token
cargo build --release --target wasm32-unknown-unknown

MNEMONIC="..." FEE_BPS=1500 POOL_PANDA=... FOUNDER=... \
  TOKEN_NAME="Panda Strategy" TOKEN_SYMBOL=PANDASTR \
  CONFIRM=yes node deploy-token.mjs
```

After deploy: **SetPandaPrice** to enable NFT buyback (e.g. `1` DIESEL per Panda in base units).

Attach seed DIESEL in the Initialize reveal tx (protostone edict).