---
title: 🟠 How to make a wrapped BRC-20 token on Alkanes
source: tutorials
source_url: https://alkanescan.org/tutorials/tutorial-wrapped-token.php
---

Tutorial 20 · 22 min read

# 🟠 How to make a wrapped BRC-20 token on Alkanes

27/5/2026 · Plain-language guide · Bitcoin mainnet · Alkanes

A **wrapped BRC-20** on Alkanes is an alkane token (e.g. `wSATS` at `2:N`) backed by real **BRC-20** (e.g. `sats`) held by a bridge operator. Users deposit BRC-20 off-chain/on-chain; the operator mints wrapped alkanes. To exit, users **burn** wrapped tokens on-chain and the operator sends BRC-20 back.

This is **not** a trustless light-client bridge — it is a **custodial** pattern with on-chain accounting. AlkaneScan ships a reference implementation in `contracts/wrap_ordi/` (wORDI, wSATS, wPEPE).

⚠️ Before you ship

Run [Audit](audit.php), use multisig for the owner key, publish proof-of-reserves, and read [security issues](tutorials/tutorial-security-issues.php). Never paste mnemonics in chat or logs.

## What “wrapped” means here

BRC-20 lives in the Ordinals/indexer world. Alkanes lives in WASM + protostones. There is no single Bitcoin opcode that says “move ORDI from BRC-20 to alkane automatically.” So we split responsibilities:

-   **On-chain (Alkanes contract)** — mint/burn wrapped supply, fees, pause, escrow counters, unwrap request ids.
-   **Off-chain / operator (bridge server)** — watch BRC-20 deposits, verify transfer txids, build PSBTs, broadcast `MintWrap` / `FulfillUnwrap`.

Compare with [Alkanes vs BRC-20](tutorials/tutorial-alkanes-vs-brc20.php) for why both layers exist.

## Architecture (contract + bridge)

User wallet (UniSat)
    │
    ├─ Wrap:  BRC-20 transfer → deposit address (Bitcoin)
    │         submit txid → bridge POST /submit-deposit
    │         operator → MintWrap PSBT → user receives wTOKEN at 2:N
    │
    └─ Unwrap: attach wTOKEN + BurnUnwrap PSBT (Schnorr on commit outpoint)
               contract escrow += net amount, request id++
               operator → FulfillUnwrap + send BRC-20 back (manual/indexer)

Apache (wrap-brc20.php, api/\*)  ──curl──►  Node bridge-server.mjs :3023
                                              │
                                              ├─ oyl-sdk (PSBT, protostone)
                                              ├─ Sandshrew RPC (simulate, UTXOs)
                                              └─ data/deposits.json, tokens.json

**One WASM binary, many deploys:** compile `wrap_ordi` once, deploy separately per ticker with different `Initialize` (name, symbol, max supply). Each deploy gets its own `2:N`.

## The WASM contract

Full source: `contracts/wrap_ordi/src/lib.rs` (also `contracts/deploy/examples/wrap-brc20-lib.rs` for the deploy wizard).

### Imports, domains, and token metadata

// contracts/wrap\_ordi/src/lib.rs (excerpt)
use alkanes\_runtime::{ declare\_alkane, message::MessageDispatch, runtime::AlkaneResponder, storage::StoragePointer, token::Token };
use k256::schnorr::{Signature as SchnorrSig, VerifyingKey};
use sha2::{Digest, Sha256};

const DOM\_MINT: &\[u8\] = b"ALKANES\_WBRC20\_MINT";
const DOM\_BURN: &\[u8\] = b"ALKANES\_WBRC20\_BURN";
const DOM\_FULFILL: &\[u8\] = b"ALKANES\_WBRC20\_FULFILL";
// … SETPAUSED, WITHDRAW\_FEES, WITHDRAW\_ALL

#\[derive(Default)\]
pub struct WrapOrdi(());

impl Token for WrapOrdi {
    fn name(&self) -> String {
        read\_string(K\_NAME).unwrap\_or\_else(|| String::from("Wrapped BRC-20"))
    }
    fn symbol(&self) -> String {
        read\_string(K\_SYMBOL).unwrap\_or\_else(|| String::from("wBRC20"))
    }
}

### MessageDispatch opcodes

#\[derive(MessageDispatch)\]
enum WrapOrdiMessage {
    #\[opcode(0)\]  Initialize,
    #\[opcode(1)\]  MintWrap,        // owner: after BRC-20 deposit verified
    #\[opcode(2)\]  BurnUnwrap,      // user: attach wTOKEN, open unwrap request
    #\[opcode(3)\]  FulfillUnwrap,   // owner: mark BRC-20 sent
    #\[opcode(5)\]  SetPaused,
    #\[opcode(6)\]  WithdrawFees,
    #\[opcode(8)\]  WithdrawAll,     // pause + shutdown + sweep
    #\[opcode(20)\] GetState,
    #\[opcode(21)\] GetUnwrapRequest,
    #\[opcode(22)\] GetUserNonce,
    #\[opcode(99)\] GetName,
    #\[opcode(100)\] GetSymbol,
}

