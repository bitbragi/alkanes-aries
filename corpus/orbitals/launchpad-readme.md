---
title: Alkanes NFT Project
source: orbitals
source_url: https://raw.githubusercontent.com/0xsupersimon/nft-launchpad-alkanes/main/README.md
---

# Alkanes NFT Project

This repository contains the smart contracts and tools for the Alkanes NFT ecosystem, including collection and NFT contracts, as well as an NFT SVG image generator.

## Contact

If you have any question, contact here [Telegram](https://t.me/shiny0103)

## Project Structure

- **alkanes-collection/**: The main collection contract for Alkanes Orbitals.
- **alkanes-nft/**: The factory contract for creating individual Alkanes NFTs.
- **nft-generator/**: A Rust tool for generating SVG images for the NFTs.

---

## alkanes-collection

The collection contract for Alkanes Orbitals.

### Build

```bash
cargo build --target wasm32-unknown-unknown --release
```

The compiled WASM binary will be available in `target/wasm32-unknown-unknown/release/alkanes_collection.wasm`.

### Deployment

```bash
yarn oyl alkane new-contract -c ./target/alkanes/wasm32-unknown-unknown/release/alkanes_collection.wasm -data 1,0 -p signet
```

### Tracing

```bash
yarn oyl provider alkanes --method trace -params '{"txid":"a1ccb55a8a66b9ddcd4340c6f03bd25c44159a7fe59e663e123c35f2028f7ecc", "vout":3}' -p signet
```

---

## alkanes-nft

A factory contract used by the Alkanes collection contract for creating individual Alkanes NFTs.

### Build

```bash
cargo build --target wasm32-unknown-unknown --release
```

The compiled WASM binary will be available in `target/wasm32-unknown-unknown/release/alkanes_nft.wasm`.

### Deployment

```bash
yarn oyl alkane new-contract -c ./target/alkanes/wasm32-unknown-unknown/release/alkanes_nft.wasm -data 3,16802 -p oylnet
```

### Tracing

```bash
yarn oyl provider alkanes --method trace -params '{"txid":"88a68a2fcef7139232d858b49ff39f5e50da79a308616ff84a80adf344ea4341", "vout":3}' -p oylnet
```

---

## nft-generator

A Rust tool for generating SVG images for the Alkanes NFTs based on encoded traits and SVG templates.

### Usage

1. Build the generator:
   ```bash
   cargo build --release
   ```
2. Run the generator:
   ```bash
   cargo run --release
   ```
   This will generate SVG images in the `output/` directory.

The generator uses `encoded_traits.json` and `svg_template.json` to create unique SVGs for each NFT.

---

## Requirements

- [Rust](https://rustup.rs/) (for building contracts and generator)
- [yarn](https://yarnpkg.com/) (for deployment scripts)