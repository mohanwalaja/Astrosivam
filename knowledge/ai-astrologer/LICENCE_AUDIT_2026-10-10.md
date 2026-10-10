# Tamil source licence audit — 2026-10-10

Status: **audit only. No text downloaded, no renderings written, no reply logic changed.**
Machine-readable results: [`licence-audit.json`](./licence-audit.json).

## 1. Counts (198 Tamil records in `sources.json`)

| Result | Count | Records |
|---|---|---|
| **OPEN — archive.org licenseurl** | **2** | `acc.-no.-44889-machamuni-jothidam-piranki-muni-jothidam-2012` (PD Mark 1.0); `XjKB_pulippani-jothidam-300-…` (CC0 1.0) |
| **OPEN — site-wide CC BY-SA 4.0** | 2 | TA-25, TA-26 (ta.wikipedia.org articles, not books) |
| Not open — no licenseurl (archive.org) | 136 | 138 archive.org identifiers minus the 2 above |
| Not open — site says "Copyright © Reserved" | 57 | tamilnavarasam.in |
| Unclear — no licence stated | 1 | TP-03 thirunallarutemple.org (treated as NOT open) |
| CC BY-NC / CC BY-ND found | **0 / 0** | none |

Rule applied: OPEN = licenseurl containing `publicdomain/mark/1.0`, `creativecommons.org/publicdomain/zero`, `creativecommons.org/licenses/by/`, or `by-sa/`. No licenseurl = NOT open.

## 2. How each check was done

- **archive.org (138 identifiers, 6 batches of 23).** The advancedsearch URLs from the brief were fetched. All six returned 23 hits each. Batch 1 was re-checked directly and matches the progress note. Batches 2–6 were checked here for the first time. Only two identifiers carry a licenseurl. `TamilVirtualAcademy` is a collection, not an item, and was not counted as a source.
- **Open items, metadata only.** The metadata API was read for the two open items to get file lists and sizes. Nothing was downloaded.
- **tamilnavarasam.in.** The astrology index page and the About page were opened. The About page footer reads "Copyright 2017 © Reserved". The 57 PDFs were not opened or downloaded, because they are not open.
- **ta.wikipedia.org.** Both articles were opened. The site licence was read from the MediaWiki `siteinfo/rightsinfo` API: CC BY-SA 4.0.
- **thirunallarutemple.org.** All three chunks of the homepage were read. No licence or reuse statement was found.

## 3. Open items — text and provenance

| Item | Declared licence | Uploader | Text (djvu.txt) | Concern |
|---|---|---|---|---|
| Machamuni Jothidam, Piranki Muni Jothidam (2012), acc. 44889 | PD Mark 1.0 | kaldigitalarchive@outlook.com (2025) | **394,633 bytes**, 120 pages, OCR mostly high confidence | A 2012 print book is probably still in copyright in India. PD Mark is the uploader's assertion, not a legal finding. |
| Pulippani Jothidam 300, B R Balakrishna Nayakar | CC0 1.0 | muthulakshmi.research.academy@gmail.com (2021) | **169,773 bytes**, 84 pages | Item metadata says language **san**, OCR detected **Nepali** (script confidence 0.89). Most word-confidence bins are 0–10%, so the OCR is poor. The CC0 claim also depends on the uploader's rights. |

Combined djvu.txt: about **0.56 MB**. The PDFs (13.6 MB and 33.4 MB) are not needed and were not downloaded.

## 4. Things you need to know

