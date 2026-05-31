---
title: Alkanes / frBTC Constants
source_url: https://docs.subfrost.io/developer-guide/alkanes-integration
---

# Alkanes / frBTC Constants

| Constant | Value | Meaning |
|---|---|---|
| frBTC contract | `{ block: 32, tx: 0 }` (string `32:0`) | The frBTC alkane |
| Wrap opcode | `77` | frBTC exchange (mint) function |
| Unwrap opcode | `78` | frBTC unwrap (burn) function |
| Get-signer opcode | `103` | Query the current signer address |
| Mainnet genesis | `880000` | Alkanes mainnet genesis block |
| Protocol tag | `1` | protorune / alkanes protocol tag (always "1") |

## Alkane identifiers

An alkane is identified by its etching location `{ block, tx }`, written in
string form as `block:tx`. Example: `32:0` is frBTC. `block` is the height the
contract was etched at; `tx` is the transaction index within that block.

## Opcodes as calldata

Opcodes are passed in the protostone `calldata` array, typically prefixed by
the target alkane id. For frBTC the contract is `32:0`, so a wrap call is
`calldata: [32, 0, 77]` and an unwrap is `calldata: [32, 0, 78, ...dest]`.
