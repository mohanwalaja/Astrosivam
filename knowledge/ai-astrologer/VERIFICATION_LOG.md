# Verification log — ASTRO SIVAM AI Astrologer source registry

Every source in [`sources.json`](./sources.json) is backed by an entry here. Re-run these
checks any time to confirm the registry is still live.

**Verification date:** 2026-10-09
**Tools used:** `fetch_page` (page open + content read) and `web_search` (discovery only —
a search result alone is *never* treated as verification).

---

## 1. Method

A source entered the registry only after one of these returned real content:

| Method | Endpoint | What it proves |
|---|---|---|
| **Page open** | `fetch_page(<url>)` | The URL resolves and its content was read. Highest confidence. |
| **Item catalogue** | `https://archive.org/advancedsearch.php?q=identifier%3A%28A+OR+B+OR+...%29&fl[]=identifier&fl[]=title&fl[]=language&fl[]=creator&fl[]=year&output=json` | The identifier exists; title, language, author and year were read back from archive.org itself. |
| **Item metadata** | `https://archive.org/metadata/<identifier>` | The item exists and its file list, OCR language and derivative files were read. |
| **Full text** | `https://archive.org/stream/<identifier>/<name>_djvu.txt` | Body text was read (title page, index, chapter content). |
| **Bookseller catalogue** | two independent product pages | A print book exists with the stated author, publisher, ISBN and page count. |

**Rejected as verification:** a `web_search` snippet on its own. Search snippets were used
to *discover* candidates; each candidate was then opened or catalogue-checked before it was
allowed into the registry.

---

## 2. Exact checks performed

### 2.1 Classical texts — English

| Source | Check | Result |
|---|---|---|
| EN-01 | `fetch_page(https://archive.org/details/BPHSEnglish)` | Opened. Item description read verbatim: *"English Translation-cum-Commentary of Brihat Parashara Hora Shastra by Dr. R. Santhanam"*. Item size 794.0M. EPUB, PDF and `_djvu.txt` derivatives present for both volumes. |
| EN-02 | `fetch_page(https://archive.org/details/Phaladeepika2ndEd.1950ByVSubrahmanyaSastri)` **and** `fetch_page(.../Phaladeepika 2nd Ed. 1950 by V Subrahmanya Sastri_djvu.txt)` | Details page opened; full-text derivative opened in two chunks. **Title page read:** `MANTRESWARA'S PHALADEEPIKA (ADHYAYAS I—XXVIII) WITH AN ENGLISH TRANSLATION BY PANDITABHUSHANA V. SUBRAHMANYA SASTRI, BA. … SECOND EDITION – REVISED AND ENLARGED … ARUNA PRESS, BANGALORE 1950`. **Printed index read** — yielded the chapter anchors recorded in `sources.json` → `verifiedChapterAnchors`. Item metadata also read: 16 files, 703,259,685 bytes, one public review. |
| EN-03 | catalogue query, identifier `in.ernet.dli.2015.92117` | Returned: title *Mantreswaras Phaladeepika*, creator `Sastri,panditabhushana V. Subrahmanya,tr.`, year **1937**, language **eng**. |
| EN-04 | catalogue query, identifier `dli.csl.7888` | Returned: title *Saravali*, creator **Kalyanavarman**, year **1928**, language **eng**. |
| EN-05 | catalogue query, identifier `saravali00kalyuoft` | Returned: creators **Kalya Varma** and **Subrahmanya Sastri, V., of Bangalore**, year **1907**, language **san**. |
| EN-06 / EN-07 | catalogue query | Both returned: creator **V Subrahmanya Sastri**, language **English**. |
| EN-08 | catalogue query, identifier `brihat-parashara-hora-sastra` | Returned: creator **Rishi Parashara**, language **eng**, licence **Public Domain Mark 1.0**. |
| EN-09 | `fetch_page` on `bagchee.com` product page **and** the `occultnthings.com` product page | Both opened. They agree: author attributed to Kalidasa, translator **Prof. P.S. Sastri**, publisher **Ranjan Publications**, ISBN **8188230405 / 9788188230402**, ~264 pp. Marked `catalogue-verified` — **no free full text exists**, so it cannot be quoted from the web. |

### 2.2 Hindi

