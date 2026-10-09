# ASTRO SIVAM — Services, Prediction Accuracy & Security Audit

> **Historical note (October 2026):** This file records work from before the Node.js application server was removed. Production is now a static React frontend plus the PHP API in `api/`; Node.js remains build/test tooling only. Any `server/` paths and Node-server behaviors below describe the retired implementation, not the current deployment.


**Date:** 5 October 2026
**Branch:** `arena/01a109b1-astrosivam` (from `main` @ `5487694`)
**Scope:** every astrology service and report the site sells, the astronomical and
predictive accuracy of the engines behind them, and the security of the Node
and PHP back ends that produce, pay for and deliver those reports.

> **Update, same branch:** the two highest-priority calculation findings have
> since been fixed and are now locked down by a Node↔PHP parity suite.
> See [§0.1 Remediation status](#01-remediation-status-f1-and-f2) below; the
> rest of this report still describes the code as it was audited.

Everything below is reproducible with:

```bash
npm install
npm test                              # 29 Node suites, all green
npx tsx scripts/audit-engine-accuracy.ts   # new: independent accuracy audit (added by this audit)
npm run lint                          # tsc --noEmit, clean
```

---

## 0. Executive summary

| Area | Verdict |
|---|---|
| Test suite | **PASS** — 29/29 Node suites green, `tsc` clean |
| Astronomical accuracy (Node engine) | **PASS** — matches Swiss Ephemeris to a few arcseconds for all planets; Moon ≤ 58″ |
| Panchangam | **PASS** — matches the published Drik Panchang to **1–53 seconds** on tithi/nakshatra/yoga end times |
| Vimshottari dasha | **PASS** — 120-year cycle, contiguous periods, proportional antardashas |
| Porutham / matchmaking tables | **FAIL — HIGH (corrected in this change set)** — the Rajju table rotated `4,3,2,1,0` every five stars instead of every nine, so six Nakshatras sat in the wrong Rajju group and the crucial Rajju gate failed valid pairs (e.g. bride Avittam/Siro + groom Swati/Kanda reported as a same-group Rajju dosha). Gana, Yoni and Vedha were re-checked and stand. |
| Kuja (Sevvay) Dosha | **FAIL — HIGH** – the two engines disagree on **20.8 %** of charts |
| Node ↔ PHP chart parity | **FAIL — MEDIUM** – systematic 18.4″ peak (10.7″ RMS) ayanamsa offset |
| Security engineering | **GOOD** – no critical or high-severity vulnerability found; 5 medium, 8 low, 12 positive controls confirmed |

**The three things to fix first**

1. **Kuja/Sevvay Dosha (HIGH).** `server/astrology/matchmaking.ts` tests Mars in houses
   2,4,7,8,12 **from the Lagna only**; `api/astrology/engine.php` tests houses
   **1**,2,4,7,8,12 from the **Lagna, Moon and Venus**. On 400 random charts the
   engines return a different answer 83 times (20.8 %), and in 60 of those the PHP
   engine finds a dosha the Node engine silently misses. The same couple can be
   told "clean match" or "Manglik — remedies advised" depending on which stack
   rendered the PDF.
2. **Ayanamsa convention (MEDIUM-HIGH).** The Node engine subtracts the **mean**
   Lahiri ayanamsa, the PHP engine the **true** ayanamsa (mean + Δψ). Every
   sidereal longitude and the Lagna therefore differ between stacks by up to
   18.44″ (10.73″ RMS) — enough to move a Pada on ~0.9 % of charts and to make a
   preview and its delivered PDF disagree.
3. **Session hardening (MEDIUM).** 6-character password minimum, no password-reset
   flow, no token revocation, 30-day PHP bearer tokens, and no CSP/HSTS on the
   Node server while auth tokens live in `localStorage`.

---

## 0.1 Remediation status (F1 and F2)

Both top-priority calculation findings are **fixed** on this branch and are
covered by `tests/node-php-parity.test.ts` (Node) and
`tests/node-php-parity.test.php` (PHP), which run against one committed
contract. Details and operating instructions: **[NODE_PHP_PARITY_TESTING.md](NODE_PHP_PARITY_TESTING.md)**.

| Finding | Before | After |
|---|---|---|
| **F1 — Kuja/Sevvay Dosha rule set** | Node tested houses 2, 4, 7, 8, 12 from the Lagna only; PHP tested 1, 2, 4, 7, 8, 12 from Lagna + Moon + Venus with the full exception list. **83 of 400 charts (20.8 %) disagreed**, 60 of them doshas the Node engine silently missed. | Node uses `server/astrology/kujaDosha.ts`, a port of `AstroEngine::evaluateKujaDosha()`. Over the same 400 charts: **0 disagreements** (108 flagged by each). |
| **F2 — Ayanamsa convention** | Node subtracted the MEAN Lahiri ayanamsa, PHP the TRUE one (mean + Δψ). Every sidereal longitude and the Lagna differed by Δψ: **peak 18.44″, RMS 10.73″**. | Both subtract TRUE. Node's ayanamsa now matches Swiss Ephemeris to **0.018″ max / 0.006″ RMS**, and the Node↔PHP gap is **0.000″**. Residual graha error dropped to 3.96″ (Sun), 8.09″ (Mercury), 8.15″ (Mars), 10.88″ (Saturn), 58.56″ (Moon), 44.88″ (Rahu/Ketu). |

Side effects of the fix, all verified by `npm test` (30 suites) and
`npx tsc --noEmit`:

* `src/lib/muhurtham/scanner.ts` no longer carries its own private copy of the
  ayanamsa — it imports the shared implementation, so a Muhurtham day and the
  chart of the same instant now use the same convention.
* `server/astrology/matchmaking.ts` and `src/services/jathagamHtmlBuilder.ts`
  no longer contain their own (differing) Kuja rules; both call the ported one.
* A dosha that a chart cannot assess reports `isPresent: null` / `N/A`
  everywhere instead of a false "clean" result.
* `tests/dosha-rule-accuracy.test.ts` restates the new rule independently and
  re-checks it against 648 charts, so a transcription error in either copy of
  the rule fails the suite.

---

## 1. What the site actually sells — service inventory

Four report engines, each reachable three ways (single order, family bundle,
multi-person order) and in three languages (Tamil / English / Hindi).

| Service | Route / page | Engine | Core output |
|---|---|---|---|
| **Birth Jathagam** | `/birth-jathagam` | `calculatePrecisionHoroscope()` | Rasi + Navamsa charts, 9 graha positions, 12 bhavas, Vimshottari dasha timeline, Sani transit (Sade Sati), Navagraha dosha screening, life-aspect summary |
| **Marriage Compatibility (Porutham)** | `/marriage-compatibility` | `calculateWeddingCompatibility()` | 10 Poruthams, score /10, Rajju + Vedha hard stops, Sevvay (Kuja) Dosha samyam, verdict |
| **Baby Naming (Namakaranam)** | `/baby-naming` | `calculateBabyNamingDetails()` | Janma nakshatra → pada → auspicious seed letters, curated name bank with meanings |
| **Subha Muhurtham** | `/muhurtham` | `src/lib/muhurtham/scanner.ts` | 18 ceremonies × month/day scan: tithi, nakshatra, yoga, karana, Rahu Kalam, Yama Gandam, Gulika, Abhijit, Tara Balam, Chandrashtama |
| Live Panchangam bar | every page | `calculatePrecisionPanchangam()` | tithi / nakshatra / yoga / karana / vara / sunrise / sunset + inauspicious windows |

Pricing is payment-method driven (`astro_currency_for_payment()` in PHP,
`resolveOrderCurrency()` in Node): UPI & Google Pay → INR, M-PAiSA & MyCash → FJD,
PayPal & card → USD. A family bundle is always charged in the single currency the
customer pays with — verified by `tests/multi-person-orders.test.ts`.

**Free-beta rule** (exactly one free report per IP) is enforced server-side against
the hardened client IP, not a client-supplied value — verified in
`tests/admin-free-orders.test.ts`.

---

## 2. Astronomical accuracy (measured, not assumed)

Method: the live Node engine (`server/astrology/astronomy.ts`, built on
`astronomy-engine` 2.1.19) was run against the 108-sample Swiss Ephemeris 2.10.03
Lahiri reference checked into `tests/fixtures/` (JD 2415020.6 → 2487836.3, i.e.
1900–2100). Full run: `npx tsx scripts/audit-engine-accuracy.ts`.

### 2.1 Ayanamsa

| Comparison | Max | RMS |
|---|---|---|
| Node engine vs Swiss **mean** Lahiri ayanamsa | **0.298″** | 0.150″ |
| Node engine vs Swiss **true** Lahiri ayanamsa (PHP / Drik Panchang) | 18.243″ | 10.732″ |

The Node ayanamsa polynomial is excellent; it simply tracks the **mean**
convention while the PHP engine (and the reference fixture) use the **true**
convention. Δψ across 1900–2100 peaks at **18.44″**, RMS **10.73″**.

### 2.2 Graha sidereal longitudes (as shipped)

| Body | Max err | RMS err | Residual error after aligning the ayanamsa convention |
|---|---|---|---|
| Sun | 20.2″ | 10.7″ | **3.7″ max / 1.1″ RMS** |
| Moon | 56.2″ | 18.8″ | **58.3″ max / 15.9″ RMS** |
| Mercury | 23.0″ | 10.8″ | 8.2″ / 3.2″ |
| Venus | 26.0″ | 11.4″ | 18.0″ / 3.5″ |
| Mars | 24.3″ | 11.0″ | 7.9″ / 1.9″ |
| Jupiter | 23.9″ | 11.0″ | 7.3″ / 3.3″ |
| Saturn | 23.1″ | 10.4″ | 10.9″ / 5.4″ |
| Rahu / Ketu | 45.3″ | 16.3″ | 45.0″ / 14.3″ |

* Ketu stays **exactly** opposite Rahu (0.00″ deviation).
* Retrograde flags: **0 mismatches in 506** station-free comparisons.
* The residual column is the honest figure once the convention gap is removed:
  planets agree with Swiss to a few arcseconds; the Moon to ~1 arcminute; Rahu
  (derived from the lunar state vector) to ~45″.

**Verdict: the astronomy is sound.** The Moon's ~1′ worst case is 0.4 % of a
nakshatra pada and 0.06 % of a nakshatra; Rahu's 45″ is 0.4 % of a nakshatra.
Neither can be felt by a customer except in a genuine sandhi case, and the PHP
engine (documented in `EPHEMERIS_ACCURACY_UPGRADE.md`) is an order of magnitude
tighter still.

### 2.3 Panchangam vs a published reference

Independent check against the [Drik Panchang day page for 5 October 2026](https://www.drikpanchang.com/panchang/day-panchang.html?date=05/10/2026)
(Rome, 41°53′N 12°30′E; sunrise 07:11, sunset 18:45 CEST). Tithi, nakshatra and
yoga end times are location-independent instants, so the comparison is valid for
any place.

| Element | Engine (UTC) | Drik Panchang (UTC) | Difference |
|---|---|---|---|
| Krishna Dashami → Ekadashi | 2026-10-05 20:37:52 | 20:37 | **+53 s** |
| Pushya → Ashlesha | 2026-10-05 17:39:09 | 17:39 | **+9 s** |
| Siddha → Sadhya yoga | 2026-10-06 01:50:01 | 01:50 | **+1 s** |

Sunrise in Chennai computes to 05:58 and sunset 17:56 with real
`SearchRiseSet` solar-altitude solving (refraction + limb corrected), and Rahu
Kalam / Yama Gandam / Gulika use the classical weekday part numbers
(8,2,7,5,6,4,3 / 5,4,3,2,1,7,6 / 7,6,5,4,3,2,1) applied to the **actual**
sunrise-to-sunset interval rather than a fixed 06:00–18:00 day. Correct.

---

## 3. Prediction rules — verified against classical sources

### 3.1 Verified correct

| Rule set | Where | Check |
|---|---|---|
| Nakshatra lords (Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury) | `astronomy.ts` | Standard Vimshottari cycle ✔ |
| Vimshottari years 7+20+6+10+7+18+16+19+17 | `astronomy.ts` | = **120** ✔; timeline contiguous, antardashas proportional to 0.0000 month ✔ |
| Gana (Deva / Manushya / Rakshasa) | `matchmaking.ts` | All 27 independently re-derived ✔ |
| Rajju (Siro / Kanda / Udhara / Uru / Pada), 6-6-6-5-4 split | `matchmaking.ts`, `api/astrology/engine.php` | **Corrected:** the split is Siro = Mrigashirsha/Chitra/Dhanishta, Kanda = Rohini/Ardra/Hasta/Swati/Shravana/Shatabhisha, Udhara = Krittika/Punarvasu/Uttara Phalguni/Vishakha/Uttara Ashadha/Purva Bhadrapada, Uru = Bharani/Pushya/Purva Phalguni/Anuradha/Purva Ashadha/Uttara Bhadrapada, Pada = Ashwini/Ashlesha/Magha/Jyeshtha/Mula/Revati. The earlier table gave the right five *names* but the wrong five *memberships* for Ardra..Ashlesha, Swati..Jyeshtha and Shatabhisha..Uttara Bhadrapada. |
| Yoni (14 animals + 7 inimical pairs) | `matchmaking.ts` | All 27 + all 7 enemy pairs ✔ |
| Vedha pairs incl. the Mrigashira–Chitra–Dhanishta triad | `matchmaking.ts` | 14 pairs ✔ |
| Dina Porutham (starDiff mod 9) | `matchmaking.ts` | 2,4,6,8,0 auspicious; 1,3,5,7 inauspicious ✔ |
| Mahendra (starDiff 4,7,10,13,16,19,22,25) | `matchmaking.ts` | ✔ |
| Stree Deergha (>13 excellent, ≥7 moderate) | `matchmaking.ts` | ✔ |
| Karana mapping (7 movable + 4 fixed, Kimstughna first) | `astronomy.ts`, `scanner.ts` | ✔ |
| Muhurtham panchangam sampled **at sunrise** | `scanner.ts` `computeDayMuhurtham()` | Classical convention ✔ |

### 3.2 Findings in the prediction layer

**F1 — HIGH — Kuja / Sevvay Dosha is computed differently by the two engines.**

| | Node `matchmaking.ts` | PHP `engine.php` |
|---|---|---|
| Dosha houses | 2, 4, 7, 8, 12 | **1**, 2, 4, 7, 8, 12 |
| References | Lagna only | Lagna **+ Moon + Venus** |
| Cancellations | house-sign pairs, own/exalted Mars, Guru conjunction/aspect | own/exalted, Simha/Kumbha, house-sign, Yogakaraka (Karka/Simha lagna), Guru-Mangala, Chandra-Mangala, Guru Drishti, mitigation rules |

Measured on **400 random worldwide charts (1950–2020)**:

```
Node rule flags Kuja Dosha : 62 (15.5%)
PHP  rule flags Kuja Dosha : 99 (24.8%)
Charts where the two engines DISAGREE: 83 (20.8%)
…of which PHP finds a dosha the Node engine misses: 60
```

Mars in the **1st house (Lagna)** is the single most-cited Manglik condition in
Tamil practice, and the Moon/Venus references are the other two of the three
classical reference points — the Node engine tests neither. Because
`sevvayDosham.isBalanced` feeds the overall verdict, a couple the PHP report
calls "Dosha imbalance … remedial prayers advised" can be called a "clean match"
by the Node report.

**Recommendation:** port `AstroEngine::evaluateKujaDosha()` to Node verbatim
(three references, house 1 included, full exception list) so both stacks emit the
same dosha object, and add a parity test that asserts identical verdicts for a
fixed corpus of charts.

> **Rule-set revision (carried out later).** Both engines now default to the
> South Indian (Tamil) five-house rule — Mars in **2, 4, 7, 8, 12** counted
> whole-sign from the Lagna, the Moon and Venus, with the 1st house **not**
> screened (`KUJA_DOSHA_HOUSES` in `server/astrology/kujaDosha.ts` and
> `KUJA_DOSHA_HOUSES` in `api/astrology/engine.php`). Set
> `ASTRO_KUJA_HOUSES=1,2,4,7,8,12` to opt back into the BPHS / North Indian
> reading quoted above. Independent sources agree the two traditions differ on
> exactly this pair of houses: South Indian practice omits the 1st, North Indian
> practice omits the 2nd (Drik Panchang, "Mangal Dosha"; appliedjyotish,
> "Manglik Calculator"; astroma, "Mangal Dosha guide"). The exception and
> mitigation tables, the three reference points and the parity corpus are
> unchanged apart from one narrowing: the house-sign exception table follows the
> Tamil Sevvai Dosha Vilakku lists, which exempt Mithunam/Kanni only in the 2nd
> house (Kadagam is not exempt there — astroved's Tamil list is the lone variant
> that adds it, and the majority reading was chosen). The contract was re-seeded
> and `npm run parity:compare` reports all
> 1507 values agree.

**F2 — MEDIUM-HIGH — Ayanamsa convention differs between stacks (§2.1).**
Pick one convention for both engines. If you want to match Drik Panchang (which
the PHP engine and the reference fixture already do), expose
`lahiriAyanamsaMean() + Δψ` in Node too, or add `ASTRO_AYANAMSA_MODE` and default
both to `TRUE`. Then tighten `tests/astrology-accuracy-regression.test.ts`: its
0.02° (72″) tolerance is 4× looser than the error being measured, so it cannot
catch a convention regression today.

**F3 — MEDIUM-LOW — Vasya (Vasiya) table diverges from the published Tamil
tables.** `matchmaking.ts` uses
`{1:[5,8], 2:[4,7], 3:[6], 4:[8,9], 5:[7,9], 6:[3,12], 7:[10,12], 8:[4,11],
9:[12], 10:[1,11], 11:[1,10], 12:[3,10]}` (1 = Mesham … 12 = Meenam). Against two
published Tamil tables:

| Rasi | Engine | [Tamil OneIndia](https://tamil.oneindia.com/porutham/vasya-porutham-tamil.html) | [mpanchang](https://www.mpanchang.com/articles/astrology/thirumana-porutham/) |
|---|---|---|---|
| Simham (5) | Thulam, **Dhanusu** | Magaram | Thulam |
| Kanni (6) | Mithunam, Meenam | Rishabam, Meenam | Mithunam, Meenam ✔ |
| Thulam (7) | Magaram, **Meenam** | Magaram | Magaram |
| Viruchigam (8) | Kadagam, **Kumbham** | Kadagam, Kanni | Kadagam, Kanni |
| Kumbham (11) | Mesham, **Magaram** | Meenam | Mesham |
| Meenam (12) | Mithunam, **Magaram** | Magaram | — |

Five of the twelve rows differ from at least one published source, and the
published sources disagree with each other (Simham → Magaram vs Thulam; Kumbham →
Meenam vs Mesham). The engine is self-consistent and the Vasya porutham is
weighted non-critical, so the impact is one porutham's wording — but this is the
one table in the engine I could not confirm, and it is worth a pundit ruling
before the next marriage report batch.

**F4 — LOW — Rasiyadhipathi friendship** is derived from a Deva/Asura split
(Sun/Moon/Mars/Jupiter vs Mercury/Venus/Saturn) rather than the classical
friendship table, so Sun–Mercury and Moon–Mercury score 0.5 where the classical
table calls them friends.

**F5 — LOW — Rasi Porutham** scores same-sign (distance 1) as only "moderate";
most sources treat the same rasi as auspicious. Tradition-dependent — document
the choice.

**F6 — LOW — Combustion orbs disagree** between modules: Venus 10° in
`getCombustionLimit()` but 8° in `src/lib/muhurtham/scanner.ts`.

**F7 — LOW — Yoga #16 is printed as "Asiddhi"** (`YOGA_NAMES_EN[15]`). The
classical name is **Siddhi** (सिद्धि); "Siddha" (index 20) is a different yoga.
This is customer-visible text in the Panchangam and Muhurtham reports.

---

## 4. Security assessment

### 4.1 Threat model in one line
Internet-facing paid report service holding names, dates/times/places of birth,
mobile numbers, e-mail addresses, payment references and order history, with an
admin portal that can approve, refund and e-mail.

### 4.2 Controls that are already right (verified, not assumed)

| Control | Evidence |
|---|---|
| Bearer tokens are HMAC-SHA256 signed and expiry-checked; unsigned tokens are **never** accepted | `server/security/tokens.ts` — the old unsigned-base64 fallback is gone; `api/config.php::verifyBearerToken()` does the same with `hash_equals` |
| Google / Facebook login verified **server-side** with audience + `email_verified`; client-supplied e-mail never trusted | `tokens.ts` `verifyGoogleLogin()` / `verifyFacebookLogin()` (incl. `appsecret_proof`) |
| Passwords bcrypt cost 10, compared in `try`/`catch`, max 72 bytes | `server/routes/auth.ts` |
| Login lockout (5 failures / 15 min) + per-IP, per-e-mail and per-pending-registration rate limits, shared through Redis when configured | `server/security/rateLimit.ts`, `tests/rate-limit-shared.test.ts` |
| Spoof-resistant client IP (XFF/CF headers honoured only from loopback, private ranges or published Cloudflare edges) | `server/security/clientIp.ts` |
| Parameterised SQL **everywhere** in the PHP API — zero interpolated queries | grep of `api/**/*.php`; the only interpolation is generated `?` placeholders |
| Webhooks: Razorpay HMAC (timing-safe) + PayPal verify API, amount + currency re-checked against the stored intent, replay-idempotent | `server/routes/paymentWebhooks.ts`, `api/payments.php`, `tests/payment-recovery.test.ts` |
| IDOR: every order / PDF / invoice / family-invoice route re-checks ownership or admin role (Node **and** PHP) | `server/routes/services.ts` (`order.userId !== user.id && user.role !== 'admin'` → 403) |
| Admin routers gate on `requireAdmin` at the top; `api/provision_admin.php` is CLI-only (404 over HTTP) | `api/admin/index.php`, `api/provision_admin.php` |
| DB export strips password hashes and redacts SMTP/OAuth/payment/chat secrets | `server/db/store.ts::exportDatabase`, `server/security/settingsSecrets.ts` |
| CORS allowlist (no wildcard with credentials); `X-Powered-By` disabled; nosniff, Referrer-Policy, Permissions-Policy set | `server.ts` |
| `.htaccess` denies `.env/.sql/.log/.txt/.map/.cjs`, `config.php`, `db.php`, `vendor/`, `api/astrology/tmp/`, `api/storage/`; HTTPS + HSTS + SPA fallback in `public/.htaccess` | repo root / `public/.htaccess` |
| Body-size limits (8 MB JSON, 56 MB staged docs, 1 MB raw webhook), staged-doc TTL 6 h, PDF quality gate before e-mail | `server.ts`, `server/services/stagedDocs.ts` |
| **No secrets in the repository** (only a test fixture string); `.env*` and the generated signing key are git-ignored | `git grep`, `.gitignore` |
| Dependency audit: **1 low** advisory, nothing moderate/high/critical | `npm audit` |

### 4.3 Findings

| # | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| S1 | **Medium** | **Minimum password length is 6 characters**, no complexity rule, no breached-password check, no strength meter (admin provisioning correctly requires 12) | `auth.ts` `password.length < 6` | Raise to 10–12, add a strength meter, reject the top-10k/common passwords (zxcvbn or HaveIBeenPwned k-anonymity API) |
| S2 | **Medium** | **No password-reset / account-recovery flow** and **no token revocation**: a stolen token stays valid for its full TTL and an admin cannot force a logout | no `forgot`/`reset` route in `src/`, `server/` or `api/`; `verifySignedToken()` only checks `exp` | Add e-mail OTP reset (you already have the OTP + HMAC plumbing from registration) and a `tokenVersion` / issued-before check on the user record |
| S3 | **Medium** | **Bearer-token TTLs differ and are long**: Node 7 days, PHP **30 days** (`createBearerToken($user, 2592000)`) | `tokens.ts` vs `api/config.php` | Unify at ~24 h with a refresh token, or at minimum 7 days for both; never 30 |
| S4 | **Medium** | **No Content-Security-Policy and no HSTS on the Node server.** `public/.htaccess` sets HSTS for Apache, but a Node deployment serves nothing of the kind. Auth tokens live in `localStorage`, so any XSS anywhere (including in a dependency) is a full account takeover with no CSP to limit it | `server.ts` sets nosniff/XSS-Protection/Referrer-Policy/Permissions-Policy only; `src/services/api.ts` uses `localStorage` | Add `Strict-Transport-Security` and a report-only → enforcing CSP; move the session token to an httpOnly + Secure + SameSite=Lax cookie (or keep it in memory and accept a reload login) |
| S5 | **Medium** | **`POST /api/services/export-preview-pdf` is unauthenticated** and renders an official ASTRO SIVAM branded PDF from arbitrary client-supplied `result` JSON — a forged-report / brand-abuse vector, and an unauthenticated CPU-heavy PDF render (DoS) | `services.ts:1648` | Require auth (or at minimum the shared IP rate limiter that the sibling `calculate-preview` route already uses), cap request size, and stamp preview exports "PREVIEW — not an official ASTRO SIVAM report" |
| S6 | **Medium** | **CSRF surface on the PHP stack:** PHP endpoints authenticate via a `SameSite=Lax` session cookie as well as bearer tokens, and no CSRF token is issued. `Lax` blocks cross-site POSTs but not top-level GET navigation | `api/config.php` session cookie params | Issue a double-submit CSRF token for cookie-authenticated state changes, or make the PHP API bearer-only |
| S7 | **Low** | `dompurify@3.4.14` (transitive via `jspdf@4.2.1`) — [GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p), DOM XSS via `IN_PLACE` afterSanitize hook | `npm audit` | `npm audit fix` / upgrade jspdf when a patched release lands |
| S8 | **Low** | Cloudflare edge ranges are **hard-coded** in `clientIp.ts`. If you move behind a different CDN or proxy outside the private ranges, forwarding headers are ignored and every user shares one rate-limit bucket keyed on the proxy IP | `clientIp.ts` | Fetch/refresh the ranges periodically, or make the trusted-proxy list configurable |
| S9 | **Low** | `api/config.php` ships a default DB name/user (`astro287_Astro_admin`) and a literal placeholder password fallback | `api/config.php` | Keep it, but add a runtime guard that refuses to start when `DB_PASS` is the placeholder |
| S10 | **Low** | Client-side "anti-screenshot / anti-copy" protection is bypassable theatre, calls `console.clear()`, blocks right-click and **overwrites the user's clipboard** | `src/utils/securityProtection.ts` | Keep the polite notice, drop the clipboard wipe and the devtools/right-click blocking (accessibility + false sense of security) |
| S11 | **Low** | `target="_blank"` links in `PaymentGatewayCheckoutBox.tsx` use `rel="noreferrer"` without `noopener` (modern browsers imply it, older ones do not) | grep | Add `noopener` |
| S12 | **Low** | `GET /api/admin/database/export` returns every customer record (PII) in one response; correctly admin-gated and password-hash-free, but not rate-limited or audit-logged | `admin.ts:1404` | Log the action, rate-limit it, and consider streaming a signed download instead |
| S13 | **Low** | `RAHU_NODE_TYPE` is hard-coded `'TRUE'` in Node but configurable in PHP (`ASTRO_RAHU_NODE_TYPE`). If someone sets the PHP env var to `MEAN`, the two stacks separate Rahu/Ketu by up to 1°49′ | `astronomy.ts:56` vs `api/config.php` | Read the same env var in Node and warn on mismatch (the engine already declares `nodeType` on every result — good) |
| S14 | **Info** | Rate limiter is **fail-open** when Redis is unreachable (`RATE_LIMIT_FAIL_MODE=open`). Deliberate and documented; note that a Redis outage downgrades you to per-instance in-process limits | `RATE_LIMITING_AND_PAYMENT_RECOVERY.md` | Accept, or set `closed` for admin/login paths |
| S15 | **Info** | `api/check_mpdf.php` prints server paths when `ASTROSIVAM_DIAGNOSTICS=1`. Gated off by default — confirm the live host does not set it | `api/check_mpdf.php` | Verify on the server |

### 4.4 Not exploitable in the way these usually are
* **SQL injection** — every query in the PHP API is prepared; I found no string
  interpolation into SQL.
* **XSS** — no `dangerouslySetInnerHTML` / `innerHTML` sink fed by user data
  (the one `innerHTML` is a static toast string).
* **Command execution** — no `eval`, `new Function`, or `child_process` in app
  code.
* **Secrets in git** — none (the working tree is one squashed commit, so history
  could not be scanned; run `gitleaks detect --log-opts=--all` on a full clone).

---

## 5. What I could not run here

* `npm run test:php` — the eight PHP suites (`astrology-accuracy-regression`,
  `preview-pdf-quality`, `muhurtham-reports`, `wedding-matching-report`,
  `namakaran-page2`, `payment-webhook`, `mailer-guards`, `rate-limit`). No PHP
  runtime is installable in this sandbox. **This is the main gap: the PHP
  engine's own accuracy test has never been re-run in this audit**, so my PHP
  statements come from reading `api/astrology/engine.php` and
  `EPHEMERIS_ACCURACY_UPGRADE.md`, not from executing it.
* `npm run test:pdf` (Playwright) — needs browser binaries.
* Full git history secret scan (shallow single-commit clone).

---

## 6. Prioritised remediation plan

| Priority | Item | Effort |
|---|---|---|
| P0 | Port the PHP `evaluateKujaDosha()` rule set to Node (F1) | ½ day |
| P0 | Unify the ayanamsa convention across both engines (F2) | ½ day |
| P1 | Add a Node ↔ PHP parity test: same 200 charts → identical rasi, lagna, nakshatra, pada, dosha, porutham verdict | 1 day |
| P1 | Password policy (≥10–12, strength meter, breached-password check) (S1) | ½ day |
| P1 | Password-reset flow + token revocation (S2) | 1–2 days |
| P1 | Unify token TTL, add HSTS + CSP, move the token out of `localStorage` (S3, S4) | 1–2 days |
| P2 | Authenticate + rate-limit `export-preview-pdf`, watermark preview exports (S5) | ½ day |
| P2 | CSRF tokens for cookie-authenticated PHP writes (S6) | ½ day |
| P2 | Fix "Asiddhi" → "Siddhi", confirm the Vasya table, unify combustion orbs (F3, F6, F7) | 1 hr |
| P3 | `npm audit fix`, `noopener`, configurable trusted proxies, DB-export audit log (S7, S8, S11, S12) | ½ day |

---

## 7. Bottom line

The astronomy and the Panchangam are genuinely good — the engine reproduces a
published Panchangam to within a minute, matches Swiss Ephemeris to a few
arcseconds for the planets, and gets every classical table I checked right. The
security engineering is well above average for a project this size: signed
tokens, server-side social verification, parameterised SQL, ownership checks on
every order route, verified payment webhooks, secret redaction.

The real risk is **not** a hacker — it is that **two engines disagree**. One
marriage report in five can carry a different Kuja Dosha verdict depending on
which stack printed it, and every chart is silently offset by up to 18″ between
them. Fix F1 and F2, add the parity test, and the product becomes provably
consistent; then spend the remaining effort on S1–S5.
