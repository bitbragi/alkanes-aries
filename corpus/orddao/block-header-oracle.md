---
title: Block Header / Time Oracle
source: orddao
source_url: https://raw.githubusercontent.com/orddao/Block-Header-Oracle/main/README.md
---

# Block Header / Time Oracle

A pure on-chain Bitcoin block & time data oracle implemented as a native Alkanes smart contract.

Exposes the current block's height, timestamp, hash, full header, the halving schedule, and time/height predicates to other Alkanes contracts. Historical block headers can be cached on demand via `snapshot()` and read back later.

- **File:** `block_header_oracle.txt` (rename to `src/lib.rs` in your project)
- **Language:** Rust 2021, compiled to `wasm32-unknown-unknown`
- **Runtime:** Alkanes metaprotocol on Bitcoin L1
- **Trust model:** **Fully trustless** — no operator, no off-chain service, no admin keys
- **Estimated size:** ~14 KB optimized WASM

---

## Why this oracle exists

The Alkanes runtime already exposes raw block data to contracts through `AlkaneResponder::block_header()`, `height()`, etc. — but every contract has to reimplement the derived logic itself (halving math, time predicates, historical caching). This oracle:

1. **Standardizes the interface.** One well-known `AlkaneId` that any contract can call.
2. **Adds derived helpers** the runtime doesn't expose directly:
   - `current_subsidy_sats` (block reward including halving math)
   - `next_halving_height`, `blocks_until_halving`
   - `is_after_timestamp`, `is_after_height` (cheap predicates for vesting / time-locks)
3. **Caches historical headers** so contracts can do `time_elapsed(block_a, block_b)` without each contract maintaining its own snapshot table.

---

## Opcode interface

| Opcode | Method                | Inputs (u128 each)        | Returns               | Notes |
|--------|-----------------------|---------------------------|-----------------------|-------|
| 0      | `initialize`          | —                         | —                     | One-time init guard |
| 10     | `current_height`      | —                         | 8 bytes LE (u64)      | Bitcoin block height |
| 11     | `current_timestamp`   | —                         | 8 bytes LE (u64)      | Block time in unix seconds |
| 12     | `current_block_hash`  | —                         | 32 bytes              | SHA256d block hash |
| 13     | `current_header`      | —                         | 80 bytes              | Serialized header (consensus encoding) |
| 20     | `current_subsidy_sats`| —                         | 8 bytes LE (u64)      | Block subsidy in satoshis |
| 21     | `subsidy_at_height`   | `[height]`                | 8 bytes LE (u64)      | Subsidy at the given height |
| 22     | `next_halving_height` | —                         | 8 bytes LE (u64)      | Height of the next halving |
| 23     | `blocks_until_halving`| —                         | 8 bytes LE (u64)      | Blocks remaining until next halving |
| 30     | `is_after_timestamp`  | `[ts]`                    | 1 byte (0\|1)         | `block.time >= ts` |
| 31     | `is_after_height`     | `[h]`                     | 1 byte (0\|1)         | `height() >= h` |
| 40     | `snapshot`            | —                         | 8 bytes LE (u64)      | Cache current header. Idempotent. |
| 41     | `get_header_at`       | `[height]`                | 80 bytes              | Cached header (errors if not snapshotted) |
| 42     | `get_timestamp_at`    | `[height]`                | 8 bytes LE (u64)      | Cached timestamp |
| 43     | `time_elapsed`        | `[from, to]`              | 8 bytes LE (i64)      | Seconds between two snapshotted heights |
| 99     | `snapshot_count`      | —                         | 16 bytes LE (u128)    | Total snapshots stored (read-only) |

All output is little-endian byte order in `CallResponse.data`.

---

## Building

`Cargo.toml`:

```toml
[package]
name    = "block-header-oracle"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
alkanes-runtime   = { git = "https://github.com/kungfuflex/alkanes-rs" }
alkanes-support   = { git = "https://github.com/kungfuflex/alkanes-rs" }
metashrew-support = { git = "https://github.com/sandshrewmetaprotocols/metashrew" }
bitcoin = { version = "0.32", default-features = false }
anyhow  = "1"

[profile.release]
opt-level     = "z"
lto           = true
strip         = true
codegen-units = 1
```

Build:

```bash
cargo build --release --target wasm32-unknown-unknown
```

The output WASM is at `target/wasm32-unknown-unknown/release/block_header_oracle.wasm`. Deploy through your usual Alkanes deployment flow (factory at block 3, instance lands at block 4).

---

## Calling from a consumer contract

