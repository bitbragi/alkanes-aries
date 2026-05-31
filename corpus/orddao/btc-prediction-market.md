---
title: prediction_market_btc — 4-hour binary BTC price market on Alkanes
source: orddao
source_url: https://raw.githubusercontent.com/orddao/BTC-price-prediction-market-for-alkanes/main/README.md
---

# prediction_market_btc — 4-hour binary BTC price market on Alkanes

A minimal, secure, single-market prediction contract. Each deployment is one
market with one question:

> **"Will BTC price be greater than $STRIKE at block RESOLVE_BLOCK?"**

* **Sides:** YES (price > strike) / NO (price ≤ strike)
* **Settlement:** parimutuel — winners split the entire pool pro-rata,
  minus a platform fee.
* **Platform fee:** configurable at deploy via `FEE_BPS` (default 500 = 5%).
  Taken from the **losing pool** at resolution; winners share `total − fee`.
  Fee is paid to the contract owner (the deployer's taproot pubkey) via the
  signed `WithdrawFees` opcode. **Refund paths take no fee.** Hard-capped at
  10% (`FEE_BPS_MAX = 1000`) — even the deployer cannot exceed this.
* **Oracle:** reads `price_oracle` opcode 10 (GetPrice) via `staticcall` at
  resolution time. Bring your own oracle by passing `ORACLE_BLOCK`/`ORACLE_TX`
  at deploy. The oracle must store an 8-decimal USD price.
* **Time:** block heights only — no timestamps anywhere (miners can fudge
  Bitcoin timestamps ±2 h, so they are unsafe for short markets).
* **Auth:** bets keyed by a user-supplied BIP-340 x-only pubkey; claims and
  refunds require a Schnorr signature over `(contract_id ‖ DOMAIN ‖ pubkey)`.
* **Failure recovery:** if the oracle is dead or the market is unbalanced,
  anyone with a stake can `ForceRefund` after `refund_block`.

The contract is ~900 lines of Rust and reuses the proven signing patterns from
`ico_freemint`, hardened with three additional defences:

* **Outpoint-bound signatures** for `Claim` / `ForceRefund` / `WithdrawFees`.
  The user (or owner) signs over a specific BTC outpoint that the broadcast
  tx must spend. A mempool front-runner who scrapes (pubkey, sig) can't
  redirect the payout because they don't own the bound UTXO. (No live
  prediction-market design on Alkanes is safe without this.)
* **Hard pool cap** (`POOL_CAP = 2⁶⁴ − 1` base units per side). Guarantees
  the parimutuel payout math (`bet × distributable / winners`) never
  overflows u128, so the contract never silently corrupts a payout. Enforced
  on every `Buy`.
* **Resolve / Refund mutex.** Once `now ≥ refund_block`, `Resolve` is
  permanently disabled; `ForceRefund` decrements the pools so the contract
  can never reach a half-resolved / half-refunded state.

---

## Files

```
contracts/prediction_market_btc/
├── Cargo.toml
├── src/
│   └── lib.rs                       ← the contract
├── deploy-market.mjs                ← deploy + initialize one market
├── resolve-market.mjs               ← cron/pm2-friendly Resolve() caller
├── prediction-market-server.mjs     ← HTTP microservice that builds PSBTs
└── README.md
```

A reference frontend (`predict.php` + `api/predict-build.php` + `api/predict-state.php`)
in the project root drives the full Bet / Resolve / Claim / ForceRefund flow,
mirroring the `ico.php` / `my-scan.php` pattern.

---

## Build

```bash
cd contracts/prediction_market_btc
cargo build --release --target wasm32-unknown-unknown
wasm-opt -Oz target/wasm32-unknown-unknown/release/prediction_market_btc.wasm \
   -o prediction_market_btc_opt.wasm
```

---

## Deploy one market

Prereqs:

* You already deployed `price_oracle` (note its `[2, ORACLE_TX]` id).
* You registered a `symbol_id` for BTC in that oracle (e.g. 100).
* You have a `price-feeder.mjs` daemon pushing fresh BTC prices.
* You picked a `collateral` alkane (e.g. SCAN at `2:77595`, or DIESEL at `2:0`).

```bash
MNEMONIC="word1 … word12" \
  ORACLE_BLOCK=2  ORACLE_TX=80000 \
  SYMBOL_ID=100 \
  STRIKE_USD=100000 \
  CLOSE_BLOCK=950100 \
  COLLATERAL_BLOCK=2 COLLATERAL_TX=77595 \
  MIN_BET=10000 \
  FEE_BPS=500 \
  FEE_RATE=3 \
  CONFIRM=yes \
  node deploy-market.mjs
```

Defaults applied if you don't override them:

| env var          | default                          | meaning                              |
|------------------|----------------------------------|--------------------------------------|
| `RESOLVE_BLOCK`  | `CLOSE_BLOCK + 24`               | ~4 h after close                     |
| `REFUND_BLOCK`   | `RESOLVE_BLOCK + 1008`           | +1 week — force-refund deadline       |
| `MAX_STALENESS`  | `24`                             | max blocks since `updated_block`     |
| `FEE_BPS`        | `500`                            | platform fee (5% of losers' pool); contract caps at 1000 |

Constraints enforced at Initialize:

* `close_block > now`
* `resolve_block ≥ close_block + 6` (the indexer-lag + feeder-cadence buffer)
* `refund_block > resolve_block`
* `min_bet > 0`, `max_staleness > 0`, `strike_e8 > 0`, `symbol_id > 0`

Once confirmed (~10 min), look up the new `[2, MARKET_TX]` id via
`alkanes-cli alkanes trace <reveal_txid>:0..4`.

---

## Run the resolver

The market doesn't resolve itself — someone needs to call opcode 2 after
`resolve_block`. Anyone can; in practice you run this on the same VPS as the
oracle feeder:

```bash
# pm2 loop, retries every 60 s until success:
pm2 start resolve-market.mjs --name mkt-100k-resolve -- env \
  MNEMONIC="…" \
  MARKET_BLOCK=2 MARKET_TX=80123 \
  LOOP=60 \
  CONFIRM=yes
```

Or a plain cron one-shot:

```bash
* * * * * MNEMONIC="…" MARKET_BLOCK=2 MARKET_TX=80123 CONFIRM=yes \
  node /var/www/.../resolve-market.mjs >> /var/log/resolve.log 2>&1
```

The script does its own pre-flight via `alkanes_simulate` so it doesn't burn
a fee if the call would revert (e.g. the oracle hasn't pushed a post-close
price yet). It exits 0 once the market is resolved or refundable; non-zero
on a retryable error so cron tries again next minute.

---

## Run the PSBT server (for the web frontend)

`prediction-market-server.mjs` is a small HTTP microservice that builds the
unsigned PSBTs for Bet / Resolve / Claim / ForceRefund. The web frontend
(`predict.php` + `api/predict-build.php`) talks to it through a thin PHP
proxy, exactly like `ico-freemint-server.mjs` does for the ICO page.

```bash
# Install deps once (shares the @oyl/sdk + bitcoinjs-lib from the ICO server)
cd contracts/prediction_market_btc
pm2 start prediction-market-server.mjs \
  --name prediction-market-server \
  -- env \
    PORT=3018 \
    COLLATERAL=4:797           # default collateral if state read fails
```

Endpoints:

```
GET  /health
GET  /state?market=BLOCK:TX[&pubkey=…]
POST /build-bet-psbt        { address, pubkey, utxos, market, side, amountBu,
                              claimPubkey, feeRate? }
POST /build-resolve-psbt    { address, pubkey, utxos, market, feeRate? }
POST /build-claim-psbt      { address, pubkey, utxos, market, claimPubkey,
                              sig, feeRate? }
POST /build-refund-psbt     { address, pubkey, utxos, market, claimPubkey,
                              sig, feeRate? }
```

Point `api/predict-build.php`'s `PREDICT_SERVER_BASE` constant (or the
`PREDICT_SERVER_URL` env var) at this service.

