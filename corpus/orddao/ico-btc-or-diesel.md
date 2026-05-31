---
title: ICO — Alkanes Token Sale Contract (Dual-Payment + Treasury Split)
source: orddao
source_url: https://raw.githubusercontent.com/orddao/ICO-contract---Alkanescan/main/README.md
---

# ICO — Alkanes Token Sale Contract (Dual-Payment + Treasury Split)

A secure Initial Coin Offering smart contract that accepts **either Bitcoin
or DIESEL alkane tokens** as payment. Auto-detects which method the buyer
used. BTC payments route straight to a treasury cold wallet; DIESEL
payments accumulate inside the contract and the owner can sweep them out.

## Combined payment (both prices > 0)

Buyers may pay with **BTC only**, **DIESEL only**, or **both in one tx**.

Let:
- `amount` = ICO tokens requested
- `price_btc` = sats per token
- `price_diesel` = DIESEL units per token
- `btc_paid` = total sats paid to the **treasury scriptPubKey** (sum of matching outputs)
- `diesel_in` = DIESEL amount forwarded into this call (`incoming_alkanes`)

The contract accepts the payment when:

\[
\frac{btc\_{paid}}{price\_{btc}} + \frac{diesel\_{in}}{price\_{diesel}} \geq amount
\]

To stay in integer arithmetic (no floats), this is equivalent to:

\[
btc\_{paid}\cdot price\_{diesel} + diesel\_{in}\cdot price\_{btc} \geq amount \cdot price\_{btc}\cdot price\_{diesel}
\]

**Examples** (prices = 1,240 sats / 0.025 DIESEL per token, buying 10 tokens):

| BTC to treasury (sats) | DIESEL in | OK? |
|------------------------|-----------|-----|
| 12,400 | 0 DIESEL | ✅ (full BTC) |
| 0 | 0.250 DIESEL | ✅ (full DIESEL) |
| 6,200 | 0.125 DIESEL | ✅ (half + half) |
| 6,200 | 0.050 DIESEL | ❌ under-paid (BTC covers 50%, DIESEL covers 20% → only 70%) |

When only **one** price is non-zero at `Initialize`, the other asset is not part of the formula:
- BTC-only (`price_diesel = 0`): any `diesel_in > 0` **reverts** (avoids trapping DIESEL).
- DIESEL-only (`price_btc = 0`): only `diesel_in ≥ amount × price_diesel` is checked; accidental BTC to treasury is ignored (still goes to your cold wallet as a donation).

## Diesel balance

All DIESEL forwarded in on a successful `Buy` is added to `K_DIESEL_BAL`. The owner
sweeps via `WithdrawDiesel`.

## Opcodes

| # | Name | Auth | Calldata |
|---|------|------|----------|
| 0 | Initialize | once only | see "Initialize layout" below — also mints `founder_amount` tokens to the deployer's pointer output |
| 1 | Buy | anyone | `amount_u64_le` (8 B) — mints from public-sale pool (`cap - founder_amount`). Only **DIESEL** is allowed in incoming alkanes; any other alkane reverts the call. |
| 2 | SetPaused | **owner sig** | `owner_pubkey(32) ‖ sig(64) ‖ nonce(8) ‖ flag(1)` |
| 3 | CloseSale | **owner sig** | `owner_pubkey(32) ‖ sig(64) ‖ nonce(8)` |
| 4 | WithdrawDiesel | **owner sig** | `owner_pubkey(32) ‖ sig(64) ‖ nonce(8)` — sends DIESEL to pointer output |
| 10 | GetSold         | view | u128 LE |
| 11 | GetCap          | view | u128 LE |
| 12 | GetPriceBtc     | view | u64 LE |
| 13 | GetEndBlock     | view | u64 LE |
| 14 | GetOwner        | view | 32 B |
| 15 | GetPaused       | view | u8 |
| 16 | GetState        | view | packed struct (see below) |
| 17 | GetTreasury     | view | 22-34 B script_pubkey |
| 18 | GetPriceDiesel  | view | u128 LE |
| 19 | GetDieselId     | view | 32 B = block(16) ‖ tx(16) |
| 20 | GetDieselBalance| view | u128 LE (accumulated DIESEL inside the contract) |
| 21 | GetNonce        | view | u64 LE — current admin nonce (required to sign next privileged call) |
| 22 | GetClosed       | view | u8 — `1` if sale was closed via opcode 3 |
| 23 | GetFounderAmount| view | u128 LE — tokens reserved for founder (minted at Initialize) |
| 24 | GetCapSale      | view | u128 LE — public-sale supply (`cap - founder_amount`) |
| 99 | GetName         | view | UTF-8 string — token display name (standard Alkanes Token convention) |
| 100| GetSymbol       | view | UTF-8 string — ticker symbol |
| 101| GetTotalSupply  | view | u128 LE — actual minted tokens to date (`founder_amount + sold`) |

