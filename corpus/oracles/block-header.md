---
title: Block Header Oracle
source: oracles
source_url: https://alkanescan.org/oracle-block-header.php
---

[Oracles](oracles.php) › Block Header Oracle

⏰

# Block Header Oracle

Alkanes smart contract · pure on-chain Bitcoin time & block data

Exposes the current Bitcoin block’s **height**, **timestamp**, **hash**, and **full header** to any Alkanes consumer contract — along with the **halving schedule**, **time predicates** (useful for vesting & time-locks), and optional **historical snapshots**. Fully trustless: no operator, no off-chain service, no admin keys. Built on top of the block-data host functions already present in the Alkanes WASM runtime.

Vesting / time-locks Halving-aware rewards Auction deadlines Streaming payments Commit-reveal windows

"cm"\>// =============================================================================
"cm"\>// AlkaneScan · Block Header / Time Oracle
"cm"\>//
"cm"\>// A pure on-chain Bitcoin block & time data oracle implemented as a native
"cm"\>// Alkanes smart contract(Rust -> WASM, deployed on Bitcoin L1).
"cm"\>//
"cm"\>// Exposes the current block&#039;s height, timestamp, hash, full header, the
"cm"\>// halving schedule, and time/height predicates to other Alkanes contracts.
"cm"\>// Historical block headers can be cached on demand via the snapshot()
"cm"\>// opcode and read back later.
"cm"\>//
"cm"\>// Source file: src/lib.rs
"cm"\>// Crate type:  cdylib
"cm"\>// Edition:     2021
"cm"\>// =============================================================================

use alkanes\_runtime::{
    declare\_alkane,
    message::MessageDispatch,
    runtime::AlkaneResponder,
    storage::StoragePointer,
};
use alkanes\_support::{context::Context, response::CallResponse};
use anyhow::{anyhow, Result};
use bitcoin::{
    block::Header,
    consensus::encode::{deserialize, serialize},
};
use metashrew\_support::index\_pointer::KeyValuePointer;
use std::sync::Arc;

"cm"\>// -----------------------------------------------------------------------------
"cm"\>// Constants — Bitcoin consensus parameters
"cm"\>// -----------------------------------------------------------------------------

"cm"\>/// Number of blocks between halvings(every 210\_000 blocks, ~4 years).
const HALVING\_INTERVAL: u64 = 210\_000;

"cm"\>/// Initial block subsidy in satoshis(50 BTC at genesis).
const INITIAL\_SUBSIDY: u64 = 50 \* 100\_000\_000;

"cm"\>/// Maximum halvings before subsidy saturates to 0 (post-2140 AD).
const MAX\_HALVINGS: u64 = 64;

"cm"\>// -----------------------------------------------------------------------------
"cm"\>// Contract definition
"cm"\>// -----------------------------------------------------------------------------

#\[derive(Default)\]
pub struct BlockHeaderOracle(());

impl AlkaneResponder for BlockHeaderOracle {}

#\[derive(MessageDispatch)\]
enum BlockHeaderOracleMessage {
    "cm"\>/// One-time initialiser. Must be called once after deployment.
    #\[opcode(0)\]
    Initialize,

    "cm"\>// ---- Current block data(pure) ----
    #\[opcode(10)\] #\[returns(Vec<u8\>)\] CurrentHeight,
    #\[opcode(11)\] #\[returns(Vec<u8\>)\] CurrentTimestamp,
    #\[opcode(12)\] #\[returns(Vec<u8\>)\] CurrentBlockHash,
    #\[opcode(13)\] #\[returns(Vec<u8\>)\] CurrentHeader,

    "cm"\>// ---- Subsidy & halving(pure) ----
    #\[opcode(20)\] #\[returns(Vec<u8\>)\] CurrentSubsidySats,
    #\[opcode(21)\] #\[returns(Vec<u8\>)\] SubsidyAtHeight { height: u128 },
    #\[opcode(22)\] #\[returns(Vec<u8\>)\] NextHalvingHeight,
    #\[opcode(23)\] #\[returns(Vec<u8\>)\] BlocksUntilHalving,

