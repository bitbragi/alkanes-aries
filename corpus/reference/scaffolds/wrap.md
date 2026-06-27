---
title: Recipe — Wrap BTC to frBTC (mint)
source_url: https://docs.subfrost.io/key-components/alkanes
---

# Recipe: Wrap BTC to frBTC (mint)

Construct a transaction whose OP_RETURN carries a runestone/protostone that
calls the frBTC contract's exchange (opcode 77).

```
{
  "protostones": [{
    "protocolTag": 1,
    "edicts": [{
      "id": { "block": 32, "tx": 0 },  // frBTC alkane id
      "amount": 100000000,              // 1.0 frBTC, in sats
      "output": 2                       // assign minted frBTC to vout 2
    }],
    "pointer": 1,
    "calldata": [32, 0, 77]             // target 32:0, opcode 77 (exchange)
  }]
}
```

CLI equivalent:

```
alkanes alkanes wrap-btc 0.01 \
  --to bc1p... --from bc1q... --change bc1q... \
  --fee-rate 10 -y
```

Signing/broadcast is intentionally out of scope for Aries — keep keys in the CLI.
