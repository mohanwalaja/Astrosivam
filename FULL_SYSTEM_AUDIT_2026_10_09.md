# ASTRO SIVAM — Full System Audit

**Date:** 9 October 2026
**Branch:** `arena/f3fb1103-astrosivam` (from `main` @ `32f249c`)
**Scope:** Everything — user safety, customer login, Google login, admin login,
astrology calculation & prediction accuracy, PDF generation, payments, web
design, deployment, tests, and general issues.
**Method:** Full source review of the React frontend (`src/`) and the PHP API
(`api/`), execution of the Node test suite (21 suites), production build,
served-site checks, dependency audit, and cross-checking against the two prior
audits (`LAUNCH_READINESS_AUDIT.md`, `ASTRO_SERVICES_ACCURACY_AND_SECURITY_AUDIT.md`).

---

## 0. Executive summary

| Area | Verdict |
|---|---|
| User login / registration / OTP / password reset | ✅ Strong |
| Google login | ✅ Strong (server-verified, no client-trust fallback) |
| Admin login / authorization | ✅ Strong (role-gated, CLI-only provisioning) |
| Brute-force / credential-stuffing protection | ✅ Strong (layered, fail-closed) |
| Payment system (Razorpay / PayPal / manual) | ✅ Strong (signature + provider re-verification) |
| Astrology calculation accuracy | ✅ Verified against Swiss Ephemeris, all tests pass |
| Prediction rule sets | ✅ Prior findings fixed; 1 documented tradition question (Vasya) |
| PDF generation & delivery | ✅ Good, **one open hole (finding A1)** |
| Web design / UX / SEO | ✅ Good; 2 performance/a11y items |
| Infrastructure / deployment | ✅ Good; composer.lock not pinned |
| Test suite | ✅ **223 assertions passing** (lockfiles fixed in this audit) |

**Bottom line:** the platform is in good shape. Authentication, payments and
the calculation engine are genuinely well-hardened — this audit re-verified
them by running the code, not by reading comments. There is **1 high-severity
finding** (the unauthenticated, unwatermarked `export-preview-pdf` endpoint),
**3 medium** (30-day tokens, weak password policy, unpinned composer deps),
and a handful of low items. Details and fixes in §10.

One fix was applied during this audit (§11): both lockfiles were drifted from
`package.json` (CI-breaking) and have been regenerated — the full test suite
now exits 0.

---

## 1. User login, registration & account safety

Verified in `api/auth/index.php`, `api/config.php`, `api/rate_limit.php`,
`src/context/AuthContext.tsx`, `src/services/api.ts`.

**What's right (all code-verified):**

- Passwords hashed with `password_hash()` (bcrypt, `PASSWORD_DEFAULT`); verified with `password_verify()`.
- Registration requires e-mail OTP verification (6-digit, `random_int`, stored
  as HMAC-SHA256 hash — raw OTP never persisted, 10-minute expiry, 5 tries,
  separate HMAC domain from password-reset codes so codes can't be replayed
  across flows).
- Password reset flow exists (15-minute expiry, 5 attempts burns the code,
  generic reply that never reveals whether an account exists, reset revokes
  **all** sessions via `token_version`).
- Session fixation prevented: `session_regenerate_id(true)` after every authentication.
- **Tokens:** HMAC-SHA256-signed bearer tokens; unsigned tokens are rejected
  outright (historical takeover vector removed); per-user `token_version`
  enables forced sign-out; expiry enforced; issued-at future-dating guard.
- **Token storage (H3):** the token is delivered as an `httpOnly`,
  `SameSite=Lax`, `Secure`-on-HTTPS cookie. The frontend keeps at most an
  in-memory copy and **purges legacy `localStorage` keys on every load** —
  nothing script-readable persists a credential.
- Identity is immutable (`usr_` id in tokens, never e-mail) so account
  deletion/reuse cannot resurrect old tokens.
- Every auth event (login, admin login, OTP verified, reset, revocation,
  provisioning) is written to `audit_logs` with the spoof-resistant client IP.
- Errors never leak driver/schema details (generic 503 message).
- DB access is PDO with **native** prepared statements
  (`PDO::ATTR_EMULATE_PREPARES => false`) everywhere; no string-interpolated SQL found.

