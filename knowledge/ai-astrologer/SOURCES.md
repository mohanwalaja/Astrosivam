# ASTRO SIVAM AI Astrologer — Verified Source List (Part 1, rev. 2)

**Registry:** `knowledge/ai-astrologer/sources.json` · **55 active sources** + **13 excluded** · verified **2026-10-09**

Machine-readable form: [`sources.json`](./sources.json) · method and failures: [`VERIFICATION_LOG.md`](./VERIFICATION_LOG.md)

> **Revision 2 applies four owner decisions taken on 2026-10-09:**
> 1. Tamil books are cited at **passage** level wherever a passage was actually read.
> 2. **TP-03** (Thirunallar, fully read) is sufficient for launch; TP-04…TP-12 stay `linked-not-opened`.
> 3. **Phaladeepika Adhyaya XXVI is the classical anchor** for Sade Sati wording.
> 4. **No Hindi source is used.** All 13 moved out of the active registry (§2).

---

## 0. How each row was verified

| Level | Meaning | Active |
|---|---|---|
| **content-read** | Opened the URL and read the content. Where a book was read through its full-text derivative, the row carries `verifiedPassages` and may be cited to a passage. | 11 |
| **metadata-verified** | The item exists; the catalogue returned identifier + title + language + author. Body not read. **Book-level citation only.** | 32 |
| **catalogue-verified** | Print book; two independent catalogues agree. No free full text. | 1 |
| **linked-not-opened** | Link seen inside a page that *was* opened. **Not citable as an authority.** | 10 |
| **dead** | Unreachable. Quarantined. | 1 |

Totals: 11 + 32 + 1 + 10 + 1 = **55 active**. Plus 13 excluded (§2).

---

## 1. English — classical texts (9)

