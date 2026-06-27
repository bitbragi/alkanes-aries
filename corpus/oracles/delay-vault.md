---
title: Delay Vault
source: oracles
source_url: https://alkanescan.org/oracle-delay-vault.php
---

[← All Contracts](oracles.php)

⌛

# Delay Vault

Send tokens, get them back after 2 Bitcoin blocks

Time-Lock Open Source Trustless No Admin Keys

## What is the Delay Vault?

The Delay Vault is a simple Alkanes smart contract that acts as a **time-locked escrow**. You send any Alkanes token (DIESEL, custom tokens, etc.) to the contract and specify how many Bitcoin blocks must pass before you can claim them back. The default lock is **2 blocks (≈20 minutes)**.

This is useful for building vesting schedules, two-block confirmation windows, time-locked rewards, or any situation where you want funds to be immovable for a fixed period.

Deposit → Wait → Withdraw

1

Deploy the contract

Call `initialize(2)` to set the 2-block lock period. This is done once at deploy time. The contract then accepts deposits from anyone.

2

Deposit tokens (opcode 10)

Attach your DIESEL (or any alkane) to the Cellpack and call `deposit()`. The contract stores your caller identity and the block at which you can withdraw (`current_height + 2`). You receive a **deposit\_id** in return — save it.

3

Wait 2 blocks (≈20 min)

The tokens are safely held by the contract. You can check how many blocks remain with `blocks_until_unlock(deposit_id)` via a staticcall at any time.

4

Withdraw (opcode 20)

Call `withdraw(deposit_id)` from the same caller address. The contract verifies the lock has elapsed and sends the tokens directly back to you. The deposit is permanently marked as claimed to prevent double-spend.

Security guarantees

-   Only the **original depositor** (matching `ctx.caller`) can withdraw.
-   A **single-use flag** prevents the same deposit from being withdrawn twice.
-   Withdrawals before the unlock block are **hard-rejected** with a descriptive error.
-   There is **no admin key** — nobody can freeze, drain, or override deposits.

### Quick-start (consumer side)

"cm"\>// 1. Deposit DIESEL into the vault
let cellpack = Cellpack {
    target: VAULT\_ID,   "cm"\>// deployed DelayVault AlkaneId
    inputs: vec!\[10\],   "cm"\>// opcode 10 = deposit
};
"cm"\>// Attach your DIESEL tokens in the AlkaneTransferParcel on the tx.

"cm"\>// 2. Read the returned deposit\_id(first 16 bytes of response data)
let deposit\_id = u128::from\_le\_bytes(response.data\[..16\].try\_into()?);
println!("deposit\_id = {}", deposit\_id);

"cm"\>// 3. Check blocks remaining(staticcall, free)
let resp = staticcall(Cellpack {
    target: VAULT\_ID,
    inputs: vec!\[31, deposit\_id\],  "cm"\>// opcode 31 = blocks\_until\_unlock
}, &AlkaneTransferParcel::default(), fuel)?;
let remaining = u64::from\_le\_bytes(resp.data\[..8\].try\_into()?);
println!("{} blocks until tokens are claimable", remaining);

"cm"\>// 4. After N blocks: withdraw
let cellpack = Cellpack {
    target: VAULT\_ID,
    inputs: vec!\[20, deposit\_id\],  "cm"\>// opcode 20 = withdraw
};
"cm"\>// DIESEL is returned directly in the CallResponse alkanes parcel.

"cm"\>// =============================================================================
"cm"\>// AlkaneScan · Delay Vault
"cm"\>//
"cm"\>// Send any Alkanes token to this contract; get it back after N Bitcoin blocks.
"cm"\>// N is configured at deploy time(default: 2 blocks, ~20 minutes on mainnet).
"cm"\>//
"cm"\>// Flow:
"cm"\>//   1. Caller sends tokens + invokes opcode 10 (deposit).
"cm"\>//   2. Contract records(caller, token, amount, unlock\_block = height + N).
"cm"\>//      Returns a unique deposit\_id.
"cm"\>//   3. After N blocks, caller invokes opcode 20 (withdraw, deposit\_id).
"cm"\>//   4. Contract verifies: same caller, block reached, not already withdrawn.
"cm"\>//      Sends tokens back.
"cm"\>//
"cm"\>// Security:
"cm"\>//   \* Only the original depositor(same ctx.caller) may withdraw.
"cm"\>//   \* A single-use flag prevents double-spend withdrawals.
"cm"\>//   \* Accepts exactly ONE alkane type per deposit(rejects multi-token parcels).
"cm"\>//   \* All amounts and block heights are validated before storage.
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
use alkanes\_support::{
    id::AlkaneId,
    parcel::{AlkaneTransfer, AlkaneTransferParcel},
    response::CallResponse,
};
use anyhow::{anyhow, Result};
use metashrew\_support::index\_pointer::KeyValuePointer;
use std::sync::Arc;

