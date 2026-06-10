---
title: subfrost-node cli Reference
source: subfrost
source_url: https://docs.subfrost.io/reference/subfrost-node-cli-reference
---

On this page

# `subfrost-node` cli Reference

This page provides a complete reference for all commands, subcommands, and flags available in the `subfrost-node` command-line interface. The `subfrost-node` is the core application for running a signer or full node on the SUBFROST network.

## Global Options[​](#global-options "Direct link to Global Options")

These options can be used with any command.

-   `--config <PATH>`: Specifies a path to a custom configuration file.
-   `--help`: Displays help information.
-   `--version`: Displays version information.

## Main Commands[​](#main-commands "Direct link to Main Commands")

### `run`[​](#run "Direct link to run")

This is the primary command to start the SUBFROST node and begin syncing with the network.

**Usage:**

```
subfrost-node run [OPTIONS]
```

**Options:**

-   `--name <NAME>`: A human-readable name for your node.
-   `--signer`: Run the node in signer mode. This requires a key for signing blocks.
-   `--chain <CHAIN_SPEC>`: Specifies the chain specification. Can be `dev`, `testnet`, or a path to a custom chain spec file.
-   `--base-path <PATH>`: The path to the node's data directory.
-   `--port <PORT>`: The port for peer-to-peer communication.
-   `--rpc-port <PORT>`: The port for the JSON-RPC server.
-   `--prometheus-port <PORT>`: The port for the Prometheus metrics endpoint.
-   `--log <LEVEL>`: Sets the logging level (e.g., `info`, `debug`, `trace`).

### `keygen`[​](#keygen "Direct link to keygen")

A utility command to generate a new secret key for a signer.

**Usage:**

```
subfrost-node keygen --file <PATH>
```

**Options:**

-   `--file <PATH>`: The path where the new key file will be saved. If not provided, the key will be printed to standard output.

### `dkg`[​](#dkg "Direct link to dkg")

Commands for participating in the Distributed Key Generation (DKG) ceremony, which is essential for creating the shared private key for the FROST protocol.

**Usage:**

```
subfrost-node dkg <SUBCOMMAND>
```

**Subcommands:**

-   `start`: Initiates a new DKG ceremony.
-   `participate`: Joins an existing DKG ceremony.
-   `status`: Checks the status of an ongoing ceremony.

_This is a simplified reference. For detailed options on each subcommand, run `subfrost-node dkg <SUBCOMMAND> --help`._

-   [Global Options](#global-options)
-   [Main Commands](#main-commands)
    -   [`run`](#run)
    -   [`keygen`](#keygen)
    -   [`dkg`](#dkg)