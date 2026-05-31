---
title: frBTC on Alkanes
source: subfrost
source_url: https://docs.subfrost.io/developer-guide/wrapping-frBTC
---

On this page

# frBTC on Alkanes

frBTC is the native Bitcoin synthetic token on the Alkanes metaprotocol, pegged 1:1 to BTC. This guide covers wrapping, unwrapping, and interacting with the frBTC contract using Alkanes.

## Contract Location[​](#contract-location "Direct link to Contract Location")

Property

Value

**Alkane ID**

`{32, 0}`

**Block**

32

**Transaction**

0

The frBTC contract is deployed at genesis and is immutable.

## Contract Opcodes[​](#contract-opcodes "Direct link to Contract Opcodes")

The frBTC contract exposes these methods via opcodes:

### Core Operations[​](#core-operations "Direct link to Core Operations")

Opcode

Method

Parameters

Description

`77`

`exchange()`

None

Wrap BTC to frBTC

`78`

`unwrap()`

`vout: u128, amount: u128`

Burn frBTC and queue BTC payment

### Query Methods[​](#query-methods "Direct link to Query Methods")

Opcode

Method

Returns

Description

`99`

`get_name()`

`"Fractional BTC"`

Token name

`100`

`get_symbol()`

`"frBTC"`

Token symbol

`101`

`get_pending_unwraps()`

`Payment[]`

List pending payments

`102`

`get_decimals()`

`8`

Decimal places

`103`

`get_signer()`

`[u8; 32]`

Current signer pubkey

`105`

`get_total_supply()`

`u128`

Total frBTC supply

## How Wrapping Works[​](#how-wrapping-works "Direct link to How Wrapping Works")

Wrapping converts native BTC to frBTC in a single atomic Bitcoin transaction:

```
┌─────────────────────────────────────────────────────────┐│  WRAP TRANSACTION                                       │├─────────────────────────────────────────────────────────┤│  Input: Your BTC UTXO                                   │├─────────────────────────────────────────────────────────┤│  Output 0: BTC → SUBFROST signer address                ││  Output 1: frBTC → Your address (via protostone)        ││  Output 2+: Change → Your change address                │├─────────────────────────────────────────────────────────┤│  OP_RETURN: Protostone calling exchange() opcode 77     │└─────────────────────────────────────────────────────────┘
```

The frBTC contract at `{32, 0}` validates that BTC was sent to the correct signer address and mints an equivalent amount of frBTC to your address.

### Wrap Using CLI[​](#wrap-using-cli "Direct link to Wrap Using CLI")

```
alkanes alkanes wrap-btc <AMOUNT> \  --to <RECIPIENT_ADDRESS> \  --from <YOUR_ADDRESS> \  --change <CHANGE_ADDRESS> \  --fee-rate <SAT_PER_VB> \  -y
```

**Example: Wrap 0.01 BTC**

```
alkanes alkanes wrap-btc 0.01 \  --to bc1p... \  --from bc1q... \  --change bc1q... \  --fee-rate 10 \  -y
```

### Advanced: Execute with Protostone[​](#advanced-execute-with-protostone "Direct link to Advanced: Execute with Protostone")

For custom transactions:

```
alkanes alkanes execute \  --inputs "B:1000000" \  --to "<SIGNER_ADDR>,bc1p..." \  --protostones "[32,0,77]:v1:v1" \  -y
```

## How Unwrapping Works[​](#how-unwrapping-works "Direct link to How Unwrapping Works")

Unwrapping converts frBTC back to native BTC in a two-step process:

### Step 1: Burn frBTC[​](#step-1-burn-frbtc "Direct link to Step 1: Burn frBTC")

Create a transaction that burns your frBTC and queues a payment request:

```
┌─────────────────────────────────────────────────────────┐│  UNWRAP TRANSACTION                                     │├─────────────────────────────────────────────────────────┤│  Input: Your frBTC UTXO                                 │├─────────────────────────────────────────────────────────┤│  OP_RETURN: Protostone calling unwrap() opcode 78       ││             with vout and amount parameters             │└─────────────────────────────────────────────────────────┘
```

### Step 2: Receive BTC[​](#step-2-receive-btc "Direct link to Step 2: Receive BTC")

The SUBFROST signers monitor for unwrap requests and cooperatively sign a Bitcoin transaction to release the locked BTC to your specified address.

### Minimum Unwrap Amount[​](#minimum-unwrap-amount "Direct link to Minimum Unwrap Amount")

Due to dust limits and transaction fees, there's a minimum unwrap amount:

```
alkanes subfrost minimum-unwrap \  --fee-rate <SAT_PER_VB> \  --premium 0.001
```

The formula considers:

-   Dust threshold (546 sats)
-   Fee per output based on transaction size
-   Protocol premium (default 0.1%)

## Transaction Structure[​](#transaction-structure "Direct link to Transaction Structure")

