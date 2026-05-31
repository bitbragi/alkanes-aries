---
title: Alkanes CLI Integration
source_url: https://docs.subfrost.io/developer-guide/alkanes-integration
---

# Alkanes CLI Integration

The alkanes CLI is the primary tool for the Alkanes metaprotocol: wallet
management, token ops, contract deployment, network queries. Install from
github.com/kungfuflex/alkanes-rs (cargo build --release; binary at
target/release/alkanes).

## Global options

--wallet-file, --passphrase, --wallet-address (watch-only), --jsonrpc-url,
--provider (regtest|signet|mainnet), --frbtc-address.

## Wallet commands

wallet create; wallet addresses --range 0:5; wallet balance; wallet utxos.

## Alkanes operations

- wrap-btc <AMOUNT> --to --from --change --fee-rate -y
- getbalance --address <ADDRESS>
- unwrap --block-tag latest (view pending unwraps)
- execute --inputs --to --protostones -y (custom tx; inputs B:amount or BLOCK:TX:amount)
- inspect <OUTPOINT> --disasm --meta
- simulate <TX_HEX>

## Passthrough commands

bitcoind getblockcount/getrawtransaction/decoderawtransaction/sendrawtransaction;
esplora address/address-utxo/tx/fee-estimates.

## Broadcasting methods

Default mempool; --use-slipstream (MARA Slipstream); --use-rebar (Rebar Shield,
private relay + MEV protection); --mine (regtest only).