**Rate limiting / brute force (all verified present and layered):**

| Bucket | Limit |
|---|---|
| login per account+IP | 5 / 15 min |
| login per IP | 25 / 15 min |
| failed credentials per IP per endpoint | 10 / 15 min |
| failed credentials per IP (all endpoints) | 20 / 15 min |
| failed credentials site-wide | 300 / 15 min |
| registration per IP / per email | 5 / 10 min, 3 / 15 min |
| OTP verify / resend | 10 & 5 per email, per-IP caps |
| password reset request / verify | 3 & 10 per email, per-IP caps |

Counters are keyed by HMAC of the identifier (no raw IPs/emails stored),
enforced **before** credential checks, and fail **closed** (503) if the DB is
unavailable. A successful login clears the lockout counter.

**IP handling:** `api/client_ip.php` honours `X-Forwarded-For` /
`CF-Connecting-IP` **only** when the direct TCP peer is loopback, RFC1918,
CGNAT or a published Cloudflare edge range — direct clients cannot spoof
their IP to escape rate limits or the free-beta ledger.

**Findings:** none new. Prior items S2 (reset/revocation) and S4
(localStorage token) are confirmed fixed.

---

## 2. Google login

Verified in `api/config.php::verifyGoogleLogin()`, `api/auth/index.php`
(Google route), `src/components/common/GoogleLoginButton.tsx`.

- The frontend sends **only** the Google access token / GSI ID-token; identity
  is never taken from client-supplied fields.
- The server resolves identity from `oauth2.googleapis.com/tokeninfo` (+
  `userinfo` for access tokens) with strict TLS, and requires:
  - audience (`aud`/`issued_to`) matches the configured `GOOGLE_CLIENT_ID`,
  - `azp` (authorized party) matches when present,
  - `email_verified == true`.
- No local JWT-decode fallback: a failed remote verification is a hard 401.
- Social sign-in is keyed on the immutable provider subject
  (`auth_provider` + `provider_subject` with a unique key), **not** on e-mail.
- Account linking is deliberately disabled: if the Google e-mail already
  belongs to an existing account the login returns 409 instead of merging —
  this blocks social-account takeover of password accounts.
- Administrator accounts cannot be reached via Google/Facebook login (403).
- Google login can be disabled from admin settings; an empty client ID
  disables the button cleanly with an explanatory dialog.
- Facebook login (same router) uses `debug_token` + `appsecret_proof` with
  app-id validation — equally sound.

**Findings:** none.

---

## 3. Admin login & admin authorization

Verified in `api/auth/index.php` (admin route), `api/admin/index.php`,
`api/provision_admin.php`, `src/components/admin/AdminLogin.tsx`.

- Admin portal uses a dedicated route (`admin-login`); the server checks the
  **persisted DB role** — client flags, e-mail addresses and settings can
  never grant admin.
- The old "standard password override" universal backdoor was removed
  (comment documents it); only the account's real bcrypt hash is accepted.
- Admin logins hit a separate, stricter rate-limit bucket
  (`admin-login` endpoint counter).
- Admins are created only by `api/provision_admin.php`, which is CLI-only
  (returns 404 over HTTP), requires a 12–72 char password, and refuses to
  promote an existing account without an explicit `--promote-existing` flag.
- Every admin router (`api/admin/index.php`, `orders.php`, `approve_order.php`,
  `family_docs.php`, incl. the direct-entry fallbacks) calls `requireAdmin()`
  before any logic; order endpoints additionally verify ownership where a
  customer could otherwise read another customer's order.
- Admin settings endpoint is admin-only; the public settings endpoint strips
  every secret (Razorpay/PayPal/Facebook secrets, webhook secrets, chat-alert
  tokens, SMTP password) before responding — verified field by field.
- Admin actions (approve/reject/refund/ban/revoke sessions) are audit-logged.

**Findings:** none.

---

## 4. Payments (Razorpay UPI/GPay, PayPal, M-PAiSA, MyCash)

Verified in `api/services/index.php`, `api/payments.php`, `api/payment_webhook.php`.