    "cm"\>// ---- Time / height predicates(pure) ----
    #\[opcode(30)\] #\[returns(Vec<u8\>)\] IsAfterTimestamp { timestamp: u128 },
    #\[opcode(31)\] #\[returns(Vec<u8\>)\] IsAfterHeight    { height: u128 },

    "cm"\>// ---- Historical snapshots ----
    #\[opcode(40)\] #\[returns(Vec<u8\>)\] Snapshot,
    #\[opcode(41)\] #\[returns(Vec<u8\>)\] GetHeaderAt     { height: u128 },
    #\[opcode(42)\] #\[returns(Vec<u8\>)\] GetTimestampAt  { height: u128 },
    #\[opcode(43)\] #\[returns(Vec<u8\>)\] TimeElapsed     { from: u128, to: u128 },

    "cm"\>// ---- Stats ----
    #\[opcode(99)\] #\[returns(Vec<u8\>)\] SnapshotCount,
}

impl BlockHeaderOracle {
    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Helpers
    "cm"\>// -------------------------------------------------------------------------

    "cm"\>/// Bitcoin block subsidy in satoshis at the given height.
    "cm"\>/// Saturates to 0 after MAX\_HALVINGS, never panics on shift overflow.
    fn subsidy\_at(h: u64) -> u64 {
        let halvings = h / HALVING\_INTERVAL;
        if halvings >= MAX\_HALVINGS {
            0
        } else {
            INITIAL\_SUBSIDY >> halvings
        }
    }

    "cm"\>/// Load a previously-snapshotted header from storage.
    fn read\_header(&self, height: u64) -> Result<Header\> {
        let key = format!("/header/{}", height);
        let bytes = StoragePointer::from\_keyword(&key).get();
        if bytes.len() == 0 {
            return Err(anyhow!(
                "no snapshot at height {} -- call snapshot() in that block first",
                height
            ));
        }
        Ok(deserialize(&bytes)?)
    }

    "cm"\>/// Atomically +1 the snapshot counter.
    fn bump\_snapshot\_count(&self) {
        let mut ptr = StoragePointer::from\_keyword("/snapshots");
        let prev = ptr.get();
        let n = if prev.len() >= 16 {
            u128::from\_le\_bytes(prev\[..16\].try\_into().unwrap())
        } else {
            0
        };
        ptr.set(Arc::new(n.saturating\_add(1).to\_le\_bytes().to\_vec()));
    }