"cm"\>// -----------------------------------------------------------------------------
"cm"\>// Deposit record — 89 bytes stored at /deposit/{id}
"cm"\>//
"cm"\>//   offset | size | field
"cm"\>//   -------|------|------------------------------
"cm"\>//   0      | 16   | caller.block(u128 LE)
"cm"\>//   16     | 16   | caller.tx(u128 LE)
"cm"\>//   32     | 16   | alkane.block(u128 LE)
"cm"\>//   48     | 16   | alkane.tx(u128 LE)
"cm"\>//   64     | 16   | amount(u128 LE)
"cm"\>//   80     | 8    | unlock\_block(u64 LE)
"cm"\>//   88     | 1    | withdrawn flag(0 = pending, 1 = claimed)
"cm"\>// -----------------------------------------------------------------------------

const RECORD\_LEN: usize = 89;

fn encode\_deposit(
    caller: &AlkaneId,
    alkane: &AlkaneId,
    amount: u128,
    unlock\_block: u64,
) -> Vec<u8\> {
    let mut out = Vec::with\_capacity(RECORD\_LEN);
    out.extend\_from\_slice(&caller.block.to\_le\_bytes());
    out.extend\_from\_slice(&caller.tx.to\_le\_bytes());
    out.extend\_from\_slice(&alkane.block.to\_le\_bytes());
    out.extend\_from\_slice(&alkane.tx.to\_le\_bytes());
    out.extend\_from\_slice(&amount.to\_le\_bytes());
    out.extend\_from\_slice(&unlock\_block.to\_le\_bytes());
    out.push(0u8); "cm"\>// not withdrawn
    out
}

struct Deposit {
    caller:       AlkaneId,
    alkane:       AlkaneId,
    amount:       u128,
    unlock\_block: u64,
    withdrawn:    bool,
}

fn decode\_deposit(b: &\[u8\]) -> Result<Deposit> {
    if b.len() < RECORD\_LEN {
        return Err(anyhow!("deposit record truncated"));
    }
    Ok(Deposit {
        caller: AlkaneId {
            block: u128::from\_le\_bytes(b\[0..16\].try\_into().unwrap()),
            tx:    u128::from\_le\_bytes(b\[16..32\].try\_into().unwrap()),
        },
        alkane: AlkaneId {
            block: u128::from\_le\_bytes(b\[32..48\].try\_into().unwrap()),
            tx:    u128::from\_le\_bytes(b\[48..64\].try\_into().unwrap()),
        },
        amount:       u128::from\_le\_bytes(b\[64..80\].try\_into().unwrap()),
        unlock\_block: u64::from\_le\_bytes(b\[80..88\].try\_into().unwrap()),
        withdrawn:    b\[88\] != 0,
    })
}

fn deposit\_key(id: u128) -> String {
    format!("/deposit/{}", id)
}

"cm"\>// -----------------------------------------------------------------------------
"cm"\>// Contract
"cm"\>// -----------------------------------------------------------------------------

#\[derive(Default)\]
pub struct DelayVault(());

impl AlkaneResponder for DelayVault {}

#\[derive(MessageDispatch)\]
enum DelayVaultMessage {
    "cm"\>/// One-time initializer.
    "cm"\>///   lock\_blocks: how many blocks to lock deposits(0 = use default of 2).
    #\[opcode(0)\]
    Initialize { lock\_blocks: u128 },

    "cm"\>/// Deposit tokens. Requires exactly one alkane type in incoming\_alkanes.
    "cm"\>/// Returns the deposit\_id(16 bytes LE u128) — keep it to withdraw later.
    #\[opcode(10)\]
    #\[returns(Vec<u8\>)\]
    Deposit,

    "cm"\>/// Withdraw a matured deposit.
    "cm"\>///   deposit\_id: the id returned by Deposit.
    "cm"\>/// Errors if: wrong caller, not yet unlocked, or already withdrawn.
    #\[opcode(20)\]
    #\[returns(Vec<u8\>)\]
    Withdraw { deposit\_id: u128 },

    "cm"\>/// Read-only: full deposit record.
    "cm"\>/// Returns 89 bytes(same layout as internal storage).
    #\[opcode(30)\]
    #\[returns(Vec<u8\>)\]
    GetDeposit { deposit\_id: u128 },