- Checkout uses a server-side **payment-intent** model: the amount is computed
  server-side from the price settings and bound to the authenticated user;
  intents expire, and are consumed atomically (race-safe `UPDATE ... WHERE
  status='CAPTURED' AND order_id IS NULL`).
- Razorpay: checkout signature verified with
  `hash_hmac('sha256', order_id|payment_id, keySecret)` + `hash_equals`, then
  **re-verified against the Razorpay API** (status=`captured`, order match,
  exact amount, currency INR).
- PayPal: server-side OAuth → order details/capture → status `COMPLETED` +
  exact amount + currency USD checks.
- Webhooks: Razorpay raw-body HMAC-SHA256 signature; PayPal
  `verify-webhook-signature` against PayPal itself. Unverifiable events are
  rejected and never change payment state; missing secrets make the endpoints
  fail closed (503). Events are deduplicated in `payment_webhook_events`.
- Amount mismatches produce `MISMATCH` (never captured).
- Currency rule is deterministic (`astro_currency_for_payment`): payment
  method decides FJD/INR/USD; birth-country never changes the charge currency.
- Manual (offline M-PAiSA/MyCash) orders stay `PENDING` until an admin
  verifies and approves — appropriate for the workflow.
- Verification endpoints are rate-limited per user and per IP.

**Findings:** none new.

---

## 5. Astrology calculations & prediction accuracy

This was verified empirically — the regression suites were executed in this
audit (Node side; PHP side runs in the GitHub Actions `tests.yml` workflow and
could not run in this sandbox because PHP is not installed here — see §12).

**Test results (executed 9 Oct 2026):** 21 suites, **223 assertions, all pass.**

Highlights of what the passing tests prove:

- **Graha longitudes** agree with an independent Swiss Ephemeris 2.10.03
  reference fixture (`SIDM_LAHIRI`, 30+ sample dates 1900–2050) within
  **0.02°** for all nine grahas; retrograde flags match exactly; Ketu is
  exactly 180° from Rahu.
- **Lahiri ayanamsa** matches SWE within 0.0001° (TRUE convention =
  mean + Δψ, same as Drik Panchang); MEAN value asserted separately so a
  convention swap can't slip through silently.
- **Ascendant** matches SWE within 0.01° (Greenwich J2000 reference).
- **Rahu/Ketu convention:** default MEAN node (classical, per B. V. Raman)
  matches `SE_MEAN_NODE` within 0.001°; TRUE node matches within 0.02°;
  the seven classical grahas are bit-identical between conventions; the report
  prints which node type produced the chart.
- **Vimshottari dasha** timeline boundaries are half-open and correct at the
  exact Mahadasha/Antardasha transition instants.
- **Porutham:** 10-porutham scoring incl. Vedha — a critical Vedha mismatch
  blocks a positive overall verdict (regression-tested); Rajju grouped
  correctly; Nadhi handling tested.
- **Dosha rules** (Kuja/Sevvay with the Tamil five-house rule 2/4/7/8/12 from
  Lagna, Moon and Venus; Kala Sarpa; Pitru; Guru-Chandala; combustion orbs)
  verified against classical references; **Node and PHP engines share the same
  rule set** (`KUJA_DOSHA_HOUSES = [2,4,7,8,12]` in both — prior audit finding
  F1 confirmed fixed), with a 1507-value parity corpus.
- **Muhurtham** astronomy regression passes; combustion orbs unified at
  10° for Venus across all modules (prior finding F6 confirmed fixed).
- **Panchangam yoga names** — index 15 prints "Siddhi" (prior finding F7 fixed).
- Timezone handling, birth-details validation, date-format rendering,
  nakshatra naming syllables, namakaran meanings (1186 curated meanings) —
  all covered by passing suites.

**Open accuracy item (carried, documented):** the **Vasya porutham table**
differs from at least one of two published Tamil tables on 5 of 12 rasis (the
published sources disagree with each other). It is self-consistent and the
porutham is weighted non-critical, but a pundit ruling is still recommended
before the next marriage-report batch (prior finding F3).

**Findings:** no new accuracy problems. Engine accuracy is the strongest part
of the codebase.

---

## 6. PDF generation & delivery