1. **TA-02 and TA-07 are not open.** These are the only two Tamil books with `verifiedPassages` (passage-level citations). Both are archive.org `tdl.*` items with no licenseurl. Their passage `quote` text is stored in `sources.json`, and the rule files cite them: `guardrails.json`, `life-areas.json`, `remedies.json`, `report-sections.json`, and `api/astrology/life_cards_rules.json`. Live replies may therefore already rely on non-open text. I have not changed anything, but this needs your decision (see §5).
2. **TA-196 language mismatch.** The registry says `ta`. The archive.org item says `san`. The text is Tamil.
3. **Wikipedia (TA-25, TA-26)** is CC BY-SA. ShareAlike means any derived rule text may need to be released under the same licence. This matters for a paid product.
4. **Existing tests.** Baseline: 8 of 9 `tests/ai-astrologer-*.test.ts` files pass. `tamil-only` fails on `main` as you said. The `npx tsx tests/ai-astrologer-*.test.ts` glob only runs the first file, so each file was run separately.

## 5. Decisions needed from you

1. **NC/ND:** none were found, so nothing needs deciding for these categories.
2. **Accept the two archive items?** Yes, if you accept PD Mark / CC0 on the uploader's word. I recommend a rights check first for the 2012 Machamuni book, and a re-OCR or manual proof for the Pulippani text.
3. **Accept the two Wikipedia articles?** They are CC BY-SA 4.0 and are encyclopedia articles, not books. They can be used as internal references only, or cited with the ShareAlike obligation accepted.
4. **Thirunallar (TP-03):** exclude, unless the temple confirms a licence in writing.
5. **TA-02 / TA-07:** (a) get written permission, (b) remove the quotes and the rules that depend on them, or (c) keep them as internal reference only and mark them "not for citation". The current state is (c) in practice, and it should be made explicit.
6. **English and Hindi reviewers.** Renderings must be prepared and reviewed by named people, with a review date. I cannot supply reviewers or review dates. Please name them.

## 6. Proposed retrieval and reply design (not implemented)

**Corpus.** A new small file, `knowledge/ai-astrologer/passages.json`, containing only passages from sources whose status is `open`. Each entry has: `sourceId`, `archiveIdentifier`, `licenseurl`, `page`, `verse`, `topic` tags, the Tamil excerpt, `en` and `hi` renderings, and for each rendering `reviewer`, `reviewedOn`, and `status` (`draft` or `reviewed`). Only short excerpts are stored, not full djvu.txt. The full text stays out of Git.

**Retrieval.** Deterministic and local. Use the question's life-area and the chart features already in `rules/*.json`, match them against passage `topic` tags, and rank by tag overlap. No embeddings and no runtime model. A passage is eligible only if all of these hold: its source is in an approved-sources allowlist, its licence status is `open`, and the rendering for the requested language has `status: reviewed`. The allowlist defaults to empty, so behaviour is unchanged until you approve sources.

**Reply.** Assemble from the reviewed fields for the requested language (ta, en or hi). If no reviewed passage exists for that language, fall back to the existing curated rule text. Never translate at runtime. Each citation includes source ID and page or verse.

**Guard.** `checkReply()` runs on every reply after assembly, as it does today. Tests to add: no passage with a non-reviewed rendering is ever returned; no passage from a non-open or non-allowlisted source is returned; every citation has a page or verse; suppressed verses (`guardrails.json`) never appear in output.

**Hosting.** One JSON file, loaded per request, expected to be a few hundred KB at most. No new server process, no external API calls, no secrets in the browser.

Before I change any reply logic, please confirm the design above and answer §5.

## 7. Confirmed decisions (owner, 2026-10-10)

1. **Scope:** copyrighted (freely readable and unlicensed) books may be loaded for retrieval. The owner accepts the copyright risk.
2. **Display rule:** the chat shows only short reviewed excerpts (one verse or a few lines), each with source ID and page or verse. It never shows a full page or chapter. Full texts stay in the search index only.
3. **Unreviewed text:** stored for retrieval, never quoted to a customer until reviewed.
4. **Storage:** collected text lives outside Git (`/home/user/astro-texts`). Only reviewed excerpts enter the repo.
5. **Open items:** the 57 tamilnavarasam.in PDFs and any non-archive.org text need a separate collection step, to be decided with the owner.
