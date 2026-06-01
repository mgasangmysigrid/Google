# Cloudflare in front of MySigrid (production)

> **Status (June 2026): DEFERRED.** The app runs on Vercel at `app.mysigrid.com`,
> a subdomain of `mysigrid.com` whose DNS is hosted at GoDaddy (and which also
> serves the marketing site + company email). Putting Cloudflare in front on the
> free plan requires moving the **entire `mysigrid.com` zone** to Cloudflare
> (nameserver change at GoDaddy), which risks breaking email (MX/SPF/DKIM/DMARC)
> and the marketing site if any record fails to import. That risk is not worth it
> just to front the app for CASA, because **Vercel already provides** the
> network-layer controls a Tier 2 DAST scan checks: TLS 1.2/1.3, automatic HTTPS,
> HTTP/2+3, edge DDoS protection, and a global proxy. The app's own CSP/HSTS,
> rate limiting, and the other ASVS controls cover the rest.
>
> **The one real gap without Cloudflare:** the in-memory rate limiter
> (`lib/rate-limit.ts`) is per-instance and does not hold across Vercel's
> serverless invocations. The fix that does NOT require Cloudflare is to move the
> limiter to Upstash Redis (the `rateLimit()` signature stays the same). Do that
> if rate-limit robustness needs to be demonstrable.
>
> The steps below remain valid for **if/when** the whole zone is migrated to
> Cloudflare (the safe order is: export every GoDaddy record — especially
> MX/SPF/DKIM/DMARC — add the zone in Cloudflare, verify all records imported,
> THEN flip nameservers). They are not needed for the current CASA submission.

---

Putting Cloudflare in front of the production deployment satisfies a meaningful
chunk of the network-layer DAST checks (TLS, HSTS preload eligibility, DDoS
protection) and backstops the in-memory rate limiter (`lib/rate-limit.ts`), which
on its own does not hold across multiple instances / serverless invocations.

This is a hosting/DNS change — nothing in this repo needs to change to adopt it.

## 1. Add the site and proxy DNS

1. In the Cloudflare dashboard, **Add a site** for `mysigrid.com` (or the app's
   apex/subdomain) and update the nameservers at your registrar to Cloudflare's.
2. For the app hostname (e.g. `app.mysigrid.com`), create the DNS record pointing
   at your origin (Vercel/host) and set it to **Proxied** (orange cloud). Proxied
   is what routes traffic through Cloudflare's edge — a grey-cloud / DNS-only
   record gets you none of the protection.

## 2. TLS / HTTPS

- **SSL/TLS → Overview**: set encryption mode to **Full (strict)** so the
  Cloudflare↔origin hop is also TLS-verified (not just the browser↔Cloudflare hop).
- **SSL/TLS → Edge Certificates**:
  - Enable **Always Use HTTPS**.
  - Enable **Automatic HTTPS Rewrites**.
  - Set **Minimum TLS Version** to **1.2** (1.3 if your clients allow it).
  - The app already sends an HSTS header (`Strict-Transport-Security`,
    `next.config.ts`). You can also enable HSTS at the edge — keep the
    `max-age`, `includeSubDomains`, and `preload` values consistent with the app
    so they don't conflict. Only submit to the HSTS preload list once you're
    confident every subdomain is HTTPS-only.

## 3. Rate limiting (the rate-limiter backstop)

The app rate-limits login and email-send per IP/user in memory. Add **edge** rate
limiting so the limit holds regardless of how many app instances run.

**Security → WAF → Rate limiting rules** — create rules such as:

- **Login abuse**
  - When incoming requests match: `URI Path` equals `/api/auth/callback/credentials`
    (the NextAuth credentials endpoint)
  - Rate: **10 requests per 1 minute** per client IP
  - Action: **Block** for 1 minute (or Managed Challenge)

- **Email-send abuse**
  - When incoming requests match: `URI Path` equals `/api/communications/email`
    AND `Request Method` equals `POST`
  - Rate: **20 requests per 1 minute** per client IP
  - Action: **Block** for 1 minute

These mirror the in-app limits (`login` 10/min, `email-send` 20/min) so behavior
is consistent whether a request is stopped at the edge or in the app.

> Note: the in-app limiter keys email-send by **user id**, while a Cloudflare rule
> keys by **IP**. They are complementary, not identical — keep both. (For exact
> multi-instance parity in-app, move `lib/rate-limit.ts` to Redis/Upstash; see §6.)

## 4. WAF managed rules

**Security → WAF → Managed rules**: enable the **Cloudflare Managed Ruleset** (and
the OWASP Core Ruleset at a sensible paranoia level). Run in **Log** mode briefly,
confirm no false positives against the app's own API calls, then switch to
**Block**. This covers a range of generic injection/scanning patterns a DAST scan
probes for.

## 5. Bot / general hardening

- **Security → Bots**: enable Bot Fight Mode (or Super Bot Fight Mode on paid
  plans) to deflect automated credential-stuffing.
- **Network**: leave HTTP/2 + HTTP/3 on.
- Make sure no Cloudflare feature strips the app's security headers. If you add
  **Transform Rules** for headers, don't duplicate/contradict the CSP — the app
  sets a per-request nonce CSP in `middleware.ts`, which Cloudflare must pass
  through untouched.

## 6. Multi-instance rate limiting (only if you scale out)

If production runs more than one instance (or serverless), the in-memory limiter
in `lib/rate-limit.ts` is per-instance. Two options:

1. **Rely on the Cloudflare edge rules above** for the abuse-sensitive paths
   (login, email-send). Simplest; usually sufficient.
2. **Swap the limiter for a shared store** (Upstash Redis) — the public
   `rateLimit()` signature is designed to stay the same; only the `buckets` Map
   implementation changes.

## 7. Verify

After cutover:
- `curl -sI https://app.mysigrid.com` → confirm Cloudflare headers (`server: cloudflare`,
  `cf-ray`) and that the app's security headers (HSTS, CSP, `X-Content-Type-Options`,
  `X-Frame-Options`) are still present.
- Hit the login endpoint >10x/min from one IP and confirm a 429/block.
- Confirm the OAuth callback (`/api/communications/google/callback`) and Gmail flows
  still work end-to-end through the proxy.