Two pipelines, both reviewed:

1. **Server-side (customer emails):** `AstroEngine::generateReportPdf()` →
   mPDF (`pdf_mpdf_reports.php`, 4.8k lines) with a full font kit
   (Noto Sans + Tamil + Devanagari + display faces, committed). Design is
   fail-closed: if mPDF or fonts are unavailable it throws — **no degraded
   fallback PDF is ever substituted**. Official order PDFs are rebuilt from
   saved service inputs (a cached result is never authoritative).
2. **Admin preview-exact pipeline:** html2canvas + jsPDF rendering of the same
   HTML shown in the preview, staged one-document-per-request
   (`api/admin/family_docs.php`) to survive `post_max_size` limits on shared
   hosting; staged files live under `api/storage/` with `Require all denied`
   + PHP-handler removal, and approval fails closed if any document is missing.

Delivery model is safe by design: **there is no public PDF download route**.
Reports and invoices are only e-mailed to the customer; the old
`orders/:id/pdf` customer endpoints were removed with a comment forbidding
their re-introduction. E-mail construction validates every address
(`FILTER_VALIDATE_EMAIL`) before MIME assembly — header injection blocked;
attachment filenames sanitised.

### ⚠️ Finding A1 (HIGH) — the one open hole

`POST /api/services/export-preview-pdf` (`api/services/index.php:1681`) is
**unauthenticated, unwatermarked and unrate-limited** on the PHP backend:

- Anyone can POST arbitrary `result` JSON and receive an official, fully
  branded ASTRO SIVAM PDF with **no SAMPLE/PREVIEW watermark** (the watermark
  exists only in the client-side preview HTML, not in the server renderer).
  This enables forged "paid" reports and brand abuse.
- mPDF rendering is CPU-heavy; without a rate limit it is an unauthenticated
  DoS lever.
- History: the prior audit fixed exactly this on the **Node** stack
  (`requireAuth` + watermark). The Node server has since been retired and the
  PHP-only route was never patched.
- Complication: the public "View Sample Report" flow (SampleReportButton →
  LivePdfPreviewModal → this endpoint) legitimately uses it anonymously, so it
  can't simply be locked behind login.

**Recommended fix (mirrors the old Node fix):** rate-limit the endpoint; for
unauthenticated callers, accept only the fixed sample payloads (or require
login); and render a visible `SAMPLE / PREVIEW` watermark in the mPDF view for
every export that is not an approved order. See §10, item A1.

---

## 7. Web design, UX, SEO

Verified by building (`vite build` — clean), serving the production bundle and
probing it, plus component review. TypeScript compiles with **zero errors**.

**Working well:**

- SEO: full meta set (description, keywords incl. Tamil/Hindi, canonical, OG,
  Twitter cards, JSON-LD-ready), `robots.txt`, `sitemap.xml`, cache-busted
  favicons, OG image present and served.
- All static assets (favicons, manifest, OG image) serve 200.
- Mobile input handling is deliberately excellent (text inputs with numeric
  keypads instead of native date/time pickers, iOS zoom prevention ≥16px,
  auto-formatting DOB entry — 30+ passing assertions).
- No `dangerouslySetInnerHTML` anywhere; the single `innerHTML` use is a
  static toast. External links use `rel="noreferrer"`.
- Dark/light theme, i18n (en/ta/hi), error boundary present.
- Production `.htaccess`: HSTS (1 year, includeSubDomains, preload),
  X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy and an
  allow-list CSP for the SPA.

**Design/UX findings:**

- **W1 (medium, performance):** the build produces one **3.48 MB JS chunk**
  (933 KB gzip). For the primary mobile audience (Fiji/India) this materially
  slows first load. Recommend code-splitting (route-level dynamic imports;
  admin portal, Leaflet, recharts, html2canvas/jsPDF are natural split points).
- **W2 (low):** 7 links use `target="_blank"` with `rel="noreferrer"` but no
  explicit `noopener` (modern browsers imply it; explicit is best practice).
  Files: `PaymentGatewayCheckoutBox.tsx` (×3), `Footer.tsx`, `ContactPage.tsx`,
  `GoogleSetupPanel.tsx`, `PaymentConfigPanel.tsx`.