### Initialize calldata layout

After the dispatcher strips the opcode-prefix u128, the remaining bytes are:

```
[  0.. 32]  owner          (32 B taproot x-only pubkey)
[ 32.. 48]  cap            (u128 LE — TOTAL supply, founder + public sale)
[ 48.. 64]  founder_amount (u128 LE — minted to deployer at Initialize; 0 = no reservation)
[ 64.. 72]  price_btc      (u64  LE — sats per token)
[ 72.. 88]  price_diesel   (u128 LE — DIESEL units per token)
[ 88.. 96]  end_block      (u64  LE — `0` = no automatic deadline; sale runs until pause/close)
[ 96..   ]  treasury_len   (u8, must be 22..=34) ‖ treasury_script
            name_len       (u8, must be 1..=64)  ‖ name   (UTF-8)
            symbol_len     (u8, must be 1..=16)  ‖ symbol (UTF-8)
```

The contract enforces `founder_amount < cap` so there is always something
to sell. On a successful Initialize, `founder_amount` tokens are emitted
to the call's pointer output (the deployer's UTXO), and the public-sale
cap becomes `cap_sale = cap - founder_amount`.

`name` and `symbol` are validated as UTF-8 and stored permanently. They are
exposed via the standard Alkanes Token opcodes 99 (GetName), 100 (GetSymbol),
and 101 (GetTotalSupply) so wallets and explorers (Ordiscan etc.) can render
the token by name and ticker.