| Source | Check | Result |
|---|---|---|
| HI-01 | `fetch_page(https://archive.org/metadata/brihat-parashar-hora-shastra-vol-1)` | Opened. Read back: `language: hin`, OCR `tesseract 5.0.0-rc2-1-gf788` with `-l hin`, `ocr_detected_script: Devanagari` at conf 0.9733, 448 scanned pages, `_djvu.txt` derivative of 1,528,337 bytes present. |
| HI-02 … HI-13 | batched catalogue query on the identifier list | All eight queried in one batch returned `numFound: 8`; the remaining four (`20230523_20230523_1342`, `VedicRatnaRashiAstrology`, `in.ernet.dli.2015.321684`, `ravansamhita3`) returned `numFound: 4`. Titles, authors and years recorded from those responses. `ravansamhita3` was returned but **not** added to the registry (no author, no year, uncertain edition). |

### 2.3 Tamil — discovery then verification

**Discovery.** `fetch_page` on
`https://archive.org/advancedsearch.php?q=collection%3ATamilVirtualAcademy+AND+(ஜோதிடம்+OR+சோதிடம்)&fl[]=identifier&fl[]=title&rows=60&output=json`
→ `numFound: 128`. Two further result pages were read. Additional queries were run for
`நவக்கிரகம்`, `பரிகாரம்` and `பெயர்ச்சி` inside the same collection → `numFound: 18`.

**Verification.** All 20 candidate Tamil identifiers were then submitted as a single
batched catalogue query:

```
https://archive.org/advancedsearch.php?q=identifier:(tdl.8555-… OR tdl.39589-… OR tdl.23441-…
  OR tdl.25437-… OR tdl.2092-… OR tdl.27861-… OR tdl.8529-… OR tdl.8540 OR tdl.8553-…
  OR tdl.tdl_f3b15f-… OR tdl.44281-… OR tdl.30975-… OR tdl.21740-… OR 20250302_20250302_1126
  OR acc.-no.-44889-… OR tdl.tdl_dc487c-… OR tdl.28095-…
  OR dli.jZY9lup2kZl6TuXGlZQdjZM3kZpy.TVA_BOK_0008544 OR tdl.5866-… OR tdl.8543-…)
&fl[]=identifier&fl[]=title&fl[]=language&output=json
```

Result: **`numFound: 20`** — every queried identifier exists, all with `language: tam`.
The ten extra Tamil rows (TA-09, TA-26…TA-30) came from the same collection queries and
were confirmed by title in those result sets.

**Deepest Tamil check — TA-02.** `fetch_page(https://archive.org/details/tdl.8526-nuul-caatk-paaricaatm)`
opened the item page. Read back: title **நூல் – சாதக பாரிசாதம்**; keywords
**தமிழ் சோதிடம், சோதிடம், சாதக பாரிசாதம், சாதகம்**; collections
`TamilVirtualAcademy`, `JaiGyan`; language `Tamil`; item size 168.0M; OCR
`tesseract 5.3.0-6-g76ae` with `-l tam+Tamil`, detected language `ta` and script `Tamil` at
confidence **1.0000**; `Original_url` points at `tamildigitallibrary.in`.

> **Failed attempt, recorded for honesty:** a direct
> `fetch_page` on `https://www.tamildigitallibrary.in/…` and on
> `https://www.tamildigitallibrary.in/` both returned *"Failed to fetch page"*. The Tamil
> Digital Library site was **not** reachable from this environment, so the registry cites the
> **Internet Archive mirror** for every Tamil book, and REF-01 names the TVA collection as the
> access point. If `tamildigitallibrary.in` is reachable from the deployment server later, the
> `Original_url` on each item is the better citation.

### 2.4 Temples and Tamil temple tradition