- **W3 (info/UX):** `securityProtection.ts` blocks right-click, wipes the
  clipboard on PrintScreen and shows a "screenshots disabled" toast. This is
  security theatreatre — trivially bypassed, and it can annoy legitimate users
  (copying an order number, accessibility tools). It protects nothing real;
  consider removing the clipboard wipe at minimum.
- **W4 (info):** Google Fonts are loaded from `fonts.googleapis.com` —
  availability/privacy dependency on a third party; consider self-hosting.

---

## 8. Infrastructure, configuration & deployment

- No secrets in the repo (grep-scan for passwords/keys over `src/`, `api/`,
  `scripts/` found nothing; `.env.example` ships empty values; `.env*`
  ignored). `.gitignore` covers `.env`, `vendor/`, runtime signing keys, tmp.
- `APP_SECRET_KEY`: env-first; otherwise a 64-hex random key is generated and
  persisted `0600` under `api/astrology/tmp/` (HTTP-denied). No guessable
  fallback.
- CORS is allow-listed to `https://astrosivam.com` / `www`, with credentials;
  API responses carry a `default-src 'none'` CSP, `nosniff`, no-store where needed.
- `api/.htaccess`: blocks direct access to `config.php`/`db.php`, SQL/env/log/
  key files, vendor; JSON 404 fallback; auth-header passthrough for FastCGI.
- Diagnostics endpoint (`check_mpdf.php`) 404s unless
  `ASTROSIVAM_DIAGNOSTICS=1` — correct, but remember to keep it off in prod.
- `.cpanel.yml` deploy preserves the live `config.php` and signing key, sets
  sane permissions (640 config, 600 key).
- CI: `tests.yml` runs PHP lint + 15 PHP suites with mPDF on PHP 8.1;
  `build.yml` packages dist + api.

**Findings:**

- **I1 (medium):** `composer.lock` is **not committed** — `mpdf/mpdf: ^8.2`
  floats. CI and production installs can pick up different mPDF versions,
  which can change font/PDF behaviour between environments. Commit a
  `composer.lock` generated on PHP 8.1.
- **I2 (info):** CI uses `composer update || echo ...` style tolerance in
  `build.yml`, so a broken composer step won't fail the build.
- **I3 (info):** old audit docs reference the retired `server/` Node stack;
  `MANUAL_CHANGES_REVIEW_OCT_6_7.md` carries a historical note, but readers of
  `LAUNCH_READINESS_AUDIT.md` should know its "Node" remediations do not
  automatically apply to today's PHP-only deployment (A1 above is the proof).

---

## 9. Test suite status (executed in this audit)

| Suite group | Result |
|---|---|
| 21 Node/TS suites (`npm test`, 223 assertions) | ✅ **all pass** after lockfile fix |
| PHP suites (15 files) | ⏸ not runnable here (no PHP in sandbox) — run in CI (`tests.yml`) |
| Playwright browser PDF tests | ⏸ need browser binaries; run via `npm run test:pdf` in CI |
| `tsc --noEmit` | ✅ zero errors |
| `vite build` | ✅ clean (bundle-size warning, W1) |
| `npm audit` | ⚠️ 2 advisories — see D2 |

---

## 10. Issue register (prioritised)