| ID | Title | Lang | URL / Publisher | Useful for | Verified |
|---|---|---|---|---|---|
| EN-01 | **Brihat Parashara Hora Shastra** — Rishi Parashara; English translation-cum-commentary by **Dr. R. Santhanam**, 2 vols | en | [archive.org/details/BPHSEnglish](https://archive.org/details/BPHSEnglish) | Graha swarupa & karakatva; bhava results; **Vimshottari Dasha / Antardasha**; yogas and their cancellation; remedial measures | content-read |
| EN-02 | **Phaladeepika** (Adhyayas I–XXVIII) — Mantreswara; tr. **Panditabhushana V. Subrahmanya Sastri**, 2nd ed. **1950**, Aruna Press Bangalore | en | [archive.org](https://archive.org/details/Phaladeepika2ndEd.1950ByVSubrahmanyaSastri) | **Gochara — Adhyaya XXVI** · bhava phala · ailments (XIV) · dasha phala (XXIII) · yogas (VI) · remedial penance (XXVI-50) · pilgrimage (V-3) | content-read — title page **and** printed index |
| EN-03 | **Phaladeepika** — tr. V. Subrahmanya Sastri, **1937** (DLI scan; Visva-Bharati copy) | en | [archive.org](https://archive.org/details/in.ernet.dli.2015.92117) | Second independent scan for cross-checking EN-02 | metadata-verified |
| EN-04 | **Saravali** — Kalyana Varman, **1928**, Nirnaya Sagar Press, Bombay | en | [archive.org](https://archive.org/details/dli.csl.7888) | Graha-in-rasi results; planetary combinations in houses; yoga strength | metadata-verified |
| EN-05 | **Saravali** — Kalya Varma / V. Subrahmanya Sastri of Bangalore, **1907** (Sanskrit, 274 pp.) | sa | [archive.org](https://archive.org/details/saravali00kalyuoft) | Sanskrit original for checking English renderings | metadata-verified |
| EN-06 | **Jataka Parijata, Vol. I** — Vaidyanatha Dikshita; tr. V. Subrahmanya Sastri | en | [archive.org](https://archive.org/details/JatakaParijataVolIOfIIByVSubrahmanyaSastri) | Graha & rasi results; bhava phala; Vimshottari results; **stri jataka** | metadata-verified |
| EN-07 | **Jataka Parijata, Vol. II** — same author/translator | en | [archive.org](https://archive.org/details/JatakaParijataVolIIOfIIByVSubrahmanyaSastri) | Ayurdaya; ashtakavarga; kalachakra dasha; **gochara** | metadata-verified |
| EN-08 | **Brihat Parashara Hora Shastra** — simplified English edition (Public Domain Mark 1.0) | en | [archive.org](https://archive.org/details/brihat-parashara-hora-sastra) | Plain-language cross-check only — *never* the primary citation | metadata-verified |
| EN-09 | **Uttara Kalamrita** — attributed to Kalidasa; tr. **Prof. P. S. Sastri**, **Ranjan Publications**, ISBN 9788188230402 | en | [bagchee](https://www.bagchee.com/books/BB38082/uttara-kalamrita-by-kalidasa) · [occultnthings](https://occultnthings.com/products/uttara-kalamrita-kalidas-nar417) | Karaka lists; **yoga karaka per lagna**; elaborate **Rahu–Ketu**; retrogrades; Guru–Shani together | catalogue-verified (print only) |

> **Verified chapter anchors from the EN-02 printed index** — the only chapter-level citations
> the agent may make: ninth house — XXVI-2…8, 11, 15, 20, 21, 23 · **penance — XXVI-50** ·
> planetary war — XXVI-29 · penury — XXVI-37 · pain — XIV-9 · nervous diseases — XIV-41 ·
> *"palpitation — Rahu causes palpitation of the heart" — XIV-9* · piles — VIII-23 ·
> papa kartari — VI-8 · parivartana — VI-32 · pilgrimage to holy shrines — V-3 ·
> dismissal from office — XIX-14 · prarabdha & ashtakavarga — XXVII-17.
>
> **Decision 3 — Sade Sati.** Per REF-03 the agent may say the classical basis for the
> seven-and-a-half-year period is **Phaladeepika Adhyaya XXVI**, which gives Saturn's results
> house by house from the natal Moon, and that "Sade Sati" is the name the *later transit
> tradition* gave that period. It must not claim the phrase appears in a classical verse.

---

## 2. हिन्दी — **excluded by owner decision, not used**

> **Decision 4 (2026-10-09): "don't use any Hindi source."**
>
> All 13 Hindi entries below were moved from `sources` to `excludedSources` in the registry.
> The retrieval layer reads `sources` and never `excludedSources`, so **no Hindi book can
> reach a customer citation**, and the integrity test fails the build if one leaks back in.
>
> **Hindi answers are still produced.** A Hindi reply states rules sourced from the English
> classics or the Tamil corpus; only the reply language is Hindi. This is also the safer
> position on the evidence: most of these were `metadata-verified` modern uploads of
> uncertain provenance (two had no author, one no year), which is weaker ground than the
> English and Tamil corpus.

| ID | Excluded title | Was |
|---|---|---|
| HI-01 | बृहत्पराशरहोराशास्त्र Vol. 1 (Hindi) | content-read |
| HI-02 | पराशरहोराशास्त्र — Ganesh Datta Pathak | metadata-verified |
| HI-03 | बृहत्पराशरहोराशास्त्र — Girdhari Lal 1944 / Khemraj | metadata-verified |
| HI-04 | ज्योतिष-रत्नाकर — देवकीनन्दन सिंह, 1934 | metadata-verified |
| HI-05 | फलित राजेन्द्र — Brajesh Pathak, 2020 | metadata-verified |
| HI-06 | दुर्लभ लघु प्रयोग एवं नवग्रह महाविशेषांक, 2023 | metadata-verified |
| HI-07 | रत्न ज्योतिष — डॉ. नारायण दत्त श्रीमाली | metadata-verified |
| HI-08 | Vedic Ratna Rashi Astrology, 2018 | metadata-verified |
| HI-09 | हनुमान ज्योतिष | metadata-verified |
| HI-10 | प्रश्नचूड़ामणि — विष्णुदत्त, 1890 | metadata-verified |
| HI-11 | बृहसंहिता अर्थात बाराहीसंहिता — वराहमिहिर, 1893 | metadata-verified |
| HI-12 | सुगम ज्योतिष | metadata-verified |
| HI-13 | तार्किक ज्योतिष — Vipul Joshi, 2023 | metadata-verified |

**Consequence worth naming:** gemstone cautions previously leaned on HI-07 and HI-08. With
Hindi out, the only gemstone sources left are **EN-09** (Uttara Kalamrita, print-only). The
default position is therefore **not to recommend gemstones at all** — which also matches the
"no expensive remedies" guardrail. If you want a real gemstone policy, that needs a source.

---

## 3. ⭐ தமிழ் — TAMIL SOURCES (30)

All 30 come from the **தமிழ் இணையக் கல்விக் கழகம் / Tamil Digital Library** scans in the
`TamilVirtualAcademy` collection (REF-01), which returned **numFound 128** for
ஜோதிடம் / சோதிடம் on 2026-10-09.

**Two are now read to passage level: TA-02 and TA-07.** Those two, and only those two, may be
cited to a verse or page. See §3i for the passages.

### 3a. Tamil translations of the classical texts (6)

| ID | நூல் / Title | URL | Useful for | Verified |
|---|---|---|---|---|
| TA-01 | **நூல் – பூர்வபாராசரியம் : தமிழாக்கம்** | [tdl.8555](https://archive.org/details/tdl.8555-nuul-puurvpaaraacrym-tmilllaakkm) | **Tamil Parashari rules** — the Tamil answer cites a Tamil book | metadata-verified |
| TA-02 | **நூல் – சாதக பாரிசாதம்** | [tdl.8526](https://archive.org/details/tdl.8526-nuul-caatk-paaricaatm) | **Tamil Jataka Parijata.** Verse + `(இ-ள்.)` gloss, numbered verses, printed page numbers | **content-read — pp.20–24 read; 7 passages verified** |
| TA-03 | **நூல் – பிருஹஜ்ஜாதக மென்னும் மங்களேஸ்வரியம்** | [tdl.27861](https://archive.org/details/tdl.27861-nuul-piruhjjaatk-mennnnnnum-mngklleesvriiym-muulmum-uraiyum) | The standard **Tamil commentary on Brihat Jataka** | metadata-verified |
| TA-05 | **நூல் – சாதக சிந்தாமணி : கால நிகண்டு, காரக நிகண்டு – பாகம் 1** | [tdl.8529](https://archive.org/details/tdl.8529-nuul-caatk-cintaamnni-kaal-niknnttu-kaark-niknnttu-muulmum-uraiyum-paakm-1) | **Tamil karaka tables** | metadata-verified |
| TA-29 | **நூல் – மகாகவி காளிதாஸன் இயற்றிய ஜாதகசந்திரிகை** | [tdl.8341](https://archive.org/details/tdl.8341-nuul-mkaakvi-kaallitaasnnn-iyrrrriy-jaatkcntirikai) | Tamil Kalidasa-attributed Jataka Chandrika | metadata-verified |
| TA-21 | **குமாரசுவாமியம் (சோதிட நூல்)** — சரசுவதி மகால் நூலகம், தஞ்சாவூர், **2007** | [TVA_BOK_0008544](https://archive.org/details/dli.jZY9lup2kZl6TuXGlZQdjZM3kZpy.TVA_BOK_0008544) | Library-catalogued Tamil sothida text | metadata-verified |

### 3b. நவக்கிரகம் (3)

| ID | நூல் / Title | URL | Useful for | Verified |
|---|---|---|---|---|
| TA-08 | **நூல் – நவக்கிரகம்** | [tdl.2092](https://archive.org/details/tdl.2092-nuul-nvkkirkm) | Each of the nine grahas — swaroopa, weekday, colour, direction, deity | metadata-verified |
| TA-09 | **நவக்கிரகம்** (2nd Tamil edition) | [TVA_BOK_0002092](https://archive.org/details/dli.jZY9lup2kZl6TuXGlZQdjZU3l0xy.TVA_BOK_0002092) | Cross-check of TA-08 | metadata-verified |
| TA-11 | **நூல் – அசுவதி, பரணி, கார்த்திகையின் முற்பாதம் … நவக்கிரகபலன்** | [tdl.23441](https://archive.org/details/tdl.23441-nuul-acuvti-prnni-kaarttikaiyinnn-mutrrpaatm-ivaikllil-jnnnittvrkllukku-aann) | **நட்சத்திரம்-wise நவக்கிரக பலன்** | metadata-verified |

### 3c. பரிகாரம் — Tamil remedies (2)

| ID | நூல் / Title | URL | Useful for | Verified |
|---|---|---|---|---|
| TA-07 | **நவக்கிரக தோஷ பரிகாரம் என்னும் ஜாதக தெசாரிஷ்ட நிவாரணி** — கோமடம் ஸ்ரீனிவாச அய்யங்கார், **1946**, C. G. Urania press, சென்னை | [tdl.39589](https://archive.org/details/tdl.39589-nuul-nvkkirk-tooss-prikaarm-ennnnnnum-jaatk-tecaarisstt-nivaarnni) | **Primary Tamil remedies source.** Structured தசை → புக்தி → சாந்தி — exactly the shape the chat needs | **content-read — title page + pp.14–18; 7 passages verified** |
| TA-10 | **நூல் – நோய்களுக்குச் சித்த பரிகாரம் – பாகம் 1** | [tdl.25437](https://archive.org/details/tdl.25437-nuul-nooykllukkuc-citt-prikaarm-paakm-1) | Tamil spiritual practice around illness. **RESTRICTED** — spiritual framing only, always with "see a qualified doctor" | metadata-verified |

### 3d. நட்சத்திரம் (1) · 3e. கோசாரம் (2) · 3f. பஞ்சாங்கம் (2) · 3g. முகூர்த்தம் (3)

| ID | நூல் / Title | URL | Useful for | Verified |
|---|---|---|---|---|
| TA-06 | **நட்சத்திர சிந்தாமணி பாகம் 1** (பாகம் 2: [tdl.8554](https://archive.org/details/tdl.8554)) | [tdl.8553](https://archive.org/details/tdl.8553-nuul-nttcttir-cintaamnni-acuvinnni-mutl-puurm-muttiy-paakm-1) | Birth-star results; nakshatra lord and remedy; naming sounds | metadata-verified |
| TA-04 | **திநசரி கோசார போதினி : மூலமும் உரையும்** | [tdl.tdl_f3b15f](https://archive.org/details/tdl.tdl_f3b15f-nuul-tinnncri-koocaar-pootinnni-_-muulmum-uraiyum) | **Tamil gochara treatise** | metadata-verified |
| TA-15 | **குரு, சனி மாறுதல் சிறப்பு இதழ்** | [tdl.21740](https://archive.org/details/tdl.21740-nuul-kuru-cnnni-maarrutl-cirrppu-itlll) | **குரு / சனி பெயர்ச்சி**; ஏழரைச் சனி framing | metadata-verified |
| TA-25 | **திருக்கணிதப் பஞ்சாங்கம்** | [ta.wikipedia.org](https://ta.wikipedia.org/wiki/%E0%AE%A4%E0%AE%BF%E0%AE%B0%E0%AF%81%E0%AE%95%E0%AF%8D%E0%AE%95%E0%AE%A3%E0%AE%BF%E0%AE%A4%E0%AE%AA%E0%AF%8D_%E0%AE%AA%E0%AE%9E%E0%AF%8D%E0%AE%9A%E0%AE%BE%E0%AE%99%E0%AF%8D%E0%AE%95%E0%AE%AE%E0%AF%8D) | **Drik vs Vakya.** Confirmed: சிந்தாமணி ரகுநாத சாரி (1822–1880), Madras Observatory 1861–91, publishing from **1869**; accepted after a Kumbakonam Sankara Mutt scholars' meeting | content-read |
| TA-26 | **வாக்கியப் பஞ்சாங்கம்** | [ta.wikipedia.org](https://ta.wikipedia.org/wiki/%E0%AE%B5%E0%AE%BE%E0%AE%95%E0%AF%8D%E0%AE%95%E0%AE%BF%E0%AE%AF%E0%AE%AA%E0%AF%8D_%E0%AE%AA%E0%AE%9E%E0%AF%8D%E0%AE%9A%E0%AE%BE%E0%AE%99%E0%AF%8D%E0%AE%95%E0%AE%AE%E0%AF%8D) | Vakya background | linked-not-opened |
| TA-12 | **காலப்பிரகாசிகை (தமிழாக்கம்)** | [tdl.8540](https://archive.org/details/tdl.8540) | **Subha muhurtham in Tamil** | metadata-verified |
| TA-27 | **காலசக்கரம் (தெளிவான உரையுடன்)** | [tdl.8536](https://archive.org/details/tdl.8536) | Kalachakra and time cycles | metadata-verified |
| TA-28 | **சகாதேவ நிமித்த சூடாமணி** | [tdl.8534](https://archive.org/details/tdl.8534) | நிமித்தம் (omens) | metadata-verified |

### 3h. Tamil method, nadi & temple-tradition texts (11)

| ID | நூல் / Title | URL | Useful for | Verified |
|---|---|---|---|---|
| TA-13 | **தமிழ் சோதிட தரிசனம் என்னும் விதி விளக்கம்** | [tdl.44281](https://archive.org/details/tdl.44281-nuul-tmilll-cootitt-trsnnnm-ennnnnnum-viti-villkkm) | The Tamil *vidhi* behind a reading; native terms | metadata-verified |
| TA-14 | **சோதிடக்களஞ்சியம் : பாடல்களாகவும் வாக்கியங்களாகவும்** | [tdl.30975](https://archive.org/details/tdl.30975-nuul-cootittkkllnyciym-paattlkllaakvum-vaakkiyngkllaakvum-attngkiyirukkinnnr) | **வாக்கிய மரபு** rules in verse | metadata-verified |
| TA-16 | **போகமுனிவர் … பஞ்சபட்சி சாஸ்திரம்** | [tdl.27363](https://archive.org/details/tdl.27363-nuul-pookmunnnivr-tiruvaaymlrntrulliy-pnycpttci-caastirm) | A distinctly Tamil tradition. ⚠ Must be flagged as *not* the basis of the ASTRO SIVAM chart | metadata-verified |
| TA-17 | **ஜாதகசித்தி என்னும் அனுபோக சோதிட பிரம்ம ரகசியம்** | [tdl.tdl_dc487c](https://archive.org/details/tdl.tdl_dc487c-nuul-jaatkcitti-ennnnnnum-annnupook-cootitt-pirmm-rhsym-_-irnnttu-kaannttmum) | Tamil அனுபோக reading practice | metadata-verified |
| TA-18 | **சப்தரிஷிகள் … அனுபோக ஜாதக ரகசியம்** | [tdl.tdl_11a707](https://archive.org/details/tdl.tdl_11a707-nuul-cptrissikll-tiruvaaymlrntrulliy-annnupook-jaatk-rkciym) | Saptarishi / nadi conventions | metadata-verified |
| TA-19 | **சுக்ரநாடி என்னும் ஜோதிட சிகாமணி** | [tdl.28095](https://archive.org/details/tdl.28095-nuul-cukrnaatti-ennnnnnum-jootitt-cikaamnni-muulmum-uraiyum) | Tamil nadi school; **சுக்ரன்** — marriage, comfort, art, money | metadata-verified |
| TA-20 | **சூடாமணி உள்ளமுடையான் (உரையுடன்)** | [tdl.8543](https://archive.org/details/tdl.8543-nuul-cuuttaamnni-ullllmuttaiyaannn-uraiyuttnnn-cootitt-nuul) | Tamil sothida rules with commentary | metadata-verified |
| TA-22 | **இலக்கியத்தில் சோதிடம்** | [tdl.5866](https://archive.org/details/tdl.5866-nuul-ilkkiyttil-cootittm) | Astrology in Tamil literature — recognisable idioms | metadata-verified |
| TA-23 | **மச்சமுனி ஜோதிடம், பீராங்கி முனி ஜோதிடம், நந்திநூல் சாஸ்திரம், சோதிட சாந்திதீபம், கண்மகாண்டச் சருக்கம்** (Koviloor Andavar Library, 2012) | [acc.-no.-44889](https://archive.org/details/acc.-no.-44889-machamuni-jothidam-piranki-muni-jothidam-2012) | அகஸ்தியர்-lineage texts; சாந்தி practice | metadata-verified |
| TA-24 | **சூரியனார்கோயிலில் ஸ்தலவரலாறு** — ஜெயம் பதிப்பகம் | [archive 20250302](https://archive.org/details/20250302_20250302_1126) | Tamil **sthala puranam** of the Surya sthalam | metadata-verified |
| TA-30 | **சினேந்திர மாலை** | [tdl.8541](https://archive.org/details/tdl.8541-nuul-cinnneentir-maalai) | Tamil sothida verse text | metadata-verified |

### 3i. ⭐ The verified Tamil passages (decision 1)

**TA-02 — சாதக பாரிசாதம், printed pp.20–24 (2nd-house section).** Format is verse then
`(இ-ள்.)` gloss. Seven passages read:

| Verse | Page | Rule, as read | Ruling |
|---|---|---|---|
| 46 | 20 | காரகன் + சனி + சூரியன் in the 2nd → வறுமை; Rahu/Ketu with குளிகன் in the 2nd → poverty; benefics aspecting or occupying the 2nd → good for the family | **Usable** — Wealth & Finance card |
| 47 | 20 | 2nd lord in the 11th **and** 11th lord in the 2nd, or both in kendra/trikona → தர்மவான், கீர்த்திமான் | **Usable** |
| 48 | 22 | 2nd lord in the 6th or 12th; 12th lord in the 2nd; 11th lord in 6/8/12 → தன நாசம் | **Usable** — as a tendency to plan around, never a fixed loss |
| 50 | 23 | Lagna lord in the 2nd, 2nd lord in the 11th, 11th lord in the lagna → செல்வம் | **Usable** |
| 51 | 23 | Lagna, 12th and 9th lords all exalted or vargottama → great wealth | **Usable** — never as a guarantee |
| 53–57 | 23–24 | Named eye, ear and skin conditions (மாலைக்கண் நோய், காதில் நோய், நேத்திர ரோகம்; 59–60 add வைசூரி) | **DO NOT RELAY** — the agent never diagnoses |
| 58 | 24 | Benefics in the 2nd in exaltation/own varga, 2nd lord likewise → **வாக்கு சித்தி** | **Usable** — Education and Career answers on speaking, teaching, negotiation |

**TA-07 — நவக்கிரக தோஷ பரிகாரம், 1946, pp.14–18.** Structure is தசை → புக்தி → சாந்தி:

| Page | Dasha / Bhukti | What the page actually prescribes | Ruling |
|---|---|---|---|
| 15 | Rahu-linked மஹா அபிமிருத்யு தோஷம் | மஹிஷீதானம் (buffalo dana) | **Never relayed** — fear language + expensive |
| 15–16 | சூரிய / குரு | **சுவர்ண தானம்** on a Thursday (குருவாரம் புண்ணிய காலங்களில்), *"எதாசக்தி தக்ஷணையுடன்"*; Jupiter by house for 1, 3, 4, 8, 10, 12 | **Usable**, with the 1st-house death wording dropped |
| 16–17 | சூரிய / சனி | Timing: அஷ்டமி, சதுர்த்தசி, அமாவாசை, ஜன்ம நட்சத்திரம், குரூர காலம், பர்வதினம், ஞாயிறு/செவ்வாய்/வெள்ளி. Grains: கோதுமை, உளுந்து, நெல்லு, எள். நீல வஸ்திரம். மிருத்யுஞ்ஜயேஸ்வர பூஜை. ஆடு தானம் | **Usable in part** — timing, grains, cloth and japa are free; the goat is substituted |
| 17 | சூரிய / புதன் | **11 பலம் வெள்ளி பிரதிமை**; Wednesday; மல்லிகை, ஜாதி flowers; பச்சை வஸ்திரம்; சிம்ம வாகனம் | **Usable in part** |
| 17 | சூரிய / கேது | Ketu in the **9th or 7th**, or with those houses' lords → **துர்க்கை ஜெபம்** + **மஹா மிருத்யுஞ்ஜய ஜபம்** (+ goat dana) | **Usable in part** — the japa stands alone |
| 18 | சூரிய / சுக்ரன் | வெள்ளைப் பட்ட தானம், மிருத்யுஞ்ஜய ஜபம், ருத்ராட்ச ஜபம் | **Usable in part** |
| 18 | சந்திர / சந்திர | A weak Moon transiting the **12th, 8th or its own natal sign** → வெள்ளி தாமிர தானம்; Monday; பச்சரிசி; வெள்ளி தாமரைப்பூ; வெள்ளை வஸ்திரம் | **Usable** |

> **OCR caveat, recorded honestly.** TA-02 OCR is good — 26,136 of ~32,726 indexed words (80%)
> at confidence 91–100. **TA-07 OCR is only moderate — 7,029 of ~12,803 words (55%), with 228
> words at confidence 0–10.** Tamil quotations from TA-07 carry OCR noise and must be re-read
> against the scan before being shown verbatim to a customer. The *rule* is safe to use; the
> *verbatim string* is not yet.

---

## 3j. ⭐ The filter that makes a 1946 remedies text safe to quote

**This is the most important finding of revision 2.** Both Tamil books read at passage level
were written in a register this product is not allowed to use. They name death, they name
diseases, and they prescribe gold, silver images, goats and buffaloes.

So `sources.json` now carries a `guardrailTransforms` block that stores the **source text**
and the **transformed text** side by side. The retrieval layer returns only the transformed
text; the source text stays in the file so every citation is auditable.

**Dropped entirely:** மரணம் / மிருத்யு / அகால மிருத்யு as a predicted outcome · every named
disease (மாலைக்கண் நோய், காதில் நோய், நேத்திர ரோகம், வைசூரி, பித்த ரோகம்) · invocation of the
deity of death · loss of wife or children phrased as a certainty · தோஷம் used as a threat.

**Rewritten to:** a tendency, a period, and a practice — never "X will die / will lose his
wife / will go blind".

**Expensive → affordable.** The warrant for this is *in the text*: TA-07 repeatedly says
**"எதாசக்தி" / "யதாசக்தி"** — according to one's capacity. That phrase, read off the page, is
the textual authority for scaling down. The substitution is not an invention; it is the
book's own dial.

| Source remedy | Graha | Substitute |
|---|---|---|
| சுவர்ண தானம் (gold) | Guru | food or yellow items on a Thursday; support a teacher or student |
| 11 பலம் வெள்ளி பிரதிமை | Budha | a small silver coin, or green moong dal + green cloth on a Wednesday |
| ஆடு தானம் (goat) | Sani, Ketu | feed a cow or a stray; black sesame or mustard oil to a worker on Saturday |
| மஹிஷீதானம் (buffalo) | Rahu | dropped entirely — only the free Durga japa + Mrityunjaya japa |
| வெள்ளைப் பட்ட தானம் (silk) | Sukra | any clean white cloth to someone who needs it, on a Friday |

**Always allowed:** weekday observance · flower, colour and grain offerings · துர்க்கை ஜபம்,
மஹா மிருத்யுஞ்ஜய ஜபம், ருத்ராட்ச ஜபம் · a temple visit to the graha's Navagraha sthalam · the
Thirunallar Sambandar pathigam the temple itself names.

---

### 3k. Added 2026-10-10 - verified Tamil sources (3)

Each was added only after its page was opened. The new rows keep the registry levels exactly.

| ID | நூல் / Title | URL | Useful for | Verified |
|---|---|---|---|---|
| TA-31 | **ஜோதிஷசாஸ்திரம்** (மார்க்கலிங்க ஜோதிடர், 1938) | [dli.rmrl.008825](https://archive.org/details/dli.rmrl.008825) | Early Tamil jothisha text; book-level citation only | metadata-verified |
| TA-32 | **ஜோதிட புத்தகம்** (author not catalogued) | [20200421_20200421_1209](https://archive.org/details/20200421_20200421_1209) | General Tamil astrology reference; OCR unreliable, book-level only | metadata-verified |
| TA-33 | **தமிழ்நவரசம் ஜோதிட நூல்கள்** (listing page) | [tamilnavarasam.in](https://tamilnavarasam.in/astrologybook.aspx) | Lead list only. The PDFs are not opened, so this is NOT citable | linked-not-opened |

## 4. நவக்கிரக ஸ்தலங்கள் — Navagraha temple remedies (12)

Mapping **content-read** from TP-01:

| # | Graha | Temple | Place | District | Day |
|---|---|---|---|---|---|
| 1 | ☉ Surya | **Suryanar Kovil** | Suryanar Koil, nr. Aduthurai | Thanjavur | Sunday |
| 2 | ☽ Chandra | **Kailasanathar Temple** | Thingalur | Thanjavur | Monday |
| 3 | ♂ Angaraka | **Vaitheeswaran Koil** | Vaitheeswaran Koil | Mayiladuthurai | Tuesday |
| 4 | ☿ Budha | **Swetharanyeswarar Temple** | Thiruvenkadu | Mayiladuthurai | Wednesday |
| 5 | ♃ Guru | **Apatsahayesvarar Temple** | Alangudi | Thanjavur | Thursday |
| 6 | ♀ Sukra | **Agniswarar Temple** | Kanjanur | Thanjavur | Friday |
| 7 | ♄ Sani | **Dharbaranyeswarar Temple** | Thirunallar | **Karaikal, Puducherry UT** | Saturday |
| 8 | ☊ Rahu | **Naganathar Temple** | Thirunageswaram | Thanjavur | — |
| 9 | ☋ Ketu | **Nagannathaswamy Temple** | Keezhaperumpallam | Mayiladuthurai | — |

| ID | Source | URL | Useful for | Verified |
|---|---|---|---|---|
| TP-01 | **Navagraha temples in Tamil Nadu** | [en.wikipedia.org](https://en.wikipedia.org/wiki/Navagraha_temples_in_Tamil_Nadu) | Graha → temple → district → weekday mapping | **content-read** |
| TP-02 | **Suryanar Kovil** | [en.wikipedia.org](https://en.wikipedia.org/wiki/Suryanar_Kovil) | Surya remedies. **Only temple in TN with shrines for all nine grahas** — one trip covers everything | **content-read** |
| TP-03 | ⭐ **Thirunallar — official temple site** | [thirunallarutemple.org](https://thirunallarutemple.org/) | Read in full. **சனிபகவானுக்கு உரிய பரிகாரத் தலம்.** தர்ப்பாரண்யேஸ்வரர் / பிராணேஸ்வரி; King Nala freed here; சப்தவிடங்கத் தலம்; sung by அப்பர், சுந்தரர், சம்பந்தர். **The temple itself recommends** the திருஞானசம்பந்தர் pathigam beginning **"போகமார்த்த பூண்முலையாள்"** (பச்சைப் பதிகம்) for Sani dosha — a free, temple-endorsed remedy. Under the Puducherry Dept. of Hindu Religious Institutions, not TN HR&CE | **content-read** |
| TP-04 | Kailasanathar Temple, Thingalur | [en.wikipedia.org](https://en.wikipedia.org/wiki/Kailasanathar_Temple,_Thingalur) | Chandra remedies | linked-not-opened — **decision 2: not opened for launch** |
| TP-05 | Vaitheeswaran Koil | [en.wikipedia.org](https://en.wikipedia.org/wiki/Vaitheeswaran_Koil) | Chevvai remedies; the Vaidyanatha (healer) association | linked-not-opened |
| TP-06 | Swetharanyeswarar Temple, Thiruvenkadu | [en.wikipedia.org](https://en.wikipedia.org/wiki/Swetharanyeswarar_Temple) | Budhan remedies; study, speech, intellect | linked-not-opened |
| TP-07 | Apatsahayesvarar Temple, Alangudi | [en.wikipedia.org](https://en.wikipedia.org/wiki/Apatsahayesvarar_Temple,_Alangudi) | Guru remedies; marriage delay, children, education, wealth | linked-not-opened |
| TP-08 | Agniswarar Temple, Kanjanur | [en.wikipedia.org](https://en.wikipedia.org/wiki/Agniswarar_Temple,_Kanjanur) | Sukra remedies; marriage, comfort, art | linked-not-opened |
| TP-09 | Tirunallar Saniswaran Temple | [en.wikipedia.org](https://en.wikipedia.org/wiki/Tirunallar_Saniswaran_Temple) | Sani background only — prefer TP-03 | linked-not-opened |
| TP-10 | Rahu Stalam, Thirunageswaram | [en.wikipedia.org/wiki/Rahu_Stalam](https://en.wikipedia.org/wiki/Rahu_Stalam) | Rahu remedies | linked-not-opened |
| TP-11 | Nagannathaswamy Temple, Keezhaperumpallam | [en.wikipedia.org](https://en.wikipedia.org/wiki/Nagannathaswamy_Temple,_Keezhaperumpallam) | Ketu remedies | linked-not-opened |
| TP-12 | Tamil Nadu HR&CE portal | [hrce.tn.gov.in](https://hrce.tn.gov.in/) | Official darshan/seva | linked-not-opened |

---

## 5. Reference entries (4)

| ID | Entry | Useful for | Verified |
|---|---|---|---|
| REF-01 | **Tamil Virtual Academy / Tamil Digital Library collection** — [archive.org](https://archive.org/details/TamilVirtualAcademy) | Single access point for the Tamil corpus; **numFound 128** | content-read |
| REF-02 | **Internet Archive advancedsearch API** | The endpoint that confirmed every identifier. Re-run to re-verify | content-read |
| REF-03 | **"Sade Sati" caution** — [vidhata.app](https://vidhata.app/blog/sade-sati-shani-saturn-7-5-year-transit-explained) | **Decision 3:** the agent may anchor the seven-and-a-half-year period to **Phaladeepika Adhyaya XXVI** and call "Sade Sati" the later transit tradition's name. It must not claim the phrase is in a classical verse. Still a secondary source — read 2026-10-09, not proven against the primary texts | content-read (secondary) |
| REF-04 | ~~jyotishbooks.wordpress.com~~ | **DEAD** — WordPress reports it archived/suspended for a ToS violation. Its Gita Press titles are **excluded** | dead |

---

## 6. Gaps that remain after revision 2

1. **Gemstone policy has no source.** The two gemstone books in the registry were Hindi and
   are now excluded, leaving only EN-09 (print-only, no free text). **Default position:
   recommend no gemstones at all** - which also matches "no expensive remedies". If you want
   a real gemstone policy, it needs a source first.
2. **TA-07 verbatim Tamil is not yet quotable.** Its OCR is only 55% high-confidence. Use the
   rule, not the string, until the scan is re-read.
3. **28 of 30 Tamil books are still metadata-verified.** Only TA-02 and TA-07 are at passage
   level. Every other Tamil citation is book-level.
4. **TP-04…TP-12 are not opened** (decision 2 accepted this). The graha → temple → weekday
   mapping from TP-01 is safe; temple-specific detail beyond it is not quotable.
5. **No Hindi source at all** (decision 4). Hindi answers translate rules from the English
   and Tamil corpus.

## 7. Decisions recorded

| # | Question | Your answer | Effect |
|---|---|---|---|
| 1 | Read the top Tamil books to passage level? | **Yes — cite passages** | TA-02 and TA-07 read; 14 passages recorded with page/verse and a ruling |
| 2 | Open TP-04…TP-12? | **No — TP-03 is enough** | They stay `linked-not-opened`; TP-03 is the temple authority |
| 3 | Sade Sati wording | **Use Phaladeepika** | Adhyaya XXVI is the classical anchor; the phrase itself is later tradition |
| 4 | Gita Press / Hindi | **Don't use any Hindi source** | All 13 moved to `excludedSources`; test fails if one leaks back |
