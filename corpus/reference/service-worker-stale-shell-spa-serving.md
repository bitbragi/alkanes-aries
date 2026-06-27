---
title: The service-worker stale-shell trap + SPA deep-link serving and cache hygiene
source: reference
source_url: ""
---

# The service-worker stale-shell trap (and SPA serving hygiene)

A cache-first service worker (SW) is the single nastiest "works for me" bug when shipping
a single-page app: after a deploy, returning users keep getting the **old** app shell
(`index.html` + references to bundles that no longer exist), so they see a blank page or
a MIME error, while every test you run looks fine.

## Why your tests can't see it

- **curl** fetches over HTTP and **bypasses the SW entirely** — it always gets the fresh
  server bytes. It structurally cannot reproduce a stale-shell bug.
- A **fresh headless browser** starts with **no registered SW and no cache**, so its
  first load also bypasses the stale shell. It can't reproduce it either.
- Only a **returning browser** — one that previously registered the SW — carries the
  stale shell. That's the real user, and often the only repro.
- A **hard refresh** bypasses the SW for *that one load* (so it "works", which is
  misleading) but does **not unregister** the SW — the next normal navigation is stale
  again. The clean diagnostic: if **"Clear site data" → normal refresh works** but a
  plain refresh doesn't, the SW + cached shell is the culprit.

## The fix: a self-unregistering kill-switch SW

You can't just delete the SW file — returning browsers keep running the **installed**
copy until they fetch a new one at the same URL/scope. Ship a kill-switch at the **same
SW path**:

- `install`: `self.skipWaiting()`.
- `activate`: delete **all** caches, `self.registration.unregister()`, `clients.claim()`,
  then navigate/reload open clients.
- **No `fetch` handler** — so nothing is served from cache.
- Separately, **remove the SW registration** from the app so a fresh visitor never
  installs one again.

Returning browsers fetch the kill-switch (SW byte-diff check), run `activate`, wipe their
caches, unregister, and reload onto the live shell. Verify with a headless test that
pre-registers a dummy SW, loads the page, and asserts the SW is gone + caches empty.

## SPA deep-link serving (the "MIME text/html" signature)

Two server/build settings prevent a related blank-on-refresh:

- **Absolute base path.** Build the SPA with an absolute base (`base: '/'` in Vite) so
  hashed asset URLs are `/assets/x.js`, not relative to a deep path like `/wallet/`. With
  a relative base, refreshing a deep link requests `/wallet/assets/x.js`, which 404s.
- **404 for missing assets — never an index.html fallback.** The classic console error
  **"Expected a JavaScript module but the server responded with a MIME type of
  text/html"** means the server returned `index.html` (HTML) for a `.js` request. Make the
  SPA fallback apply **only to navigations**, and let genuine missing static-asset
  requests **404** so a wrong/stale bundle URL fails loudly instead of being papered over
  with HTML.

## Cache headers for an SPA on a static host / reverse proxy

- `index.html` → `Cache-Control: no-cache` (must revalidate every load) so a deploy is
  picked up immediately.
- Content-hashed assets (`/assets/*`) → `immutable, max-age=31536000` (safe forever; the
  hash changes when content changes).
- Missing static assets → **404**, not the HTML shell (see above).

Hashed-immutable + html-no-cache + 404-not-fallback is the combination that makes a
normal refresh always land on the current build — and removes the temptation to "fix"
deploys with a cache-first SW in the first place.
