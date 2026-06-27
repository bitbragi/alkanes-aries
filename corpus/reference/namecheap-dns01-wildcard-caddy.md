---
title: Wildcard TLS for *.subdomain apps — Namecheap DNS-01 on a custom Caddy build
source: reference
source_url: ""
---

# Wildcard TLS via Namecheap DNS-01 on Caddy

For an app that serves arbitrary subdomains (`*.example.com`, e.g. a per-name profile
renderer), one **wildcard certificate** beats per-subdomain on-demand TLS: no
per-subdomain issuance limit, one cert to manage. A wildcard cert **requires the DNS-01
challenge** — HTTP-01 cannot satisfy `*.example.com`. These are the sharp edges with
Namecheap as the DNS provider.

## DANGER: Namecheap setHosts REPLACES the entire record set

Namecheap's API has **no "add one record" call**. The only write is `setHosts`, which
**overwrites the domain's full host-record list**. An ACME integration has to:

1. `getHosts` (read all existing records),
2. **merge** in (or out) the single `_acme-challenge` TXT,
3. `setHosts` the **complete** set back.

A naive provider that writes only the challenge TXT will **wipe your A / MX / CNAME
records**. The maintained `libdns/namecheap` provider does the read-merge-write correctly
(its `AppendRecords`/`SetRecords`/`DeleteRecords` all `GetHosts → merge → setHosts`).
Even so:

- **Snapshot first.** Before the first issuance, do a read-only `getHosts` and save the
  exact record set (names, types, addresses, TTLs) so you can restore by hand if a write
  misbehaves.
- **Watch the records during the first issuance** — confirm your apex/wildcard A records
  are still present while the transient `_acme-challenge` TXT comes and goes.

## IP allowlist requirement

Namecheap's API requires **per-account IP whitelisting**. The machine making the API
calls (your server's public IP) must be added to the Namecheap API allowlist, **and**
passed to the provider as `client_ip`. Without both, every API call fails auth and the
challenge never even writes a TXT.

## Stock Caddy has no DNS providers — build a custom binary

`caddy:2` ships without DNS-provider modules. Build one with **xcaddy**:

- `xcaddy build --with github.com/caddy-dns/namecheap` (add a Go module `--replace` to a
  fork or a local path if you need a patched provider; a local-path replace lets you
  vendor the exact provider source into the build context, no module-proxy/private-repo
  auth needed).
- Multi-stage Dockerfile: `caddy:2-builder` (runs xcaddy) → copy the built binary into
  `caddy:2`.
- Confirm the module is present: `caddy list-modules | grep dns.providers.namecheap`.

Caddyfile (creds via env, never literals):

```
*.example.com {
    tls {
        dns namecheap {
            api_key {env.NAMECHEAP_API_KEY}
            user    {env.NAMECHEAP_API_USER}
            client_ip <your-whitelisted-server-ip>
        }
    }
    reverse_proxy your-app:PORT
}
example.com { ... apex, unchanged ... }
```

Load the env from a **gitignored** file (`--env-file`); never bake the API key into the
image or commit it. The Caddyfile must reference `{env.*}` only.

## Renewal flakiness: stale challenge TXTs + slow propagation

DNS-01 on a slow provider is racy, and the failures are distinct:

- **"No TXT record found"** — Caddy asked the CA to validate before Namecheap propagated
  the new TXT. Cause: too-short propagation wait + a high record TTL.
- **"Incorrect TXT record …"** — the CA's resolver served a **stale** value: a previous
  attempt's `_acme-challenge` TXT that hadn't expired (or accumulated alongside the new
  one).

Mitigations:

- In the `tls` block, set a **`propagation_delay`** (wait before asking the CA), a
  generous **`propagation_timeout`**, and explicit public **`resolvers`** so Caddy polls
  for the *correct* value before validation.
- Keep the challenge TXT **TTL low** so stale values expire fast.
- **Pre-renewal sweep:** failed attempts can leave several `_acme-challenge` TXTs behind.
  Periodically (or before a renewal window) `getHosts` and `setHosts` back **only your
  real records**, dropping every leftover `_acme-challenge` TXT. (This is the same
  read-merge-write pattern — include your A/MX/etc. so you don't wipe them.)

In practice issuance often **self-heals on retry** once propagation settles (Caddy keeps
retrying with backoff and eventually gets a production cert), but a renewal at an
inopportune moment is exactly when the stale-TXT pileup bites — hence the sweep.

## Don't break the apex during the swap

When you replace a running apex Caddy with the wildcard-capable build, the apex cert is
**persisted in the data volume** and is reused (no re-issue) across the container swap —
so the apex stays up while only the new `*.example.com` cert is issued fresh. Validate
the new Caddyfile (`caddy validate`) against the custom image **before** swapping the
live container.
