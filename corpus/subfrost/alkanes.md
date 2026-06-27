---
title: Alkanes Protocol
source_url: https://docs.subfrost.io/key-components/alkanes
---

# Alkanes Protocol

Alkanes is a system for stateful, smart-contract-like applications on Bitcoin.
It builds on Runes, embedding protocol messages inside the OP_RETURN output of
a Bitcoin transaction; that embedded data is a Runestone. A metashrew indexer
reads the OP_RETURN outputs, interprets the Runestones, and applies state
changes to the Alkanes state database. Because the data lives in a valid
Bitcoin transaction, it inherits Bitcoin's security and immutability.

## Structure of a Runestone

- protocolTag: identifier for the metaprotocol (1 for base protorune/alkanes).
- edicts: array of instructions modifying rune balances. Each edict has an
  id ({block, tx}), an amount, and an output index.
- pointer: default output index for unassigned runes.
- calldata: arbitrary byte array passed to the alkane contract — effectively a
  function call (target id + opcode + args).

## Minting frBTC (wrapping)

A wrap tx carries a protostone with protocolTag 1, an edict assigning the minted
frBTC ({block:32,tx:0}) to an output, and calldata [32,0,77] to call exchange.

## Burning frBTC (unwrapping)

An unwrap spends the frBTC UTXO. The edicts array is empty (signals a burn) and
calldata [32,0,78,...] specifies the destination address for released collateral.
