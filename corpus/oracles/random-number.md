---
title: Random Number Oracle
source: oracles
source_url: https://alkanescan.org/oracle.php?id=random
---

[Oracles](oracles.php) › Random Number Oracle

🎲

# Random Number Oracle

Alkanes smart contract · verifiable on-chain randomness

A Chainlink-style randomness oracle implemented as a native Alkanes contract (Rust → WASM, deployed on Bitcoin L1). Entropy is derived from `SHA256( block_hash ‖ height ‖ txid ‖ vout ‖ caller ‖ salt )`, which is reproducible by any Bitcoin node yet unpredictable before the block is mined. Consumer contracts call it via a `Cellpack` staticcall and receive the result in `CallResponse.data`.

// =============================================================================
// AlkaneScan · Random Number Oracle
//
// Verifiable on-chain randomness for the Alkanes metaprotocol.
// seed = SHA-256( "alkanescan/random/v1"
//                 || block\_hash    (32 bytes, big-endian)
//                 || height        (u64 LE)
//                 || txid          (32 bytes)
//                 || vout          (u32 LE)
//                 || caller.block  (u128 LE)
//                 || caller.tx     (u128 LE)
//                 || salt          (u128 LE) )
// =============================================================================

use alkanes\_runtime::{
    declare\_alkane,
    message::MessageDispatch,
    runtime::AlkaneResponder,
    storage::StoragePointer,
};
use alkanes\_support::{context::Context, response::CallResponse};
use anyhow::{anyhow, Result};
use metashrew\_support::index\_pointer::KeyValuePointer;
use sha2::{Digest, Sha256};
use std::sync::Arc;

#\[derive(Default)\]
pub struct RandomNumberOracle(());

impl AlkaneResponder for RandomNumberOracle {}

#\[derive(MessageDispatch)\]
enum RandomNumberOracleMessage {
    /// One-time initialiser. Must be called once after deployment.
    #\[opcode(0)\]
    Initialize,

    /// Random u64 (8 bytes LE in CallResponse.data)
    #\[opcode(10)\]
    #\[returns(Vec<u8>)\]
    RandomU64 { salt: u128 },

    /// Full 32-byte random value
    #\[opcode(11)\]
    #\[returns(Vec<u8>)\]
    RandomBytes32 { salt: u128 },

    /// Uniform random u128 in \[min, max). Rejection-sampled (no modulo bias).
    #\[opcode(12)\]
    #\[returns(Vec<u8>)\]
    RandomInRange { salt: u128, min: u128, max: u128 },

    /// Read-only: total requests served
    #\[opcode(99)\]
    #\[returns(u128)\]
    RequestCount,
}

impl RandomNumberOracle {
    /// Build a 32-byte entropy seed. Domain-separated and bound to the calling tx.
    fn seed(&self, ctx: &Context, salt: u128) -> Result<\[u8; 32\]> {
        let header     = self.block\_header()?;
        let block\_hash = header.block\_hash();
        let height     = self.height();
        let txid       = self.transaction\_id()?;

        let mut h = Sha256::new();
        h.update(b"alkanescan/random/v1");
        h.update(block\_hash.as\_ref());
        h.update(&height.to\_le\_bytes());
        h.update(txid.as\_ref());
        h.update(&ctx.vout.to\_le\_bytes());
        h.update(&ctx.caller.block.to\_le\_bytes());
        h.update(&ctx.caller.tx.to\_le\_bytes());
        h.update(&salt.to\_le\_bytes());
        Ok(h.finalize().into())
    }

    /// Atomic +1 on the all-time request counter.
    fn bump\_counter(&self) {
        let mut ptr = StoragePointer::from\_keyword("/requests");
        let bytes   = ptr.get();
        let prev    = if bytes.len() >= 16 {
            u128::from\_le\_bytes(bytes\[..16\].try\_into().unwrap())
        } else { 0 };
        ptr.set(Arc::new(prev.saturating\_add(1).to\_le\_bytes().to\_vec()));
    }

