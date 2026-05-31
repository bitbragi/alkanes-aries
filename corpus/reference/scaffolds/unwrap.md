---
title: Recipe — Unwrap frBTC to BTC (burn)
source_url: https://docs.subfrost.io/key-components/alkanes
---

# Recipe: Unwrap frBTC to BTC (burn)

Spend the UTXO holding frBTC. An EMPTY edicts array signals a burn; calldata
specifies the destination Bitcoin address for the released collateral.

```
{
  "protostones": [{
    "protocolTag": 1,
    "edicts": [],                       // empty => burn input runes
    "pointer": 0,
    "calldata": [32, 0, 78, /* ...destination address bytes... */]
  }]
}
```

CLI: pending unwraps can be viewed with `alkanes alkanes unwrap --block-tag latest`.