| # | Sev | Area | Finding | Fix |
|---|---|---|---|---|
| **A1** | **HIGH** | PDF/API | `POST /api/services/export-preview-pdf` is unauthenticated, unwatermarked, unrate-limited → forgeable branded PDFs + CPU DoS (was fixed on the retired Node stack, never ported to PHP) | Rate-limit; require auth for non-sample payloads (or allow only the fixed sample result anonymously); stamp `SAMPLE/PREVIEW` watermark in the mPDF view for all non-order exports |
| **A2** | MEDIUM | Auth | Bearer/session token TTL is **30 days** in PHP (`createBearerToken` default) — prior audit S3, still open | Lower default to 7 days (`604800`); httpOnly cookie makes re-login cheap |
| **A3** | MEDIUM | Auth | Password policy is only 6–72 chars; no complexity, no common/breached-password check (admin provisioning already requires 12) — prior S1 | Raise to ≥10, reject top-10k common passwords, add strength hint in RegisterPage |
| **I1** | MEDIUM | Infra | `composer.lock` not committed (mPDF floats) | Generate + commit `composer.lock` on PHP 8.1; use `composer install` in CI |
| **W1** | MEDIUM | Web | Single 3.48 MB JS bundle (933 KB gzip) | Route-level code splitting (admin, Leaflet, recharts, PDF libs) |
| **D2** | LOW | Deps | `npm audit`: dompurify ≤3.4.15 (transitive via jspdf) + source-map-js ≤1.2.1 (build-time) | `npm audit fix`; bump jspdf if fix requires it |
| **W2** | LOW | Web | 7 × `target="_blank"` without explicit `noopener` | Add `noopener` to the `rel` list |
| **F3** | LOW | Accuracy | Vasya porutham table differs from one of two published Tamil sources on 5/12 rasis (sources disagree with each other) | Pundit ruling; document the chosen tradition in the report footer |
| **A4** | LOW | Auth | No CSRF token for cookie-authenticated writes. Mitigated: `SameSite=Lax` + every state change is POST (Lax blocks cross-site POST form CSRF) | Optional double-submit token if you ever add GET mutations |
| **W3** | INFO | UX | Right-click block / clipboard wipe is bypassable theatre and harms UX | Remove clipboard wipe; keep at most the console notice |
| **W4** | INFO | Web | Google Fonts fetched from third-party CDN | Self-host the 3 font families |
| **I2** | INFO | CI | `build.yml` tolerates composer failures (`|| echo`) | Fail the step |
| **L1** | INFO | Ops | Prior audit docs reference the retired Node `server/` stack | Add a historical-note header to `LAUNCH_READINESS_AUDIT.md` / `ASTRO_SERVICES_ACCURACY_AND_SECURITY_AUDIT.md` |

Known-and-accepted (not findings): the FREE_BETA one-per-IP limit is
bypassable by VPN (documented business decision); manual M-PAiSA/MyCash
payments rely on admin verification by design.

---

## 11. Fix applied during this audit

**Lockfile drift (was breaking `npm test` and could break `npm ci` in CI):**

- The committed `package-lock.json` still listed retired Node-server deps
  (`express`, `bcryptjs`, `nodemailer`, `@google/genai`, `msedge-tts`, `cors`,
  `dotenv`) and was missing declared runtime deps (`tz-lookup`,
  `@playwright/test`, …).
- `bun.lock` had drifted 19 packages from `package.json` (incl. `motion`
  major 12 → 14, `tailwindcss`, `lucide-react`).
- Regenerated both: `npm install` (package-lock.json) and `bun install`
  (bun.lock). **The full test suite now passes: exit 0, 223 assertions.**

No other code was changed; every other item is recorded in §10 for decision.

---

## 12. What could not be verified in this sandbox

1. **PHP runtime tests** (15 suites incl. PHP-engine accuracy vs SWE, mPDF
   rendering, mailer guards, rate-limit unit tests) — no PHP interpreter
   available here; they are wired to run in GitHub Actions `tests.yml`.
   Recommend checking the last CI run on `main`.
2. **Playwright browser PDF tests** — require browser binaries; run via
   `npm run test:pdf` where Chromium is available.
3. **Live production behaviour** (real SMTP, real Razorpay/PayPal keys,
   cPanel limits) — requires the production host.

---

## 13. Bottom line

- **User safety, login (customer / Google / admin): strong.** Signed tokens,
  httpOnly cookies, OTP-verified registration, layered brute-force budgets,
  server-verified social identity, role-gated admin, CLI-only admin
  provisioning, full audit logging. No injection, XSS, SSRF or open-redirect
  surface found.
- **Calculations and predictions: accurate and regression-proven** against an
  independent Swiss Ephemeris reference; prior prediction-layer findings are
  fixed; only the documented Vasya-table tradition question remains.
- **PDFs: high-quality, fail-closed pipeline** with one open endpoint (A1)
  that should be patched before anything else.
- **Everything else is hardening**, not firefighting: fix A1–A3 and I1, then
  treat the rest as normal backlog.
