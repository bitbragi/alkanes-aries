---
title: Cloneable Alkanes collection template + in-browser create launchpad (field notes)
source_url: https://github.com/0xsupersimon/nft-launchpad-alkanes
---

# Cloneable template + in-browser create — field notes

Patterns and traps from building a launchpad where creators **deploy their own on-chain NFT
collection from the browser** (clone a template, ingest art on-chain, seal, register, mint) with a
non-custodial burner wallet. Complements `orbitals-launchpad-regtest-and-browser-mint.md`,
`deploy-and-gateway-gotchas.md`, and `regtest-broadcast-nonstandard-protostone.md`.

## Data-driven, cloneable template (deploy once, configure N at clone)

- Put per-instance **config + assets in STORAGE**, not in constants / `include_str!`. Compiling and
  deploying a fresh wasm per collection doesn't scale; a template that reads its config from storage
  does.
- Deploy the template once as a reserve `{4,T}`. Clone per instance with a cellpack targeting
  `{block:6, tx:T}` whose inputs **are** the `Initialize` args → lands a fresh `{2,seq}` configured
  at clone-time. (`block 6` resolves the template at `{4,T}`; `block 5` → `{2,tx}`.)
- `MessageDispatch` decodes the clone inputs, **including `String` and `Vec<u128>`**. String encoding:
  UTF-8 bytes, null-terminated, padded to a 16-byte (u128) boundary, little-endian per word.
  Consecutive `String` args each occupy whole words, so the decoder finds each null terminator and
  the next String starts on the next word — pack them the same way client-side.
- Ingest large assets **post-clone** via chunked append ops (plain cellpack executes), then expose
  them through view opcodes. The whole clone→init→append→seal sequence is ordinary executes, so it
  runs **in-browser** with a burner — no per-collection deploy step.
- **Mint mode as an init param:** store the mode at `Initialize` and branch the mint op on it
  (e.g. `0` = lottery, difficulty-gated; `1` = deterministic, next sequential index). One template
  serves both styles.

## Multi-tenant rendering — delegate at read-time, never hardcode a per-instance field

- An instance stores `collection = context.caller` at init and delegates read-only views
  (`GetData`=1000, `GetName`=99, `GetSymbol`=100) to its collection via **staticcall at read-time**,
  passing its own index. Each tenant answers for itself.
- **Trap:** a SHARED factory/template that returns a per-instance field (e.g. the orbital *name*)
  from a **hardcoded constant** leaks it across every tenant — the art delegates correctly but every
  instance is mis-named. Passes a one-collection smoke test; only a SECOND collection reveals it.
- Fix: data-drive the field (delegate it like the art) or give each collection its own factory.
  Read-time staticcall back to the collection is safe — a separate read-only frame — so it avoids
  the re-entrancy you'd risk by calling back during the mint that created the instance.

## Creator-auth + threading an auth token through a multi-tx ceremony

- Gate mutating ops (e.g. `AppendArt`, `Seal`) on the collection **auth token**: `Initialize` mints
  one collection token to the cloner; the gated op requires it in `context.incoming_alkanes` (same
  shape as a token-gated auth-mint). A direct call from a non-creator has no token → rejected. A
  `Seal` op flips a `/sealed` flag that permanently rejects further appends.
- **Threading the token across the sequence (the subtle part):** to present the token to each tx's
  gated op, simply **SPEND the UTXO that holds it** as an input and emit a **plain** alkanes message
  protostone — proto `pointer=0`, `refund=0`, **NO edicts**. Alkanes on an input DEFAULT into the
  first protostone message (they become `incoming_alkanes`); the contract `forward`s the token back
  to the pointer vout (`vout0`), which the next tx spends.
- **Do NOT add an explicit edict to "deliver" the token to the message's virtual vout.** It double-
  handles the allocation: the forwarded token no longer follows the pointer and is burned to the
  OP_RETURN. Symptom: the first token-threaded tx works, every subsequent one reverts "missing token",
  and the holder shows zero balance. This exactly mirrors the `alkanes-cli --inputs ID:1` path
  (decode one: pointer=0, refund=0, no `Tag::Body` edict block).
- Verify each step by **observable on-chain state** (an `ArtLen`/`GetSealed` view growing), not by
  tx-confirmed — a reverted protomessage still confirms as a valid bitcoin tx.

## On-chain art ingestion + the mainnet OP_RETURN call

- Chunk art into `AppendArt` cellpack executes carrying the bytes in the runestone OP_RETURN — **no
  witness/inscription envelope**, so ingestion stays in-browser.
- A single tx's OP_RETURN payload is capped by the push prefix: `OP_PUSHDATA2` → **65,535 bytes**.
  That's a *tooling* cap — emit `OP_PUSHDATA4` (or multi-push) to exceed it. A CLI `E2BIG` around
  ~60KB is the **OS argv length limit** (art passed as command args), **not** a chain limit; the
  browser builds tx bytes directly and has no such ceiling.
- **Mainnet:** the art rides in OP_RETURN. Bitcoin **Core 30 (Oct 2025)** raised the default
  `-datacarriersize` from 83 bytes to ~**100,000**, so collection-scale (≤100KB) OP_RETURN data is
  **standard and relayed/mined by default** — embedded-via-OP_RETURN graduates to mainnet within that
  budget; no heavier witness "data-alkane" needed. Caveat: Bitcoin **Knots** (~16% of nodes) and
  `datacarriersize=83` holdouts reject it, but Core and the majority relay/confirm.

## Discovery + the write/read split

- **Discovery:** deploy a lightweight on-chain **registry** alkane — `Register(id, name)` (dedup by
  id) + `ListAll` → JSON `[{id,name}]`. The create flow appends to it; the directory reads it. Swap
  any static collection list for a registry read → new collections appear for everyone with no
  frontend redeploy. Beats enumerating `{6,T}` clones (needs an indexer range-scan, can't carry
  curated metadata).
- **Architecture:** keep all **writes** in-browser/non-custodial (clone/init/append/seal/register/
  mint are plain burner cellpack executes); put **reads** (registry `ListAll`, per-collection
  `reflect-alkane`/`simulate` views, on-chain art via `GetData`) behind a thin **stateless** backend
  that wraps simulate/reflect and returns JSON/SVG. The server never signs; the browser never needs
  an indexer SDK.

## Verifying it (headless browser on a no-sudo box)

- Drive the real UI with Playwright and assert on DOM/text so the screenshot proves behaviour.
- No-sudo chromium: `apt-get download` the chromium `*t64` dep debs + a fonts package, `dpkg -x` into
  a local dir, point `LD_LIBRARY_PATH` at the extracted libs, install the `.ttf` to `~/.fonts` with a
  `~/.config/fontconfig/fonts.conf` referencing it; use a cached `playwright-core` chromium.
- **FONTS are the silent killer:** if a headless screenshot shows correct images/shapes but **no
  text**, suspect fonts/fontconfig first — not your CSS. (Missing shared libs are the obvious
  blocker; missing fonts are the one that wastes an hour chasing the app.)
