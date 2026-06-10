---
title: Alkanes Protocol
source: subfrost
source_url: https://docs.subfrost.io/key-components/alkanes
---

On this page

# Alkanes Protocol

The Alkanes Protocol is a powerful system for creating stateful, smart contract-like applications on top of the Bitcoin blockchain. It is the engine that powers synthetic assets like `frBTC` and enables complex logic to be executed in a way that is verifiable by the underlying SUBFROST consensus.

## Runestones[​](#runestones "Direct link to Runestones")

Alkanes builds upon the concept of Runes, embedding protocol messages inside the `OP_RETURN` output of a Bitcoin transaction. This embedded data is called a **Runestone**.

A Runestone is a structured piece of data that instructs the Alkanes metaprotocol on how to alter the state of its "on-chain" programs. Because this data is part of a valid Bitcoin transaction, **it inherits the security and immutability of the Bitcoin blockchain.**

The SUBFROST protocol uses a `metashrew` indexer to read these `OP_RETURN` outputs, interpret the Runestones, and apply the resulting state changes to the Alkanes state database.

This mechanism allows for a flexible and expressive way to manage digital assets and execute complex logic, all while **anchored to the security of the Bitcoin blockchain.**

## Structure of a Runestone[​](#structure-of-a-runestone "Direct link to Structure of a Runestone")

The Runestone token operation has several key fields:

-   `protocolTag`: An identifier for the specific metaprotocol (e.g., `1n` for the base protorune protocol).
-   `edicts`: An array of instructions that modify rune balances.
    -   `id`: The ID of the rune being affected (e.g., `{ block: 32n, tx: 0n }` for `frBTC`).
    -   `amount`: The quantity of the rune to be minted or transferred.
    -   `output`: The index of the transaction output that will receive the runes.
-   `pointer`: A default output index to assign any unassigned runes.
-   `calldata`: An arbitrary byte array that can be used to pass data to the Alkane contract, effectively calling a function.

### Example: Minting `frBTC` (Wrapping)[​](#example-minting-frbtc-wrapping "Direct link to example-minting-frbtc-wrapping")

When a user wraps BTC, they create a transaction with a Runestone that looks something like this:

```
{  "protostones": [{    "protocolTag": 1n,    "edicts": [{      "id": { "block": 32n, "tx": 0n }, // frBTC Alkane ID      "amount": 100000000n,             // 1.0 frBTC (in satoshis)      "output": 2                      // Assign to the 3rd output    }],    "pointer": 1,    "calldata": [32n, 0n, 77n] // Call the 'exchange' function  }]}
```

This Runestone instructs the protocol to:

1.  Identify the `frBTC` Alkane contract.
2.  Mint `1.0` new `frBTC`.
3.  Assign ownership of this new `frBTC` to the recipient of the transaction's third output.
4.  Pass `[32, 0, 77]` as calldata to the contract's logic (target block 32, tx 0, opcode 77).

### Example: Burning `frBTC` (Unwrapping)[​](#example-burning-frbtc-unwrapping "Direct link to example-burning-frbtc-unwrapping")

To unwrap, a user spends the UTXO containing `frBTC`. The Runestone in this transaction will have an empty `edicts` array, which signals a burn. The `calldata` is used to specify the destination Bitcoin address for the released collateral.

```
{  "protostones": [{    "protocolTag": 1n,    "edicts": [], // An empty array signifies a burn of input runes    "pointer": 0,    "calldata": [32n, 0n, 78n, /*...destination address...*/] // Call 'unwrap'  }]}
```

## See Also[​](#see-also "Direct link to See Also")

-   [Alkanes Integration](/developer-guide/alkanes-integration) — CLI commands for Alkanes
-   [frBTC - Alkanes](/developer-guide/wrapping-frBTC) — Wrapping and unwrapping frBTC

-   [Runestones](#runestones)
-   [Structure of a Runestone](#structure-of-a-runestone)
    -   [Example: Minting `frBTC` (Wrapping)](#example-minting-frbtc-wrapping)
    -   [Example: Burning `frBTC` (Unwrapping)](#example-burning-frbtc-unwrapping)
-   [See Also](#see-also)