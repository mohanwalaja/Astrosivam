# ASTRO SIVAM — Auth & session security hardening (H1 / H2 / H3)

Remediation for the three high-priority findings of the October 2026 pentest:

| # | Finding | Fix |
| --- | --- | --- |
| H1 | Rate limiter keyed per account, not per IP → unlimited credential stuffing (one IP could walk thousands of accounts) | Failed-credential budgets: per-IP-per-endpoint **and** per-IP **and** site-wide global cap |
| H2 | No `Content-Security-Policy` header on `/` while the SPA renders user-controlled content | Enforcing CSP on the SPA document (Apache) and a strict `default-src 'none'` CSP on every API response |
| H3 | Auth tokens persisted in `localStorage` (script-readable 30-day credentials) | Tokens now live in an **httpOnly, SameSite=Lax, Secure** cookie; `localStorage` is purged |

---

## H1 — Credential stuffing: failed-credential budgets

**Before.** `login-pair` (5/15 min per IP+email) stopped an attacker who kept guessing one account, but six *different* emails from the same IP returned `401 401 401 401 401 401` with no throttling signal. The only per-IP control (`login-ip`, 25 attempts/15 min) counted requests, not failures, and nothing bounded the *total* volume of failed guesses.

**After** (`api/rate_limit.php`, wired in `api/auth/index.php`):

Every **failed** credential check — wrong password, unknown account, wrong email OTP, rejected Google/Facebook token — is recorded into three counters, and those counters are enforced *before* the next credential is evaluated:

| Counter | Budget (default) | Scope |
| --- | --- | --- |
| `auth-fail-ip-endpoint` | 10 failures / 15 min | per IP, per auth endpoint (`login`, `admin-login`, `google-login`, `facebook-login`, `otp-verify`) |
| `auth-fail-ip` | 20 failures / 15 min | per IP, across all auth endpoints |
| `auth-fail-global` | 300 failures / 15 min | site-wide |

* Only failures count — a valid sign-in never consumes the budget, and a successful password login still clears the `login-pair` counter.
* The previous layers (`login-pair`, `login-ip`, `register-*`, `otp-*`) remain in place; this is strictly additive.
* Counter identifiers stay HMAC-hashed (no raw IP/e-mail is stored), the limiter fails **closed** (503) if the database is unreachable, and exceeded budgets answer `429` + `Retry-After`.
* Tunables: `AUTH_FAIL_LIMIT_ENDPOINT`, `AUTH_FAIL_LIMIT_IP`, `AUTH_FAIL_LIMIT_GLOBAL`, `AUTH_FAIL_WINDOW_SECONDS`.
* Trade-off (accepted): while a stuffing wave is in progress, the global cap briefly slows legitimate sign-ins too. The defaults are chosen so ordinary traffic never sees it.

Pure decision maths (`astro_rate_limit_failure_gate`) and the budget/env handling are unit-tested in `tests/rate-limit.test.php`.

## H2 — Content-Security-Policy

**Before.** `public/.htaccess` set HSTS, `X-Frame-Options` and friends, but no CSP — so any XSS in the SPA (which renders user-controlled names, messages and order data) had full capabilities.

**After:**

* `public/.htaccess` now sends an enforcing `Content-Security-Policy` on every document response (this is the header the finding verified as absent on `/`; both `deploy_cpanel.sh` and `create_dist_zip.py` ship this file as the root `.htaccess`). The policy allows exactly what the app uses:
  * `script-src 'self'` + Google Sign-In (`accounts.google.com`) + Razorpay checkout (`checkout.razorpay.com`)
  * `style-src 'self' 'unsafe-inline'` + Google Fonts CSS (inline styles are used pervasively by React and the report HTML previews)
  * `font-src` Google Fonts files + `data:`; `img-src` self/data/blob/https (map tiles, provider logos, exports)
  * `connect-src` `/api` (self) + Google sign-in + Razorpay + the Leaflet geocoders (`nominatim.openstreetmap.org`, `photon.komoot.io`)
  * `frame-src` the PDF preview iframes (`blob:`/`srcdoc`) + Google/Razorpay payment frames
  * `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`, `upgrade-insecure-requests`
  * The JSON-LD block in `<head>` is a non-executable data block and is unaffected by `script-src`.
* Every PHP API response (`api/config.php`, `api/index.php`, `api/404.php`) additionally carries `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` — under `/api` injected markup can do nothing at all.

**Ops note:** if the SPA starts loading a new third-party origin (script, font, image host, API or frame), it must be added to the policy in `public/.htaccess` — the browser console will name the blocked origin.

## H3 — Session tokens out of `localStorage`

**Before.** `src/services/api.ts` persisted the signed bearer token under `astrosivam_token` (and legacy key names) in `localStorage`. Any XSS anywhere could read a 30-day credential and exfiltrate it.

**After:**

* **Server** (`api/config.php`, `api/auth/index.php`): login, e-mail-OTP verification and social sign-in now deliver the signed token via `astro_issue_auth_token()`, which sets it as an **httpOnly, SameSite=Lax, Secure-on-HTTPS** cookie (`astrosivam_auth`, 30-day expiry matching the token TTL). Logout clears it. `extractBearerToken()` accepts the cookie transparently, so `requireAuth()`/`requireAdmin()` and every download/new-tab navigation work with zero client changes. The `Authorization` header path is kept for non-browser API clients (an explicit header always wins).
* **Client** (`src/services/api.ts`): the token is kept **in memory only** for the header fallback and is never written to any web storage. Every load and auth transition **purges** the legacy `localStorage` keys, so tokens persisted by older releases die on the first page view after deploy.
* **Session restore** (`src/context/AuthContext.tsx`): a reload now asks `GET /api/auth/me` (the cookie is attached automatically) instead of inspecting stored tokens. `refreshSettings()` recognises a cookie-restored session via a synchronous `userRef`.
* SameSite=Lax keeps classic CSRF POSTs off the table (cross-site POSTs carry no cookie); CORS remains restricted to the site's own origins with credentials enabled.

**Rollout note:** existing users are signed out once when this deploys (their old `localStorage` token is purged and no cookie exists yet). They simply sign in again and receive the httpOnly cookie.

## Files touched

* `api/rate_limit.php` — failure gates/buckets, shared counter helpers
* `api/auth/index.php` — gate/record wiring, cookie issuance & clearing
* `api/config.php` — httpOnly cookie helpers, cookie auth fallback, API CSP
* `api/index.php`, `api/404.php` — API CSP on the standalone routers
* `public/.htaccess` — enforcing CSP for the SPA
* `src/services/api.ts`, `src/context/AuthContext.tsx` — memory-only token, cookie session restore, legacy purge
* `tests/rate-limit.test.php`, `tests/browser/*.spec.ts` — regression coverage
* `RATE_LIMITING_AND_PAYMENT_RECOVERY.md` — operator documentation for the new budgets
