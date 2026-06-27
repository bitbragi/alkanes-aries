---
title: Reading the Bitcoin transaction from an Alkanes contract (BTC payment verification)
source_url: https://github.com/kungfuflex/alkanes-rs/blob/main/crates/alkanes-runtime/src/runtime.rs
---

# Reading the Bitcoin transaction from an Alkanes contract

Alkanes contracts execute inside the Metashrew indexer while the block is being
indexed, so a contract can read **the Bitcoin transaction it is being invoked in**
(and the block) directly. This is a general capability on the `AlkaneResponder`
trait — not an frBTC privilege — verified from `crates/alkanes-runtime/src/runtime.rs`.

## Available methods (AlkaneResponder)

| Method | Returns | Notes |
|---|---|---|
| `transaction()` | `Vec<u8>` | raw consensus-encoded tx bytes (`__request_transaction` / `__load_transaction`) |
| `transaction_object()` | `Result<bitcoin::Transaction>` | parsed tx — full `input` / `output` (`TxOut { value, script_pubkey }`) |
| `transaction_id()` | `Result<Txid>` | the tx id |
| `block()` / `block_header()` | `Vec<u8>` / `Result<Header>` | the block / header being indexed |
| `height()` | `u64` | current block height |
| `output(&OutPoint)` | `Result<Vec<u8>>` | fetch a specific output (backed by `__request_output`/`__load_output`, which may be gated in some builds — for the *current* tx's outputs, prefer `transaction_object()`) |
| `context()` | `Result<Context>` | `{ myself, caller, vout, incoming_alkanes, inputs }` |

## Verify a BTC payment to a treasury address (no frBTC needed)

This is how to take a **plain BTC fee** in the same transaction as the contract
call — the mechanism frBTC's wrap uses to confirm a deposit, reused by any
contract. Store the treasury `scriptPubKey` at deploy, then on the paid opcode:

```rust
use anyhow::ensure;

let tx = self.transaction_object()?;                 // bitcoin::Transaction
let treasury_spk: Vec<u8> = self.treasury_spk();     // stored at init
let paid: u64 = tx
    .output
    .iter()
    .filter(|o| o.script_pubkey.as_bytes() == treasury_spk.as_slice())
    .map(|o| o.value.to_sat())
    .sum();
ensure!(paid >= required_fee_sats, "insufficient fee paid to treasury");
// ...proceed with the state change (e.g. register the username)
```

The caller's wallet builds **one tx** containing both the fee output (paying the
treasury) and the protostone carrying the contract call (cellpack: target alkane,
opcode, inputs). The contract sees that tx via `transaction_object()`.

## Token-denominated payments instead

If you'd rather take payment in an alkane token (frBTC `32:0`, DIESEL `2:0`, or a
project token), don't read the tx — read `context().incoming_alkanes` (the
`AlkaneTransferParcel` of tokens transferred into the call) and check the id +
amount. See `orddao/ico-btc-or-diesel` for a contract that accepts either path.

## Notes

- `bitcoin::{Transaction, TxOut, OutPoint, Txid}` and `Header` come from the
  rust-bitcoin types re-exported through the alkanes/metashrew support crates.
- Match the **exact** treasury `scriptPubKey` (not an address string) and require
  `value >= fee`; use a dedicated fee-collection address so any output to it in a
  call tx is unambiguously the fee.