---

## End-to-end test (with the web frontend)

The fastest way to test a fresh deploy.

1. **Deploy the oracle** and push a price. The oracle has its own README at
   `contracts/price_oracle/README.md`. Register a symbol id for BTC (e.g.
   `SYMBOL_ID=100`) and run the feeder so prices are recent.

2. **Deploy a short test market.** Pick a `CLOSE_BLOCK` ~ 2–4 blocks from
   the current tip so you can place bets, then watch it close, then resolve.
   ```bash
   MNEMONIC="…" \
     ORACLE_BLOCK=2 ORACLE_TX=<oracle_tx> \
     SYMBOL_ID=100 \
     STRIKE_USD=70000 \
     CLOSE_BLOCK=$(($(curl -s https://blockstream.info/api/blocks/tip/height) + 3)) \
     RESOLVE_BLOCK=$(($(curl -s https://blockstream.info/api/blocks/tip/height) + 5)) \
     REFUND_BLOCK=$(($(curl -s https://blockstream.info/api/blocks/tip/height) + 50)) \
     MAX_STALENESS=24 \
     COLLATERAL_BLOCK=4 COLLATERAL_TX=797 \
     MIN_BET=1000 \
     FEE_BPS=500 \
     FEE_RATE=3 \
     CONFIRM=yes \
     node deploy-market.mjs
   ```
   Wait for the reveal to confirm, then read the new market id from the
   `[2, N]` line the script prints.

3. **Start the PSBT server** (`pm2 start prediction-market-server.mjs`,
   above) and verify the upstream URL inside
   `api/predict-build.php` / `api/predict-state.php` matches your DNS layout.

4. **Visit `https://your-host/predict.php?market=2:N`.** The page will:
   * Load the live market state from the contract via `alkanes_simulate`.
   * Ask you to connect UniSat (used only for funding + broadcasting).
   * Generate an in-browser BIP-340 keypair the first time you load the
     market, and store it in `localStorage` keyed by `(market, address)`.
     This key is the *bet identity* — keep it safe; if you clear site data
     before claiming you forfeit the bet.
   * Show **Place Bet** while `tip < close_block`.
   * Show **Resolve market** once `tip ≥ resolve_block` (anyone can press
     it).
   * Show **Claim winnings** to winners after resolution, or
     **Force refund** if the market hit the refund path.

5. **Watch the on-chain trace** at `https://espo.sh/tx/<txid>` (alkanes
   trace tab) to verify each call's effect. Bets credit the contract;
   refunds (over-payment) return to your taproot vout 0; payouts arrive
   as the collateral alkane back to vout 0.

> Note: `predict.php` is intentionally a single-market test page. Multi-
> market dashboards (a list of upcoming/active/settled markets) are easy
> to add — wire your own indexing layer (a small SQL table that the
> deploy script writes to) and have the frontend list each entry through
> the same state/build endpoints.

---

## Bet from a frontend (Buy)

`Buy` takes 49 bytes of calldata after the opcode and consumes the configured
collateral alkane as **incoming alkanes** on the bet transaction.

### Calldata layout (after opcode 1)

```
[ 0..32]  pubkey         (32 B, x-only BIP-340 — the user's identifier for claiming)
[32..33]  side           (1 = YES / price > strike,  0 = NO)
[33..49]  desired_amount (u128 LE) — exact bet size in collateral base units.
                                     0 means "use the full incoming, no refund".
                                     Non-zero requires incoming ≥ desired_amount
                                     and any excess is refunded to vout 0.
```

So the full `inputs` array on the protostone is:

```
[ MARKET_BLOCK, MARKET_TX, 1, pk_lo_u128, pk_hi_u128, side_padded_u128, desired_amount_u128 ]
```

(49 bytes packed into 4 × u128.)

### Incoming alkanes

