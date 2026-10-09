# Your manual changes — 6–7 October 2026

> **Historical note (October 2026):** This file records work from before the Node.js application server was removed. Production is now a static React frontend plus the PHP API in `api/`; Node.js remains build/test tooling only. Any `server/` paths and Node-server behaviors below describe the retired implementation, not the current deployment.


**Question answered:** *"What did my own hand-written changes over the last two
days actually do for ASTRO SIVAM?"*

**Window reviewed:** `c84c8ec` (5 Oct, PR #101 merge) → `47a3818` (7 Oct, PR #109)
**Reviewed on:** 7 October 2026
**Everything below was re-verified by running the repo, not read off commit messages.**

---

## 0. The short answer

In the last two days **39 commits** landed on `main` (33 real commits + 6 merges),
totalling **91 files, +9,713 / −2,527 lines**.

Of those, **two commits were typed by you by hand** — everything else came through
Arena agent branches that you reviewed and merged:

| | Commit | Date | Size |
|---|---|---|---|
| 1 | `2844c08` `feat: implement thematic dynamic backgrounds and routing` | 6 Oct 23:13 | 9 files, +504 / −619 |
| 2 | `c3ae486` `refactor: remove legacy theme templates` | 6 Oct 23:26 | 6 files, +6 / −624 |

**Combined net effect: 10 files, +115 / −848.** Strip the two lockfiles and it is
**8 files, +42 / −300** — a small, surgical pair of commits.

They did three genuinely valuable things and three things that needed undoing.
In one line:

> You gave the site **real shareable URLs**, **unblocked a Google Cloud deployment**,
> and **deleted ~900 lines of unused theme machinery** — but the same commit
> quietly **rewound `bun.lock` by a major version of Express**, **deleted
> `composer.lock`**, and **deleted a security `.htaccess`**.

**All three are fixed in this branch**, along with the CORS wildcard from §2.2
and a fourth problem the fix uncovered: `package-lock.json` was stale too, and
`npm ci || npm install` in CI had been hiding it (§3.4). Two new test suites
stop any of it recurring.

---

## 1. How I decided what counts as "manual"

Your GitHub account authors *every* commit on this repo, including the agent ones,
so author name alone does not separate them. Three signals do:

1. **Timezone.** Your laptop commits are stamped `+1200` (NZ). Agent-session
   commits are stamped `+0000`.
2. **Branch of origin.** Agent work arrives via `arena/<id>-astrosivam` branches
   through a PR. Your hand commits went **straight onto `main`** with no PR.
3. **Trailer.** Agent commits carry `Co-authored-by: arena-agent <...>`. Neither
   of your two commits does.

All three agree on the same answer: `2844c08` and `c3ae486`.

> Boundary note: `82b420f` (5 Oct, PR #101, branch `fix/report-audit-three-languages`)
> is also hand-written and *just* outside the two-day window. It matters here
> because `2844c08` partly reverted it — see §3.1.

---

## 2. What the two commits did, and why it helped

### 2.1 Real URLs for every page — the biggest win

**File:** `src/App.tsx` (+68 / −… in `handleNavigate` and `getInitialRoute`)

**Before.** Only two routes had a real address. Everything else lived behind a
query string:

```
astrosivam.com/                      → home     ✅
astrosivam.com/admin                 → admin    ✅
astrosivam.com/?route=birth-jathagam → Jathagam ❌ ugly, unshareable, unindexable
astrosivam.com/?route=muhurtham      → Muhurtham ❌
```

**After.** `handleNavigate()` builds a clean path for *every* route:

```js
const cleanPath = targetRoute === 'home' ? '/' : `/${targetRoute}`;
const url = new URL(cleanPath, window.location.origin);
window.history.pushState({}, '', url.pathname + url.search);
```

```
astrosivam.com/birth-jathagam        ✅
astrosivam.com/marriage-compatibility ✅
astrosivam.com/muhurtham             ✅
astrosivam.com/baby-naming           ✅
```

**Why this helped ASTRO SIVAM, concretely:**

- **SEO.** Google will not rank `/?route=muhurtham` as a distinct page — query
  strings are treated as parameters of `/`. `/muhurtham` is a page it can index,
  title and rank. For a service business whose four products *are* the four
  routes, this is the difference between one indexable page and five.
- **Shareability.** A customer can now paste `astrosivam.com/marriage-compatibility`
  into WhatsApp and it looks like a real business. `?route=` looks like a dev build.
- **Ads & analytics.** You can finally set a landing page per campaign and read
  per-service traffic in Analytics without parsing query strings.

**I verified the plumbing actually supports this** — a clean URL is worthless if a
hard refresh 404s:

- Apache/cPanel: `public/.htaccess` rule **(g)** `RewriteRule ^ index.html [L,QSA]` ✅
- Node/production: `server.ts:145` `app.get('/*splat', …)` → `index.html` ✅
- Legacy links: rules in `getInitialRoute()` still catch `/eclipse-guide`,
  `/kiraganam`, `/logos` and `replaceState` them to the live page, so old
  bookmarks don't dead-end ✅

**One deliberate reversal worth knowing about.** You also flipped the precedence:
`?route=` is now checked **before** the path. So `/services?route=admin` lands on
admin, not services. That is the right call for a platform that serves the SPA
from a host which can't rewrite paths (see §2.2) — the query string always works.
Just be aware it's a change: the path no longer wins.

---

### 2.2 CORS opened for Google Cloud — unblocked a deployment

**File:** `server.ts` (+2 lines)

```js
if (/^https:\/\/[\w.-]+\.run\.app$/.test(origin)) return callback(null, true);
if (/^https:\/\/[\w.-]+\.googleusercontent\.com$/.test(origin)) return callback(null, true);
```

**What it helped:** the API previously answered only `astrosivam.com`,
`www.astrosivam.com` and (in dev only) localhost / `*.e2b.app`. Anything served
from Cloud Run or a Google-hosted preview got a CORS rejection on every API call —
login, chart generation, checkout, all of it. These two lines are what let you put
the site in front of someone on a Google URL.

**Two things to know, and they are the reason I flagged this:**

1. **These two rules are not gated on `isDev`.** The `e2b.app` and `localhost`
   rules above them are (`if (isDev && …)`); yours are not. So in **production**,
   *any* `*.run.app` or `*.googleusercontent.com` origin — including one owned by
   a stranger — can call your API with credentials. Anyone can deploy to Cloud Run
   and get a `*.run.app` hostname in about ninety seconds.
2. **You don't need the code change at all.** `server.ts` already reads
   `ALLOWED_ORIGINS` from the environment:

   ```js
   const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://astrosivam.com,…')
   ```

**FIXED.** The decision moved into `server/security/corsOrigins.ts` (next to
`clientIp.ts`, same documented style) so it can be unit-tested, and the two
wildcards are now gated on `isDev` like the rules above them. Development keeps
working with no env var; production trusts only exact `ALLOWED_ORIGINS` entries.

So the Cloud Run deployment doesn't break silently, the server now says so at boot:

```
[CORS] ALLOWED_ORIGINS is not set; falling back to https://astrosivam.com,
https://www.astrosivam.com. Browser requests from any other host (including
*.run.app preview deployments) will be refused. Set ALLOWED_ORIGINS to the
exact origins that must reach this API.
```

**To put the Cloud Run host back online, set this on the service — no code change:**

```bash
ALLOWED_ORIGINS="https://astrosivam.com,https://www.astrosivam.com,https://astrosivam-xxxxx.run.app"
```

Verified against the real server on all three paths (see §4.2).

---

### 2.3 Dead theme system removed — ~900 lines of maintenance gone

**Files:** `src/context/ThemeContext.tsx` (−144), `src/index.css` (−97),
`src/types/index.ts`, `src/pages/AdminPortal.tsx`,
`src/components/admin/WebsiteBrandDesignPanel.tsx` (added then removed, net 0)

You briefly built a four-template theme switcher (`mandapam-temple`,
`cosmic-observatory`, `vedic-manuscript` + the default), with an admin panel to
preview and apply them site-wide, then thought better of it 13 minutes later and
tore it back out. The type now reads:

```ts
export type ThemeTemplateId = 'classic-primary';
```

**Why this helped:** that feature would have been a permanent tax. Every new page
and component would have needed testing against four `[data-theme="…"]` CSS
override blocks full of `!important` rules — and those overrides worked by
blanket-overriding Tailwind utility classes (`.bg-slate-900`, `.border-slate-800`),
which is exactly the pattern that breaks silently the moment someone changes a
utility class. Killing it the same night, before it touched the report renderers
or the PDF builders, was the correct instinct. The three surviving PDF pipelines
(jsPDF, mPDF, html2canvas) never learned about themes, so nothing downstream broke.

**Cleanly done.** I checked for orphans: `ThemeProvider` is still imported and
mounted in `App.tsx:5,236`, `THEME_TEMPLATES` still has its one entry,
`server/db/store.ts:550` still defaults `activeThemeTemplate: 'classic-primary'`,
and `tsc --noEmit` is clean. No dangling references.

---

> **Status: all fixed.** Everything in §3 and the CORS gating in §2.2 has been
> applied in this branch, with regression tests so none of it can come back
> silently. See §3.5 for the summary and §4 for the verification run.

## 3. Three things to put back

These rode along in `2844c08` and are almost certainly unintentional — the commit
message calls them *"Update dependency versions for project stability"*, but they
move in the opposite direction.

### 3.1 `bun.lock` was rewound — Express 5 → Express 4

This is the one to fix first. `bun.lock` was replaced with an **older** resolution
set that no longer matches `package.json`. **13 of 35 packages now disagree:**

| package | `package.json` | `bun.lock` | |
|---|---|---|---|
| **express** | `^5.2.1` | `^4.21.2` | **major version behind** |
| **@types/express** | `^5.0.0` | `^4.17.21` | major behind |
| **motion** | `^14.0.0` | `^12.23.24` | 2 majors behind |
| **nodemailer** | `^10.0.14` | `^9.1.1` | major behind |
| **dotenv** | `^18.0.5` | `^17.2.3` | major behind |
| **@google/genai** | `^2.27.0` | `^2.4.0` | |
| **@vitejs/plugin-react** | `^5.2.0` | `^5.0.4` | |
| **lucide-react** | `^0.556.0` | `^0.546.0` | |
| **msedge-tts** | `^2.0.9` | `^2.0.7` | |
| **tailwindcss** | `^4.3.3` | `^4.1.14` | |
| **tz-lookup** | `^6.1.25` | **absent** | |
| **@playwright/test** | `^1.63.0` | **absent** | |
| **@types/tz-lookup** | `^6.1.2` | **absent** | |

**Why this bites.** `server.ts:145` uses `app.get('/*splat', …)`. That named-wildcard
syntax is **Express 5 / path-to-regexp v8 only** — the comment two lines above says
so explicitly. Install from this lockfile with `bun install` and you get Express 4,
where the server's SPA fallback breaks. Separately, `tz-lookup` is missing from the
lock but is imported by `src/lib/timezone.ts:1` — the module that resolves a birth
place to an IANA timezone, i.e. the thing that makes birth times correct.

**Why it hasn't broken yet:** the repo also has `package-lock.json`, and
`npm install` ignores `bun.lock` entirely. The damage is dormant until someone runs
`bun install` — on a new laptop, in a container, or in CI.

**FIXED** — `bun.lock` restored from `4c18ce0`; all 35 packages now agree.
Guarded by `tests/lockfile-drift.test.ts`.

### 3.2 `composer.lock` was deleted

You **added** `composer.lock` (480 lines) the previous evening in `82b420f`, then
deleted it 24 hours later in `2844c08`. It is gone at `HEAD`.

`composer.json` requires `"mpdf/mpdf": "^8.2"` — a range, not a pin. Without the
lockfile, `composer install` on the cPanel host resolves to whatever 8.x is newest
*that day*. mPDF is what renders every server-side PDF, and the PHP suites assert
exact page counts (the birth report must be exactly three pages — see `8446019`).
An unpinned minor bump can change text metrics and silently push a report onto a
fourth page.

**FIXED** — restored from `82b420f`, pinning `mpdf/mpdf v8.3.1`. `composer.json`
has not changed since 25 Sep, ten days before that lock was generated, so it is
still in sync. `tests/lockfile-drift.test.ts` now fails if the lock goes missing
again.

### 3.3 `api/vendor/.htaccess` was deleted

```apache
<IfModule mod_authz_core.c>
Require all denied
</IfModule>
```

That file was added by `bcc993b` (`chore(security): harden directory and file access`)
and is gone at `HEAD`.

**Severity: low — this is defence-in-depth, not an open hole.** I checked the parent:
`api/.htaccess` still carries `RewriteRule ^vendor(/.*)?$ - [F,L]`, so vendor is
still blocked *as long as `mod_rewrite` is enabled*. The deleted file was the
belt-and-braces layer that worked even without `mod_rewrite`. Since `.cpanel.yml`
copies `api/` recursively to `public_html/api/`, your installed mPDF tree is what
sits behind that single remaining rule.

**FIXED** — restored from `4c18ce0`. (`vendor/` is in `.gitignore`, but
`git checkout <commit> -- <path>` restores *and* stages it regardless, so no
`git add -f` was needed.)

### 3.4 Found while fixing: `package-lock.json` was stale too, and CI was hiding it

The drift guard written for §3.1 immediately failed on the **npm** lockfile as
well — same shape, 14 packages: `express` locked at 4.22.2 against a declared
`^5.2.1`, and `tz-lookup`, `msedge-tts`, `react-helmet-async`, `@playwright/test`
and `@types/tz-lookup` missing outright.

`npm ci` refuses to run in that state. Confirmed against the committed file:

```
npm error `npm ci` can only install packages when your package.json and
npm error package-lock.json ... are in sync.
npm error Invalid: lock file's express@4.22.2 does not satisfy express@5.2.1
npm error Missing: @playwright/test@1.63.0 from lock file
```

All three CI jobs ran `npm ci || npm install`, so this failed silently on every
run and the fallback resolved fresh versions from the registry instead. **CI has
not been testing the pinned dependency set.**

**FIXED** — lockfile regenerated (`npm ci` now exits 0), and the `|| npm install`
fallback removed from all three jobs in `.github/workflows/tests.yml` and
`build.yml` so it fails loudly next time.

### 3.5 What changed in this branch

| File | Change |
|---|---|
| `bun.lock` | restored to the version matching `package.json` |
| `package-lock.json` | regenerated; `npm ci` works again |
| `composer.lock` | restored (`mpdf/mpdf v8.3.1`) |
| `api/vendor/.htaccess` | restored |
| `server/security/corsOrigins.ts` | **new** — origin allow-list, extracted and testable |
| `server.ts` | uses the above; wildcards now dev-only; warns at startup if `ALLOWED_ORIGINS` is unset in production |
| `.env.example` | documents the Cloud Run path |
| `.github/workflows/{tests,build}.yml` | `npm ci` instead of `npm ci \|\| npm install` (3 jobs) |
| `tests/cors-origins.test.ts` | **new** — 11 checks |
| `tests/lockfile-drift.test.ts` | **new** — 5 checks |
| `scripts/run-tests.mjs` | registers the two new suites (32 → 34) |

---

## 4. Verification

### 4.1 Suites

Against this branch, with all the fixes applied:

| Check | Command | Result |
|---|---|---|
| Clean install | `npm ci` | **exit 0** (failed with `EUSAGE` before the fix) |
| Types | `npx tsc --noEmit` | **exit 0**, no errors |
| Build | `npm run build` | **success** — 2,647 modules, `dist/server.cjs` 1.7 MB |
| Tests | `npm test` | **exit 0** — all **34** Node suites green (32 + the 2 new) |
| Advisories | `npm audit` | 1 critical, 1 high, 1 low — unchanged, all transitive |

The three advisories match §4.2 of `LAUNCH_READINESS_AUDIT.md` exactly —
`proxy-addr` (critical, via express), `source-map-js` (high, build-time only),
`dompurify` (low, via jspdf). None are new, and the audit explains why each is
already neutralised in practice.

Note the original state was also green on `tsc`/`build`/`npm test` — your manual
changes never broke the build. Everything in §3 was latent: it bit a future
install or deploy, not that day's work.

### 4.2 Live CORS check against the real server

Booted `dist/server.cjs` and sent real requests, rather than trusting the unit
tests alone:

**`NODE_ENV=production`, no `ALLOWED_ORIGINS`** — startup warning printed:

| Origin | Result |
|---|---|
| `https://astrosivam.com` | allowed |
| `https://www.astrosivam.com` | allowed |
| `https://attacker-owned.run.app` | **refused** |
| `https://foo.googleusercontent.com` | **refused** |
| `https://evil.test` | **refused** |
| `http://localhost:3000` | **refused** |
| *(no Origin header)* | HTTP 200 — server-to-server unaffected |

**`NODE_ENV=production`, `ALLOWED_ORIGINS=…,https://astrosivam-abc123.run.app`**
— no warning:

| Origin | Result |
|---|---|
| `https://astrosivam-abc123.run.app` | allowed — the escape hatch works |
| `https://attacker-owned.run.app` | **refused** — siblings get nothing |

**`NODE_ENV=development`** — convenience preserved:

| Origin | Result |
|---|---|
| `http://localhost:5173`, `https://abc123.e2b.app` | allowed |
| `https://astrosivam-abc123.run.app`, `https://preview.googleusercontent.com` | allowed |
| `https://foo.run.app.evil.test` | **refused** — suffix smuggling blocked |

---

## 5. The other 37 commits (context)

So you have the full two-day picture, here is what came in through the agent PRs
you reviewed and merged. Nearly all of it is **calculation accuracy**, and it is
the more consequential half of the window:

| PR | What it fixed | Why it matters |
|---|---|---|
| **#102** | Shared Lahiri ayanamsa; Kuja verdict can never show a clean badge while the text lists a dosha; dignity + Neecha Bhanga in planet tables; Vimshottari Mahadasa + Bhukti; Pitru 12° orb; Graha Yuddha; Tamil `புத்தி` → `புக்தி` | Removed self-contradicting report output |
| **#103** | Dropped the `patch.py` toolchain; Neecha Bhanga now always **names the rule** that fired and states it doesn't erase the debilitation; Kuja default house set corrected to the South Indian 2/4/7/8/12 (1st house is *not* a Kuja house); 2nd-house exception narrowed to Mithunam/Kanni per the Tamil Sevvai lists | The Kuja rule was over-firing. Parity: **1,507/1,507 values agree** Node↔PHP |
| **#104** | Birth Jathagam: dasha lord read from the enum (Sukra/Sani dasha were being missed by English text-matching); conjunction needs a **10° orb**, not just a shared rasi; exalted/own-sign lord offsets one malefic; Rahu/Ketu debilitation removed from both card tables; Navamsa D9 + Vimshottari table moved onto page 1 | Seven real calculation bugs, fixed in **both** Node and PHP. +527-line test file |
| **#105** | **Rajju groups were rotating every 5 nakshatras instead of 9.** Avittam + Swati were read as the same group → false failure. Correct table gives the sample couple 24/35 and 7/10 | A genuine matchmaking error that would have told real couples they were incompatible |
| **#106** | Marriage verdicts: a partial score is **Mathimam**, never Uttamam; non-full rows explain what is *lacking*; a true zero renders `0 / 4` instead of blank | Report no longer overstates a match |
| **#107** | Baby naming: rajju + sound checks, name data, layout | |
| **#108** | Muhurtham now checks candidate dates against **both** charts (Chandrashtama, Tara Bala, Janma Nakshatra for bride *and* groom); prints the real covered range instead of boilerplate; Sukra/Guru asta orbs named; Tamil `மிருகசீரிடம்` spelling fixed. Follow-ups restricted two-chart logic to wedding, then extended it to engagement | It was silently checking one chart while implying both |
| **#109** | `POST /api/services/export-preview-pdf` was **unauthenticated** — anyone could mint an official-looking ASTRO SIVAM PDF from arbitrary JSON and trigger a CPU-heavy render. Now behind `requireAuth`. Yoga #16 corrected `Asiddhi` → `Siddhi` | Closed a brand-abuse + DoS vector before launch |

**The pattern:** the agent PRs fixed what the reports *say*; your two commits fixed
how customers *reach* them. They're complementary, which is why both halves of the
window were worth doing.

---

## 6. Next steps

**One thing you must do — on the deployment, not in code:**

- If a Cloud Run / preview host needs to reach the API, set `ALLOWED_ORIGINS`
  on that service to include its exact origin (§2.2). Until then the startup log
  will tell you on every boot. Production `astrosivam.com` is unaffected.

**Worth doing soon:**

- **Pick one package manager.** Both lockfiles drifted; `bun.lock` and
  `package-lock.json` are now both correct and guarded, but maintaining two
  lockfiles for one project invites this again. If nobody uses bun, delete
  `bun.lock` and the drift test will skip it automatically.
- **Protect `main`.** Both of your direct-to-`main` commits skipped CI entirely.
  They happened to be fine; nothing would have caught it if they weren't. Now
  that `npm ci` is enforced, requiring the Test Suite check on `main` would have
  caught every issue in §3 at push time.
- **Add per-route `<title>` / canonical tags** now that the clean URLs exist
  (`react-helmet-async` is already a dependency). The routing work in §2.1 only
  pays off in search once each route has its own metadata — right now all five
  URLs are indexable but share one title.

**Still open from the launch audit** (unchanged by these two days, listed in
`LAUNCH_READINESS_AUDIT.md` §4.2): 6-character minimum password (S1), no password
reset or token revocation (S2), PHP bearer-token TTL 30 days vs Node's 7 (S3), no
CSP/HSTS on the Node server (S4), no CSRF token on cookie-auth PHP writes (S6),
`noreferrer` without `noopener` (S11), Vasya porutham table diverging on 5 of 12
rasis (F3).
