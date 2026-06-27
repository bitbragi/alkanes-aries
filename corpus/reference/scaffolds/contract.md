---
title: Scaffold — alkanes-rs WASM contract skeleton
source_url: https://github.com/kungfuflex/alkanes-rs
---

# Scaffold: alkanes-rs contract skeleton

Alkanes contracts compile to WASM. Build from the alkanes-rs workspace.
This is a starting template only — run the real audit workflow before deploy.

```rust
use alkanes_runtime::{declare_alkane, message::MessageDispatch, runtime::AlkaneResponder};
use alkanes_support::response::CallResponse;

#[derive(Default)]
pub struct Token;

#[derive(MessageDispatch)]
enum TokenMessage {
    #[opcode(0)]
    Initialize,
    #[opcode(77)]
    Exchange,
    #[opcode(103)]
    GetSigner,
}

impl AlkaneResponder for Token {}

declare_alkane!(Token, TokenMessage);
```

Build: `cargo build --release --target wasm32-unknown-unknown`.
Inspect after deploy: `alkanes alkanes inspect <OUTPOINT> --disasm --meta`.