The transaction's protostone must transfer `≥ MIN_BET` base units of the
configured collateral alkane to the market contract. **Only the collateral
alkane is accepted** — sending any other alkane reverts the entire Buy.

### Frontend flow (matches your existing patterns)

1. `await window.unisat.requestAccounts()` and `window.unisat.getPublicKey()`
   to obtain the x-only pubkey.
2. Show the user the bet card: market id, strike, side, amount, fee rate.
   **Display the pubkey** that will be used so a malicious frontend can't
   silently substitute another address.
3. Build a PSBT that:
   * spends the user's collateral UTXOs (fetched from the indexer),
   * sends `bet_amount` of collateral to the market contract via an alkane
     edict (pointer to vout 0 of the contract),
   * embeds the Buy protostone with the calldata above.
4. `unisat.signPsbt(psbtBase64)` → `unisat.pushPsbt(signedPsbt)`.

A working reference is your `my-scan.php` send flow — the only differences
are: (a) the recipient is a contract (alkane id) instead of an address,
(b) the protostone calldata carries `[MARKET_BLOCK, MARKET_TX, 1, pk_lo, pk_hi, side]`.

The contract validates and reverts on any of:

* `paused == 1`
* market already resolved
* `now >= close_block` (deadline passed)
* `side > 1`
* invalid pubkey encoding
* incoming amount `< min_bet`
* any incoming alkane that isn't the collateral id

---

## Claim winnings

Once the market is resolved (`GetResolved` returns `1`) and the user is on the
winning side, they call opcode 3 with a Schnorr signature **bound to a
specific BTC outpoint** that the Claim tx must spend.

### Why the outpoint binding?

A naïve "sign over (DOMAIN ‖ contract ‖ pubkey)" digest is vulnerable to
mempool front-running: an attacker scrapes (pubkey, sig) out of the user's
pending tx, builds a competing tx with the same calldata but their own
pointer output, pays a higher miner fee, and steals the payout.

To defeat this, the digest is **also bound to a UTXO outpoint** that the
broadcast tx must consume. An attacker who lifts (pubkey, sig) out of the
mempool still cannot construct a valid Bitcoin tx because they don't own the
private key for the committed UTXO — any tx they build either won't spend
the bound outpoint (contract reverts) or won't be a valid Bitcoin tx at
all.

### Signed message

```
digest = SHA-256( "ALKANES_PMKT_CLAIM"
                ‖ market_block        (u128 LE, 16 B)
                ‖ market_tx           (u128 LE, 16 B)
                ‖ pubkey              (32 B, x-only BIP-340)
                ‖ commit_txid         (32 B, display order)
                ‖ commit_vout         (u32 LE,  4 B) )
sig = schnorr_sign( claim_sk, digest )
```

The contract's `verify_user_sig_bound` runs **a single SHA-256** over the
same fields and calls `k256::schnorr::VerifyingKey::verify(digest, sig)`
(BIP-340 handles its own per-signature randomisation internally). The
`@noble/curves` library on the frontend uses the same algorithm.

### Calldata (after opcode 3)

```
[  0.. 32]  pubkey       (32 B, x-only)
[ 32.. 64]  commit_txid  (32 B, display order — same bytes as on blockstream)
[ 64.. 68]  commit_vout  (u32 LE)
[ 68..132]  sig          (64 B Schnorr)
```

Packed into 9 × u128 in the protostone:

```
[ MARKET_BLOCK, MARKET_TX, 3, pk_lo, pk_hi,
  txid_lo, txid_hi, vout_padded_u128,
  sig_0, sig_1, sig_2, sig_3 ]
```

The contract:
1. Verifies the Schnorr signature.
2. Calls `transaction_object()` and asserts that one of the tx inputs
   spends `(commit_txid, commit_vout)`.
3. Sets `/claimed/<pubkey> = 1`.
4. Emits the payout via the protostone pointer.

### `ForceRefund` uses the same shape

