# Namakaran page 2 — correct Tamil & Hindi name meanings

> **Historical note (October 2026):** This file records work from before the Node.js application server was removed. Production is now a static React frontend plus the PHP API in `api/`; Node.js remains build/test tooling only. Any `server/` paths and Node-server behaviors below describe the retired implementation, not the current deployment.


The name suggestions themselves were already printed in the language the customer
ordered in, but the **meaning line under each name** was wrong in Tamil (and
Hindi) for most names — broken words such as `டமில் நமெ` for *"A Tamil name"*,
`இறைவன் இன் விஷெஸ்` for *"Lord of wishes"*, or `ஒருவர் யார் ஹஸ் அட்டைநெட்` for
*"One who has attained"*.

---

## What was wrong

| Where | Problem |
|---|---|
| `server/astrology/namakaranMeaning.ts` | A hand-written phrase table held only **511 of the 1141** meanings the name bank prints. Everything else fell through to a **word-by-word** translator, which produced Tamil like `டமில் நமெ` (transliterated "Tamil name") and Hindi like `एक ब्लिन्क का एये`. |
| `api/astrology/namakaran_meanings.php` | The same partial phrase table in PHP, so the official mPDF report was wrong in exactly the same way. |
| `server/astrology/namakaranNames.ts`, `api/astrology/pdf_mpdf_reports.php` | A cached `meaningTa` / `meaningHi` from an older order was **reused as-is**, so even after a fix the old broken text kept printing on saved orders. |

Result: 654 of the 1141 meanings (57%) were machine output — the "plenty word
mistakes" in the Tamil report.

---

## What it does now

1. **One curated glossary** — `data/namakaran_meaning_glossary.tsv` holds the
   English meaning of every name in the bank with its hand-written Tamil and
   Hindi text (1182 rows: 1141 cover the bank, the remaining 41 localize phrases
   printed outside the bank — the page-1 example-name table of the PHP engine
   and legacy cached meanings). The Tamil column was **rewritten from scratch**
   in one pass over all 1182 rows (not carried over from the earlier phrase
   table), in report style: plain noun phrases, `-உம் … -உம்` instead of a
   literal "மற்றும்", and no transliterated English inside a meaning.
2. **Generated for both engines** —
   `node scripts/build_namakaran_glossary.mjs` compiles the TSV into
   `server/astrology/namakaranMeaningData.ts` (browser preview + Node PDF) and
   `api/astrology/namakaran_meanings.php` (official mPDF report). Both files
   carry the **same content hash**, so the preview and the delivered PDF can be
   proven to print an identical meaning.
3. **The build fails on a gap** — the generator refuses to build if a single
   meaning of `data/namakaran_name_bank.tsv` has no translation, if a Tamil line
   contains Latin letters or non-Tamil script, or if a Hindi line is not
   Devanagari. A shipped name can therefore never fall back to word-by-word
   output again.
4. **Old orders are corrected on render** — the English meaning is the source
   value, so a cached `meaningTa` / `meaningHi` from an earlier order is
   re-localized instead of reused. A saved order prints the corrected text
   without a database migration.
5. **The word lists stay only as a safety net** — they are used for a meaning
   that is not in the bank at all (a custom or admin-entered name), after which
   the transliterator converts any leftover proper noun, so a Tamil or Hindi
   meaning line never shows English text.
6. **The PHP page-1 example table is localized too** — the legacy
   `AstroEngine::getBabyNameExamples()` list (Vedant, Karthik, Kavya, …) used to
   copy its English meaning into `meaningTa` / `meaningHi`; it now runs the same
   glossary lookup, so the Tamil and Hindi sheets never print an English clause
   in that table either. The example *names* are untouched.

### Example

