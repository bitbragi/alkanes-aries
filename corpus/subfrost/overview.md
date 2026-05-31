---
title: SUBFROST Overview
source_url: https://docs.subfrost.io/
---

# SUBFROST Overview

SUBFROST is a decentralized custodian enabling a trustless DeFi ecosystem on
Bitcoin L1. It operates as a Layer-0, issuing synthetic BTC assets directly on
Bitcoin through execution layers such as Alkanes, Arch, BRC 2.0, and MIDL.

## Synthetic assets

- frBTC: synthetic asset pegged 1:1 to BTC on Bitcoin L1.
- dxBTC: yield-bearing BTC variant.
- FUEL: protocol token.

## Cryptography

Core custody uses FROST (Flexible Round-Optimized Schnorr Threshold) and ROAST
(Robust Asynchronous Schnorr Threshold) signature schemes, supporting signing
groups up to 255 participants. The network runs on QUIC + libp2p.