Opcode 4. Identical 132-byte calldata layout, identical digest formula
except `DOMAIN = "ALKANES_PMKT_REFUND"`. Allowed only when
`(resolved == 2) || (resolved == 0 && now >= refund_block)`. Decrements
`pool_yes`/`pool_no` and zeros the per-user bet keys so any stuck-state
follow-up `Claim` from another user still sees correct totals.

### Frontend pattern (matches `predict.php`)

```js
// 1. Pick a BTC UTXO to commit to (largest confirmed plain-BTC UTXO works).
const utxos  = await fetch(`https://blockstream.info/api/address/${addr}/utxo`).then(r => r.json())
const commit = utxos.filter(u => u.status.confirmed)
                    .sort((a,b) => b.value - a.value)[0]

// 2. Build the digest and sign with the in-page ephemeral claim key.
const buf = new Uint8Array(tag.length + 16 + 16 + 32 + 32 + 4)
// …pack DOMAIN ‖ block ‖ tx ‖ pubkey ‖ commit_txid ‖ commit_vout_le
const digest = sha256(buf)
const sig    = schnorr.sign(digest, claimKey.priv)

// 3. POST to api/predict-build.php with kind:"claim", including commit_txid + commit_vout.
//    The Node.js server force-includes that UTXO in the PSBT inputs.