| Source | Check | Result |
|---|---|---|
| TP-01 | `fetch_page(https://en.wikipedia.org/wiki/Navagraha_temples_in_Tamil_Nadu)` | Opened. Read: the nine-temple table (deity, graha, weekday, location); Shiva presides in most with a separate planetary shrine; Tirunallar is in **Karaikal district, Union Territory of Puducherry**, the rest in Thanjavur / Mayiladuthurai / Tiruvarur; masonry structures from the **Medieval Cholas, 7th–11th century**; six daily rituals 5:30 a.m.–9 p.m. |
| TP-02 | `fetch_page(https://en.wikipedia.org/wiki/Suryanar_Kovil)` | Opened. Read: presiding deity **Suriyanar** with consorts **Ushadevi** and **Pratyusha Devi**; separate shrines for the other eight grahas; **the only temple in Tamil Nadu with shrines for all nine planetary deities**; **the only one of the nine where Shiva is not the presiding deity**; built under **Kulottunga Choladeva (1060–1118 CE)** as *Kulottungachola-Marttandalaya*; administered by **TN HR&CE**; **Muthuswami Dikshitar** composed a kriti beginning *"Suryamurthe"* in **Saurashtra** ragam. |
| TP-03 | `fetch_page(https://thirunallarutemple.org/)` | **Opened — the strongest single verification in this registry.** Tamil body text read directly: திருநள்ளாறு is **சனிபகவானுக்கு உரிய பரிகாரத் தலம்**; the area was **தர்ப்பாரண்யம்** because darbha grew thickly, later **நகவிடங்கபுரம்**; மூலவர் **தர்ப்பாரண்யேஸ்வரர்**, அம்பிகை **பிராணேஸ்வரி**; King **Nala** was released from Sani's affliction here, hence **நள்ளாறு**; one of the **சப்தவிடங்கத் தலங்கள்** and of the seven swayambhu sthalams; praised by **அப்பர், சுந்தரர், சம்பந்தர்**. The page **explicitly recommends**: those wanting Sani dosha removed should sing the **திருஞானசம்பந்தர்** pathigam beginning **"போகமார்த்த பூண்முலையாள்"**, known as **பச்சைப் பதிகம்**. Page also carries the **Sani Peyarchi 2026** notice and shows the temple is under the **Department of Hindu Religious Institutions, Government of Puducherry**. |
| TP-04 … TP-12 | **not opened individually** | These nine Wikipedia URLs appear as links *inside* TP-01, which was opened. They are registered as `linked-not-opened` and must not be cited as authorities until opened. |

### 2.5 Rejected sources

| Candidate | Check | Result |
|---|---|---|
| `jyotishbooks.wordpress.com/category/authors/gita-press/` | `fetch_page` | **"jyotishbooks.wordpress.com is no longer available. This site has been archived or suspended for a violation of our Terms of Service."** → REF-04, marked `dead`. The Gita Press titles it listed (आरोग्य अंक code 1592, ज्योतिष तत्व अंक code 1980) are **excluded** from the registry. |
| `tamildigitallibrary.in` (direct) | `fetch_page` on the root and on one article path | Both **"Failed to fetch page"**. Recorded above; the Internet Archive mirrors are used instead. |
| `archive.org/oembed?url=…` | `fetch_page` on four identifiers | All four returned **"Page not found"** — the oEmbed endpoint does not work here. Switched to the `advancedsearch` API, which did work. |
| `ia600608.us.archive.org/fulltext/inside.php?…` (search-inside) | two parameter variants | Both returned `{"matches":[],"error":"No hOCR or Abbyy file present"}`. **In-book search is not available** for these items, so chapter anchors were instead taken from the Phaladeepika printed index, which was readable. |
| `wisdomlib.org/hinduism/book/phaladeepika` and `.../brihat-parashara-hora-shastra` | `fetch_page` | Both returned Wisdomlib's **"Page not found"**. Wisdomlib is **not** used anywhere in this registry. |

---

## 3. Re-verification recipe

To re-check the whole registry in one pass, submit every `sources.json` URL whose host is
`archive.org/details/…` to the batched catalogue query form used in §2.3 and confirm
`numFound` equals the number queried. Then re-open the eleven `content-read` URLs by hand:
EN-01, EN-02, HI-01, TA-02, TA-25, TP-01, TP-02, TP-03, REF-01, REF-02, REF-03.

## 4. Known limits of this verification pass

1. **45 of 68 sources are `metadata-verified`.** Existence, title, language and author are
   confirmed; **body text was not read.** Rules derived from them must be cited at book
   level, not verse level.
2. **Only one verse-adjacent anchor set was read** — the Phaladeepika printed index (EN-02),
   and only for the letters N–P of that index.
3. **`linked-not-opened` entries are not authorities.** They are placeholders with a
   confirmed link.
4. **REF-03 is a secondary blog.** It is kept because it enforces an honesty guardrail, and
   it is explicitly flagged as unverified against the primary texts.