### Protostone Format[​](#protostone-format "Direct link to Protostone Format")

Wrap transactions include a protostone in the OP\_RETURN:

```
Protostone {  cellpack: {    target: {block: 32, tx: 0},  // frBTC contract    inputs: [77]                  // exchange() opcode  },  bitcoin_transfer: {    amount: <SATS>,    target: Output(0)             // Send BTC to output 0  },  pointer: Output(1),             // frBTC goes to output 1  refund: Output(1)               // Unused tokens back to output 1}
```

### Payment Storage[​](#payment-storage "Direct link to Payment Storage")

Unwrap payments are stored by block height:

```
/alkanes/{32:0}/storage/  /payments/byheight/{height}  // Payments created at block  /fulfilled                    // Fulfilled payment tracking  /last_block                   // Last processed block
```

## Checking Balances[​](#checking-balances "Direct link to Checking Balances")

### frBTC Balance[​](#frbtc-balance "Direct link to frBTC Balance")

```
alkanes alkanes getbalance --address <YOUR_ADDRESS>
```

### Pending Unwraps[​](#pending-unwraps "Direct link to Pending Unwraps")

View pending unwrap requests:

```
alkanes alkanes unwrap --block-tag latest
```

## Security Model[​](#security-model "Direct link to Security Model")

### Atomic Wrapping[​](#atomic-wrapping "Direct link to Atomic Wrapping")

-   Wrapping is trustless and permissionless
-   BTC lock and frBTC mint happen in the same transaction
-   If the BTC transfer fails, no frBTC is minted

### Trust-Minimized Unwrapping[​](#trust-minimized-unwrapping "Direct link to Trust-Minimized Unwrapping")

-   Unwrapping requires SUBFROST signer cooperation
-   Signers monitor for unwrap events
-   Multi-party threshold signature required for BTC release
-   Users can verify pending payments on-chain

## Error Handling[​](#error-handling "Direct link to Error Handling")

**"Insufficient funds"**

-   Ensure you have enough BTC for the wrap amount plus transaction fees
-   Check that your UTXOs aren't locked or already spent

**"Below minimum unwrap"**

-   Your unwrap amount is below the dust threshold plus fees
-   Use `minimum-unwrap` command to check the current minimum

**"Signer address mismatch"**

-   The BTC was sent to the wrong address
-   Query the current signer address before wrapping

## Complete Example[​](#complete-example "Direct link to Complete Example")

Here's a complete wrap flow:

```
# 1. Create wallet if neededalkanes wallet create# 2. Check your addressesalkanes wallet addresses --range 0:3# 3. Fund your wallet with BTC (external step)# 4. Check balancealkanes wallet balance# 5. Wrap 0.01 BTCalkanes alkanes wrap-btc 0.01 \  --to bc1p... \  --from bc1q... \  --change bc1q... \  --fee-rate 10 \  -y# 6. Verify frBTC balancealkanes alkanes getbalance --address bc1p...
```

## Key Parameters[​](#key-parameters "Direct link to Key Parameters")

Parameter

Value

Description

frBTC Contract

`{32, 0}`

Block 32, Transaction 0

Wrap Opcode

`77`

exchange() function

Unwrap Opcode

`78`

unwrap() function

Default Premium

`0.1%`

Protocol fee on unwrap

Dust Threshold

`546 sats`

Minimum output value

## See Also[​](#see-also "Direct link to See Also")

-   [Alkanes Integration](/developer-guide/alkanes-integration) — CLI reference for Alkanes
-   [Alkanes Protocol](/key-components/alkanes) — Protocol overview

-   [Contract Location](#contract-location)
-   [Contract Opcodes](#contract-opcodes)
    -   [Core Operations](#core-operations)
    -   [Query Methods](#query-methods)
-   [How Wrapping Works](#how-wrapping-works)
    -   [Wrap Using CLI](#wrap-using-cli)
    -   [Advanced: Execute with Protostone](#advanced-execute-with-protostone)
-   [How Unwrapping Works](#how-unwrapping-works)
    -   [Step 1: Burn frBTC](#step-1-burn-frbtc)
    -   [Step 2: Receive BTC](#step-2-receive-btc)
    -   [Minimum Unwrap Amount](#minimum-unwrap-amount)
-   [Transaction Structure](#transaction-structure)
    -   [Protostone Format](#protostone-format)
    -   [Payment Storage](#payment-storage)
-   [Checking Balances](#checking-balances)
    -   [frBTC Balance](#frbtc-balance)
    -   [Pending Unwraps](#pending-unwraps)
-   [Security Model](#security-model)
    -   [Atomic Wrapping](#atomic-wrapping)
    -   [Trust-Minimized Unwrapping](#trust-minimized-unwrapping)
-   [Error Handling](#error-handling)
-   [Complete Example](#complete-example)
-   [Key Parameters](#key-parameters)
-   [See Also](#see-also)