// 4. unisat.signPsbt → unisat.pushPsbt. Done.
```

The full implementation is in `predict.php`'s `pmkt_signAuthBound` and
`pmkt_settleCall` functions.

---

## Platform fee

At Resolve (winner-take-all branch), the contract computes:

```
fee_accrued    = (losing_pool * fee_bps) / 10_000        // u128, truncated
distributable  = total_pool − fee_accrued                // for winners
```

…and stores `fee_accrued` in `/fee_accrued`. Winners then claim:

```
payout = (bet_winning_side * distributable) / winners_pool
```

So a YES winner with 100 SCAN bet on a pool of {YES: 1000, NO: 4000} at
`fee_bps = 500`:

```
fee_accrued   = 4000 * 500 / 10000          = 200
distributable = 5000 − 200                  = 4800
payout        = 100 * 4800 / 1000           = 480
```

versus the no-fee version (`payout = 500`). The owner walks away with 200.

**Refund flows take no fee** — `ForceRefund` and the auto-refund path (when
one side has zero bets) return original collateral verbatim. The owner can
only ever earn on resolved markets that had bettors on both sides.

### WithdrawFees (opcode 6)

Owner signs an outpoint-bound digest (same anti-front-run pattern as Claim):

```
digest = SHA-256( "ALKANES_PMKT_WITHDRAW_FEES"
                ‖ market_block  (u128 LE)
                ‖ market_tx     (u128 LE)
                ‖ admin_nonce   (u64  LE)
                ‖ commit_txid   (32 B)
                ‖ commit_vout   (u32 LE)  // "action" body)
```

Calldata after opcode 6 (140 bytes):

```
[  0.. 32]  owner pubkey
[ 32.. 40]  admin_nonce (u64 LE)
[ 40.. 72]  commit_txid (32 B, display order)
[ 72.. 76]  commit_vout (u32 LE)
[ 76..140]  sig (64 B Schnorr)
```

The contract verifies the sig, asserts that the tx spends
`(commit_txid, commit_vout)`, sets `/fee_accrued = 0`, and emits an outgoing
transfer of the accrued amount to the protostone's pointer output. The owner
builds the tx so the pointer points at their own address.

Replay is prevented by the standard admin nonce *and* by the fact that
`(commit_txid, commit_vout)` can only ever be spent once.

You can batch multiple markets into one WithdrawFees workflow by running a
small script that signs one tx per market (each market has its own admin
nonce + contract id, so each signature is unique).

---

## Force refund

After `refund_block` (default: 1 week past resolve), if the market was never
resolved (e.g. oracle died) **or** if one of the pools was empty at Resolve
(`resolved == 2`), anyone with a stake can recover their collateral.

### Calldata (after opcode 4)

```
[  0.. 32]  pubkey
[ 32.. 64]  commit_txid  (32 B, display order)
[ 64.. 68]  commit_vout  (u32 LE)
[ 68..132]  sig  (Schnorr over "ALKANES_PMKT_REFUND" digest, see Claim section)
```

Returns `bet_yes + bet_no` to the user, decrements `pool_yes` / `pool_no`
by the refunded amounts, and zeros the per-user bet keys.

> Once `now >= refund_block`, `Resolve` is permanently disabled. This keeps
> the contract from getting into a half-resolved / half-refunded state where
> Claim payouts would be miscalculated against stale pool totals.

---

## Opcode reference

| op | name           | who         | calldata (after opcode)                                           | returns                                                       |
|----|----------------|-------------|-------------------------------------------------------------------|---------------------------------------------------------------|
|  0 | Initialize     | factory     | 164 B fixed-layout config (see deploy script)                     | —                                                             |
|  1 | Buy            | anyone      | pubkey(32) ‖ side(1) ‖ desired_amount(u128)                       | refund of excess collateral (if any)                          |
|  2 | Resolve        | anyone      | —  (only while close_block ≤ now < refund_block)                  | —                                                             |
|  3 | Claim          | bettor      | pubkey(32) ‖ commit_txid(32) ‖ commit_vout(u32) ‖ sig(64)         | outgoing collateral transfer                                  |
|  4 | ForceRefund    | bettor      | pubkey(32) ‖ commit_txid(32) ‖ commit_vout(u32) ‖ sig(64)         | outgoing collateral transfer (decrements pools)               |
|  5 | SetPaused      | owner-signed| owner(32) ‖ nonce(8) ‖ flag(1) ‖ sig(64)                          | —                                                             |
|  6 | WithdrawFees   | owner-signed| owner(32) ‖ nonce(8) ‖ commit_txid(32) ‖ commit_vout(u32) ‖ sig(64)| outgoing collateral transfer of /fee_accrued                  |
| 10 | GetPoolYes     | view        | —                                                                 | u128 LE                                                       |
| 11 | GetPoolNo      | view        | —                                                                 | u128 LE                                                       |
| 12 | GetResolved    | view        | —                                                                 | u8 (0=open, 1=resolved, 2=refundable)                         |
| 13 | GetOutcome     | view        | —                                                                 | u8 (1=YES wins, 0=NO wins)                                    |
| 14 | GetResolvePrice| view        | —                                                                 | price_e8(16) ‖ price_block(8)                                 |
| 15 | GetState       | view        | —                                                                 | packed 223 B snapshot (see lib.rs)                            |
| 16 | GetBet         | view        | pubkey(32 packed as 2 u128)                                       | bet_yes(16) ‖ bet_no(16)                                      |
| 17 | GetClaimed     | view        | pubkey(32 packed as 2 u128)                                       | u8                                                            |
| 18 | GetParams      | view        | —                                                                 | same as GetState                                              |
| 19 | GetPaused      | view        | —                                                                 | u8                                                            |
| 20 | GetOwner       | view        | —                                                                 | 32 B                                                          |
| 21 | GetAdminNonce  | view        | —                                                                 | u64 LE                                                        |
| 22 | GetFeeBps      | view        | —                                                                 | u32 LE (basis points)                                         |
| 23 | GetFeeAccrued  | view        | —                                                                 | u128 LE (collateral base units)                               |
| 99 | GetName        | view        | —                                                                 | UTF-8 string                                                  |
|100 | GetSymbol      | view        | —                                                                 | UTF-8 string                                                  |

---

## Security checks at resolution

Inside opcode 2 the contract enforces three independent checks before settling:

```
1.  height()                  >= resolve_block         // time gate
2.  oracle.price_block         >= close_block          // ⚠ anti-front-run
3.  height() − oracle.updated_block  <= max_staleness  // liveness
```

Why each matters:

| check                                | what it prevents                                                                              |
|--------------------------------------|----------------------------------------------------------------------------------------------|
| `height ≥ resolve_block`             | resolving the market before the deadline                                                       |
| `oracle.price_block ≥ close_block`   | settling on a price sampled WHILE bets were still open (the operator could otherwise pick a favourable old sample) |
| `now − updated_block ≤ max_staleness`| settling on a frozen oracle whose feeder is dead — without this someone could call `Resolve` weeks later on stale data |

If any check fails, the call reverts. Anyone can retry it on the next oracle
push; nobody loses money — just the (~$0.10) tx fee.

---

## Threat model (summary)

| risk                                  | mitigation                                                                                       |
|---------------------------------------|--------------------------------------------------------------------------------------------------|
| Operator pushes manipulated price     | Use median-of-N quote sources in the feeder. Bettors trust the *oracle*, not this contract.      |
| Replay of a signed claim              | `/claimed/<pubkey>` flag + contract-id binding in digest                                          |
| Replay of a signed admin op           | Sequential admin nonce + per-opcode domain tag                                                    |
| Bets placed too close to deadline     | Frontend "safe to bet by" deadline accounts for indexer lag                                       |
| Stale oracle / feeder outage          | `max_staleness` check → Resolve reverts; `refund_block` → ForceRefund returns collateral         |
| One side of the market is empty       | Resolve marks `resolved=2` (no oracle call) → everyone refunded via ForceRefund                  |
| Mempool dust-relay (Bitcoin Knots)    | Same workaround as everywhere else: fee rate ≥ 2 sat/vB, broadcast via `mempool.space/api/tx`     |
| Miner timestamp manipulation          | Not applicable — contract uses block heights only                                                 |
| Owner sets predatory fee              | `FEE_BPS_MAX = 1000` (10%) hard-coded; Initialize reverts if exceeded. fee_bps is immutable post-deploy. |
| Fee taken from refunds                | By construction: ForceRefund and resolved=2 paths never touch /fee_accrued — only the winner-take-all branch in Resolve writes it. |

---

## Limits

* **One market per contract.** Hosting a ladder of strikes/durations =
  deploying N contracts. Each deploy is ~$3 in mainnet fees. For a busy
  product, fold many markets into one contract by adding a `market_id`
  parameter to every opcode and a per-market storage prefix — out of scope
  for this V1.
* **No on-chain order book.** Pure parimutuel. Implied probability is
  `pool_yes / (pool_yes + pool_no)` and shifts continuously as bets arrive.
  No price-time priority, no LP, no cancellation.
* **No partial early exits.** Once a bet is placed it sits until resolve.
  (Adding a `Sell` opcode that returns collateral pro-rata is straightforward
  but skipped for V1.)
* **Trusted oracle.** Same caveat as in `price_oracle/README.md`: this is a
  single-key oracle. If you need decentralised price assembly, fork the
  oracle and add a median-of-N aggregator in front before pointing the
  market at it.
* **Round-trip latency ≈ 2–4 h** for a "4-hour market" — that's the
  Bitcoin-block + indexer-lag floor, not a contract limitation.

---

## V1 launch checklist

1. ✅ `price_oracle` deployed and a BTC symbol registered (e.g. `SYMBOL_ID=100`, ticker `BTC`).
2. ✅ `price-feeder.mjs` running under pm2 with `INTERVAL_MIN=2`, multi-source quotes, `EXPIRY_BLOCKS=6`.
3. ✅ This contract built (`prediction_market_btc_opt.wasm`).
4. Pick the next round number above current BTC spot (e.g. $100,000).
5. Pick `CLOSE_BLOCK = tip + ~24` (~4 h from now); `RESOLVE_BLOCK` defaults to `+24` after that.
6. Run `deploy-market.mjs` with all the parameters and `CONFIRM=yes`.
7. Save the new market id; pass it to the frontend and to `resolve-market.mjs`.
8. Start the resolver in pm2 with `LOOP=60`.
9. Once a market resolves: redeploy the next round (a small cron PHP/JS script can do this in a loop).