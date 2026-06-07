---
title: BTC/USD Price Feed Oracle
source: oracles
source_url: https://alkanescan.org/oracle-price-feed.php
---

[Oracles](oracles.php) › BTC/USD Price Feed

📈

# BTC/USD Price Feed Oracle

Alkanes smart contract · Chainlink-style on-chain price feed · generic for any pair

Permissioned write · Trustless read

A Chainlink-style aggregator implemented as a native Alkanes contract. A single authorized **operator** pushes price updates; any Alkanes contract reads the latest answer (and any historical round) via `staticcall` — no auth required for reads. The feed name (_BTC/USD_) is set at deploy time; the same WASM binary powers any pair.

● Single trusted operator

Whoever holds the auth token can push prices. Transfer the token to a multisig for shared operation.

● All reads are pure

14 read opcodes. All staticcall-safe. No auth token required.

● Round-based history

Every update stores a new round. Consumers replay any past price.

● Heartbeat guard

is\_stale checks age in blocks. Configurable threshold.

● Pause switch

Operator can halt updates during incidents without losing history.

Lending / Liquidations Synthetic assets Stablecoins Streaming payments Parametric insurance Fee escalators

"cm"\>// =============================================================================
"cm"\>// AlkaneScan · BTC/USD Price Feed Oracle
"cm"\>//
"cm"\>// A Chainlink-style aggregator price feed implemented as a native Alkanes
"cm"\>// smart contract. A single authorized operator pushes price updates;
"cm"\>// any Alkanes contract can read the latest price(and historical prices
"cm"\>// by round) via staticcall.
"cm"\>//
"cm"\>// Trust model:
"cm"\>//   \* Single authorized operator, enforced via the Alkanes auth-token pattern.
"cm"\>//   \* Initialize() mints \`auth\_units\` auth tokens to the deployer.
"cm"\>//   \* Gated opcodes require the auth token in \`incoming\_alkanes\`.
"cm"\>//   \* Transferring the auth token transfers operator rights.
"cm"\>//   \* No off-chain proofs, no aggregation across nodes(use a TWAP oracle
"cm"\>//     on top if you need manipulation resistance).
"cm"\>//
"cm"\>// Source file: src/lib.rs
"cm"\>// Crate type:  cdylib
"cm"\>// Edition:     2021
"cm"\>//
"cm"\>// While named "BTC/USD" the contract is generic -- the \`description\` field
"cm"\>// is set at deploy time so the same code can power any feed(ETH/USD,
"cm"\>// DIESEL/USD, LST exchange rates, etc.).
"cm"\>// =============================================================================

use alkanes\_runtime::{
    auth::AuthenticatedResponder,
    declare\_alkane,
    message::MessageDispatch,
    runtime::AlkaneResponder,
    storage::StoragePointer,
};
use alkanes\_support::response::CallResponse;
use anyhow::{anyhow, Result};
use metashrew\_support::index\_pointer::KeyValuePointer;
use std::sync::Arc;

"cm"\>// -----------------------------------------------------------------------------
"cm"\>// Storage keys(domain-separated)
"cm"\>// -----------------------------------------------------------------------------

const K\_LATEST\_ROUND: &str = "/latest\_round";
const K\_DECIMALS:     &str = "/decimals";
const K\_DESCRIPTION:  &str = "/description";
const K\_MAX\_STALE:    &str = "/max\_staleness";
const K\_PAUSED:       &str = "/paused";

"cm"\>// -----------------------------------------------------------------------------
"cm"\>// Limits
"cm"\>// -----------------------------------------------------------------------------

"cm"\>/// Cap decimals at 18 -- matches Chainlink / ERC20 convention.
const MAX\_DECIMALS: u8 = 18;

"cm"\>/// Cap description at 64 bytes to keep storage reads cheap.
const MAX\_DESC\_LEN: usize = 64;

"cm"\>// -----------------------------------------------------------------------------
"cm"\>// Round record layout(33 bytes)
"cm"\>//
"cm"\>//   offset | size | field
"cm"\>//   -------|------|------------------
"cm"\>//   0      | 16   | price(u128 LE)
"cm"\>//   16     | 1    | decimals(u8)
"cm"\>//   17     | 8    | updated\_at\_block(u64 LE)
"cm"\>//   25     | 8    | updated\_at\_time(u64 LE)
"cm"\>// -----------------------------------------------------------------------------