| Name | English | Tamil (before → after) | Hindi (before → after) |
|---|---|---|---|
| Kothandaraman | Lord Rama, wielder of the bow | இறைவன் ராமர், விஎல்டெர் இன் பௌ → **வில்லேந்திய ராமபிரான்** | भगवान राम, विएल्देर का बौ → **धनुर्धर भगवान राम** |
| Santhosh | Contentment, joy | சொந்தெந்த்மெந்த், மகிழ்ச்சி → **திருப்தி, மகிழ்ச்சி** | चोन्तेन्त्मेन्त, आनंद → **संतोष, आनंद** |
| Nithilan | Lord of wishes | இறைவன் இன் விஷெஸ் → **விருப்பங்களை நிறைவேற்றும் இறைவன்** | भगवान का विशेस → **इच्छाओं के स्वामी** |
| Anjali | An offering of devotion | அர்ப்பணம் இன் டெவொடிஒன் → **பக்தியின் காணிக்கை** | एक अर्पण का देवोतिओन → **भक्ति का अर्पण** |

### Hindi verification

The Hindi column was audited row by row against the same checklist:

* **1182/1182 rows pass structure**: Devanagari only — no Latin, no digits, no
  double spaces, no repeated "और", no placeholder "अर्थ", and **no
  transliteration artifacts** (`देवोतिओन`, `एये`-style text is gone from the
  shipped data).
* **24 rows were corrected in this pass.** 19 dropped the literal article
  ("एक फूल" → **फूल**, "एक राजकुमार" → **राजकुमार**, "एक युग, काल" → **युग, काल**,
  "पृथ्वी, एक धारा" → **पृथ्वी, धारा**, …) and 5 were reworded
  (`कृष्ण का बाल्यकाल का घर` → **कृष्ण के बाल्यकाल का घर**,
  `सूर्य जैसे भगवान विष्णु` → **सूर्य के समान भगवान विष्णु**,
  `सांसारिक ज्ञान और बुद्धि वाला` → **सांसारिक ज्ञान और विवेक**, …).
* **Layout impact is neutral**: total Hindi ink −0.5 %, the widest Hindi meaning
  is unchanged at 170.9 px, and no corrected row is more than a few pixels wider
  than before.

---

## Editing a meaning

1. Open `data/namakaran_meaning_glossary.tsv` and edit (or add) the row for the
   English meaning. Columns are tab separated:

   ```
   english<TAB>tamil<TAB>hindi
   ```

2. Run the generator:

   ```bash
   node scripts/build_namakaran_glossary.mjs          # validate + regenerate
   node scripts/build_namakaran_glossary.mjs --check  # validate only (CI)
   ```

3. Both report engines, the browser preview and the email/PDF delivery pick the
   new text up on the next render — no other file needs editing.

Adding a name to `data/namakaran_name_bank.tsv` requires its meaning to be added
here as well; otherwise `scripts/build_namakaran_glossary.mjs` (and the test
suite) fails with the missing English meaning named explicitly.

---

## Testing

* `tests/namakaran-meanings.test.ts` — every meaning of the bank has a curated
  translation, all 27 Nakshatras × both genders × 4 padas print the glossary
  text (3201 names), no Tamil/Hindi line carries Latin text, both engines share
  one glossary hash, the generators are in sync, and a legacy order with cached
  broken text prints the corrected line.
* `tests/namakaran-page2.test.php` — the same guarantees for the official mPDF
  report, including the page-1 example names (every `AstroEngine` example
  meaning must print Tamil/Hindi, never English), the legacy-cache check and the
  generator `--check`.
* `npm test` (Node suite) and `npm run test:php` (PHP suite) both cover it.

Layout was verified with the real report fonts (`NotoSansTamil-Medium`,
`NotoSansDevanagari-Medium`, page-2 size 10 px): after the Tamil rewrite the
total width of the Tamil meanings is **6.3 % lower** than the previous glossary
(138678 → 129959 px), the widest Tamil meaning is **282.6 px** (down from
341.3 px) so **no meaning needs more than two lines** in a 163.8 px name cell,
and a wrap simulation over all 54 report pages (27 stars × male/female) gives
**153 fewer lines in total with a worst single page of +2 lines** — the Hindi
column is unchanged by this rewrite.
