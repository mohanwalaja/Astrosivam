# ASTRO SIVAM AI Astrologer — Knowledge Base

Server-side knowledge base for the paid-customer chat agent (English / தமிழ் / हिन्दी).
Everything the agent says must trace back to a source registered here.

```
knowledge/ai-astrologer/
├── README.md              ← this file: structure, rules, Part 2-5 plan
├── SOURCES.md             ← PART 1 DELIVERABLE: the verified source table for approval
├── sources.json           ← machine-readable source registry (68 sources), read by PHP
└── VERIFICATION_LOG.md    ← exactly how each source was verified, incl. failures
```

---

## Status

| Part | State |
|---|---|
| **Part 1 — sources** | ✅ Done. 68 sources registered and verified 2026-10-09. Awaiting approval. |
| Part 2 — 8 life areas, health rules | ⏸ Blocked on Part 1 approval |
| Part 3 — PDF report upload & explain | ⏸ Blocked on Part 1 approval |
| Part 4 — access control, rate limit, migration | ⏸ Blocked on Part 1 approval |
| Part 5 — human-like response behaviour | ⏸ Blocked on Part 1 approval |

---

## The one rule this knowledge base exists to enforce

> **A rule may only be shown to a customer with a source reference at the level it was
> actually verified at.**

`sources.json` carries a `verification` field on every entry with one of five values
(`content-read`, `metadata-verified`, `catalogue-verified`, `linked-not-opened`, `dead`).
The retrieval layer must read that field and:

- `content-read` / `metadata-verified` / `catalogue-verified` → citable in a customer answer.
- `linked-not-opened` → **not** citable. Retrieve the fact, cite the source it *was* read from.
- `dead` → never retrievable at all. Kept in the file only so it is not re-added.

Book-level vs verse-level citation: 45 of 68 sources are `metadata-verified`, which proves the
book exists and what it is, but **not** what any particular verse says. Until a book is opened
and read, its rules are cited as *"Brihat Parashara Hora Shastra"* — never as
*"BPHS chapter 12, verse 8"*. The only exception today is **EN-02 Phaladeepika**, whose printed
index was read; its chapter anchors are listed in `sources.json` → `verifiedChapterAnchors` and
those, and only those, may be cited to chapter.

---

## Coverage by question area

Which sources answer which of the customer's questions:

| Question area | Primary sources |
|---|---|
| **Navagraha in house / sign** | EN-01, EN-04, EN-06, HI-04, TA-03, TA-05 |
| **Navagraha nature & karaka** | EN-01, TA-08, TA-09, TA-05, EN-09 |
| **Aspects (drishti) & conjunctions** | EN-01, EN-04, EN-09 |
| **Dasha / Bhukti effects** | EN-01, EN-02 (Adh. XXIII), EN-06, HI-05, TA-02 |
| **Gochara / transit** | EN-02 (Adh. XXVI), EN-07, HI-11, **TA-04**, **TA-15** |
| **Sade Sati / ஏழரைச் சனி** | EN-02 (Adh. XXVI, house by house from Moon), TA-15, **TP-03**, REF-03 *(honesty note)* |
| **Rahu–Ketu** | EN-09 (elaborate account), EN-02 (XIV-9 palpitation), TA-07 |
| **Doshas & their cancellation** | EN-01, EN-06, **TA-07** |
| **Remedies — mantra, temple, charity, fasting** | **TA-07**, **TA-10**, **TA-23**, HI-06, HI-09, TP-01…TP-11 |
| **Temple-based remedies (TN)** | **TP-01** (mapping), **TP-02** (Suryanar), **TP-03** (Thirunallar, read in full) |
| **Gemstone cautions** | HI-07, HI-08, EN-09 |
| **Education / exams** | EN-06, TA-05, TA-06, TP-06 |
| **Health (astrological indications only)** | EN-02 (Adh. XIV), EN-01, TA-10 *(restricted — see below)* |
| **Business, career, partnerships** | EN-01, EN-02 (XIX-14), HI-05, TA-13 |
| **Foreign opportunities / travel** | EN-01, EN-07, EN-09 |
| **Marriage, children, wealth, property** | EN-01, EN-06, EN-09, TA-19, TP-07, TP-08 |
| **Muhurtham** | **TA-12**, TA-27, TA-28 |
| **Nakshatra / baby naming** | TA-06, TA-11, EN-09 |
| **"Why does your chart differ from my panchangam?"** | **TA-25** (Drik vs Vakya) |
| **Prashna — no birth data available** | HI-10 |