`GetName` / `GetSymbol` require matching handlers:

fn get\_name(&self) -> Result<CallResponse> {
    Self::pure(self.name().into\_bytes())
}
fn get\_symbol(&self) -> Result<CallResponse> {
    Self::pure(self.symbol().into\_bytes())
}

## Opcodes & storage

Opcode

Who

What happens

`0 Initialize`

Deploy

Sets owner pubkey, max supply, wrap/unwrap fee bps, min mint, name, symbol, BRC-20 ticker

`1 MintWrap`

Owner

Owner-signed; mints wTOKEN to operator output; increases `/circulating`; records deposit txid in signature action

`2 BurnUnwrap`

User

User attaches wTOKEN; burns amount; net goes to `/escrow`; creates pending request

`3 FulfillUnwrap`

Owner

Owner-signed; marks request done; escrow reduced (BRC-20 sent off-chain)

`5–8`

Owner

Pause, withdraw fee balance, emergency `WithdrawAll`

`20–22`

Anyone

Read state, unwrap request, per-user nonce for burn signatures

### Initialize calldata (binary layout)

Packed into cellpack args after opcode `0` on deploy (see `deploy-wrap-brc20.mjs`):

owner\_pubkey(32)
max\_supply(16 LE u128)
wrap\_fee\_bps(4 LE u32)
unwrap\_fee\_bps(4 LE u32)
min\_mint(16 LE u128)
name\_len(2 LE u16) + name\_utf8
symbol\_len(2 LE u16) + symbol\_utf8
brc20\_ticker\_len(2 LE u16) + ticker\_utf8
// padded to 16-byte cells for protostone

// initialize() parses strings and writes storage keys
let (name, symbol, brc20) = if buf.len() > 72 {
    let (name, off) = read\_str\_u16(&buf, 72)?;
    let (symbol, off) = read\_str\_u16(&buf, off)?;
    let (brc20, \_) = read\_str\_u16(&buf, off)?;
    (name, symbol, brc20)
} else { /\* legacy 72-byte → wORDI / ordi \*/ };

write\_bytes(K\_OWNER, owner.to\_vec());
write\_bytes(K\_NAME, name.into\_bytes());
write\_bytes(K\_SYMBOL, symbol.into\_bytes());
write\_u128(K\_MAX, max\_supply);
// … fees, paused=0, req\_count=0

### MintWrap (operator mint after deposit)

fn mint\_wrap(&self) -> Result<CallResponse> {
    self.assert\_live()?;
    let deposit\_txid = need(&buf, 0, 32)?;
    let amount = u128::from\_le\_bytes(...);
    let nonce = u64::from\_le\_bytes(...);
    let sig = need(&buf, 56, 64)?;

    Self::assert\_owner\_signed(..., DOM\_MINT, &action)?;  // action = txid || amount
    let fee = fee\_of(amount, read\_u32(K\_WRAP\_BPS))?;
    let net = amount - fee;
    // check max\_supply, update /total\_minted, /circulating, /fee\_total
    r.alkanes.0.push(AlkaneTransfer { id: ctx.myself.clone(), value: net });
    Ok(r)
}

### BurnUnwrap (user requests exit)

fn burn\_unwrap(&self) -> Result<CallResponse> {
    let incoming = Self::collect\_self\_token(&ctx.incoming\_alkanes, &ctx.myself)?;
    // user must attach wrapped alkane UTXOs in the same tx
    Self::assert\_user\_signed(..., DOM\_BURN, commit\_txid, commit\_vout, &amount\_bytes)?;
    self.assert\_tx\_spends\_outpoint(commit\_txid, commit\_vout)?;
    // escrow += net; circulating -= amount; new /req/{id}/
}

The user signs a Schnorr digest that includes their pubkey, nonce, the **commit outpoint** they will spend, and the burn amount — so the burn cannot be replayed on a different tx.

## Schnorr signature domains

Owner and user actions use fixed domain strings (must match bridge-server when building PSBTs):

-   `ALKANES_WBRC20_MINT` — owner mint; action = `deposit_txid ‖ amount`
-   `ALKANES_WBRC20_BURN` — user burn; digest includes commit txid + vout
-   `ALKANES_WBRC20_FULFILL` — owner marks unwrap done
-   `ALKANES_WBRC20_SETPAUSED`, `WITHDRAW_FEES`, `WITHDRAW_ALL`

Digest formula (owner example): `SHA256(domain ‖ block_le ‖ tx_le ‖ admin_nonce_le ‖ action)`.

## Deploy one ticker (CLI on your server)

Same flow as [deploy tutorial](tutorials/tutorial-deploy.php) (commit → wait → reveal), but use the wrap deploy script so Initialize bytes are correct.

1

**Build WASM**

`cd contracts/wrap_ordi && cargo build --release --target wasm32-unknown-unknown`  
`cp target/.../wrap_ordi.wasm wrap_ordi_opt.wasm`

2

**Dry run**

`unset DRY_RUN` before broadcast. `TOKEN=sats DRY_RUN=1 MNEMONIC="…" node deploy-wrap-brc20.mjs`