    // ----- opcode 0 -----
    fn initialize(&self) -> Result<CallResponse\> {
        self.observe\_initialization()?;
        let ctx = self.context()?;
        Ok(CallResponse::forward(&ctx.incoming\_alkanes))
    }

    // ----- opcode 10 -----
    fn random\_u64(&self, salt: u128) -> Result<CallResponse\> {
        let ctx   = self.context()?;
        let seed  = self.seed(&ctx, salt)?;
        let value = u64::from\_le\_bytes(seed\[..8\].try\_into().unwrap());
        self.bump\_counter();

        let mut r = CallResponse::forward(&ctx.incoming\_alkanes);
        r.data = value.to\_le\_bytes().to\_vec();
        Ok(r)
    }

    // ----- opcode 11 -----
    fn random\_bytes32(&self, salt: u128) -> Result<CallResponse\> {
        let ctx  = self.context()?;
        let seed = self.seed(&ctx, salt)?;
        self.bump\_counter();

        let mut r = CallResponse::forward(&ctx.incoming\_alkanes);
        r.data = seed.to\_vec();
        Ok(r)
    }

    // ----- opcode 12 -----
    fn random\_in\_range(&self, salt: u128, min: u128, max: u128) -> Result<CallResponse\> {
        if max <= min { return Err(anyhow!("max must be > min")); }
        let span  = max - min;
        let ctx   = self.context()?;

        // Rejection sampling removes modulo bias.
        let limit = u128::MAX - (u128::MAX % span);
        let mut counter = salt;
        let value = loop {
            let seed = self.seed(&ctx, counter)?;
            let raw  = u128::from\_le\_bytes(seed\[..16\].try\_into().unwrap());
            if raw < limit { break min + (raw % span); }
            counter = counter.wrapping\_add(1);
        };

        self.bump\_counter();
        let mut r = CallResponse::forward(&ctx.incoming\_alkanes);
        r.data = value.to\_le\_bytes().to\_vec();
        Ok(r)
    }

    // ----- opcode 99 -----
    fn request\_count(&self) -> Result<CallResponse\> {
        let bytes = StoragePointer::from\_keyword("/requests").get();
        let count = if bytes.len() >= 16 {
            u128::from\_le\_bytes(bytes\[..16\].try\_into().unwrap())
        } else { 0 };

        let mut r = CallResponse::forward(&self.context()?.incoming\_alkanes);
        r.data = count.to\_le\_bytes().to\_vec();
        Ok(r)
    }
}

declare\_alkane! {
    impl AlkaneResponder for RandomNumberOracle {
        type Message = RandomNumberOracleMessage;
    }
}

\# random\_number\_oracle/Cargo.toml

\[package\]
name    = "random-number-oracle"
version = "0.1.0"
edition = "2021"

\[lib\]
crate-type = \["cdylib"\]

\[dependencies\]
alkanes-runtime   = { git = "https://github.com/kungfuflex/alkanes-rs" }
alkanes-support   = { git = "https://github.com/kungfuflex/alkanes-rs" }
metashrew-support = { git = "https://github.com/sandshrewmetaprotocols/metashrew" }
anyhow = "1"
sha2   = { version = "0.10", default-features = false }

\[profile.release\]
opt-level = "z"
lto       = true
strip     = true
codegen-units = 1

Your consumer contract calls the oracle through a `Cellpack` — the inputs vector is `[opcode, ...args]`. Use `staticcall` so the oracle cannot modify your state. Replace `ORACLE_ID` with the AlkaneId returned by your deployment transaction (instances live at block `4`).

use alkanes\_runtime::runtime::AlkaneResponder;
use alkanes\_support::{
    cellpack::Cellpack,
    id::AlkaneId,
    parcel::AlkaneTransferParcel,
    response::CallResponse,
};
use anyhow::{anyhow, Result};

/// AlkaneId of the deployed Random Number Oracle.
/// Replace \`tx\` with the value emitted by your deployment.
const ORACLE\_ID: AlkaneId = AlkaneId { block: 4, tx: 0 };

const OP\_RANDOM\_U64:      u128 = 10;
const OP\_RANDOM\_IN\_RANGE: u128 = 12;

