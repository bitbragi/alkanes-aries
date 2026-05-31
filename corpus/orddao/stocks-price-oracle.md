---
title: price_oracle — A simple, secure Alkanes price oracle
source: orddao
source_url: https://raw.githubusercontent.com/orddao/Stocks-price-oracle-smart-contract-for-Alkanes-/main/README.md
---

# price_oracle — A simple, secure Alkanes price oracle

A minimal on-chain oracle that stores prices for off-chain assets
(BTC, TSLA, NVDA, AMZN, FX pairs, anything quotable in USD) and exposes
them to any other Alkanes contract through `alkanes_simulate` reads or
in-contract `staticcall`s.

The design is deliberately the smallest thing that can work:

* **One key, owner-signed updates.** A single BIP-340 Schnorr key
  (the deployer's taproot key) signs every price update. No multisig,
  no DAO, no median of N — just like Chainlink originally launched.
  Anyone who trusts the operator (or runs their own oracle for their
  own dApp) can use it.
* **Multiple symbols in one contract.** Each asset is registered once
  with a `symbol_id` (u32) and a ticker string. Updates reference the
  numeric id; the ticker is on-chain only as metadata. The contract
  hardcodes 8 decimals of price precision for every symbol.
* **8 decimal places of precision.** Prices are stored as a u128
  fixed-point integer: `$250.4321 → 25,043,210,000`.
* **Freshness as on-chain metadata.** Every price record stores:
  - the **block at which it was sampled off-chain** (`price_block`),
  - the **block at which the contract recorded it** (`updated_block`).
  Consumer contracts decide if the data is fresh enough for their use
  case (e.g. "reject if older than 144 blocks ≈ 1 day").
* **Replay-safe.** A sequential admin nonce + per-opcode domain tag
  + contract-id binding make every signed message unique to *this*
  oracle, *this* opcode, *this* call.
* **Future-stamp protection (H1 audit fix).** The contract enforces
  `price_block ≤ now` on every update so a (compromised) owner can't
  back-date or forward-date their samples to manipulate downstream
  prediction markets.
* **Mandatory expiry (L1 audit fix).** Every signed update must carry
  `expiry > 0`. Open-ended sigs are forbidden so a stale broadcast
  can't be replayed weeks later.
* **Pause + two-step ownership transfer (M1 audit fix).** Emergency
  freeze if the key is compromised; ownership rotation requires both
  the current owner's *and* the prospective new owner's signatures so
  a typo can't brick the contract.

The contract is ~700 lines of Rust and uses the same patterns the rest
of this codebase already uses (`ico_freemint` is the reference).

---

## Files

```
contracts/price_oracle/
├── Cargo.toml
├── src/
│   └── lib.rs                  ← the contract
├── deploy-price-oracle.mjs     ← atomic deploy + Initialize
├── register-symbol.mjs         ← owner-signed RegisterSymbol
├── update-price.mjs            ← owner-signed UpdatePrice (one symbol)
├── price-feeder.mjs            ← daemon: pulls quotes + pushes batches
├── simulate-oracle.mjs         ← read-only dashboard
└── README.md
```

---

## Build

```bash
cd contracts/price_oracle
cargo build --release --target wasm32-unknown-unknown
# Optional: shrink with wasm-opt -O3 (matches ico_freemint convention).
wasm-opt -Oz target/wasm32-unknown-unknown/release/price_oracle.wasm \
   -o price_oracle_opt.wasm
```

The compiled WASM is ~150 KB which fits comfortably into one
commit/reveal transaction.

---

## Deploy

```bash
MNEMONIC="word1 word2 … word12" \
  FEE_RATE=3 \
  CONFIRM=yes \
  node deploy-price-oracle.mjs
```

After ~10 minutes look up the new `[2, N]` contract id with
`alkanes-cli alkanes trace <reveal_txid>:0..4`. From now on, set
`ORACLE_BLOCK=2 ORACLE_TX=N` in every script's environment.

The contract starts with `paused=0`, `nonce=0`, `symbol_count=0`,
and an empty registry.

---

## Register tickers

Each symbol has to be registered **once** before its price can be
updated. Pick the `symbol_id` yourself (any unused u32 ≥ 1):

```bash
# BTC — used by the prediction_market_btc contract.
CONFIRM=yes MNEMONIC="…" \
  ORACLE_BLOCK=2 ORACLE_TX=80000 \
  SYMBOL_ID=100 TICKER=BTC \
  node register-symbol.mjs

# Equities for stock-price markets.
CONFIRM=yes MNEMONIC="…" \
  ORACLE_BLOCK=2 ORACLE_TX=80000 \
  SYMBOL_ID=1 TICKER=TSLA \
  node register-symbol.mjs

CONFIRM=yes MNEMONIC="…" \
  ORACLE_BLOCK=2 ORACLE_TX=80000 \
  SYMBOL_ID=2 TICKER=NVDA \
  node register-symbol.mjs

CONFIRM=yes MNEMONIC="…" \
  ORACLE_BLOCK=2 ORACLE_TX=80000 \
  SYMBOL_ID=3 TICKER=AMZN \
  node register-symbol.mjs
```

Once confirmed, `simulate-oracle.mjs` will list them.

---

## Push prices

### Manual one-shot

```bash
CONFIRM=yes MNEMONIC="…" \
  ORACLE_BLOCK=2 ORACLE_TX=80000 \
  SYMBOL_ID=1 PRICE_USD=250.4321 \
  node update-price.mjs
```

### Automated daemon

Pulls quotes from a free public quote API (stooq.com by default, or
Yahoo Finance with `QUOTE_PROVIDER=yahoo`) and broadcasts one
`UpdatePriceBatch` per cycle:

```bash
pm2 start price-feeder.mjs --name oracle-feeder --update-env -- env \
  MNEMONIC="…" \
  ORACLE_BLOCK=2 ORACLE_TX=80000 \
  INTERVAL_MIN=1440 \
  DEVIATION_PCT=0.5 \
  EXPIRY_BLOCKS=6 \
  FEE_RATE=3
```

The daemon will:

1. Read every registered symbol from the contract.
2. Fetch a current quote for each ticker.
3. Skip the batch if **no** symbol moved more than `DEVIATION_PCT`
   since the last push (avoids wasting fees on idle markets).
4. Skip if the last push was within `MIN_BLOCKS` blocks.
5. Sign one batch update and broadcast.

Default cadence is **once every 24 hours** (`INTERVAL_MIN=1440`). Override with
env if you need fresher prices (e.g. `INTERVAL_MIN=15` for ~15 minutes).

**Warning:** the prediction market contract rejects oracle prices older than
`MAX_STALENESS` blocks (24 blocks ≈ ~4 hours). A 24-hour feeder cadence is
fine for display/history only — not for live prediction settlement unless you
also increase staleness on the market or push more often before resolves.

---

## Pause / unpause

```bash
# Pause:
CONFIRM=yes MNEMONIC="…" \
  ORACLE_BLOCK=2 ORACLE_TX=80000 \
  PAUSE_FLAG=1 \
  node ../ico_freemint/pause-ico-freemint.mjs   # adapt or copy

# (We reuse the same SetPaused pattern; opcode 2 on this contract.)
```

When `paused=1`, every `UpdatePrice` / `UpdatePriceBatch` reverts.
Views still work.

---

## Reading prices from another Alkanes contract

The whole point of the oracle is that other contracts can read it
**inside the same transaction**. A consumer contract calls the
oracle's `GetPrice` opcode through the Alkanes runtime's `call` /
`staticcall` (whichever your SDK exposes) and parses the 32-byte
response:

```
returndata layout (32 bytes):
  [ 0..16]  price          u128 LE     (8-decimal fixed point, USD)
  [16..24]  price_block    u64  LE     (block off-chain price was sampled)
  [24..32]  updated_block  u64  LE     (block contract recorded it)
```

### Rust example (consumer dApp)

```rust
const ORACLE_BLOCK: u128 = 2;
const ORACLE_TX:    u128 = 80000;   // replace with your deployed id
const MAX_STALENESS_BLOCKS: u64 = 144;   // ~1 day

fn read_tsla_price_usd_e8(myself: &AlkaneId, height: u64) -> Result<u128> {
    let oracle = AlkaneId { block: ORACLE_BLOCK, tx: ORACLE_TX };
    let inputs = vec![10u128, 1u128];   // opcode 10 = GetPrice, symbol_id=1
    let resp   = call(&oracle, &inputs)?;   // your SDK call helper
    if resp.data.len() < 32 { return Err(anyhow!("oracle gave short response")) }

    let price        = u128::from_le_bytes(resp.data[ 0..16].try_into().unwrap());
    let _price_block = u64 ::from_le_bytes(resp.data[16..24].try_into().unwrap());
    let updated_block= u64 ::from_le_bytes(resp.data[24..32].try_into().unwrap());

    if price == 0 {
        return Err(anyhow!("oracle has no TSLA price yet"));
    }
    let age = height.saturating_sub(updated_block);
    if age > MAX_STALENESS_BLOCKS {
        return Err(anyhow!("TSLA price is stale: {} blocks old", age));
    }
    Ok(price)
}
```

The consumer can then use the price to settle a prediction market,
compute LTV in a lending app, mark a position in a perps DEX, etc.

### Off-chain JS example

```js
const ORACLE = { block: '2', tx: '80000' }
const SYMBOL_ID_TSLA = 1

const body = {
  jsonrpc: '2.0', id: 1, method: 'alkanes_simulate',
  params: [{
    alkaneId: ORACLE,
    inputs:   ['10', String(SYMBOL_ID_TSLA)],   // 10 = GetPrice
    target:   ORACLE,
    pointer: 0, refundPointer: 0, vout: 0, data: '0x',
  }],
}
const r = await fetch('https://mainnet.sandshrew.io/v2/lasereyes', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify(body),
})
const j = await r.json()
const hex = j.result.execution.data.replace(/^0x/, '')
const buf = Buffer.from(hex, 'hex')
const lo  = buf.readBigUInt64LE(0)
const hi  = buf.readBigUInt64LE(8)
const price_e8  = lo | (hi << 64n)
const priceBlock   = buf.readBigUInt64LE(16)
const updatedBlock = buf.readBigUInt64LE(24)
console.log('TSLA  $' + Number(price_e8) / 1e8, 'updated @ block', updatedBlock.toString())
```

---

## Opcode reference

| op | name                       | who can call    | input layout                                                                    | output                                                  |
|----|----------------------------|-----------------|---------------------------------------------------------------------------------|---------------------------------------------------------|
|  0 | Initialize                 | factory (once)  | owner(32)                                                                       | —                                                       |
|  1 | RegisterSymbol             | owner-signed    | owner(32)‖nonce(8)‖symbol_id(4)‖tlen(1)‖ticker(tlen)‖sig(64)                    | —                                                       |
|  2 | SetPaused                  | owner-signed    | owner(32)‖nonce(8)‖paused(1)‖sig(64)                                            | —                                                       |
|  3 | ProposeTransferOwnership   | owner-signed    | owner(32)‖nonce(8)‖new_owner(32)‖sig(64)   ([0×32 = cancel any pending])        | —                                                       |
|  4 | UpdatePrice                | owner-signed    | owner(32)‖nonce(8)‖symbol_id(4)‖price(16)‖price_block(8)‖expiry(8)‖sig(64)      | —                                                       |
|  5 | UpdatePriceBatch           | owner-signed    | owner(32)‖nonce(8)‖count(1)‖count×[id(4)‖price(16)]‖price_block(8)‖expiry(8)‖sig(64) | —                                                  |
|  6 | AcceptTransferOwnership    | pending owner   | new_owner(32)‖sig(64)                                                           | —                                                       |
| 10 | GetPrice                   | anyone (view)   | input1 = symbol_id (u32)                                                        | price(16) ‖ price_block(8) ‖ updated_block(8) = 32 B    |
| 11 | GetSymbolInfo              | anyone (view)   | input1 = symbol_id                                                              | decimals(1) ‖ tlen(1) ‖ ticker(tlen)                    |
| 12 | GetOwner                   | anyone (view)   | —                                                                               | 32 B                                                    |
| 13 | GetPaused                  | anyone (view)   | —                                                                               | 1 B                                                     |
| 14 | GetNonce                   | anyone (view)   | —                                                                               | u64 LE                                                  |
| 15 | GetSymbolCount             | anyone (view)   | —                                                                               | u32 LE                                                  |
| 16 | IsSymbolRegistered         | anyone (view)   | input1 = symbol_id                                                              | 1 B (0/1)                                               |
| 17 | GetPendingOwner            | anyone (view)   | —                                                                               | 32 B (zero if none)                                     |
| 99 | GetName                    | anyone (view)   | —                                                                               | UTF-8                                                   |
|100 | GetSymbol                  | anyone (view)   | —                                                                               | UTF-8                                                   |

All multi-byte fields are little-endian. All owner-gated opcodes (1, 2, 3, 4, 5) sign:

```
digest = sha256( DOMAIN_TAG
                ‖ contract.block (u128 LE, 16 B)
                ‖ contract.tx    (u128 LE, 16 B)
                ‖ nonce          (u64  LE,  8 B)
                ‖ action_bytes )
```

with `DOMAIN_TAG` one of
`ALKANES_ORACLE_REGSYM`, `ALKANES_ORACLE_SETPAUSED`,
`ALKANES_ORACLE_PROPOSE_XFER`, `ALKANES_ORACLE_UPDATE`,
`ALKANES_ORACLE_BATCH`.

`AcceptTransferOwnership` (opcode 6) is signed by the **pending** owner
(not the current one) and uses a different digest with no admin nonce:

```
digest = sha256( "ALKANES_ORACLE_ACCEPTXFER"
                ‖ contract.block (u128 LE, 16 B)
                ‖ contract.tx    (u128 LE, 16 B)
                ‖ new_owner      (32 B) )
```

The pending-owner slot acts as a one-shot — once Accept succeeds, the
slot is cleared and the same `(pending_key, sig)` pair can't be replayed.

The contract then SHA-256-hashes that digest a second time inside
`k256::schnorr::VerifyingKey::verify` (BIP-340 message pre-hash).
The Node.js scripts already do the matching double-SHA-256 so you
don't have to think about it.

---

## Threat model

| risk                                  | mitigation                                                                                                       |
|---------------------------------------|------------------------------------------------------------------------------------------------------------------|
| Owner key is compromised              | Use two-step `Propose → Accept` ownership transfer to rotate to a safe key; consumer dApps should also enforce max-staleness. `SetPaused` is the fastest stop-gap. |
| Owner pushes a manipulated price      | This is a trusted-oracle model. Consumer dApps that need stronger guarantees should either run their own oracle or aggregate several oracles and take the median in their own contract. |
| Owner stamps a future `price_block`   | Contract rejects `price_block > now` (H1 audit fix). Consumer dApps that gate on `price_block ≥ market_close` can therefore trust that the sample was taken *no later than `now`*. |
| Replay of an old signed message       | Sequential `nonce` + per-opcode `DOMAIN_TAG` + contract-id in the digest.                                         |
| A signed update sits in mempool too long | Every signed update MUST carry `expiry > 0` (L1 audit fix); the contract rejects if `now > expiry` AND if `expiry == 0`. |
| Typo in ownership transfer bricks oracle | New owner must sign `AcceptTransferOwnership` to take over. A typo'd `new_owner` whose private key is unknown can't accept, so the current owner just calls Propose again with the all-zero sentinel to cancel. |
| Stale data used by consumer           | Every read returns `updated_block`; consumer enforces its own staleness policy (recommended: ≤ 144 blocks).      |
| Bitcoin mempool dust-relay policy     | Same as every other Alkanes tx — keep fee rate ≥ 2 sat/vB and broadcast via `mempool.space/api/tx` if Knots nodes reject. |

---

## Limits

* **Latency.** Bitcoin blocks are ~10 minutes. The oracle is fine
  for prediction markets, lending, and slow-mark perps, but is the
  wrong layer for HFT or millisecond mark prices.
* **Throughput.** One batch tx per cycle, ≤ 32 symbols per batch
  (raise `MAX_BATCH` in the contract and redeploy if you need more).
* **Trust.** This is a single-key oracle. If the operator goes
  offline, prices freeze; consumers see the staleness and refuse to
  trade. If you need decentralised price assembly, fork this and add
  a median-of-N aggregator contract in front.
* **Coverage.** Quote provider availability is the operator's
  responsibility. Yahoo and stooq cover most US equities; for ETFs,
  futures, or crypto pairs you'll want to swap the provider in
  `price-feeder.mjs`.