    "cm"\>/// Read-only: blocks remaining until deposit\_id is claimable.
    "cm"\>/// Returns 8 bytes LE u64. Returns 0 if already unlocked or withdrawn.
    #\[opcode(31)\]
    #\[returns(Vec<u8\>)\]
    BlocksUntilUnlock { deposit\_id: u128 },

    "cm"\>/// Read-only: configured lock period in blocks.
    #\[opcode(40)\]
    #\[returns(Vec<u8\>)\]
    LockBlocks,

    "cm"\>/// Read-only: total number of deposits ever made.
    #\[opcode(99)\]
    #\[returns(Vec<u8\>)\]
    TotalDeposits,
}

impl DelayVault {
    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Storage helpers
    "cm"\>// -------------------------------------------------------------------------

    fn read\_u64(key: &str) -> u64 {
        let b = StoragePointer::from\_keyword(key).get();
        if b.len() >= 8 { u64::from\_le\_bytes(b\[..8\].try\_into().unwrap()) } else { 0 }
    }

    fn read\_u128(key: &str) -> u128 {
        let b = StoragePointer::from\_keyword(key).get();
        if b.len() >= 16 { u128::from\_le\_bytes(b\[..16\].try\_into().unwrap()) } else { 0 }
    }

    fn write\_u64(key: &str, v: u64) {
        StoragePointer::from\_keyword(key).set(Arc::new(v.to\_le\_bytes().to\_vec()));
    }

    fn write\_u128(key: &str, v: u128) {
        StoragePointer::from\_keyword(key).set(Arc::new(v.to\_le\_bytes().to\_vec()));
    }

