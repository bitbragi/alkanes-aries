---
title: Verification layers and their blind spots — Node harness vs curl vs headless vs returning browser
source: reference
source_url: ""
---

# Verification layers and their blind spots

When you build a web wallet on this stack, "I verified it" is meaningless without saying
**which layer** you verified at — because each layer is structurally blind to a different
class of bug. Several bugs in a single port (a `Buffer` crash, a WebAuthn rpId mismatch, a
service-worker stale shell) each slipped past one or two layers and were only caught by a
specific one. Be explicit about what you ran and what it cannot see.

## What each layer sees

| Layer | Good for | Structurally blind to |
|---|---|---|
| **Node test harness** | tx building, coin selection, signing, encoding, SDK logic; money-moving paths before you spend real sats | Browser-only globals (has `Buffer`, the browser doesn't); DOM/render; WebAuthn; service workers; real TLS |
| **curl** | server responses, status codes, headers, redirects, MIME types, TLS cert chain, JSON-RPC round-trips | All client JS; **bypasses any service worker**; no WebAuthn; no render |
| **Fresh headless browser** | JS execution, render, console errors, `Buffer`/polyfill presence, WebAuthn via virtual authenticator | **Returning-user state**: starts with no registered SW and no cache, so it can't reproduce stale-shell / cached-bundle bugs |
| **Returning browser / real device** | service-worker staleness, cached-shell after deploy, real passkey ceremonies across apex/subdomain | Slow, manual, hard to automate — but the only layer that catches the above |

## Concrete failure-to-layer mapping

- **`Buffer is not defined` (blank page):** Node harness **passes** (Node has `Buffer`);
  caught only by a **fresh headless** load asserting a clean console / `window.Buffer`.
- **WebAuthn rpId mismatch on sign-in:** unit tests pass; caught by a headless **virtual
  authenticator** scripting register-then-get and asserting `rp.id` on **both** ceremonies.
- **Service-worker stale shell:** curl and fresh headless both **bypass** it; caught only
  by a **returning** browser, or by the "**clear-site-data vs plain-refresh**" comparison.
- **Wrong TLS cert / missing security header / bad MIME fallback:** invisible to JS tests;
  caught by **curl** + `openssl s_client`.
- **Underpaid / non-standard tx rejected at broadcast:** construction looks fine in a
  harness; caught only when you actually **broadcast** (regtest node or gateway) and read
  back **confirmed** state.

## Operating rule

1. **tx-building / signing / money-moving** → Node harness first (cheap, before real sats).
2. **server / cert / headers / RPC** → curl + `openssl`.
3. **client crashes & render** → fresh headless, assert **console-clean**, not just HTTP 200.
4. **deploy/cache/SW + passkey-across-origins** → returning browser or an explicit
   pre-registered-SW headless test; never trust a fresh context here.

A "200 OK" from curl, a green Node suite, and a clean fresh-headless load can **all be
true while a returning user sees a blank page**. State which layer you used, and reach for
the layer that can actually see the bug class you're worried about.
