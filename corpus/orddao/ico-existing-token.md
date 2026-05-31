---
title: ico_freemint
source: orddao
source_url: https://raw.githubusercontent.com/orddao/Alkanes-ICO-contract-for-exist-token/main/README.md
---

# ico_freemint

Sale-only ICO contract for an **externally-deployed** free-mint token.

This contract is a fork of `../ico/` with two big changes:

1. **No own token.** It does not mint anything. Instead it holds an inventory
   of an external alkane (e.g. a free-mint instance spawned from template
   `4:797`) and transfers from that inventory at Buy time.
2. **DIESEL refund.** If a buyer attaches more DIESEL than the price requires
   (e.g. because their wallet picked a 10-DIESEL UTXO to spend 1 DIESEL),
   the excess is refunded in the same Buy transaction.

## Architecture

```
 ┌──────────────────────┐         ┌──────────────────────┐
 │ free-mint instance   │         │ ico_freemint         │
 │  (e.g. 2:77595)      │ ◄────── │  (e.g. 2:NNNNN)      │
 │  — has the token's   │  sells  │  — has the price,    │
 │    name/symbol/cap   │  from   │    treasury, owner,  │
 │  — premined at deploy│  here   │    nonce, inventory  │
 └──────────────────────┘         └──────────────────────┘
            ▲                              ▲
            │ premine landed here          │ Buy() pays here
            │                              │
        ┌──────┐                       ┌────────┐
        │OWNER │                       │ BUYER  │
        └──────┘                       └────────┘
            │
            └── runs deposit-ico-freemint.mjs to send tokens INTO the ICO
```

## Three-step launch

1. **Deploy the free-mint token** (separate, in `../free-mint/`).
   Set its premine to whatever total amount you want the ICO to sell.

   ```bash
   MNEMONIC="..." \
   TOKEN_NAME="MyToken" TOKEN_SYMBOL="MTK" \
   TOKEN_UNITS=100000000000000   `# 1,000,000 × 1e8 base units` \
   VALUE_PER_MINT=0 CAP=0        `# disable public minting` \
   node deploy-free-mint.mjs
   ```

   After confirmation, note the new id (e.g. `2:77595`).

2. **Deploy `ico_freemint`** (this directory).

   ```bash
   # Build the contract first
   cd contracts/ico_freemint
   cargo build --target wasm32-unknown-unknown --release
   cp target/wasm32-unknown-unknown/release/ico_freemint.wasm ./ico_freemint_opt.wasm

   # Deploy + initialize atomically
   MNEMONIC="..." \
   TREASURY_ADDR="bc1p..." \
   SALE_TOKEN_BLOCK=2 SALE_TOKEN_TX=77595 \
   PRICE_BTC=1240 PRICE_DIESEL=2500000 \
   CAP_SALE=0 END_BLOCK=0 \
   FEE_RATE=3 \
   node deploy-ico-freemint.mjs

   # Then re-run with CONFIRM=yes
   ```

   After the reveal confirms, find the new id with `alkanes trace` (the
   script prints the exact command). Say the new id is `2:80000`.

3. **Fund inventory.**

   ```bash
   MNEMONIC="..." \
   ICO_BLOCK=2 ICO_TX=80000 \
   SALE_TOKEN_BLOCK=2 SALE_TOKEN_TX=77595 \
   DEPOSIT_AMOUNT=100000000000000 \
   FEE_RATE=3 \
   node deposit-ico-freemint.mjs

   # Then re-run with CONFIRM=yes
   ```

   You can call this multiple times to top up.

After step 3, `Buy(amount)` works: it pulls from the inventory deposited.

## Opcodes

| op | name | who |
|---:|---|---|
| 0 | Initialize | deploy tx |
| 1 | Buy(amount_u64) | public |
| 2 | SetPaused(flag) | owner-signed |
| 3 | CloseSale | owner-signed |
| 4 | WithdrawDiesel | owner-signed |
| 5 | EmergencyMigrate(v2_block, v2_tx) | owner-signed (one-shot) |
| 6 | Deposit | public (attach sale tokens) |
| 7 | WithdrawInventory(amount>0) | owner-signed |
| 10..27 | Get* views | read-only |
| 99..101 | GetName / GetSymbol / GetTotalSupply | read-only |

`GetSaleTokenId` (opcode 26) returns the configured external token id as
32 bytes (`block(16) || tx(16)`, both LE u128).

`GetInventory` (opcode 27) returns the current inventory as u128 LE.

`GetState` (opcode 16) returns a packed snapshot for dashboards — see
the layout doc-comment in `src/lib.rs`.

## DIESEL refund algorithm

For `Buy(amount)`:

| mode | required DIESEL | refund |
|---|---|---|
| BTC-only (`price_diesel=0`) | 0 | refund **all** attached DIESEL |
| DIESEL-only (`price_btc=0`) | `amount × price_diesel` | refund the rest |
| Combined (both `>0`) | `(amount − floor(btc_paid / price_btc)) × price_diesel` | refund the rest |

The "BTC first" rule is deliberate: sats sent to the treasury are
irreversible (the contract never holds them), so we credit tokens to BTC
first and only ask DIESEL to cover the shortfall. This minimises DIESEL
spend per buy.

### Example

- `price_btc = 1240` sats/token, `price_diesel = 2_500_000` base units/token.
- Buyer wants `amount = 4` tokens.
- Buyer attaches 1 UTXO with 10 DIESEL (10 × 1e8 = `1_000_000_000` base units)
  and pays 2480 sats to treasury (covers 2 tokens at 1240 sats each).
- BTC covers `floor(2480/1240) = 2` tokens. Remaining 2 tokens need DIESEL.
- DIESEL required = `2 × 2_500_000 = 5_000_000`.
- DIESEL refund = `1_000_000_000 − 5_000_000 = 995_000_000` base units.
- Buyer receives at vout 0: 4 sale tokens + 995,000,000 DIESEL base units back.

## Security model

Same as `../ico/`:

- BIP-340 Schnorr signatures for all admin ops, sequential nonce, per-opcode
  domain tag, contract-id binding (`assert_is_owner_signed`).
- Checked arithmetic everywhere.
- Effects-before-interactions in `WithdrawDiesel` / `WithdrawInventory`.
- Stray-alkane protection: `Buy` rejects everything except DIESEL; `Deposit`
  rejects everything except the configured sale token.

Differences:

- Initialize cannot accept random alkanes; only the configured sale token or
  DIESEL. Anything else reverts the deploy.
- `WithdrawInventory` is a new opcode (the `ico` contract didn't need one
  because it minted on demand). Its signature commits to the requested
  amount so a "withdraw 5" signature cannot be replayed as "withdraw 5000".

## Building

```bash
cd contracts/ico_freemint
cargo build --target wasm32-unknown-unknown --release
# output: target/wasm32-unknown-unknown/release/ico_freemint.wasm
```

On Windows the Rust toolchain needs the MSVC linker; build inside WSL if you
hit `link.exe not found`.