---

## Health rules — the restriction that is built into the source data

**TA-10** (`நோய்களுக்குச் சித்த பரிகாரம்`) and **EN-02** Adhyaya XIV carry a
`usageRestriction` / caveat in `sources.json`:

> Spiritual framing only. **Never** name a disease, **never** name a medicine, **never**
> suggest delaying or stopping treatment. Every health answer must (a) tell the customer to
> see a qualified doctor, (b) treat astrology as complementary, and (c) for serious or
> emergency symptoms say to get medical help immediately.

This is stored with the source, not just in a prompt, so it survives a prompt rewrite.

The same applies globally: no guaranteed outcomes, no death or accident predictions, no
frightening language, no price or sales talk inside an answer.

---

## Part 2 groundwork — already read from this repo

So Part 2 starts from facts rather than assumptions, the eight page-2 life-area cards were
located in this checkout (`src/services/jathagamHtmlBuilder.ts`, `buildJathagamLifeCards`,
titles at lines 459–533; PHP mirror `api/astrology/pdf_mpdf_reports.php` → `$lifeCardsData`
at line 1489):

| # | English | தமிழ் | हिन्दी | House anchor in the card |
|---|---|---|---|---|
| 1 | Health & Vitality | ஆரோக்கியம் & நல்வாழ்வு | स्वास्थ्य एवं आरोग्य | 1st lord |
| 2 | Wealth & Finance | தனம் & நிதி நிலை | धन एवं संपत्ति | 2nd lord |
| 3 | Education & Intellect | கல்வி & அறிவுத்திறன் | शिक्षा एवं बौद्धिकता | 5th lord |
| 4 | Career & Profession | தொழில் & உத்தியோகம் | व्यवसाय एवं आजीविका | 10th lord |
| 5 | Marriage & Relations | திருமணம் & உறவு | विवाह एवं सम्बंध | 7th lord |
| 6 | Property & Real Estate | வீடு, நிலம் & சொத்து | भूमि, भवन एवं संपत्ति | 4th lord |
| 7 | Travel & Global Fortune | பயணம் & அதிர்ஷ்டம் | विदेश यात्रा एवं भाग्य | 9th lord |
| 8 | Current Guidance | தற்போதைய வழிகாட்டல் | ज्योतिषीय मार्गदर्शन | current Dasha / Bhukti |

The agent must answer all eight in depth from the customer's own chart, and the card titles
above are the vocabulary it should reuse so the chat and the PDF report agree.

Also confirmed present in this checkout and reusable by the agent: the existing chart engine
(`api/astrology/engine.php`, `src/lib/astrology/*`), dignity tables shared between Node and
PHP (`src/lib/astrology/dignity.ts`), Vimshottari dasha, dosha rules
(`src/services/jathagamDoshaData.ts`), the existing rate limiter (`api/rate_limit.php`), the
existing migrations directory (`api/migrations/003…006`), and an admin chat-alert path
(`api/chat_alerts.php`) which is the natural landing point for the "Talk to our astrologer"
handoff.

---

## Conventions for Parts 2–5

- **No API key ever reaches the browser.** Model calls live in PHP under `api/`, keys in
  server-side config only.
- **Knowledge base files are read by PHP**, not by the frontend. `sources.json` is plain
  JSON with no BOM and no trailing commas, so `json_decode` works on PHP 8.0+ (the minimum
  this repo declares in `composer.json`).
- **Every generated answer ends with a short source reference** drawn from the `id` +
  `title` of the sources actually retrieved.
- **Every message is stored** in the per-customer chat history table with a timestamp.
- **Paid-order check happens in PHP on every request**, never only in React.


---

## Part 2 — the rule base, retrieval and prompt (built 2026-10-09)

Three rule files and one prompt, all read server-side:

| File | What it is | Verified by |
| --- | --- | --- |
| `rules/life-areas.json` | The eight page-2 life-area cards. 34 rules, each with a chart condition, trilingual wording, an easing period, a practical step and a sourced citation. Also holds `health.suppressedRules` (the verses the agent reads but never relays) and `openEnded.routes` (the refusal routes). | `tests/ai-astrologer-knowledge.test.ts` |
| `rules/remedies.json` | The only remedies the agent may offer: mantra, weekday, temple, charity, fasting, lifestyle — per graha. Every entry is free or near-free and sourced. `neverOffer` lists what is unreachable. | same |
| `rules/guardrails.json` | Identity, disclaimer, health rules, prediction limits, money rules, tone, timing, retry and the astrologer handoff — in all three languages. | same |
| `prompt/system-prompt.md` | The complete system prompt, with the placeholder map. Stored in the repo, not a database row, so every change to what the agent may say is a reviewed diff. | manual review |

`src/services/aiAstrologerRetrieval.ts` is the **executable spec** for the retrieval half of
the agent: `detectLanguage` → `matchAreas` → `matchRefusalRoute` → `evaluateCondition` →
`remediesFor` → `formatCitation` → `checkReply`. The PHP endpoint in Part 4 must match its
behaviour. Nothing in it calls a model; model calls live only in PHP.

Two retrieval decisions worth knowing before editing:

- **Card 8 (Current Guidance) is a fallback.** It has no house anchor and its rules are
  `always` rules, so its generic phrases ("now", "this year", "இந்த வருடம்") would otherwise
  outscore a specific topic on phrase length alone. `matchAreas` returns it only when no
  house-anchored card matched.
- **An empty chart can only fire `always` rules.** Every other condition type requires
  positive chart evidence, so a partially computed chart cannot invent a finding.

Citation levels are enforced by the test, not by convention: a rule may cite `book`, `note`
or `suppressed` freely, but `passage` requires a `verifiedPassages` entry in `sources.json`
plus a verse or page, `chapter` requires `verifiedChapterAnchors` plus a note naming the
chapter, and `content` requires `verification: "content-read"`. No rule may cite an id in
`excludedSources` — the 13 Hindi books are unreachable from the rule base by construction.


---

## Part 3 — uploaded report handling (built 2026-10-09)

| File | What it is | Verified by |
| --- | --- | --- |
| `rules/report-sections.json` | The four report types (Jathagam, Wedding Matching, Baby Naming, Subha Muhurtham), every section with a trilingual title and explanation, the chart positions it comes from, its guardrail and its source. Also holds the ownership contract and the four polite refusals. | `tests/ai-astrologer-report.test.ts` (26 checks) |
| `src/services/aiReportSections.ts` | The executable spec for the upload gate and for "what does this line mean?". | same |
| `api/astrology/ai_report_extract.php` | The PHP port. **Not executed** — see the caveat below. | none yet |

### The ownership design, and why it is not what it looks like

An uploaded PDF is untrusted input. The gate proves three things before a word of
it is discussed: it is an ASTRO SIVAM report, it belongs to the session customer,
and that customer's order is **PAID**.

The order number is read from the page header — `AstroMpdfReports::topHeader` prints
`<span class="header-order-ref">#ORD-…</span>` on every page, and the filename
`ASTRO_SIVAM_Report_{order_number}.pdf` (set in `api/admin/approve_order.php`)
corroborates it. **A filename alone never grants access**, because a customer can
rename any file.

**The PDF is an ownership token, not the source of the explanation.** mPDF embeds
subset fonts, and glyph-to-Unicode mapping for Tamil and Devanagari runs frequently
does not survive PDF text extraction — extracted Indic text can come back garbled or
empty. So the gate depends only on the ASCII order number, and the content that gets
explained is regenerated server-side from the order's saved inputs via
`AstroEngine::rebuildReportResultFromSavedInputs`, which is already how official
downloads are produced. The design therefore works whether or not Indic extraction
succeeds. If extraction fails entirely, the fallback is to ask the customer to pick
the order from their dashboard — never to guess an order from a birth date.

Two retrieval details worth knowing before editing:

- **Section matching scores on the longest run of consecutive shared words**, with a
  minimum of three. Per-word hit counting was tried first and the single word
  "this" matched a section it had nothing to do with.
- **Identification needs two fingerprints**, or one at least 24 characters long.
  "Janma Nakshatra" appears in both the Jathagam and Baby Naming reports, so one
  stray phrase must not be mistaken for either.

### Caveat on the PHP

PHP cannot be installed in the build sandbox — `apt-get` fails because the Debian
repositories are unreachable (only github.com, registry.npmjs.org and pypi.org are
allowed), even with sudo. So `api/astrology/ai_report_extract.php` has **not been
executed or even syntax-checked** here. The logic it mirrors has been executed, in
TypeScript, by the 26 checks above, and the file is annotated to say so at the top.
`smalot/pdfparser ^2.7` was added to `composer.json` for the extraction step; it is
pure PHP, so it works on shared cPanel with no shell access.


---

## Part 4 — access control, rate limit and chat history (built 2026-10-09)

| File | What it is | Verified by |
| --- | --- | --- |
| `api/migrations/007_ai_astrologer_chat.sql` | `ai_chat_sessions`, `ai_chat_messages`, `ai_chat_handoffs`. Idempotent, safe to re-run. | `tests/ai-astrologer-access.test.ts` |
| `api/ai_astrologer.php` | The customer endpoint: `session`, `history`, `ask`, `upload`, `handoff`, `usage`. **Not executed** — see the caveat. | same |
| `src/services/aiAstrologerApi.ts` | Browser client. No credential, no provider URL. | same |
| `src/components/ai-astrologer/AiAstrologerPanel.tsx` | The chat panel: status line, three-dot typing, bubbles, upload, handoff, disclaimer. | same |
| `src/pages/CustomerDashboard.tsx` | Two entry points: a dashboard button, and "Ask about this report" on each paid order. | same |

### The two gates

Both run on **every** action, including read-only ones, before the action switch:

1. `requireAuth($pdo)` — signed-in customer, with the `token_version` revocation check `api/config.php` already applies.
2. `astro_ai_require_paid_order()` — at least one order with `payment_confirmed = 1`, `status IN ('COMPLETED','PROCESSING')` and no refund.

The React side hides the button when there is no completed order, but that is a
**hint only**. The server re-checks on every request, because the browser is not
trustworthy. A free-beta order does not qualify.

### Rate limit

The daily question limit reuses `api/rate_limit.php` with a 24-hour window keyed
on the user id, so signing in from another device does not reset it. There is no
second counter table — that would be a second source of truth.

**`astro_rate_limit_enforce()` already counts the request** (it calls
`astro_rate_limit_hit`, which calls `astro_rate_limit_upsert`). A first version of
the endpoint also called `astro_rate_limit_bump()` afterwards, which would have
charged the customer **two questions for one answer**. A test now fails if a bump
appears in the `ask` handler.

`astro_rate_limit_fetch()` does not know about window expiry, so
`astro_ai_usage_count()` zeroes a stale row itself rather than reporting
yesterday's usage as today's.

### Column types

`users.id`, `orders.id` and `orders.user_id` are `VARCHAR(64)` in `api/schema.sql`,
so the chat tables use `VARCHAR(64)` too. Tidying these to `INT` would make the
joins silently match nothing. A test pins the types.

### Three bugs the tests caught while building them

1. **`config.php` does not include `db.php`**, so `getDbConnection()` would have
   been a fatal error on the first request.
2. **`astro_report_normalize_language()` lives in `pdf_mpdf_invoice.php`**, a
   738-line file. It was being required on every chat request just for one
   helper; `astro_normalize_report_language()` in `config.php` does the same job.
3. **The rate-limit double count** described above.

### Caveat on the PHP

PHP cannot be installed in this sandbox, so `api/ai_astrologer.php` has **not been
executed or `php -l` checked**. `tests/ai-astrologer-access.test.ts` is a static
contract test: it parses the PHP and asserts that both gates run before dispatch,
that every function it calls exists in a file it actually requires, that every
table and column exists in `schema.sql` or the migration, and that no credential
appears in the browser-reachable files. That catches contradictions with the
schema and the brief; it cannot prove the code runs.