    "cm"\>/// Build a reply carrying \`bytes\` and forwarding any leftover alkanes.
    "cm"\>/// On Deposit this forwards nothing(tokens are kept by the contract).
    "cm"\>/// On Withdraw this is called with the returned token transfer appended.
    fn reply\_with(&self, bytes: Vec<u8\>, alkanes: AlkaneTransferParcel) -> Result<CallResponse\> {
        let mut r = CallResponse::forward(&alkanes);
        r.data = bytes;
        Ok(r)
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcode 0: initialize
    "cm"\>// -------------------------------------------------------------------------
    fn initialize(&self, lock\_blocks: u128) -> Result<CallResponse\> {
        self.observe\_initialization()?;
        let blocks = if lock\_blocks == 0 { 2u64 } else {
            if lock\_blocks > u64::MAX as u128 {
                return Err(anyhow!("lock\_blocks too large"));
            }
            lock\_blocks as u64
        };
        Self::write\_u64("/lock\_blocks", blocks);
        Self::write\_u128("/next\_id", 1); "cm"\>// start deposit IDs at 1
        let ctx = self.context()?;
        Ok(CallResponse::forward(&ctx.incoming\_alkanes))
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcode 10: deposit
    "cm"\>// -------------------------------------------------------------------------
    fn deposit(&self) -> Result<CallResponse\> {
        let ctx = self.context()?;

        "cm"\>// Require exactly one alkane type.
        if ctx.incoming\_alkanes.0.len() != 1 {
            return Err(anyhow!(
                "Deposit requires exactly one alkane type in incoming\_alkanes \\
                 (got {}). Send one token type per deposit.",
                ctx.incoming\_alkanes.0.len()
            ));
        }
        let transfer = &ctx.incoming\_alkanes.0\[0\];
        if transfer.value == 0 {
            return Err(anyhow!("deposit amount must be > 0"));
        }

        let lock   = Self::read\_u64("/lock\_blocks");
        let height = self.height();
        let unlock = height.saturating\_add(lock);

        "cm"\>// Allocate deposit ID.
        let id = Self::read\_u128("/next\_id");
        Self::write\_u128("/next\_id", id.saturating\_add(1));

        "cm"\>// Store the record.
        let record = encode\_deposit(&ctx.caller, &transfer.id, transfer.value, unlock);
        StoragePointer::from\_keyword(&deposit\_key(id)).set(Arc::new(record));

        "cm"\>// Tokens are NOT forwarded -- they remain as the contract&#039;s balance.
        "cm"\>// Return the deposit ID to the caller.
        self.reply\_with(id.to\_le\_bytes().to\_vec(), AlkaneTransferParcel::default())
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcode 20: withdraw
    "cm"\>// -------------------------------------------------------------------------
    fn withdraw(&self, deposit\_id: u128) -> Result<CallResponse\> {
        let ctx = self.context()?;

        let key   = deposit\_key(deposit\_id);
        let bytes = StoragePointer::from\_keyword(&key).get();
        if bytes.len() == 0 {
            return Err(anyhow!("deposit {} not found", deposit\_id));
        }
        let mut dep = decode\_deposit(&bytes)?;

        "cm"\>// Guard: already withdrawn?
        if dep.withdrawn {
            return Err(anyhow!("deposit {} was already withdrawn", deposit\_id));
        }

        "cm"\>// Guard: caller must be the original depositor.
        if ctx.caller.block != dep.caller.block || ctx.caller.tx != dep.caller.tx {
            return Err(anyhow!("only the original depositor may withdraw"));
        }

        "cm"\>// Guard: lock period must have elapsed.
        let height = self.height();
        if height < dep.unlock\_block {
            return Err(anyhow!(
                "deposit {} unlocks at block {} (current: {}, {} blocks remaining)",
                deposit\_id,
                dep.unlock\_block,
                height,
                dep.unlock\_block - height
            ));
        }

        "cm"\>// Mark as withdrawn.
        dep.withdrawn = true;
        let mut updated = bytes.to\_vec();
        updated\[88\] = 1;
        StoragePointer::from\_keyword(&key).set(Arc::new(updated));

        "cm"\>// Return the deposited tokens to the caller.
        let parcel = AlkaneTransferParcel(vec!\[AlkaneTransfer {
            id:    dep.alkane.clone(),
            value: dep.amount,
        }\]);

        self.reply\_with(deposit\_id.to\_le\_bytes().to\_vec(), parcel)
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcode 30: get\_deposit
    "cm"\>// -------------------------------------------------------------------------
    fn get\_deposit(&self, deposit\_id: u128) -> Result<CallResponse\> {
        let bytes = StoragePointer::from\_keyword(&deposit\_key(deposit\_id)).get();
        if bytes.len() == 0 {
            return Err(anyhow!("deposit {} not found", deposit\_id));
        }
        let ctx = self.context()?;
        let mut r = CallResponse::forward(&ctx.incoming\_alkanes);
        r.data = bytes.to\_vec();
        Ok(r)
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcode 31: blocks\_until\_unlock
    "cm"\>// -------------------------------------------------------------------------
    fn blocks\_until\_unlock(&self, deposit\_id: u128) -> Result<CallResponse\> {
        let bytes = StoragePointer::from\_keyword(&deposit\_key(deposit\_id)).get();
        if bytes.len() == 0 {
            return Err(anyhow!("deposit {} not found", deposit\_id));
        }
        let dep    = decode\_deposit(&bytes)?;
        let height = self.height();
        let remaining = if dep.withdrawn || height >= dep.unlock\_block {
            0u64
        } else {
            dep.unlock\_block - height
        };
        let ctx = self.context()?;
        let mut r = CallResponse::forward(&ctx.incoming\_alkanes);
        r.data = remaining.to\_le\_bytes().to\_vec();
        Ok(r)
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcode 40: lock\_blocks
    "cm"\>// -------------------------------------------------------------------------
    fn lock\_blocks(&self) -> Result<CallResponse\> {
        let ctx = self.context()?;
        let mut r = CallResponse::forward(&ctx.incoming\_alkanes);
        r.data = Self::read\_u64("/lock\_blocks").to\_le\_bytes().to\_vec();
        Ok(r)
    }

    "cm"\>// -------------------------------------------------------------------------
    "cm"\>// Opcode 99: total\_deposits
    "cm"\>// -------------------------------------------------------------------------
    fn total\_deposits(&self) -> Result<CallResponse\> {
        "cm"\>// next\_id starts at 1, so total = next\_id - 1
        let next = Self::read\_u128("/next\_id");
        let total = if next > 0 { next - 1 } else { 0 };
        let ctx = self.context()?;
        let mut r = CallResponse::forward(&ctx.incoming\_alkanes);
        r.data = total.to\_le\_bytes().to\_vec();
        Ok(r)
    }
}

declare\_alkane! {
    impl AlkaneResponder for DelayVault {
        type Message = DelayVaultMessage;
    }
}

### Cargo.toml

\[package\]
name    = "delay-vault"
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
opt-level = "z"
strip     = true
lto       = true
panic     = "abort"

### Build

\# Compile to WASM
cargo build --release --target wasm32-unknown-unknown

# Optimise binary size (saves on fees)
wasm-opt -Oz -o delay\_vault.wasm \\
  target/wasm32-unknown-unknown/release/delay\_vault.wasm

### Deploy

Deploy with `oyl alkane new-contract`. The deploy Cellpack must trigger `opcode 0 (initialize)` as the first call so the lock period is stored before anyone can deposit.

\# Deploy and initialize in one step
oyl alkane new-contract \\
  --wasm delay\_vault.wasm \\
  --calldata "0 2"
# calldata: opcode 0 = initialize, arg = 2 (lock\_blocks)

# The contract's AlkaneId is returned. Save it — you'll need it for deposits.

Tip — configurable lock period

Pass any `lock_blocks` value to `initialize`: e.g. `144` for ~1 day, `1008` for ~1 week. Passing `0` defaults to 2. The value is fixed forever after initialization.

### Write Opcodes

Opcode

Name

Calldata Inputs

Returns

Notes

0

**initialize**

`lock_blocks: u128`

—

WRITE One-time. Pass 0 for default 2.

10

**deposit**

\*(attach alkane in tx)\*

`deposit_id` (16 bytes LE u128)

WRITE Exactly 1 alkane type required.

20

**withdraw**

`deposit_id: u128`

`deposit_id` (16 bytes LE) + token parcel

WRITE Caller must match depositor. Block must be ≥ unlock\_block.

### Read Opcodes (staticcall-safe)

Opcode

Name

Calldata Inputs

Returns

30

**get\_deposit**

`deposit_id: u128`

89 raw bytes (see layout below)

31

**blocks\_until\_unlock**

`deposit_id: u128`

`u64 LE` — 0 if already unlocked or withdrawn

40

**lock\_blocks**

—

`u64 LE` — configured lock period

99

**total\_deposits**

—

`u128 LE` — total deposits ever made

### Deposit Record Layout (89 bytes)

offset  size  field
------  ----  -----------------------------------------
0       16    caller.block  (u128 LE) — depositor AlkaneId block
16      16    caller.tx     (u128 LE) — depositor AlkaneId tx
32      16    alkane.block  (u128 LE) — deposited token AlkaneId block
48      16    alkane.tx     (u128 LE) — deposited token AlkaneId tx
64      16    amount        (u128 LE) — base units deposited
80       8    unlock\_block  (u64 LE)  — first claimable block height
88       1    withdrawn     (u8)      — 0 = pending, 1 = already claimed

### Strengths

✓ Single-use flag prevents double-spend

The `withdrawn = 1` byte is written to storage before tokens are returned. Any second call to `withdraw` with the same id will fail with "already withdrawn".

✓ Caller-bound withdrawal

The `ctx.caller` AlkaneId stored at deposit time must match exactly on withdrawal. No third party can drain your deposit.

✓ Zero-amount guard

Deposits of 0 tokens are rejected at entry, preventing empty records from polluting storage.

✓ Single-token enforcement

Deposits with 0 or >1 alkane types in `incoming_alkanes` are rejected. Each deposit maps to exactly one token and amount.

✓ Saturating arithmetic

`saturating_add` is used for `next_id` and `unlock_block`, preventing overflow panics in edge cases.

✓ Deterministic storage keys

`/deposit/{id}` with monotonically increasing integer IDs avoids any key collision or overwrite scenario.

✓ No admin / no rug risk

After `initialize` there is no privileged owner. No one can freeze, redirect, or confiscate deposits.

✓ Read opcodes are pure

Opcodes 30, 31, 40, and 99 do not modify state, making them safe to use in `staticcall` contexts.

### Warnings & Trade-offs

⚠ ctx.caller semantics for direct user calls

In contract-to-contract calls, `ctx.caller` is the calling contract's AlkaneId. For direct user-originated transactions the value depends on the wallet implementation. Test on devnet before mainnet to confirm your caller is stable across calls.

⚠ No deposit enumeration per user

The contract has no mapping from caller to deposit IDs. A user who loses their `deposit_id` cannot recover it from the contract alone. Index deposits off-chain by listening to transactions involving the vault's AlkaneId.

⚠ Lost deposit\_id = lost access

If a depositor loses their deposit\_id AND their caller AlkaneId changes (e.g. wallet rotation), the tokens are permanently locked. Use a stable, non-rotating caller identity.

⚠ Fixed lock period

The lock period is set once at initialization and cannot be changed. Deploy a new instance if you need a different lock duration.

⚠ No emergency exit

By design there is no admin override. This maximises trustlessness but means there is no recovery path for bugs. Audit thoroughly before deploying with real value.

⚠ Single token type per deposit

To lock multiple token types simultaneously, create one deposit per token type and manage the IDs yourself.

### Storage Layout

/lock\_blocks    u64 LE   — lock duration in blocks (set by initialize)
/next\_id        u128 LE  — next deposit\_id to allocate (starts at 1)
/deposit/1      89 bytes — deposit record for id=1
/deposit/2      89 bytes — deposit record for id=2
  ...
/deposit/N      89 bytes — deposit record for id=N