fn encode\_round(price: u128, decimals: u8, block: u64, ts: u64) -> Vec<u8\> {
    let mut out = Vec::with\_capacity(33);
    out.extend\_from\_slice(&price.to\_le\_bytes());
    out.push(decimals);
    out.extend\_from\_slice(&block.to\_le\_bytes());
    out.extend\_from\_slice(&ts.to\_le\_bytes());
    out
}

fn decode\_round(bytes: &\[u8\]) -> Result<(u128, u8, u64, u64)> {
    if bytes.len() < 33 {
        return Err(anyhow!("round record corrupted or missing"));
    }
    let price    = u128::from\_le\_bytes(bytes\[0..16\].try\_into().unwrap());
    let decimals = bytes\[16\];
    let block    = u64::from\_le\_bytes(bytes\[17..25\].try\_into().unwrap());
    let ts       = u64::from\_le\_bytes(bytes\[25..33\].try\_into().unwrap());
    Ok((price, decimals, block, ts))
}

fn round\_key(id: u128) -> String {
    format!("/round/{}", id)
}

"cm"\>// -----------------------------------------------------------------------------
"cm"\>// Contract
"cm"\>// -----------------------------------------------------------------------------

#\[derive(Default)\]
pub struct PriceFeedOracle(());

impl AlkaneResponder for PriceFeedOracle {}
impl AuthenticatedResponder for PriceFeedOracle {}

#\[derive(MessageDispatch)\]
enum PriceFeedMessage {
    "cm"\>/// One-time initializer.
    "cm"\>///   \* \`auth\_units\` -- number of auth tokens to mint to deployer(typically 1).
    "cm"\>///   \* \`decimals\`   -- scaling factor for \`price\`. Must be <= 18.
    "cm"\>///   \* \`max\_staleness\_blocks\` -- 0 disables the staleness check.
    "cm"\>///   \* \`description\` -- human-readable label, e.g. "BTC / USD". <= 64 bytes.
    #\[opcode(0)\]
    Initialize {
        auth\_units: u128,
        decimals: u128,
        max\_staleness\_blocks: u128,
        description: String,
    },

    "cm"\>// ------------- Operator-gated writes -------------
    #\[opcode(10)\] #\[returns(Vec<u8\>)\] UpdatePrice { price: u128 },
    #\[opcode(50)\] #\[returns(Vec<u8\>)\] Pause,
    #\[opcode(51)\] #\[returns(Vec<u8\>)\] Unpause,
    #\[opcode(53)\] #\[returns(Vec<u8\>)\] SetMaxStaleness { blocks: u128 },
    #\[opcode(54)\] #\[returns(Vec<u8\>)\] SetDecimals { decimals: u128 },

    "cm"\>// ------------- Read-only -------------
    #\[opcode(20)\] #\[returns(Vec<u8\>)\] LatestAnswer,
    #\[opcode(21)\] #\[returns(Vec<u8\>)\] LatestRound,
    #\[opcode(22)\] #\[returns(Vec<u8\>)\] LatestRoundData,
    #\[opcode(23)\] #\[returns(Vec<u8\>)\] Decimals,
    #\[opcode(24)\] #\[returns(Vec<u8\>)\] Description,
    #\[opcode(25)\] #\[returns(Vec<u8\>)\] LatestTimestamp,
    #\[opcode(26)\] #\[returns(Vec<u8\>)\] LatestBlock,
    #\[opcode(30)\] #\[returns(Vec<u8\>)\] GetRoundData { round\_id: u128 },
    #\[opcode(31)\] #\[returns(Vec<u8\>)\] GetAnswerAt  { round\_id: u128 },
    #\[opcode(40)\] #\[returns(Vec<u8\>)\] IsStale,
    #\[opcode(41)\] #\[returns(Vec<u8\>)\] MaxStalenessBlocks,
    #\[opcode(52)\] #\[returns(Vec<u8\>)\] IsPaused,
    #\[opcode(99)\] #\[returns(Vec<u8\>)\] TotalUpdates,
}

impl PriceFeedOracle {
    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Storage helpers
    "cm"\>// -------------------------------------------------------------------------

    fn read\_u8(key: &str) -> u8 {
        let b = StoragePointer::from\_keyword(key).get();
        if b.len() >= 1 { b\[0\] } else { 0 }
    }