```rust
use alkanes_runtime::runtime::AlkaneResponder;
use alkanes_support::{
    cellpack::Cellpack,
    id::AlkaneId,
    parcel::AlkaneTransferParcel,
    response::CallResponse,
};
use anyhow::{anyhow, Result};

/// Replace `tx` with the AlkaneId emitted by the deployment transaction.
const CLOCK: AlkaneId = AlkaneId { block: 4, tx: 0 };

const OP_CURRENT_TIMESTAMP:  u128 = 11;
const OP_IS_AFTER_TIMESTAMP: u128 = 30;
const OP_CURRENT_SUBSIDY:    u128 = 20;

/// Mixin trait — add to your own AlkaneResponder impl.
pub trait Clock: AlkaneResponder {
    /// Current Bitcoin block time in unix seconds.
    fn now(&self) -> Result<u64> {
        let cellpack = Cellpack {
            target: CLOCK,
            inputs: vec![OP_CURRENT_TIMESTAMP],
        };
        let resp = self.staticcall(
            &cellpack,
            &AlkaneTransferParcel::default(),
            self.fuel(),
        )?;
        if resp.data.len() < 8 {
            return Err(anyhow!("bad reply"));
        }
        let mut b = [0u8; 8];
        b.copy_from_slice(&resp.data[..8]);
        Ok(u64::from_le_bytes(b))
    }

    /// True if current block time is >= `unlock_unix_seconds`.
    fn is_unlocked(&self, unlock_unix_seconds: u128) -> Result<bool> {
        let cellpack = Cellpack {
            target: CLOCK,
            inputs: vec![OP_IS_AFTER_TIMESTAMP, unlock_unix_seconds],
        };
        let resp = self.staticcall(
            &cellpack,
            &AlkaneTransferParcel::default(),
            self.fuel(),
        )?;
        Ok(resp.data.first().copied().unwrap_or(0) == 1)
    }
}

/// Example: a time-locked vesting contract.
pub struct Vesting;
impl AlkaneResponder for Vesting {}
impl Clock for Vesting {}

impl Vesting {
    pub fn claim(&self, unlock_at: u128) -> Result<CallResponse> {
        if !self.is_unlocked(unlock_at)? {
            return Err(anyhow!("vesting period not over"));
        }
        let ctx = self.context()?;
        // ...transfer the vested alkanes here...
        Ok(CallResponse::forward(&ctx.incoming_alkanes))
    }
}
```

> **Always use `staticcall`** (not `call`) for reads. The oracle only writes state for opcodes 40 (`snapshot`) and 99's counter. Pure reads are safe via staticcall and protect your contract's storage from being touched by the oracle.

---

## Use cases

- **Vesting / time-locks** — release tokens after a specific Bitcoin block time
- **Halving-aware reward schedules** — DeFi protocols whose emissions track Bitcoin's halving
- **Auction deadlines** — close bidding after block `N` or after timestamp `T`
- **Streaming payments** — pay per second using `time_elapsed(checkpoint, current)`
- **Block-based randomness commit/reveal windows** — pair with the Random Number Oracle for two-phase randomness

---

## Security audit

### Strengths

| | Property |
|---|---|
| OK | **Pure on-chain, no operator.** Every opcode reads either the runtime-provided block data or the contract's own storage. No off-chain service can be compromised. |
| OK | **All read opcodes are staticcall-safe.** Opcodes 10–13, 20–23, 30–31, 41–43, 99 never mutate state. |
| OK | **Idempotent snapshots.** Calling `snapshot()` twice in the same block is a no-op and does not double-count. |
| OK | **Subsidy math is overflow-safe.** Saturates to 0 after 64 halvings (~year 2140); no panicking right-shift. |
| OK | **Height bounds-checked.** All `u128 -> u64` casts validate the input range and error cleanly. |
| OK | **Domain-separated storage keys.** `/header/{N}` for snapshots, `/snapshots` for the counter, `/initialized` reserved for the init guard. No collisions. |
| OK | **`time_elapsed` uses `i64` + `saturating_sub`.** Bitcoin block timestamps are not strictly monotonic per consensus rules — the contract handles negative deltas without panicking. |
| OK | **No external dependencies on other contracts.** Cannot be bricked by a third party. |

### Trade-offs and warnings

| | Property |
|---|---|
| WARN | **Block timestamps may be ±2 hours from wall-clock time.** Bitcoin consensus only requires `block.time > median of last 11 blocks` and `block.time < network-adjusted-time + 2h`. Don't use this oracle for sub-hour time-sensitive logic. |
| WARN | **Block timestamps may run backwards.** Two consecutive blocks can have decreasing timestamps. `time_elapsed` returns `i64` to surface this. |
| WARN | **Historical reads require snapshots.** `get_header_at(N)` errors unless `snapshot()` was called in block `N`. There's no way to retrieve a historical header that was never snapshotted. |
| WARN | **Storage grows linearly with snapshots.** Each `snapshot()` consumes ~80 bytes + key overhead. There's no pruning mechanism — by design, since callers may need historical data indefinitely. Consider whether a soft cap is needed for your use case. |
| WARN | **Miner timestamp manipulation.** A miner can shift the next block's timestamp within the consensus window. For high-value timing logic, use block height instead of timestamp. |
| INFO | **Subsidy formula uses the spec's `>>` halving.** Matches the reference implementation in `core/src/validation.cpp` — including the rounding behaviour where `INITIAL_SUBSIDY >> halvings` truncates toward zero. |

### Storage layout

| Key | Type | Set by | Read by |
|---|---|---|---|
| `/initialized`   | `u8`         | `observe_initialization` | — |
| `/header/{N}`    | 80-byte header | `snapshot`             | `get_header_at`, `get_timestamp_at`, `time_elapsed` |
| `/snapshots`     | `u128 LE`    | `bump_snapshot_count`    | `snapshot_count` |

### Out of scope (intentionally not included)

- **Re-org handling.** If a Bitcoin re-org changes block `N`, any snapshot of the old block becomes stale. Mitigation: callers should only trust snapshots that are ≥ 6 confirmations deep.
- **Cross-chain headers.** This oracle only knows about the Bitcoin chain it's deployed on.
- **Difficulty / target arithmetic.** Exposed via raw `current_header` if needed, but no helpers because Alkanes contracts rarely need to validate PoW themselves.

---

## License

Provided as-is for use on the Alkanes metaprotocol. Audit before deploying to mainnet with real value at stake.