> **DIESEL alkane id is hardcoded** to `2:0` — the canonical mainnet DIESEL
> contract ([ordiscan.com/alkane/DIESEL/2:0](https://ordiscan.com/alkane/DIESEL/2:0)).
> You do **not** pass it as a parameter. This eliminates any risk of mistakenly
> pointing to a fake DIESEL.  
> On Signet where DIESEL may not exist: set `price_diesel = 0` → BTC-only mode.

### `GetState` packed layout

```
[  0.. 16] sold            (u128 LE — tokens sold via Buy)
[ 16.. 32] cap             (u128 LE — total supply)
[ 32.. 48] cap_sale        (u128 LE — public-sale pool)
[ 48.. 64] founder_amount  (u128 LE)
[ 64.. 72] price_btc       (u64  LE)
[ 72.. 88] price_diesel    (u128 LE)
[ 88..104] diesel_block    (u128 LE — always 2)
[104..120] diesel_tx       (u128 LE — always 0)
[120..128] end_block       (u64  LE)
[128..144] diesel_bal      (u128 LE — accumulated DIESEL inside contract)
[144..145] paused          (u8)
[145..146] closed          (u8)
[146..178] owner           (32 B)
[178..179] treasury_len    (u8)
[179..   ] treasury        (≤34 B)
```

## Disabling combined payment

* **BTC-only** — set `price_diesel = 0` at `Initialize`. The contract only
  checks `btc_paid ≥ amount × price_btc`. Any `diesel_in > 0` **reverts**
  so buyers cannot accidentally lock DIESEL in the contract.

* **DIESEL-only** — set `price_btc = 0`. Only `diesel_in ≥ amount × price_diesel`
  is required. BTC sent to the treasury is still received by your wallet
  but does **not** reduce the DIESEL required (treat as a donation).

* **Both accepted** — set both prices `> 0`. The combined inequality applies.

## Founder allocation

The contract supports an optional founder reservation that is minted
to the deployer at `Initialize` and **does not count toward the public
sale cap**.

### Example

| Setting | Value |
|---|---|
| `CAP` | `1_000_000n` (total supply) |
| `FOUNDER_AMOUNT` | `200_000n` (20% reserved) |
| Public sale pool (`cap_sale`) | `800_000` (automatically `cap - founder_amount`) |
| `PRICE_BTC` | `1_250n` sats/token |
| Max raise | `800_000 × 1_250 = 1_000_000_000` sats = **10 BTC** |

A buyer sending 1 BTC (= 100 000 000 sats) calls `Buy(80_000)` and
receives 80 000 tokens. `K_SOLD` advances by 80 000 (out of 800 000
max). The 200 000 founder tokens are unaffected — they were minted
to the deployer at Initialize time.

### How the founder receives the tokens

The protostone-pointer of the `Initialize` transaction routes the
founder mint to a chosen output. `deploy.mjs` sets `pointer = 0` by
default, so the founder tokens land on output #0 of the deploy tx —
which `oyl-sdk` constructs as the deployer's own taproot UTXO.

If you want the founder tokens to land in a **different** UTXO (for
example a separate cold wallet), construct the spend so its output #N
is the desired cold-wallet UTXO and set `pointer = N` in the
protostone. This is an advanced flow; the default already works for
"founder = deployer".

### Disabling the founder allocation

Set `FOUNDER_AMOUNT = 0n` in `deploy.mjs`. Cap and sale cap then
become equal, the founder branch of `Initialize` does nothing, and
the contract behaves exactly like a no-founder ICO.

## Admin authentication (how the contract knows the admin)

### How the admin is set

The admin is established at **Initialize**:
- `init.mjs` derives the **x-only taproot pubkey** from your mnemonic
  (32 bytes; same key that controls your taproot address).
- That pubkey is written to storage at `K_OWNER` and **never changed**.
- There is no `transferOwnership` opcode by design.

So "the admin" = whoever has the private key matching the pubkey baked
into the contract at deploy time.

### How a privileged call is verified

Privileged opcodes (2 SetPaused, 3 CloseSale, 4 WithdrawDiesel) all require
a **BIP-340 Schnorr signature**. The contract:

1. Reads the current `K_NONCE` (a u64 monotonic counter).
2. Builds the canonical message:
   ```
   msg = SHA256(
     domain_tag         (e.g. "ALKANES_ICO_SETPAUSED") ||
     self.block         (16 B, this contract's ID)     ||
     self.tx            (16 B, this contract's ID)     ||
     nonce              (8 B  LE)                      ||
     action_bytes       (e.g. [flag] for SetPaused)
   )
   ```
3. Verifies the 64-byte Schnorr signature against that message and the
   stored `K_OWNER` pubkey (using `k256::schnorr` — pure-Rust BIP-340).
4. On success, increments `K_NONCE`.

This means:
- **Knowing the pubkey is useless** — an attacker needs the private key
  to produce a valid signature on each new nonce.
- A signature from one opcode (e.g. Pause) **cannot be replayed** as a
  different opcode (domain tag differs).
- A signature made for one contract **cannot be reused** in another
  (the contract ID is part of the message).
- A previously-used signature **cannot be re-broadcast** (nonce
  increments).

### Using `admin.mjs`

Helper script for the admin:

```bash
# Read current nonce (no transaction):
MNEMONIC="..." node admin.mjs nonce

# Pause / unpause the sale:
MNEMONIC="..." node admin.mjs pause
MNEMONIC="..." node admin.mjs unpause

# Permanently close the sale:
MNEMONIC="..." node admin.mjs close

# Withdraw accumulated DIESEL to the pointer output:
MNEMONIC="..." node admin.mjs withdraw
```

Edit `CONTRACT_BLOCK` / `CONTRACT_TX` in `admin.mjs` first.

### About changing the treasury

The treasury scriptPubKey is **immutable** after Initialize — there is no
`SetTreasury` opcode at all. This is intentional: buyers can verify the
treasury once and trust that BTC payments will always route to the same
cold wallet. The trade-off is that if you lose access to your cold
wallet, you would have to deploy a new contract.

## Security model

| Attack | Defense |
|---|---|
| Re-run Initialize | `observe_initialization()` |
| Buy after `end_block` | `Buy` reverts when `height() > end_block` (unless `end_block == 0`) |
| Pause / close by non-owner | **BIP-340 Schnorr signature** verified inside WASM with `k256::schnorr` + monotonic nonce (anti-replay) + domain-tagged message |
| Drain accumulated DIESEL | Owner-only; signature **and** nonce required; `K_DIESEL_BAL` is zeroed BEFORE transfer |
| Under-pay (either asset or combined) | Combined inequality fails → revert |
| Stray DIESEL on BTC-only sale | `diesel_in > 0` while `price_diesel == 0` → revert |
| Mixed / partial payments | Allowed when both prices > 0; must satisfy the formula exactly |
| Over-sell beyond cap | `checked_add` + `sold + amount > cap_sale` reverts; founder share is excluded from sale pool |
| Founder over-mint | `founder_amount < cap` enforced at Initialize; mint happens exactly once (Initialize is one-shot) |
| Silent loss of attached alkanes | Buy rejects any incoming alkane that isn't DIESEL; WithdrawDiesel rejects all incoming alkanes |
| Integer overflow | `checked_mul` / `checked_add` everywhere |
| Owner takeover | No `transferOwnership` — owner pubkey is immutable |
| Treasury hijack | Treasury script is immutable after Initialize |
| DIESEL id swap | DIESEL id is **compile-time constant** `2:0` — impossible to fake |

### Why the security is strong

1. **BTC payments** route directly to your cold wallet — the contract
   never custodies them. Even a fully compromised frontend / server can't
   re-route funds, because the WASM checks the actual Bitcoin transaction.

2. **DIESEL payments** are custodied by the contract briefly, but only
   the owner's taproot key can call `WithdrawDiesel`. Frontend/server
   compromise can't drain DIESEL either.

3. The owner key is a Schnorr/taproot pubkey verified byte-for-byte against
   storage. To call privileged opcodes you must KNOW the owner pubkey AND
   include it in the calldata — pair with off-chain signature verification
   on the spending tx to make this watertight in production.

## Building

```bash
cd contracts/ico
cargo build --release --target wasm32-unknown-unknown
wasm-opt -O2 --enable-bulk-memory \
  target/wasm32-unknown-unknown/release/ico.wasm \
  -o ico_opt.wasm
```

## Deploying

The contract is deployed **and** initialized in a **single atomic transaction**
via `deploy.mjs`. This is critical — splitting deploy and Initialize across
two transactions opens a front-run window where anyone could call Initialize
on your fresh contract first and steal admin rights.

### Step 1 — Edit `deploy.mjs`

Open `contracts/ico/deploy.mjs` and fill in the `CONFIG` block:

| Setting | Notes |
|---|---|
| `TREASURY_ADDR` | Your cold wallet Bitcoin address — **immutable after init** |
| `CAP` | Total token supply |
| `PRICE_BTC` | Sats per token (`0n` = DIESEL-only) |
| `PRICE_DIESEL` | DIESEL units per token (`0n` = BTC-only) |
| `END_BLOCK` | Deadline block (`0n` = no deadline) |
| `FEE_RATE` | sat/vbyte — check [mempool.space](https://mempool.space) |

The deployer's mnemonic (which controls admin rights afterwards) is passed
via environment variable, never written to a file.

> **DIESEL note:** DIESEL (`2:0`) is hardcoded in the contract.
> DIESEL exists on **mainnet** at `2:0` — set `PRICE_DIESEL > 0n` to enable it.
> To run BTC-only, leave `PRICE_DIESEL = 0n`.

### Step 2 — Run deploy

```bash
cd contracts/ico
MNEMONIC="word1 word2 ... word12" node deploy.mjs
```

The script:
1. Validates all parameters and prints a summary.
2. Loads `ico_opt.wasm`.
3. Builds the `Initialize` calldata (owner pubkey + cap + prices + treasury).
4. Broadcasts a single transaction that **deploys the WASM AND calls
   `Initialize` inline**.

### Step 3 — Get the contract ID

Wait ~10 minutes for confirmation, then:

```bash
node getid.mjs <reveal_txid>
# === ICO Contract ID ===
# 840000:5
```

Save the printed **contract ID**, **treasury address**, and **owner pubkey** —
you'll need them for the frontend.

### About `init.mjs`

`init.mjs` is **emergency-only**. If the atomic deploy+init somehow fails
(extremely rare runtime issue), `init.mjs` lets you claim ownership of
the orphaned contract before someone else does. **For normal deployment
you should never need it.**