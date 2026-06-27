---
title: Alkanes Integration
source: subfrost
source_url: https://docs.subfrost.io/developer-guide/alkanes-integration
---

On this page

# Alkanes Integration

The Alkanes CLI (`alkanes`) is the primary command-line tool for interacting with the Alkanes metaprotocol on Bitcoin. It provides commands for wallet management, token operations, contract deployment, and querying the network.

## Installation[​](#installation "Direct link to Installation")

Install from the alkanes-rs repository:

```
git clone https://github.com/kungfuflex/alkanes-rscd alkanes-rscargo build --release
```

The binary will be available at `target/release/alkanes`.

## Global Options[​](#global-options "Direct link to Global Options")

All commands support these global options:

Option

Description

`--wallet-file <PATH>`

Path to wallet file

`--passphrase <PHRASE>`

Wallet passphrase for signing

`--wallet-address <ADDR>`

Watch-only mode (read-only)

`--jsonrpc-url <URL>`

Custom JSON-RPC endpoint

`--provider <PROVIDER>`

Network: `regtest`, `signet`, `mainnet`

`--frbtc-address <ADDR>`

Override frBTC contract address

## Wallet Commands[​](#wallet-commands "Direct link to Wallet Commands")

### Create a Wallet[​](#create-a-wallet "Direct link to Create a Wallet")

```
alkanes wallet create
```

Creates a new wallet with a 12-word mnemonic phrase. Store this phrase securely.

### List Addresses[​](#list-addresses "Direct link to List Addresses")

```
alkanes wallet addresses --range 0:5
```

Shows wallet addresses. Use range notation `start:end` to specify which addresses to display.

### Check Balance[​](#check-balance "Direct link to Check Balance")

```
alkanes wallet balance
```

Displays BTC and token balances for your wallet.

### List UTXOs[​](#list-utxos "Direct link to List UTXOs")

```
alkanes wallet utxos
```

Lists all unspent transaction outputs in your wallet.

## Alkanes Operations[​](#alkanes-operations "Direct link to Alkanes Operations")

### Wrap BTC to frBTC[​](#wrap-btc-to-frbtc "Direct link to Wrap BTC to frBTC")

```
alkanes alkanes wrap-btc <AMOUNT> \  --to <RECIPIENT_ADDRESS> \  --from <YOUR_ADDRESS> \  --change <CHANGE_ADDRESS> \  --fee-rate <SAT_PER_VB> \  -y
```

Wraps native BTC to frBTC tokens. The `-y` flag auto-confirms the transaction.

**Example:**

```
alkanes alkanes wrap-btc 0.01 \  --to bc1p... \  --from bc1q... \  --change bc1q... \  --fee-rate 10 \  -y
```

### Check Token Balance[​](#check-token-balance "Direct link to Check Token Balance")

```
alkanes alkanes getbalance --address <ADDRESS>
```

### View Pending Unwraps[​](#view-pending-unwraps "Direct link to View Pending Unwraps")

```
alkanes alkanes unwrap --block-tag latest
```

Shows pending frBTC unwrap requests waiting to be processed.

### Execute Custom Transactions[​](#execute-custom-transactions "Direct link to Execute Custom Transactions")

```
alkanes alkanes execute \  --inputs <REQUIREMENTS> \  --to <ADDRESSES> \  --protostones <SPECS> \  -y
```

For advanced users building custom Alkanes transactions.

**Input format:**

-   `B:amount` — Bitcoin amount in sats
-   `BLOCK:TX:amount` — Specific token amount

### Inspect Contracts[​](#inspect-contracts "Direct link to Inspect Contracts")

```
alkanes alkanes inspect <OUTPOINT> --disasm --meta
```

Disassemble and inspect contract bytecode.

### Simulate Transactions[​](#simulate-transactions "Direct link to Simulate Transactions")

```
alkanes alkanes simulate <TX_HEX>
```

Simulate an Alkanes transaction without broadcasting.

## Bitcoin RPC Commands[​](#bitcoin-rpc-commands "Direct link to Bitcoin RPC Commands")

Direct Bitcoin Core RPC access:

```
# Get block countalkanes bitcoind getblockcount# Get raw transactionalkanes bitcoind getrawtransaction <TXID># Decode transactionalkanes bitcoind decoderawtransaction <TX_HEX># Send transactionalkanes bitcoind sendrawtransaction <TX_HEX>
```

## Esplora Commands[​](#esplora-commands "Direct link to Esplora Commands")

Query Esplora API:

```
# Get address infoalkanes esplora address <ADDRESS># Get address UTXOsalkanes esplora address-utxo <ADDRESS># Get transactionalkanes esplora tx <TXID># Fee estimatesalkanes esplora fee-estimates
```

## Transaction Options[​](#transaction-options "Direct link to Transaction Options")

### Fee Rate[​](#fee-rate "Direct link to Fee Rate")

Set custom fee rate in sat/vB:

```
--fee-rate 15
```

### Broadcasting Methods[​](#broadcasting-methods "Direct link to Broadcasting Methods")

Option

Description

Default

Standard mempool broadcast

`--use-slipstream`

MARA Slipstream (bypasses mempool)

`--use-rebar`

Rebar Shield (private relay with MEV protection)

`--mine`

Mine immediately (regtest only)

### Auto-confirm[​](#auto-confirm "Direct link to Auto-confirm")

Skip confirmation prompts:

```
-y, --auto-confirm
```

## Key Constants[​](#key-constants "Direct link to Key Constants")

Constant

Value

Description

frBTC Contract

`{32, 0}`

Block 32, Transaction 0

Wrap Opcode

`77`

frBTC exchange function

Unwrap Opcode

`78`

frBTC unwrap function

Get Signer Opcode

`103`

Query signer address

Genesis Block

`880000`

Mainnet genesis

## Getting Help[​](#getting-help "Direct link to Getting Help")

```
alkanes --helpalkanes <COMMAND> --help
```

For issues and contributions: [kungfuflex/alkanes-rs](https://github.com/kungfuflex/alkanes-rs)

## See Also[​](#see-also "Direct link to See Also")

-   [frBTC on Alkanes](/developer-guide/wrapping-frBTC) — Wrapping and unwrapping frBTC
-   [Alkanes Protocol](/key-components/alkanes) — Protocol overview

-   [Installation](#installation)
-   [Global Options](#global-options)
-   [Wallet Commands](#wallet-commands)
    -   [Create a Wallet](#create-a-wallet)
    -   [List Addresses](#list-addresses)
    -   [Check Balance](#check-balance)
    -   [List UTXOs](#list-utxos)
-   [Alkanes Operations](#alkanes-operations)
    -   [Wrap BTC to frBTC](#wrap-btc-to-frbtc)
    -   [Check Token Balance](#check-token-balance)
    -   [View Pending Unwraps](#view-pending-unwraps)
    -   [Execute Custom Transactions](#execute-custom-transactions)
    -   [Inspect Contracts](#inspect-contracts)
    -   [Simulate Transactions](#simulate-transactions)
-   [Bitcoin RPC Commands](#bitcoin-rpc-commands)
-   [Esplora Commands](#esplora-commands)
-   [Transaction Options](#transaction-options)
    -   [Fee Rate](#fee-rate)
    -   [Broadcasting Methods](#broadcasting-methods)
    -   [Auto-confirm](#auto-confirm)
-   [Key Constants](#key-constants)
-   [Getting Help](#getting-help)
-   [See Also](#see-also)