3

**Broadcast**

`TOKEN=sats CONFIRM=yes MNEMONIC="…" node deploy-wrap-brc20.mjs` — prints commit + reveal txids.

4

**Resolve 2:N**

`alkanes trace <REVEAL_TXID>:0` or [espo.sh](https://espo.sh).

Presets in `deploy-wrap-brc20.mjs`:

`TOKEN`

BRC-20

Alkanes

Default max (8 dec)

`ordi`

ordi

wORDI

21,000,000

`sats`

sats

wSATS

21,000,000,000,000

`pepe`

pepe

wPEPE

420,690,000,000,000

## Bridge server (Node)

File: `contracts/wrap_ordi/bridge-server.mjs` (port **3023**). It does _not_ replace the contract — it helps wallets and operators talk to Bitcoin + Alkanes.

### Configuration

-   `data/tokens.json` — per-token `contract` (`2:N`) and `deposit` (BRC-20 receive address)
-   Env: `WRAP_BRC20_SATS_CONTRACT`, `WRAP_BRC20_SATS_DEPOSIT`, `BRIDGE_API_KEY`, `OYL_SDK_PATH=/tmp/oyl-sdk`
-   Apache `config.php` — `WRAP_BRC20_SERVER_URL` pointing at your tunnel (e.g. Cloudflare → `127.0.0.1:3023`)

### HTTP API

Method

Path

Purpose

GET

`/health`

Service + token list

GET

`/state?token=sats`

Simulate opcode 20 — circulating, escrow, paused

GET

`/deposits?token=sats`

Pending wrap queue

POST

`/submit-deposit`

`{ token, txid, address, amount }` — user wrap request

POST

`/build-burn-psbt`

User unwrap — attach wTOKEN, BurnUnwrap calldata

POST

`/build-burn-sig-helper`

Digest for wallet to sign

POST

`/build-owner-psbt`

Operator: mint, pause, withdraw (needs `X-Bridge-Key`)

POST

`/finalize-and-broadcast`

Broadcast signed PSBT

### How the bridge builds a burn PSBT

1.  Load token config → resolve `2:N` block/tx.
2.  `alkanes_protorunesbyaddress` — find UTXOs holding wTOKEN.
3.  Pack calldata: `[block, tx, opcode=2, user(32), amount(16), nonce(8), commit_txid(32), vout(4), sig(64)]` as u128 cells.
4.  `encodeProtostone` + `createExecutePsbt` via oyl-sdk.
5.  Return PSBT to UniSat; user signs; POST signed PSBT to finalize.

Owner mint uses the same pattern with `DOM_MINT` and owner taproot key (server-side with `BRIDGE_API_KEY` — never expose owner key in the browser in production).

### Run under pm2

cd /var/www/html/wrap\_ordi
cp data/tokens.json.example data/tokens.json
# edit contract + deposit per token

OYL\_SDK\_PATH=/tmp/oyl-sdk \\
WRAP\_BRC20\_SATS\_CONTRACT=2:YOUR\_N \\
WRAP\_BRC20\_SATS\_DEPOSIT=bc1p... \\
BRIDGE\_API\_KEY=your-secret \\
PORT=3023 \\
pm2 start bridge-server.mjs --name wrap-brc20

## User flows: wrap & unwrap

### Wrap (BRC-20 → Alkanes)

1.  User sends BRC-20 to the published **deposit address** (UniSat BRC-20 transfer).
2.  User submits transfer **txid** via [wrap-brc20.php](wrap-brc20.php) → PHP proxies to `/submit-deposit`.
3.  Operator verifies inscription/indexer, runs `MintWrap` PSBT, sends wTOKEN to user’s Alkanes address.

### Unwrap (Alkanes → BRC-20)

1.  User connects wallet, enters wTOKEN amount.
2.  Bridge returns burn PSBT; user signs Schnorr message + PSBT.
3.  On-chain: wTOKEN burned, unwrap **request id** pending, escrow increased.
4.  Operator sends BRC-20 back, calls `FulfillUnwrap` for that request id.

## Security & trust

-   **Custodial:** BRC-20 sits in wallets you control; users trust reserves ≥ circulating.
-   **Owner key:** Can mint unbacked wTOKEN if malicious — use multisig + transparency.
-   **WithdrawAll:** Sweeps contract alkane balance and shuts down — does not auto-return user BRC-20; plan wind-down.
-   **Pause:** Stops mint/burn while investigating incidents.
-   **Proof-of-reserves:** Publish indexer screenshots: BRC-20 balance at deposit address vs `GetState` circulating + escrow.

## Try it on AlkaneScan

-   Live UI: [Wrapped BRC-20 bridge](wrap-brc20.php) (tabs: wORDI, wSATS, wPEPE)
-   Contract README: `contracts/wrap_ordi/README.md`
-   Related: [Smart contract tutorial](tutorials/tutorial-smart-contract.php) · [Deploy tutorial](tutorials/tutorial-deploy.php) · [espo.sh tracking](tutorials/tutorial-espo.php)

[← All tutorials](tutorials/)