    "cm"\>/// Build a reply that forwards any incoming alkanes back to the caller
    "cm"\>/// and carries the given bytes as the return value.
    fn reply(&self, bytes: Vec<u8\>) -> Result<CallResponse\> {
        let mut r = CallResponse::forward(&self.context()?.incoming\_alkanes);
        r.data = bytes;
        Ok(r)
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcode 0: initialize
    "cm"\>// -------------------------------------------------------------------------
    fn initialize(&self) -> Result<CallResponse\> {
        self.observe\_initialization()?;
        Ok(CallResponse::forward(&self.context()?.incoming\_alkanes))
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcodes 10..13: current block data
    "cm"\>// -------------------------------------------------------------------------
    fn current\_height(&self) -> Result<CallResponse\> {
        self.reply(self.height().to\_le\_bytes().to\_vec())
    }

    fn current\_timestamp(&self) -> Result<CallResponse\> {
        let t = self.block\_header()?.time as u64;
        self.reply(t.to\_le\_bytes().to\_vec())
    }

    fn current\_block\_hash(&self) -> Result<CallResponse\> {
        let h = self.block\_header()?.block\_hash();
        self.reply(h.as\_ref().to\_vec())
    }

    fn current\_header(&self) -> Result<CallResponse\> {
        self.reply(serialize(&self.block\_header()?))
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcodes 20..23: subsidy & halving
    "cm"\>// -------------------------------------------------------------------------
    fn current\_subsidy\_sats(&self) -> Result<CallResponse\> {
        let s = Self::subsidy\_at(self.height());
        self.reply(s.to\_le\_bytes().to\_vec())
    }

    fn subsidy\_at\_height(&self, height: u128) -> Result<CallResponse\> {
        if height > u64::MAX as u128 {
            return Err(anyhow!("height out of range"));
        }
        let s = Self::subsidy\_at(height as u64);
        self.reply(s.to\_le\_bytes().to\_vec())
    }

    fn next\_halving\_height(&self) -> Result<CallResponse\> {
        let h = self.height();
        let next = ((h / HALVING\_INTERVAL) + 1).saturating\_mul(HALVING\_INTERVAL);
        self.reply(next.to\_le\_bytes().to\_vec())
    }

    fn blocks\_until\_halving(&self) -> Result<CallResponse\> {
        let h = self.height();
        let next = ((h / HALVING\_INTERVAL) + 1).saturating\_mul(HALVING\_INTERVAL);
        self.reply(next.saturating\_sub(h).to\_le\_bytes().to\_vec())
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcodes 30..31: predicates
    "cm"\>// -------------------------------------------------------------------------
    fn is\_after\_timestamp(&self, timestamp: u128) -> Result<CallResponse\> {
        let ok: u8 = if (self.block\_header()?.time as u128) >= timestamp { 1 } else { 0 };
        self.reply(vec!\[ok\])
    }

    fn is\_after\_height(&self, height: u128) -> Result<CallResponse\> {
        let ok: u8 = if (self.height() as u128) >= height { 1 } else { 0 };
        self.reply(vec!\[ok\])
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcodes 40..43: historical snapshots
    "cm"\>// -------------------------------------------------------------------------

    "cm"\>/// Cache the current block header in storage.
    "cm"\>/// Idempotent — calling twice in the same block is a no-op.
    "cm"\>/// Returns the height that was snapshotted(8 bytes LE u64).
    fn snapshot(&self) -> Result<CallResponse\> {
        let h = self.height();
        let key = format!("/header/{}", h);
        let mut ptr = StoragePointer::from\_keyword(&key);

        if ptr.get().len() == 0 {
            ptr.set(Arc::new(serialize(&self.block\_header()?)));
            self.bump\_snapshot\_count();
        }
        self.reply(h.to\_le\_bytes().to\_vec())
    }

    fn get\_header\_at(&self, height: u128) -> Result<CallResponse\> {
        if height > u64::MAX as u128 {
            return Err(anyhow!("height out of range"));
        }
        let header = self.read\_header(height as u64)?;
        self.reply(serialize(&header))
    }

    fn get\_timestamp\_at(&self, height: u128) -> Result<CallResponse\> {
        if height > u64::MAX as u128 {
            return Err(anyhow!("height out of range"));
        }
        let t = self.read\_header(height as u64)?.time as u64;
        self.reply(t.to\_le\_bytes().to\_vec())
    }

    fn time\_elapsed(&self, from: u128, to: u128) -> Result<CallResponse\> {
        if from > u64::MAX as u128 || to > u64::MAX as u128 {
            return Err(anyhow!("height out of range"));
        }
        "cm"\>// i64 since Bitcoin block timestamps are NOT strictly monotonic per
        "cm"\>// consensus rules(next block must be >  median of last 11, but may
        "cm"\>// be lower than its parent). saturating\_sub avoids overflow.
        let a = self.read\_header(from as u64)?.time as i64;
        let b = self.read\_header(to as u64)?.time as i64;
        self.reply(b.saturating\_sub(a).to\_le\_bytes().to\_vec())
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcode 99: stats
    "cm"\>// -------------------------------------------------------------------------
    fn snapshot\_count(&self) -> Result<CallResponse\> {
        let bytes = StoragePointer::from\_keyword("/snapshots").get();
        let n = if bytes.len() >= 16 {
            u128::from\_le\_bytes(bytes\[..16\].try\_into().unwrap())
        } else {
            0
        };
        self.reply(n.to\_le\_bytes().to\_vec())
    }
}

declare\_alkane! {
    impl AlkaneResponder for BlockHeaderOracle {
        type Message = BlockHeaderOracleMessage;
    }
}

\[package\]
name    = "block-header-oracle"
version = "0.1.0"
edition = "2021"

\[lib\]
crate-type = \["cdylib"\]

\[dependencies\]
alkanes-runtime   = { git = "https://github.com/kungfuflex/alkanes-rs" }
alkanes-support   = { git = "https://github.com/kungfuflex/alkanes-rs" }
metashrew-support = { git = "https://github.com/sandshrewmetaprotocols/metashrew" }
bitcoin = { version = "0.32", default-features = false }
anyhow  = "1"

\[profile.release\]
opt-level     = "z"
lto           = true
strip         = true
codegen-units = 1

Build & deploy

\# Build
cargo build --release --target wasm32-unknown-unknown

# Output
# target/wasm32-unknown-unknown/release/block\_header\_oracle.wasm

# Deploy via Alkanes factory (block 3) -- instance lands at block 4
# Run opcode 0 (Initialize) once after deployment

Add the `Clock` mixin trait to your consumer contract. Replace `tx: 0` in `CLOCK` with the actual `tx` index from your deployment transaction. Always call via `staticcall` — oracle read opcodes never mutate state.

use alkanes\_runtime::runtime::AlkaneResponder;
use alkanes\_support::{
    cellpack::Cellpack,
    id::AlkaneId,
    parcel::AlkaneTransferParcel,
    response::CallResponse,
};
use anyhow::{anyhow, Result};

"cm"\>// Replace \`tx\` with the AlkaneId emitted by the deployment transaction.
"cm"\>// Instances are deployed at block 4 by the Alkanes factory.
const CLOCK: AlkaneId = AlkaneId { block: 4, tx: 0 };

const OP\_CURRENT\_HEIGHT:     u128 = 10;
const OP\_CURRENT\_TIMESTAMP:  u128 = 11;
const OP\_IS\_AFTER\_TIMESTAMP: u128 = 30;
const OP\_IS\_AFTER\_HEIGHT:    u128 = 31;
const OP\_NEXT\_HALVING:       u128 = 22;
const OP\_BLOCKS\_UNTIL\_HALV:  u128 = 23;
const OP\_SNAPSHOT:           u128 = 40;
const OP\_TIME\_ELAPSED:       u128 = 43;

"cm"\>// Mixin trait -- add to your own AlkaneResponder impl.
pub trait Clock: AlkaneResponder {
    fn static\_call(&self, op: u128, extra: Vec<u128\>) -> Result<Vec<u8\>> {
        let mut inputs = vec!\[op\];
        inputs.extend(extra);
        let resp = self.staticcall(
            &Cellpack { target: CLOCK, inputs },
            &AlkaneTransferParcel::default(),
            self.fuel(),
        )?;
        Ok(resp.data)
    }

    "cm"\>// Current Bitcoin block time(unix seconds).
    fn now(&self) -> Result<u64\> {
        let d = self.static\_call(OP\_CURRENT\_TIMESTAMP, vec!\[\])?;
        if d.len() < 8 { return Err(anyhow!("bad reply")); }
        Ok(u64::from\_le\_bytes(d\[..8\].try\_into()?))
    }

    "cm"\>// Current block height.
    fn block\_height(&self) -> Result<u64\> {
        let d = self.static\_call(OP\_CURRENT\_HEIGHT, vec!\[\])?;
        Ok(u64::from\_le\_bytes(d\[..8\].try\_into()?))
    }

    "cm"\>// True when block.time >= unlock\_unix\_seconds.
    fn is\_unlocked\_at(&self, ts: u128) -> Result<bool\> {
        let d = self.static\_call(OP\_IS\_AFTER\_TIMESTAMP, vec!\[ts\])?;
        Ok(d.first().copied().unwrap\_or(0) == 1)
    }

    "cm"\>// True when block height >= the given height.
    fn is\_past\_block(&self, h: u128) -> Result<bool\> {
        let d = self.static\_call(OP\_IS\_AFTER\_HEIGHT, vec!\[h\])?;
        Ok(d.first().copied().unwrap\_or(0) == 1)
    }

    "cm"\>// Blocks remaining until the next halving.
    fn blocks\_to\_halving(&self) -> Result<u64\> {
        let d = self.static\_call(OP\_BLOCKS\_UNTIL\_HALV, vec!\[\])?;
        Ok(u64::from\_le\_bytes(d\[..8\].try\_into()?))
    }

    "cm"\>// Save the current header to oracle storage so get\_timestamp\_at(h) works later.
    fn take\_snapshot(&self) -> Result<u64\> {
        let d = self.static\_call(OP\_SNAPSHOT, vec!\[\])?;
        Ok(u64::from\_le\_bytes(d\[..8\].try\_into()?))
    }

    "cm"\>// Seconds between two previously-snapshotted heights(may be negative --
    "cm"\>// Bitcoin block timestamps are not strictly monotonic).
    fn elapsed\_secs(&self, from\_height: u128, to\_height: u128) -> Result<i64\> {
        let d = self.static\_call(OP\_TIME\_ELAPSED, vec!\[from\_height, to\_height\])?;
        Ok(i64::from\_le\_bytes(d\[..8\].try\_into()?))
    }
}

"cm"\>// ---- Example: time-locked vesting contract ----

pub struct VestingVault;
impl AlkaneResponder for VestingVault {}
impl Clock for VestingVault {}

impl VestingVault {
    fn claim(&self, unlock\_at\_unix: u128) -> Result<CallResponse\> {
        if !self.is\_unlocked\_at(unlock\_at\_unix)? {
            return Err(anyhow!("vesting period not over"));
        }
        let ctx = self.context()?;
        "cm"\>// ...transfer the vested alkanes here...
        Ok(CallResponse::forward(&ctx.incoming\_alkanes))
    }
}

"cm"\>// ---- Example: halving-aware emission contract ----

pub struct EmissionContract;
impl AlkaneResponder for EmissionContract {}
impl Clock for EmissionContract {}

impl EmissionContract {
    "cm"\>// Returns a mint amount that halves alongside Bitcoin.
    fn mint\_amount(&self) -> Result<u64\> {
        let d = self.static\_call(OP\_CURRENT\_HEIGHT, vec!\[\])?;
        let height = u64::from\_le\_bytes(d\[..8\].try\_into()?);
        let halvings = height / 210\_000;
        Ok(if halvings >= 64 { 0 } else { 50\_000\_000\_u64 >> halvings })
    }
}

Opcode

Method

Inputs (u128 each)

Returns

Notes

`0`

initialize

—

—

One-time init guard.

`10`

current\_height

—

8 B LE u64

staticcall-safe Bitcoin block height.

`11`

current\_timestamp

—

8 B LE u64

staticcall-safe Block time in unix seconds.

`12`

current\_block\_hash

—

32 B

staticcall-safe SHA256d block hash.

`13`

current\_header

—

80 B

staticcall-safe Full serialized block header.

`20`

current\_subsidy\_sats

—

8 B LE u64

staticcall-safe Block subsidy at current height in satoshis.

`21`

subsidy\_at\_height

\[height\]

8 B LE u64

staticcall-safe Subsidy at any given height.

`22`

next\_halving\_height

—

8 B LE u64

staticcall-safe Height of the next halving.

`23`

blocks\_until\_halving

—

8 B LE u64

staticcall-safe Blocks remaining until next halving.

`30`

is\_after\_timestamp

\[ts\]

1 B (0|1)

staticcall-safe Returns 1 if block.time ≥ ts.

`31`

is\_after\_height

\[h\]

1 B (0|1)

staticcall-safe Returns 1 if height() ≥ h.

`40`

snapshot

—

8 B LE u64

Cache current header. Idempotent.

`41`

get\_header\_at

\[height\]

80 B

staticcall-safe Cached header (errors if not snapshotted).

`42`

get\_timestamp\_at

\[height\]

8 B LE u64

staticcall-safe Cached timestamp.

`43`

time\_elapsed

\[from, to\]

8 B LE i64

staticcall-safe Seconds between two snapshotted heights. May be negative.

`99`

snapshot\_count

—

16 B LE u128

staticcall-safe Total snapshots stored (read-only).

All inputs are passed as `u128` values in the `Cellpack.inputs` vector. All output is little-endian in `CallResponse.data`. Opcodes marked staticcall-safe never mutate storage and should always be called via `self.staticcall()`.

✓  Pure on-chain, no operator

Every opcode reads either the runtime-provided block data or the contract's own storage. No off-chain service can be compromised or shut down.

✓  All read opcodes are staticcall-safe

Opcodes 10–13, 20–23, 30–31, 41–43, and 99 never write state. Consumer contracts can call these via `staticcall` to guarantee the oracle cannot touch their storage.

✓  Idempotent snapshots

Calling `snapshot()` twice in the same block is a no-op — checked with a storage-length guard before writing. The counter is only incremented on the first snapshot per block.

✓  Overflow-safe halving math

The subsidy formula uses `INITIAL_SUBSIDY >> halvings` with a guard that saturates to 0 after 64 halvings (~year 2140). No panic from over-shifting, matches Bitcoin Core's reference implementation exactly.

✓  Height bounds-checked

All opcodes that take a `height: u128` input validate it fits in `u64` and return a clean error if not. No silent truncation.

✓  Domain-separated storage keys

`/header/{N}` for cached headers, `/snapshots` for the counter, `/initialized` for the init guard. No key collisions possible.

✓  time\_elapsed uses i64 + saturating\_sub

Bitcoin block timestamps are not strictly monotonic per consensus rules (a block's time only needs to be > median of last 11). The contract handles negative elapsed time without panicking.

✓  No external contract dependencies

Cannot be bricked by a third-party contract being upgraded or removed.

⚠  Block timestamps may be ±2 hours from wall-clock time

Bitcoin consensus only requires `block.time > median of last 11 blocks` and `block.time < network-adjusted-time + 2h`. Do not use the timestamp oracle for sub-hour precision. For high-precision timing, use **block height** instead.

⚠  Block timestamps may run backwards

Two consecutive blocks can legally have decreasing timestamps. `time_elapsed` returns `i64` to surface this. Consumer code should handle negative elapsed time gracefully.

⚠  Historical reads require prior snapshots

`get_header_at(N)` errors unless `snapshot()` was called during block `N`. There is no way to retrieve a header that was never cached. Design consumers to call `snapshot()` in the same tx as the event they want to timestamp later.

⚠  Storage grows linearly with snapshots

Each `snapshot()` consumes ~80 bytes of header + key overhead with no pruning. For long-running applications this may accumulate. Consider whether a consumer-side snapshot schedule is more appropriate than snapshotting every block.

⚠  Miner timestamp manipulation

A miner can shift the next block's timestamp within the ±2-hour consensus window. For high-value time-lock logic, use `is_after_height` instead of `is_after_timestamp`.

⚠  Re-org staleness

If a Bitcoin re-org replaces block `N`, any snapshot of the old block becomes stale. Only rely on snapshots that are at least 6 confirmations deep.

Storage layout

Key

Type

Set by

Read by

`/initialized`

u8

`observe_initialization`

—

`/header/{N}`

80-byte header

`snapshot`

`get_header_at`, `get_timestamp_at`, `time_elapsed`

`/snapshots`

u128 LE

`bump_snapshot_count`

`snapshot_count`