---
title: WebAuthn passkey gotchas for Bitcoin web wallets (rpId, Buffer, on-chain ownership)
source: reference
source_url: ""
---

# WebAuthn passkey gotchas for Bitcoin web wallets

Notes from wiring a passkey-derived key (WebAuthn PRF → seed → BIP86 taproot) into a
browser wallet on the Alkanes stack. These three bugs all share a trait: a Node test
harness passes while the **browser** fails, so they only appear in a real browser.

## 1. rpId must be set on BOTH ceremonies — create AND get

`navigator.credentials.create()` (registration) and `navigator.credentials.get()`
(authentication / sign-in) are **two separate WebAuthn ceremonies**. Each carries its
own `rp.id` (create) / `rpId` (get).

- Fixing the rpId on registration does **not** fix sign-in — sign-in is a different call
  with its own option object. It's easy to patch one and leave the other.
- Symptom of a mismatch: registration works, then sign-in throws an **origin/rpId
  mismatch** (the assertion can't find a credential for that rpId) and the user bounces.
- `rpId` must be a registrable suffix of the page's effective domain. If the app is
  served at the **apex** (`example.com`) — even when profiles live on subdomains
  (`*.example.com`) — set `rpId = "example.com"` on **both** create and get. Drive it
  from one env var so the two ceremonies can't drift.
- Audit rule: grep for **both** `credentials.create` and `credentials.get` and confirm
  each sets the same rpId from the same source.

## 2. Buffer polyfill — Node harness passes, browser crashes

Bitcoin libraries (PSBT/tx builders, key libs) often reference Node's `Buffer`. Node test
harnesses have `Buffer` as a global, so **the harness passes**. The browser has no
`Buffer` → `ReferenceError: Buffer is not defined` → **blank page** on first import.

- Fix: install the `buffer` (and often `process`) packages and assign
  `globalThis.Buffer` in a tiny polyfill module that is imported **first** in the entry
  point (before anything that touches a bitcoin lib).
- Bundler caveat: a Vite "node polyfills" plugin may **not** inject the polyfill into
  source that's pulled in via a workspace alias / linked package (your own SDK source
  under `node_modules` symlink or `resolve.alias`). The manual `globalThis.Buffer = …`
  polyfill, imported first, is more reliable than relying on the plugin to reach aliased
  code.
- This class of bug is invisible to curl and to Node harnesses — only a **real browser**
  (or headless asserting `window.Buffer` + console-clean) catches it.

## 3. Ownership / resolution must hit the chain, not a leftover contract

When porting a wallet from one protocol to another (e.g. OPNet → Alkanes), the **sign-in
ownership check and the username resolve** both have to be repointed to the new chain.

- A leftover "does this key own this name?" call against the old contract (`ownerOf`-style)
  will fail or return stale data → sign-in **bounces** even though registration on the new
  chain succeeded.
- On Alkanes, ownership/resolve is a `metashrew_view` `simulate` read (resolve opcode),
  returning match / mismatch / unregistered. Make sign-in's gate and the resolver use the
  **same** on-chain read, so "I just registered" and "let me sign in" agree.

## Practical: a virtual authenticator in headless tests

Headless Chromium's WebAuthn virtual authenticator lets you script
register-then-sign-in and assert `rp.id` on both ceremonies + a clean console. That
catches #1 and #2 before a human ever taps Face ID — but note a **fresh** headless
context has no prior credential, so cross-session "returning user" assumptions still need
a real device.