/// Mixin trait. Add to your own AlkaneResponder impl.
pub trait Randomness: AlkaneResponder {
    fn get\_random\_u64(&self, salt: u128) -> Result<u64\> {
        let cellpack = Cellpack {
            target: ORACLE\_ID,
            inputs: vec!\[OP\_RANDOM\_U64, salt\],
        };
        let resp: CallResponse = self.staticcall(
            &cellpack,
            &AlkaneTransferParcel::default(),
            self.fuel(),
        )?;
        if resp.data.len() < 8 {
            return Err(anyhow!("oracle returned malformed response"));
        }
        let mut buf = \[0u8; 8\];
        buf.copy\_from\_slice(&resp.data\[..8\]);
        Ok(u64::from\_le\_bytes(buf))
    }

    fn random\_in\_range(&self, salt: u128, min: u128, max: u128) -> Result<u128\> {
        let cellpack = Cellpack {
            target: ORACLE\_ID,
            inputs: vec!\[OP\_RANDOM\_IN\_RANGE, salt, min, max\],
        };
        let resp = self.staticcall(
            &cellpack,
            &AlkaneTransferParcel::default(),
            self.fuel(),
        )?;
        Ok(u128::from\_le\_bytes(resp.data\[..16\].try\_into()?))
    }
}

/// Example: NFT mint with a random trait score (0..100)
impl Randomness for MyNftContract {}

impl MyNftContract {
    fn mint\_with\_traits(&self, token\_id: u128) -> Result<CallResponse\> {
        let trait\_score = self.random\_in\_range(token\_id, 0, 100)?;
        // ...store trait\_score, mint the alkane, return CallResponse
        let ctx = self.context()?;
        Ok(CallResponse::forward(&ctx.incoming\_alkanes))
    }
}

Opcode

Method

Inputs (u128 each)

Returns

Description

`0`

initialize

—

—

One-time init guard. Call once after deployment.

`10`

random\_u64

\[salt\]

8 bytes LE (u64)

Random unsigned 64-bit integer.

`11`

random\_bytes32

\[salt\]

32 bytes

Full SHA-256 entropy output.

`12`

random\_in\_range

\[salt, min, max\]

16 bytes LE (u128)

Unbiased random u128 in \[min, max).

`99`

request\_count

—

16 bytes LE (u128)

Total requests served. Read-only.

✓ Idiomatic Alkanes pattern

Uses `AlkaneResponder` + `#[derive(MessageDispatch)]` + `declare_alkane!` — matches the pattern in `alkanes-std-owned-token` and other reference contracts in the `alkanes-rs` repository. No raw `__execute` entry point.

✓ Domain-separated hashing

The seed is prefixed with `"alkanescan/random/v1"` so the output can never collide with another contract that happens to hash the same Bitcoin data. The version tag also allows future revisions without breaking determinism for old callers.

✓ No modulo bias in range

`random_in_range` uses rejection sampling rather than a naive `raw % span`, which would skew the distribution when `span` does not divide `2128`.

⚠ Miner-extractable randomness (MER)

The seed depends on the Bitcoin block hash. A miner who is _also_ the caller can re-order or withhold their own transaction to bias the result — the same trade-off as Ethereum’s `blockhash()`. Acceptable for low-stakes randomness (NFT traits, fair games with bounded value). For high-value randomness use a commit-reveal scheme on top, or a multi-block beacon.

⚠ Public verifiability is also public predictability

Once the block is mined the output is computable by anyone with the salt — this is a feature (auditability) but also means the value must not be used as a secret. Never use the oracle output as a private key, nonce for a signature, or sealed bid.

⚠ Same-block determinism

Two calls in the same block with the same _(caller, vout, salt)_ tuple return the same value. This is intended — callers should pass a per-request salt (e.g. `token_id`, sequence counter) to avoid collisions.

ⓘ Use `staticcall` from consumers

The oracle’s only state write is the request counter. Consumers should call via `self.staticcall(...)` instead of `self.call(...)` so a malicious oracle (or a future upgrade) cannot touch consumer storage. The counter remains a soft stat — callers that need exact stats should track requests in their own storage.