    fn read\_u64(key: &str) -> u64 {
        let b = StoragePointer::from\_keyword(key).get();
        if b.len() >= 8 {
            u64::from\_le\_bytes(b\[..8\].try\_into().unwrap())
        } else { 0 }
    }

    fn read\_u128(key: &str) -> u128 {
        let b = StoragePointer::from\_keyword(key).get();
        if b.len() >= 16 {
            u128::from\_le\_bytes(b\[..16\].try\_into().unwrap())
        } else { 0 }
    }

    fn write\_u8(key: &str, v: u8) {
        StoragePointer::from\_keyword(key).set(Arc::new(vec!\[v\]));
    }

    fn write\_u64(key: &str, v: u64) {
        StoragePointer::from\_keyword(key).set(Arc::new(v.to\_le\_bytes().to\_vec()));
    }

    fn write\_u128(key: &str, v: u128) {
        StoragePointer::from\_keyword(key).set(Arc::new(v.to\_le\_bytes().to\_vec()));
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Guards & helpers
    "cm"\>// -------------------------------------------------------------------------

    "cm"\>/// Build a reply that forwards incoming alkanes(including the auth token
    "cm"\>/// for gated writes) and carries \`bytes\` as the return value.
    fn reply(&self, bytes: Vec<u8\>) -> Result<CallResponse\> {
        let mut r = CallResponse::forward(&self.context()?.incoming\_alkanes);
        r.data = bytes;
        Ok(r)
    }

    fn require\_not\_paused(&self) -> Result<()> {
        if Self::read\_u8(K\_PAUSED) == 1 {
            return Err(anyhow!("price feed is paused"));
        }
        Ok(())
    }

    fn validate\_decimals(d: u128) -> Result<u8\> {
        if d > MAX\_DECIMALS as u128 {
            return Err(anyhow!("decimals must be <= {}", MAX\_DECIMALS));
        }
        Ok(d as u8)
    }

    fn load\_round(round\_id: u128) -> Result<(u128, u8, u64, u64)> {
        if round\_id == 0 {
            return Err(anyhow!("round\_id must be >= 1"));
        }
        let bytes = StoragePointer::from\_keyword(&round\_key(round\_id)).get();
        if bytes.len() == 0 {
            return Err(anyhow!("round {} does not exist", round\_id));
        }
        decode\_round(&bytes)
    }

    "cm"\>/// Pack a round into the public response layout(49 bytes):
    "cm"\>///   round\_id(16) | price(16) | decimals(1) | block(8) | ts(8)
    fn encode\_response(round\_id: u128, price: u128, decimals: u8, block: u64, ts: u64) -> Vec<u8\> {
        let mut out = Vec::with\_capacity(49);
        out.extend\_from\_slice(&round\_id.to\_le\_bytes());
        out.extend\_from\_slice(&price.to\_le\_bytes());
        out.push(decimals);
        out.extend\_from\_slice(&block.to\_le\_bytes());
        out.extend\_from\_slice(&ts.to\_le\_bytes());
        out
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcode 0: initialize
    "cm"\>// -------------------------------------------------------------------------
    fn initialize(
        &self,
        auth\_units: u128,
        decimals: u128,
        max\_staleness\_blocks: u128,
        description: String,
    ) -> Result<CallResponse\> {
        self.observe\_initialization()?;
        let ctx = self.context()?;
        let mut response = CallResponse::forward(&ctx.incoming\_alkanes);

        "cm"\>// Validate inputs.
        let d = Self::validate\_decimals(decimals)?;
        if max\_staleness\_blocks > u64::MAX as u128 {
            return Err(anyhow!("max\_staleness\_blocks too large"));
        }
        let desc\_bytes = description.into\_bytes();
        if desc\_bytes.len() > MAX\_DESC\_LEN {
            return Err(anyhow!("description too long(max {} bytes)", MAX\_DESC\_LEN));
        }

        "cm"\>// Write initial state.
        Self::write\_u8(K\_DECIMALS, d);
        Self::write\_u64(K\_MAX\_STALE, max\_staleness\_blocks as u64);
        StoragePointer::from\_keyword(K\_DESCRIPTION).set(Arc::new(desc\_bytes));
        Self::write\_u128(K\_LATEST\_ROUND, 0);
        Self::write\_u8(K\_PAUSED, 0);

        "cm"\>// Mint the auth token; it is sent back to the deployer in the response.
        let auth\_transfer = self.deploy\_auth\_token(auth\_units)?;
        response.alkanes.0.push(auth\_transfer);
        Ok(response)
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcode 10: update\_price(operator-gated)
    "cm"\>// -------------------------------------------------------------------------
    fn update\_price(&self, price: u128) -> Result<CallResponse\> {
        self.only\_owner()?;
        self.require\_not\_paused()?;

        let decimals = Self::read\_u8(K\_DECIMALS);
        let block = self.height();
        let ts = self.block\_header()?.time as u64;

        let next\_round = Self::read\_u128(K\_LATEST\_ROUND).saturating\_add(1);
        let record = encode\_round(price, decimals, block, ts);
        StoragePointer::from\_keyword(&round\_key(next\_round)).set(Arc::new(record));
        Self::write\_u128(K\_LATEST\_ROUND, next\_round);

        self.reply(next\_round.to\_le\_bytes().to\_vec())
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcodes 50, 51, 52: pause / unpause / is\_paused
    "cm"\>// -------------------------------------------------------------------------
    fn pause(&self) -> Result<CallResponse\> {
        self.only\_owner()?;
        Self::write\_u8(K\_PAUSED, 1);
        self.reply(vec!\[1\])
    }

    fn unpause(&self) -> Result<CallResponse\> {
        self.only\_owner()?;
        Self::write\_u8(K\_PAUSED, 0);
        self.reply(vec!\[0\])
    }

    fn is\_paused(&self) -> Result<CallResponse\> {
        self.reply(vec!\[Self::read\_u8(K\_PAUSED)\])
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcodes 53, 54: config setters(operator-gated)
    "cm"\>// -------------------------------------------------------------------------
    fn set\_max\_staleness(&self, blocks: u128) -> Result<CallResponse\> {
        self.only\_owner()?;
        if blocks > u64::MAX as u128 {
            return Err(anyhow!("blocks too large"));
        }
        Self::write\_u64(K\_MAX\_STALE, blocks as u64);
        self.reply((blocks as u64).to\_le\_bytes().to\_vec())
    }

    fn set\_decimals(&self, decimals: u128) -> Result<CallResponse\> {
        self.only\_owner()?;
        let d = Self::validate\_decimals(decimals)?;
        Self::write\_u8(K\_DECIMALS, d);
        self.reply(vec!\[d\])
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Reads
    "cm"\>// -------------------------------------------------------------------------
    fn latest\_answer(&self) -> Result<CallResponse\> {
        let r = Self::read\_u128(K\_LATEST\_ROUND);
        if r == 0 { return Err(anyhow!("no data yet")); }
        let (price, \_, \_, \_) = Self::load\_round(r)?;
        self.reply(price.to\_le\_bytes().to\_vec())
    }

    fn latest\_round(&self) -> Result<CallResponse\> {
        self.reply(Self::read\_u128(K\_LATEST\_ROUND).to\_le\_bytes().to\_vec())
    }

    fn latest\_round\_data(&self) -> Result<CallResponse\> {
        let r = Self::read\_u128(K\_LATEST\_ROUND);
        if r == 0 { return Err(anyhow!("no data yet")); }
        let (price, decimals, block, ts) = Self::load\_round(r)?;
        self.reply(Self::encode\_response(r, price, decimals, block, ts))
    }

    fn decimals(&self) -> Result<CallResponse\> {
        self.reply(vec!\[Self::read\_u8(K\_DECIMALS)\])
    }

    fn description(&self) -> Result<CallResponse\> {
        let bytes = StoragePointer::from\_keyword(K\_DESCRIPTION).get();
        self.reply((\*bytes).clone())
    }

    fn latest\_timestamp(&self) -> Result<CallResponse\> {
        let r = Self::read\_u128(K\_LATEST\_ROUND);
        if r == 0 { return Err(anyhow!("no data yet")); }
        let (\_, \_, \_, ts) = Self::load\_round(r)?;
        self.reply(ts.to\_le\_bytes().to\_vec())
    }

    fn latest\_block(&self) -> Result<CallResponse\> {
        let r = Self::read\_u128(K\_LATEST\_ROUND);
        if r == 0 { return Err(anyhow!("no data yet")); }
        let (\_, \_, block, \_) = Self::load\_round(r)?;
        self.reply(block.to\_le\_bytes().to\_vec())
    }

    fn get\_round\_data(&self, round\_id: u128) -> Result<CallResponse\> {
        let (price, decimals, block, ts) = Self::load\_round(round\_id)?;
        self.reply(Self::encode\_response(round\_id, price, decimals, block, ts))
    }

    fn get\_answer\_at(&self, round\_id: u128) -> Result<CallResponse\> {
        let (price, \_, \_, \_) = Self::load\_round(round\_id)?;
        self.reply(price.to\_le\_bytes().to\_vec())
    }

    fn is\_stale(&self) -> Result<CallResponse\> {
        let max = Self::read\_u64(K\_MAX\_STALE);
        let r = Self::read\_u128(K\_LATEST\_ROUND);
        "cm"\>// No data yet OR staleness disabled(max == 0) -> not stale.
        if r == 0 || max == 0 {
            return self.reply(vec!\[0\]);
        }
        let (\_, \_, block, \_) = Self::load\_round(r)?;
        let age = self.height().saturating\_sub(block);
        let stale: u8 = if age > max { 1 } else { 0 };
        self.reply(vec!\[stale\])
    }

    fn max\_staleness\_blocks(&self) -> Result<CallResponse\> {
        self.reply(Self::read\_u64(K\_MAX\_STALE).to\_le\_bytes().to\_vec())
    }

    fn total\_updates(&self) -> Result<CallResponse\> {
        self.reply(Self::read\_u128(K\_LATEST\_ROUND).to\_le\_bytes().to\_vec())
    }
}

declare\_alkane! {
    impl AlkaneResponder for PriceFeedOracle {
        type Message = PriceFeedMessage;
    }
}

\[package\]
name    = "btc-usd-price-feed"
version = "0.1.0"
edition = "2021"

\[lib\]
crate-type = \["cdylib"\]

\[dependencies\]
alkanes-runtime   = { git = "https://github.com/kungfuflex/alkanes-rs" }
alkanes-support   = { git = "https://github.com/kungfuflex/alkanes-rs" }
metashrew-support = { git = "https://github.com/sandshrewmetaprotocols/metashrew" }
anyhow = "1"

\[profile.release\]
opt-level     = "z"
lto           = true
strip         = true
codegen-units = 1

Build & deploy

\# Build
cargo build --release --target wasm32-unknown-unknown

# Output
# target/wasm32-unknown-unknown/release/btc\_usd\_price\_feed.wasm

# Deploy via Alkanes factory (block 3) -- instance at block 4.
# Then call opcode 0 once:
#   auth\_units           = 1
#   decimals             = 8  (or 2 for cents)
#   max\_staleness\_blocks = 6  (about 1 hour)
#   description          = "BTC / USD"
#
# Record the auth-token AlkaneId from the Initialize response.
# That token is your operator key -- keep it safe.

Operator auth token flow

deploy ──> initialize(auth\_units=1, ...) ──> auth-token alkane is minted │ ▼ owned by deployer │ every update tx must │ carry the auth token ───────▼ oracle.update\_price(p) │ ▼ auth token forwarded back to operator

**Holding the auth token = being the operator.** Transfer it to a multisig vault for shared operation, a timelock for governance, or burn it to make the feed permanently immutable. The auth token’s AlkaneId is emitted in the `Initialize` response — record it immediately.

Operator workflow: off-chain cron → on-chain push

┌───────────────────────────┐ every N min ┌─────────────────────────┐ │ AlkaneScan cron / API job │ ────────────► │ Build & broadcast a tx │ │ (scrapes BTC/USD price) │ │ 1. carries auth token │ └───────────────────────────┘ │ 2. invokes opcode 10 │ │ update\_price(price) │ └──────────┬──────────────┘ │ confirmed ▼ ┌─────────────────────────┐ │ Price Feed Oracle │ │ Bitcoin L1 (Alkanes) │ └──────────┬──────────────┘ │ staticcall-safe ▼ consumer contracts opcode 20 → latest\_answer

Use `decimals = 8` to match Chainlink convention, or `decimals = 2` for cent-precision (price in $0.01 units).

Add the `UsdPrice` mixin trait to your consumer contract. Replace `tx: 0` with the actual deployment index. All read opcodes are staticcall-safe — you never need to send the auth token as a consumer. Always call `fresh_price()` rather than `latest_price()` for liquidation or collateral-check logic.

use alkanes\_runtime::runtime::AlkaneResponder;
use alkanes\_support::{
    cellpack::Cellpack, id::AlkaneId, parcel::AlkaneTransferParcel, response::CallResponse,
};
use anyhow::{anyhow, Result};

"cm"\>// Replace \`tx\` with the AlkaneId emitted by your deployment transaction.
const PRICE\_FEED: AlkaneId = AlkaneId { block: 4, tx: 0 };

const OP\_LATEST\_ANSWER:     u128 = 20;
const OP\_LATEST\_ROUND\_DATA: u128 = 22;
const OP\_IS\_STALE:          u128 = 40;

pub trait UsdPrice: AlkaneResponder {
    "cm"\>// Internal helper.
    fn price\_call(&self, op: u128, extra: Vec<u128\>) -> Result<Vec<u8\>> {
        let mut inputs = vec!\[op\];
        inputs.extend(extra);
        let resp = self.staticcall(
            &Cellpack { target: PRICE\_FEED, inputs },
            &AlkaneTransferParcel::default(),
            self.fuel(),
        )?;
        Ok(resp.data)
    }

    "cm"\>// Latest price scaled by \`decimals\`. Errors if no data published yet.
    fn latest\_price(&self) -> Result<u128\> {
        let d = self.price\_call(OP\_LATEST\_ANSWER, vec!\[\])?;
        if d.len() < 16 { return Err(anyhow!("malformed reply")); }
        Ok(u128::from\_le\_bytes(d\[..16\].try\_into()?))
    }

    "cm"\>// Full round data: (round\_id, price, decimals, block, ts).
    fn latest\_full(&self) -> Result<(u128, u128, u8, u64, u64)> {
        let d = self.price\_call(OP\_LATEST\_ROUND\_DATA, vec!\[\])?;
        if d.len() < 49 { return Err(anyhow!("malformed reply")); }
        Ok((
            u128::from\_le\_bytes(d\[0..16\].try\_into()?),
            u128::from\_le\_bytes(d\[16..32\].try\_into()?),
            d\[32\],
            u64::from\_le\_bytes(d\[33..41\].try\_into()?),
            u64::from\_le\_bytes(d\[41..49\].try\_into()?),
        ))
    }

    "cm"\>// Safe price: errors if the heartbeat is overdue.
    "cm"\>// Use this for liquidations and health-factor checks.
    fn fresh\_price(&self) -> Result<u128\> {
        let d = self.price\_call(OP\_IS\_STALE, vec!\[\])?;
        if d.first().copied().unwrap\_or(0) == 1 {
            return Err(anyhow!("price feed is stale -- refusing to use"));
        }
        self.latest\_price()
    }
}

Example 1 — Lending vault liquidation

pub struct LendingVault;
impl AlkaneResponder for LendingVault {}
impl UsdPrice for LendingVault {}

impl LendingVault {
    "cm"\>// Liquidate if collateral\_btc \* btc\_price < debt\_usd \* 1.5 (150 % threshold).
    fn liquidate(&self, collateral\_sats: u128, debt\_usd\_cents: u128) -> Result<CallResponse\> {
        let (\_, price, decimals, \_, \_) = self.latest\_full()?;

        "cm"\>// Re-scale price to cents(10^2) from its native decimals.
        let scale = 10u128.pow(decimals as u32);
        let price\_cents = price.checked\_mul(100).ok\_or\_else(|| anyhow!("overflow"))? / scale;

        "cm"\>// collateral in USD cents = sats \* price\_per\_btc\_in\_cents / 1e8
        let collateral\_cents = collateral\_sats
            .checked\_mul(price\_cents).ok\_or\_else(|| anyhow!("overflow"))?
            / 100\_000\_000\_u128;

        "cm"\>// 150 % liquidation threshold.
        let threshold = debt\_usd\_cents.checked\_mul(150).ok\_or\_else(|| anyhow!("overflow"))? / 100;
        if collateral\_cents >= threshold {
            return Err(anyhow!("loan is healthy, cannot liquidate"));
        }

        "cm"\>// ...seize collateral, repay debt, emit event...
        Ok(CallResponse::forward(&self.context()?.incoming\_alkanes))
    }
}

Example 2 — Fee escalator (mint fee scales with BTC price)

pub struct TokenMinter;
impl AlkaneResponder for TokenMinter {}
impl UsdPrice for TokenMinter {}

impl TokenMinter {
    "cm"\>// Base fee in sats = $5 / BTC\_price \* 1e8.
    "cm"\>// If the feed is stale, fall back to a hard-coded safe fee.
    fn mint\_fee\_sats(&self) -> u128 {
        const FALLBACK\_FEE\_SATS: u128 = 10\_000; "cm"\>// ~$5 at $50k BTC
        const TARGET\_USD\_CENTS:  u128 = 500;     "cm"\>// $5.00

        match self.latest\_full() {
            Err(\_) => FALLBACK\_FEE\_SATS,
            Ok((\_, price, decimals, \_, \_)) => {
                if price == 0 { return FALLBACK\_FEE\_SATS; }
                let scale = 10u128.pow(decimals as u32);
                let price\_cents = price.saturating\_mul(100) / scale;
                if price\_cents == 0 { return FALLBACK\_FEE\_SATS; }
                "cm"\>// fee\_sats = (target\_cents / price\_per\_btc\_cents) \* 1e8
                TARGET\_USD\_CENTS
                    .saturating\_mul(100\_000\_000)
                    / price\_cents
            }
        }
    }
}

**Always check staleness for high-stakes reads.** Call `fresh_price()` (which wraps `is_stale` + `latest_answer`) rather than `latest_price()` directly in any liquidation or collateral-check path. If the feed has been paused or the operator’s cron job failed, `fresh_price()` will error and your contract will refuse to act on an outdated price — preventing incorrect liquidations.

Writes — operator-gated (require auth token in incoming\_alkanes)

Op

Method

Inputs (u128 each)

Returns

Notes

`0`

initialize

auth\_units, decimals, max\_staleness\_blocks, description

mints auth token

One-time. description ≤ 64 B; decimals ≤ 18.

`10`

update\_price

\[price\]

16 B LE u128 (new round\_id)

Stores a round at current block & time.

`50`

pause

—

1 B (1)

Blocks future update\_price calls.

`51`

unpause

—

1 B (0)

Re-enables update\_price.

`53`

set\_max\_staleness

\[blocks\]

8 B LE u64

0 = disable staleness check.

`54`

set\_decimals

\[decimals\]

1 B u8

Affects future rounds only.

Reads — staticcall-safe (no auth token needed)

Op

Method

Inputs

Returns

Notes

`20` sc

latest\_answer

—

16 B LE u128

Current price. Errors if no data.

`21` sc

latest\_round

—

16 B LE u128

Highest round id. 0 = no data.

`22` sc

latest\_round\_data

—

49 B

round\_id‖price‖decimals‖block‖ts. Errors if no data.

`23` sc

decimals

—

1 B u8

Current scaling factor.

`24` sc

description

—

≤ 64 B UTF-8

Feed label, e.g. BTC / USD.

`25` sc

latest\_timestamp

—

8 B LE u64

Block time of last update. Errors if no data.

`26` sc

latest\_block

—

8 B LE u64

Block height of last update. Errors if no data.

`30` sc

get\_round\_data

\[round\_id\]

49 B

Historical round. Same layout as op 22.

`31` sc

get\_answer\_at

\[round\_id\]

16 B LE u128

Just the historical price.

`40` sc

is\_stale

—

1 B (0|1)

height − latest\_block > max\_staleness.

`41` sc

max\_staleness\_blocks

—

8 B LE u64

Configured heartbeat threshold.

`52` sc

is\_paused

—

1 B (0|1)

Pause state.

`99` sc

total\_updates

—

16 B LE u128

Same as latest\_round.

sc = staticcall-safe. All inputs are `u128` LE in `Cellpack.inputs`. All output is LE in `CallResponse.data`.

latest\_round\_data & get\_round\_data response layout (49 bytes)

Offset

Size

Type

Field

0

16 B

u128 LE

round\_id

16

16 B

u128 LE

price

32

1 B

u8

decimals (captured at update time)

33

8 B

u64 LE

updated\_at\_block

41

8 B

u64 LE

updated\_at\_timestamp (block.time, unix seconds)

✓  Auth pattern is the standard Alkanes one

Uses the well-tested `AuthenticatedResponder` trait from `alkanes-rs` (same as `alkanes-std-owned-token`) rather than a hand-rolled owner check.

✓  All reads are staticcall-safe

Opcodes 20–26, 30, 31, 40, 41, 52, 99 never write storage. Consumers can call via `staticcall` guaranteeing the oracle cannot touch their state.

✓  Per-round decimals

Each stored round captures the decimals in effect at update time. `set_decimals` never retroactively rewrites historical rounds — re-reading old rounds always returns the correct scale.

✓  Heartbeat / staleness guard

`is_stale` compares `current_height − latest_block` against a configurable threshold. `max_staleness_blocks = 0` is an explicit opt-out for low-volatility feeds.

✓  Bounds-checked everywhere

`decimals` capped at 18, `description` capped at 64 bytes, `max_staleness_blocks` validated as `u64`, `round_id = 0` rejected.

✓  Domain-separated storage keys

`/round/{N}`, `/latest_round`, `/decimals`, `/description`, `/max_staleness`, `/paused`, `/initialized`. No collisions.

✓  Pause is non-destructive

Pausing only blocks `update_price`. Reads keep working, so consumers can detect the freeze via `is_stale` / `is_paused` and degrade gracefully.

✓  Incoming alkanes always forwarded

Writes return the operator’s auth token; reads return any (usually empty) parcel the caller attached. The contract never silently keeps caller alkanes.

✓  No external contract dependencies

Cannot be bricked by a third-party upgrade.

✓  No re-entrancy surface

Write opcodes only call host functions (`block_header`, `height`) and own storage. No `call` or `delegatecall` to user-supplied targets.

⚠  Single trusted operator

Whoever holds the auth token can push _any_ value, including 0 or u128::MAX. Mitigations: transfer the token to a multisig contract; monitor the on-chain feed vs DEX prices off-chain; layer a TWAP oracle on top for liquidations.

⚠  Lost auth token = immutable feed

Burning the key or sending it to an unspendable address freezes updates permanently. The feed will keep returning its last price (and eventually trigger `is_stale` for consumers who configured a heartbeat).

⚠  Operator can front-run consumers

A malicious operator can observe pending swap or liquidation transactions in the mempool and push a price that benefits a sandwich attack. Same risk class as Chainlink’s "evil oracle" scenario.

⚠  Pause griefing

A compromised operator can pause indefinitely. There is no time-bounded recovery mechanism. Consumers should treat a stale or paused feed as a liveness failure and refuse to liquidate or mint.

⚠  No price bounds on operator input

The contract accepts any non-negative `u128` price. Consumer contracts should validate the returned price against off-chain sanity bounds before using it for liquidations.

⚠  set\_decimals mid-life is risky

Consumers that hard-code `decimals = 8` and only read `latest_answer` will mis-scale prices after a `set_decimals` call. Always re-read `decimals` or use `latest_round_data` (which bundles both).

⚠  Round storage grows linearly

No pruning. At 1 update per 5 minutes: ~105k rounds/year × 33 bytes ≈ 3.5 MB/year. Acceptable for most feeds; plan storage costs for high-frequency updates.

⚠  Bitcoin block timestamps are imprecise

`updated_at_timestamp` is from `block.time`, which may be ±2 hours from wall-clock per consensus rules. Use block-height staleness (`is_stale`) rather than timestamp comparisons for liveness checks.

⚠  latest\_\* reads error before first update

Opcodes 20, 22, 25, 26 return errors when `latest_round = 0`. Consumers must handle the "no data yet" case explicitly, especially at contract initialization.

ⓘ  The auth token is a normal alkane

It appears in balance queries and can be traded. Treat it exactly like a multisig key. Consider holding it in a cold contract rather than a hot wallet.

Storage layout

Key

Type

Set by

Read by

`/initialized`

u8

`observe_initialization`

—

`/decimals`

u8

`initialize`, `set_decimals`

`decimals`, `update_price`

`/description`

bytes (≤64)

`initialize`

`description`

`/max_staleness`

u64 LE

`initialize`, `set_max_staleness`

`max_staleness_blocks`, `is_stale`

`/paused`

u8

`pause`, `unpause`

`is_paused`, `update_price` guard

`/latest_round`

u128 LE

`update_price`

all `latest_*`, `is_stale`

`/round/{N}`

33 B record

`update_price`

`get_round_data`, `get_answer_at`, all `latest_*`