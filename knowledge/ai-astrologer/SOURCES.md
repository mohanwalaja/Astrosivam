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

## 1. English — classical texts (12)

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
| EN-10 | **Brihat Jataka of Varaha Mihira** — tr. **N. Chidambaram Iyer**, **1885** | en | [archive.org/details/wg1079](https://archive.org/details/wg1079) | Graha strength, dignity and aspect; rashi & navamsa results; longevity / arishta. Cross-checks a Parashara reading against the Varahamihira tradition. **Internal reference — not citable to a customer** (see §8) | metadata-verified |
| EN-11 | **Prasna Marga** (2 vols) — Kerala tradition, c. **1649 CE**; English tr. and notes **Dr. B. V. Raman** | en | [archive.org/details/PrasnaMargaBVR](https://archive.org/details/PrasnaMargaBVR) | **Horary (prasna) method** — answering a question asked at a moment rather than from a birth chart; ashtamangala prasna; arudha lagna; badhaka sthana by sign modality. **Internal reference — the 20th-century translation is not public domain, so reference it, never reproduce it** | metadata-verified |
| EN-12 | **Muhurta Chintamani** — Daivagya Ramacharya (Mahidhar Sharma ed.) | sa | [archive.org](https://archive.org/details/muhurta-chintamani-of-daivagya-ramacharya-mahidhar-sharma) | Muhurtha selection; the panchanga limbs used to reject a muhurtha. Cross-checks the muhurtham rules this service already applies. **CC0 1.0** on the scan | metadata-verified |

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

### 3a. Tamil translations of the classical texts (7)

| ID | நூல் / Title | URL | Useful for | Verified |
|---|---|---|---|---|
| TA-01 | **நூல் – பூர்வபாராசரியம் : தமிழாக்கம்** | [tdl.8555](https://archive.org/details/tdl.8555-nuul-puurvpaaraacrym-tmilllaakkm) | **Tamil Parashari rules** — the Tamil answer cites a Tamil book | metadata-verified |
| TA-02 | **நூல் – சாதக பாரிசாதம்** | [tdl.8526](https://archive.org/details/tdl.8526-nuul-caatk-paaricaatm) | **Tamil Jataka Parijata.** Verse + `(இ-ள்.)` gloss, numbered verses, printed page numbers | **content-read — pp.20–24 read; 7 passages verified** |
| TA-03 | **நூல் – பிருஹஜ்ஜாதக மென்னும் மங்களேஸ்வரியம்** | [tdl.27861](https://archive.org/details/tdl.27861-nuul-piruhjjaatk-mennnnnnum-mngklleesvriiym-muulmum-uraiyum) | The standard **Tamil commentary on Brihat Jataka** | metadata-verified |
| TA-05 | **நூல் – சாதக சிந்தாமணி : கால நிகண்டு, காரக நிகண்டு – பாகம் 1** | [tdl.8529](https://archive.org/details/tdl.8529-nuul-caatk-cintaamnni-kaal-niknnttu-kaark-niknnttu-muulmum-uraiyum-paakm-1) | **Tamil karaka tables** | metadata-verified |
| TA-29 | **நூல் – மகாகவி காளிதாஸன் இயற்றிய ஜாதகசந்திரிகை** | [tdl.8341](https://archive.org/details/tdl.8341-nuul-mkaakvi-kaallitaasnnn-iyrrrriy-jaatkcntirikai) | Tamil Kalidasa-attributed Jataka Chandrika | metadata-verified |
| TA-21 | **குமாரசுவாமியம் (சோதிட நூல்)** — சரசுவதி மகால் நூலகம், தஞ்சாவூர், **2007** | [TVA_BOK_0008544](https://archive.org/details/dli.jZY9lup2kZl6TuXGlZQdjZM3kZpy.TVA_BOK_0008544) | Library-catalogued Tamil sothida text | metadata-verified |
| TA-196 | **புலிப்பாணி ஜோதிடம் 300** — attributed to **Pulippani Siddhar**, published by B. R. Balakrishna Nayakar | [archive.org](https://archive.org/details/XjKB_pulippani-jothidam-300-pulippani-siddhar-tamil-b-r-balakrishna-nayakar) | Siddhar-tradition Tamil jyotisha verse, alongside the Bogar work at TA-16; plain-language graha-placement readings; parihara phrasing in the Tamil idiom. **CC0 1.0** on the scan, but the palm-leaf attribution is traditional rather than settled — cite the text, do not assert the authorship. Note the catalogue's language field wrongly says `san` for this Tamil item. | metadata-verified |

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

### 3l. Added 2026-10-10 - Tamil Digital Library catalogue batch (10)

Catalogue-verified via the Archive.org advancedsearch API (identifier, title, language). Book-level citation only; no body text read.

| ID | நூல் / Title | URL | Useful for | Verified |
|---|---|---|---|---|
| TA-34 | **சோதிடம்** | [tdl.3332-cootittm](https://archive.org/details/tdl.3332-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-35 | **சோதிடம்** | [tdl.3400-cootittm](https://archive.org/details/tdl.3400-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-36 | **சோதிடம்** | [tdl.2481-cootittm](https://archive.org/details/tdl.2481-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-37 | **சோதிடம்** | [tdl.5071-cootittm](https://archive.org/details/tdl.5071-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-38 | **சோதிடம்** | [tdl.3526-cootittm](https://archive.org/details/tdl.3526-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-39 | **சோதிடம்** | [tdl.tdl_0a0ced-cootittm](https://archive.org/details/tdl.tdl_0a0ced-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-40 | **சோதிடம்** | [tdl.tdl_606b02-cootittm](https://archive.org/details/tdl.tdl_606b02-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-41 | **சோதிடம்** | [tdl.tdl_e15980-cootittm](https://archive.org/details/tdl.tdl_e15980-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-42 | **நூல் - சோதிட ஆராய்ச்சி : சோதிடப் புறட்டு பாட்டுகளும் சேர்ந்தது** | [tdl.41069-nuul-cootitt-aaraaycci-cootittp-purrttttu-paattttukllum-ceernttu](https://archive.org/details/tdl.41069-nuul-cootitt-aaraaycci-cootittp-purrttttu-paattttukllum-ceernttu) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-43 | **நூல் - உலோககுரு ஆதி சங்கராச்சாரிய சுவாமிகள் சோதிடம் பன்னீராயிரத்தில் சகோதரபாவகம்** | [tdl.21938-nuul-ulookkuru-aati-cngkraaccaariy-cuvaamikll-cootittm-pnnnnnniiraayirttil-c](https://archive.org/details/tdl.21938-nuul-ulookkuru-aati-cngkraaccaariy-cuvaamikll-cootittm-pnnnnnniiraayirttil-c) | Tamil sothidam text; book-level citation only | metadata-verified |

### 3m. Added 2026-10-10 - TVA catalogue, astrology titles (36)

Identifiers from the Archive.org advancedsearch API. Titles are not decoded and the bodies were not read, so these are book-level pointers only.

| ID | Title | URL | Useful for | Verified |
|---|---|---|---|---|
| TA-44 | Tamil astrology text (`tdl.tdl_51d28e-mruttuvm-cootittm`) | [link](https://archive.org/details/tdl.tdl_51d28e-mruttuvm-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-45 | Tamil astrology text (`tdl.23508-nuul-ulookkuru-aati-cngkraaccaariy-cuvaamikll-cootittm-pnnnnnniiraayirttil-p`) | [link](https://archive.org/details/tdl.23508-nuul-ulookkuru-aati-cngkraaccaariy-cuvaamikll-cootittm-pnnnnnniiraayirttil-p) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-46 | Tamil astrology text (`tdl.4659-cootittm`) | [link](https://archive.org/details/tdl.4659-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-47 | Tamil astrology text (`tdl.22653-nuul-caatk-alngkaarm-cootittm-caattirm-ceyyull-tokuppurai-villkkttuttnnn`) | [link](https://archive.org/details/tdl.22653-nuul-caatk-alngkaarm-cootittm-caattirm-ceyyull-tokuppurai-villkkttuttnnn) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-48 | Tamil astrology text (`tdl.49928-nuul-pulippaannimkaamunnnivr-tiruvaaymlrntrulliy-cootittm-munnuurru`) | [link](https://archive.org/details/tdl.49928-nuul-pulippaannimkaamunnnivr-tiruvaaymlrntrulliy-cootittm-munnuurru) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-49 | Tamil astrology text (`tdl.56658-nuul-cukkirnaatti-cootittm-aannnntkllippum-tirvukoolum-immuunnnrrum-attngkiy`) | [link](https://archive.org/details/tdl.56658-nuul-cukkirnaatti-cootittm-aannnntkllippum-tirvukoolum-immuunnnrrum-attngkiy) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-50 | Tamil astrology text (`tdl.tdl_17c15a-cootittm`) | [link](https://archive.org/details/tdl.tdl_17c15a-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-51 | Tamil astrology text (`tdl.tdl_69b242-cootittm`) | [link](https://archive.org/details/tdl.tdl_69b242-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-52 | Tamil astrology text (`tdl.tdl_f38662-cootittm-25`) | [link](https://archive.org/details/tdl.tdl_f38662-cootittm-25) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-53 | Tamil astrology text (`tdl.tdl_760b07-cootittm`) | [link](https://archive.org/details/tdl.tdl_760b07-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-54 | Tamil astrology text (`tdl.5072-cootittm`) | [link](https://archive.org/details/tdl.5072-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-55 | Tamil astrology text (`tdl.1185-nuul-ilkkiyttil-cootittm`) | [link](https://archive.org/details/tdl.1185-nuul-ilkkiyttil-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-56 | Tamil astrology text (`tdl.1589-cootittm`) | [link](https://archive.org/details/tdl.1589-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-57 | Tamil astrology text (`tdl.49931-nuul-akstiyr-arulliy-mnniknntt-keerll-cootittm-muulmum-uraiyum`) | [link](https://archive.org/details/tdl.49931-nuul-akstiyr-arulliy-mnniknntt-keerll-cootittm-muulmum-uraiyum) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-58 | Tamil astrology text (`tdl.5057-cootittm`) | [link](https://archive.org/details/tdl.5057-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-59 | Tamil astrology text (`tdl.tdl_ff8539-cootittm`) | [link](https://archive.org/details/tdl.tdl_ff8539-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-60 | Tamil astrology text (`tdl.3128-cootittm`) | [link](https://archive.org/details/tdl.3128-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-61 | Tamil astrology text (`tdl.tdl_dedfaf-cootittm`) | [link](https://archive.org/details/tdl.tdl_dedfaf-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-62 | Tamil astrology text (`tdl.tdl_e30436-cootittm-tcaap-puttipplnnnkll`) | [link](https://archive.org/details/tdl.tdl_e30436-cootittm-tcaap-puttipplnnnkll) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-63 | Tamil astrology text (`tdl.006345-jootittm-tottrpaak`) | [link](https://archive.org/details/tdl.006345-jootittm-tottrpaak) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-64 | Tamil astrology text (`tdl.tdl_244bba-cootittm`) | [link](https://archive.org/details/tdl.tdl_244bba-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-65 | Tamil astrology text (`tdl.tdl_54f220-cootittm`) | [link](https://archive.org/details/tdl.tdl_54f220-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-66 | Tamil astrology text (`tdl.23591-nuul-ulookkuru-aati-cngkraaccaariy-cuvaamikll-cootittm-pnnnnnniiraayirttil-k`) | [link](https://archive.org/details/tdl.23591-nuul-ulookkuru-aati-cngkraaccaariy-cuvaamikll-cootittm-pnnnnnniiraayirttil-k) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-67 | Tamil astrology text (`tdl.tdl_addcca-cootittm`) | [link](https://archive.org/details/tdl.tdl_addcca-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-68 | Tamil astrology text (`tdl.tdl_ce7adb-cootittm`) | [link](https://archive.org/details/tdl.tdl_ce7adb-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-69 | Tamil astrology text (`tdl.tdl_3c221e-cootittm`) | [link](https://archive.org/details/tdl.tdl_3c221e-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-70 | Tamil astrology text (`tdl.tdl_bbd27c-cootittm`) | [link](https://archive.org/details/tdl.tdl_bbd27c-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-71 | Tamil astrology text (`tdl.tdl_7ba91d-cootittm`) | [link](https://archive.org/details/tdl.tdl_7ba91d-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-72 | Tamil astrology text (`tdl.28098-nuul-akstiyr-arullicceyt-mnniknntt-keerll-cootittm`) | [link](https://archive.org/details/tdl.28098-nuul-akstiyr-arullicceyt-mnniknntt-keerll-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-73 | Tamil astrology text (`tdl.21939-nuul-ulookkuru-aati-cngkraaccaariy-cuvaamikll-cootittm-pnnnnnniiraayirttil-y`) | [link](https://archive.org/details/tdl.21939-nuul-ulookkuru-aati-cngkraaccaariy-cuvaamikll-cootittm-pnnnnnniiraayirttil-y) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-74 | Tamil astrology text (`tdl.22650-nuul-caatk-alngkaarm-cootittm-caattirm-ceyyull-tokuppurai-villkkttuttnnn`) | [link](https://archive.org/details/tdl.22650-nuul-caatk-alngkaarm-cootittm-caattirm-ceyyull-tokuppurai-villkkttuttnnn) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-75 | Tamil astrology text (`tdl.49994-nuul-pulippaanni-mkaamunnnivr-tiruvaaymlrntrulliy-cootittm-munnuurru`) | [link](https://archive.org/details/tdl.49994-nuul-pulippaanni-mkaamunnnivr-tiruvaaymlrntrulliy-cootittm-munnuurru) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-76 | Tamil astrology text (`tdl.5066-akttiyr-cootittm`) | [link](https://archive.org/details/tdl.5066-akttiyr-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-77 | Tamil astrology text (`tdl.tdl_a35035-cootittm-mnnnaiylngkaarm`) | [link](https://archive.org/details/tdl.tdl_a35035-cootittm-mnnnaiylngkaarm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-78 | Tamil astrology text (`tdl.3127-cootittm`) | [link](https://archive.org/details/tdl.3127-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |
| TA-79 | Tamil astrology text (`tdl.4979-cootittm`) | [link](https://archive.org/details/tdl.4979-cootittm) | Tamil sothidam text; book-level citation only | metadata-verified |

### 3n. Added 2026-10-10 - TVA catalogue, body-text matches (60)

Identifiers from the Archive.org advancedsearch API. Titles are not decoded and bodies were not read. Subject is not confirmed for these items.

| ID | Title | URL | Useful for | Verified |
|---|---|---|---|---|
| TA-80 | Tamil text (`tdl.5105-nuul-tiruvtikai-apprcuvaamikllennnnnnum-tirunaavukkrcu-cuvaamikll-pillllaitt`) | [link](https://archive.org/details/tdl.5105-nuul-tiruvtikai-apprcuvaamikllennnnnnum-tirunaavukkrcu-cuvaamikll-pillllaitt) | Subject to be confirmed; book-level only | metadata-verified |
| TA-81 | Tamil text (`tdl.25389-nuul-roomrissi-arullicceyt-vinaatti-pnycpttci-muulmum-tnycai-krunnaaniti-pil`) | [link](https://archive.org/details/tdl.25389-nuul-roomrissi-arullicceyt-vinaatti-pnycpttci-muulmum-tnycai-krunnaaniti-pil) | Subject to be confirmed; book-level only | metadata-verified |
| TA-82 | Tamil text (`tdl.48639-nuul-potiymlaiyi-leluntrulliy-akttiymunnnivr-tiruvaaymlrntrulliy-pnycpttci-c`) | [link](https://archive.org/details/tdl.48639-nuul-potiymlaiyi-leluntrulliy-akttiymunnnivr-tiruvaaymlrntrulliy-pnycpttci-c) | Subject to be confirmed; book-level only | metadata-verified |
| TA-83 | Tamil text (`tdl.6055-1980-2005`) | [link](https://archive.org/details/tdl.6055-1980-2005) | Subject to be confirmed; book-level only | metadata-verified |
| TA-84 | Tamil text (`tdl.24741-nuul-roomrissi-arullicceyt-vinaatti-pnycpttci-muulmum-tnycai-krunnaaniti-pil`) | [link](https://archive.org/details/tdl.24741-nuul-roomrissi-arullicceyt-vinaatti-pnycpttci-muulmum-tnycai-krunnaaniti-pil) | Subject to be confirmed; book-level only | metadata-verified |
| TA-85 | Tamil text (`tdl.50083-nuul-cittr-rhsymennnnnnum-aaruutt-alngkaarm-muulmum-uraiyum`) | [link](https://archive.org/details/tdl.50083-nuul-cittr-rhsymennnnnnum-aaruutt-alngkaarm-muulmum-uraiyum) | Subject to be confirmed; book-level only | metadata-verified |
| TA-86 | Tamil text (`tdl.49955-nuul-srii-nntikeecuvrr-prikssittu-mkiptikkut-tiruvaaymlrntrulliy-nntivaakkiy`) | [link](https://archive.org/details/tdl.49955-nuul-srii-nntikeecuvrr-prikssittu-mkiptikkut-tiruvaaymlrntrulliy-nntivaakkiy) | Subject to be confirmed; book-level only | metadata-verified |
| TA-87 | Tamil text (`tdl.23435-nuul-cuntrceekrttirrku-irnnttaampaakmaakiy-tiyaakraaj-ceekrm`) | [link](https://archive.org/details/tdl.23435-nuul-cuntrceekrttirrku-irnnttaampaakmaakiy-tiyaakraaj-ceekrm) | Subject to be confirmed; book-level only | metadata-verified |
| TA-88 | Tamil text (`tdl.28123-603`) | [link](https://archive.org/details/tdl.28123-603) | Subject to be confirmed; book-level only | metadata-verified |
| TA-89 | Tamil text (`tdl.8328-nuul-vaalaiyrull-ptinnnenn-cittrkll-pnycpttci-crittirm-uraiyum-villkkmum`) | [link](https://archive.org/details/tdl.8328-nuul-vaalaiyrull-ptinnnenn-cittrkll-pnycpttci-crittirm-uraiyum-villkkmum) | Subject to be confirmed; book-level only | metadata-verified |
| TA-90 | Tamil text (`tdl.8557`) | [link](https://archive.org/details/tdl.8557) | Subject to be confirmed; book-level only | metadata-verified |
| TA-91 | Tamil text (`tdl.28312-nuul-mrnnknntti-yennnnnnum-jootisscaastirm`) | [link](https://archive.org/details/tdl.28312-nuul-mrnnknntti-yennnnnnum-jootisscaastirm) | Subject to be confirmed; book-level only | metadata-verified |
| TA-92 | Tamil text (`tdl.tdl_3e0f25-nuul-praacrmunnnivr-vttmollliyil-iyrrrriy-ticaaputtiplnnn-attngkiy-paaraacaa`) | [link](https://archive.org/details/tdl.tdl_3e0f25-nuul-praacrmunnnivr-vttmollliyil-iyrrrriy-ticaaputtiplnnn-attngkiy-paaraacaa) | Subject to be confirmed; book-level only | metadata-verified |
| TA-93 | Tamil text (`tdl.50012-nuul-periy-cootitt-jaatk-knnit-paalcikssai`) | [link](https://archive.org/details/tdl.50012-nuul-periy-cootitt-jaatk-knnit-paalcikssai) | Subject to be confirmed; book-level only | metadata-verified |
| TA-94 | Tamil text (`tdl.50110-12000`) | [link](https://archive.org/details/tdl.50110-12000) | Subject to be confirmed; book-level only | metadata-verified |
| TA-95 | Tamil text (`tdl.50073-nuul-sriiptiyinnn-annnupv-jaatkm`) | [link](https://archive.org/details/tdl.50073-nuul-sriiptiyinnn-annnupv-jaatkm) | Subject to be confirmed; book-level only | metadata-verified |
| TA-96 | Tamil text (`tdl.tdl_792d77-nuul-taannttvraayr-arullicceyt-taannttvmaalai`) | [link](https://archive.org/details/tdl.tdl_792d77-nuul-taannttvraayr-arullicceyt-taannttvmaalai) | Subject to be confirmed; book-level only | metadata-verified |
| TA-97 | Tamil text (`tdl.24690-nuul-akstiyr-arullicceyt-mnniknntt-keerllcootittm`) | [link](https://archive.org/details/tdl.24690-nuul-akstiyr-arullicceyt-mnniknntt-keerllcootittm) | Subject to be confirmed; book-level only | metadata-verified |
| TA-98 | Tamil text (`tdl.24528-nuul-akttiyr-aayurveet-caattirm`) | [link](https://archive.org/details/tdl.24528-nuul-akttiyr-aayurveet-caattirm) | Subject to be confirmed; book-level only | metadata-verified |
| TA-99 | Tamil text (`tdl.34970-nuul-aatisaamuttirikm-ennnnnnum-avyvlkssnncaastirm`) | [link](https://archive.org/details/tdl.34970-nuul-aatisaamuttirikm-ennnnnnum-avyvlkssnncaastirm) | Subject to be confirmed; book-level only | metadata-verified |
| TA-100 | Tamil text (`tdl.33041-astronomy-and-astrology-eclipses-of-the-sun`) | [link](https://archive.org/details/tdl.33041-astronomy-and-astrology-eclipses-of-the-sun) | Subject to be confirmed; book-level only | metadata-verified |
| TA-101 | Tamil text (`tdl.44804-nuul-akstiyr-arullicceyt-mnniknntt-keerllcootittm`) | [link](https://archive.org/details/tdl.44804-nuul-akstiyr-arullicceyt-mnniknntt-keerllcootittm) | Subject to be confirmed; book-level only | metadata-verified |
| TA-102 | Tamil text (`tdl.39433-nuul-tuhpttul-hintu-mutrr-pirivum-irnnttaam-pirivum`) | [link](https://archive.org/details/tdl.39433-nuul-tuhpttul-hintu-mutrr-pirivum-irnnttaam-pirivum) | Subject to be confirmed; book-level only | metadata-verified |
| TA-103 | Tamil text (`tdl.27860-nuul-nvkkirk-cintaamnni-ennnnnnum-caatkcuuttaamnni-muulmum-uraiyum`) | [link](https://archive.org/details/tdl.27860-nuul-nvkkirk-cintaamnni-ennnnnnum-caatkcuuttaamnni-muulmum-uraiyum) | Subject to be confirmed; book-level only | metadata-verified |
| TA-104 | Tamil text (`tdl.8544`) | [link](https://archive.org/details/tdl.8544) | Subject to be confirmed; book-level only | metadata-verified |
| TA-105 | Tamil text (`tdl.9365-nuul-cootittk-kllnyciym-paattlkllaakvum-vaakkiyngkllaakvum-attngkiyirukkinnn`) | [link](https://archive.org/details/tdl.9365-nuul-cootittk-kllnyciym-paattlkllaakvum-vaakkiyngkllaakvum-attngkiyirukkinnn) | Subject to be confirmed; book-level only | metadata-verified |
| TA-106 | Tamil text (`tdl.tdl_f3726c-nuul-caamuttirikaa-lttcnnm-ennnnnnum-kmlmaamunnnivr-ireekai-caastirm-muulmum`) | [link](https://archive.org/details/tdl.tdl_f3726c-nuul-caamuttirikaa-lttcnnm-ennnnnnum-kmlmaamunnnivr-ireekai-caastirm-muulmum) | Subject to be confirmed; book-level only | metadata-verified |
| TA-107 | Tamil text (`tdl.24734-nuul-ptinnnennpeyrkll-tiruvaaymlrntrulliy-naatticaastirm`) | [link](https://archive.org/details/tdl.24734-nuul-ptinnnennpeyrkll-tiruvaaymlrntrulliy-naatticaastirm) | Subject to be confirmed; book-level only | metadata-verified |
| TA-108 | Tamil text (`tdl.8349-nuul-caatk-alngkaarm-cootitt-caattirm-ceyyull-tokuppurai-villkkttuttnnn`) | [link](https://archive.org/details/tdl.8349-nuul-caatk-alngkaarm-cootitt-caattirm-ceyyull-tokuppurai-villkkttuttnnn) | Subject to be confirmed; book-level only | metadata-verified |
| TA-109 | Tamil text (`tdl.8537`) | [link](https://archive.org/details/tdl.8537) | Subject to be confirmed; book-level only | metadata-verified |
| TA-110 | Tamil text (`tdl.25282-108`) | [link](https://archive.org/details/tdl.25282-108) | Subject to be confirmed; book-level only | metadata-verified |
| TA-111 | Tamil text (`tdl.8532`) | [link](https://archive.org/details/tdl.8532) | Subject to be confirmed; book-level only | metadata-verified |
| TA-112 | Tamil text (`tdl.51650-nuul-cntaannnmnni`) | [link](https://archive.org/details/tdl.51650-nuul-cntaannnmnni) | Subject to be confirmed; book-level only | metadata-verified |
| TA-113 | Tamil text (`tdl.tdl_0c88eb-nuul-knnnvukllinnn-plaaplnnnkll`) | [link](https://archive.org/details/tdl.tdl_0c88eb-nuul-knnnvukllinnn-plaaplnnnkll) | Subject to be confirmed; book-level only | metadata-verified |
| TA-114 | Tamil text (`tdl.24915-603`) | [link](https://archive.org/details/tdl.24915-603) | Subject to be confirmed; book-level only | metadata-verified |
| TA-115 | Tamil text (`tdl.23439-nuul-kmlmaamunnnivr-arullicceyt-caamuttirikaa-lkssnnm-ennnnnnum-hst-ireekai-`) | [link](https://archive.org/details/tdl.23439-nuul-kmlmaamunnnivr-arullicceyt-caamuttirikaa-lkssnnm-ennnnnnum-hst-ireekai-) | Subject to be confirmed; book-level only | metadata-verified |
| TA-116 | Tamil text (`tdl.24654-nuul-nttcttir-cintaamnni-uttiraattm-mutl-reevti-muttiy-paakm-3`) | [link](https://archive.org/details/tdl.24654-nuul-nttcttir-cintaamnni-uttiraattm-mutl-reevti-muttiy-paakm-3) | Subject to be confirmed; book-level only | metadata-verified |
| TA-117 | Tamil text (`tdl.39446-nuul-tmilllc-cuvttikllinnn-villkkm-ptinnnaarraavtu-tokuppu-ilkkiyp-pkuti`) | [link](https://archive.org/details/tdl.39446-nuul-tmilllc-cuvttikllinnn-villkkm-ptinnnaarraavtu-tokuppu-ilkkiyp-pkuti) | Subject to be confirmed; book-level only | metadata-verified |
| TA-118 | Tamil text (`tdl.50017-nuul-tiruvlllluvnaaynnnaar-eeleelcingkrukkupteecitt-cootitt-villkkvinnnaavit`) | [link](https://archive.org/details/tdl.50017-nuul-tiruvlllluvnaaynnnaar-eeleelcingkrukkupteecitt-cootitt-villkkvinnnaavit) | Subject to be confirmed; book-level only | metadata-verified |
| TA-119 | Tamil text (`tdl.5682-nuul-tmilllkklai-nuurrrrokai`) | [link](https://archive.org/details/tdl.5682-nuul-tmilllkklai-nuurrrrokai) | Subject to be confirmed; book-level only | metadata-verified |
| TA-120 | Tamil text (`tdl.7247-nuul-prmcivnnn-paarvtikkupteecitt-viimkvi-muulmum-uraiyum`) | [link](https://archive.org/details/tdl.7247-nuul-prmcivnnn-paarvtikkupteecitt-viimkvi-muulmum-uraiyum) | Subject to be confirmed; book-level only | metadata-verified |
| TA-121 | Tamil text (`tdl.48660-nuul-potiymlaiyilellluntrulliy-akttiymkaamunnnivr-arullicceyt-pnycpttcicaast`) | [link](https://archive.org/details/tdl.48660-nuul-potiymlaiyilellluntrulliy-akttiymkaamunnnivr-arullicceyt-pnycpttcicaast) | Subject to be confirmed; book-level only | metadata-verified |
| TA-122 | Tamil text (`tdl.50003-nuul-jyootiss-srv-vissyaamrutm`) | [link](https://archive.org/details/tdl.50003-nuul-jyootiss-srv-vissyaamrutm) | Subject to be confirmed; book-level only | metadata-verified |
| TA-123 | Tamil text (`tdl.50005-3`) | [link](https://archive.org/details/tdl.50005-3) | Subject to be confirmed; book-level only | metadata-verified |
| TA-124 | Tamil text (`tdl.50011-nuul-jaatk-knnitaa-rmpm-ennnnnnum-cootitt-aacaannn-cootittr-utviyinnnrri-krr`) | [link](https://archive.org/details/tdl.50011-nuul-jaatk-knnitaa-rmpm-ennnnnnum-cootitt-aacaannn-cootittr-utviyinnnrri-krr) | Subject to be confirmed; book-level only | metadata-verified |
| TA-125 | Tamil text (`tdl.8554`) | [link](https://archive.org/details/tdl.8554) | Subject to be confirmed; book-level only | metadata-verified |
| TA-126 | Tamil text (`tdl.27746-nuul-annnupv-nsstt-jaatkcintaamnni`) | [link](https://archive.org/details/tdl.27746-nuul-annnupv-nsstt-jaatkcintaamnni) | Subject to be confirmed; book-level only | metadata-verified |
| TA-127 | Tamil text (`tdl.tdl_f1c88a-nuul-uroomrissi-arullicceyt-vinaatti-pnycpttci-muulmum-tnycai-krunnaanitippi`) | [link](https://archive.org/details/tdl.tdl_f1c88a-nuul-uroomrissi-arullicceyt-vinaatti-pnycpttci-muulmum-tnycai-krunnaanitippi) | Subject to be confirmed; book-level only | metadata-verified |
| TA-128 | Tamil text (`tdl.tdl_3492ed-nuul-tiru-aruttpirkaac-vlllllaar-jaatkm-_-kntrnaatti-kaakkeeyr-mkaavaakkiym`) | [link](https://archive.org/details/tdl.tdl_3492ed-nuul-tiru-aruttpirkaac-vlllllaar-jaatkm-_-kntrnaatti-kaakkeeyr-mkaavaakkiym) | Subject to be confirmed; book-level only | metadata-verified |
| TA-129 | Tamil text (`tdl.28328-nuul-cootittkirkcintaamnni-ennnnnnum-periy-vrussaati-nuul`) | [link](https://archive.org/details/tdl.28328-nuul-cootittkirkcintaamnni-ennnnnnum-periy-vrussaati-nuul) | Subject to be confirmed; book-level only | metadata-verified |
| TA-130 | Tamil text (`tdl.6137-4`) | [link](https://archive.org/details/tdl.6137-4) | Subject to be confirmed; book-level only | metadata-verified |
| TA-131 | Tamil text (`tdl.000103-tirupputtkullli-srii-nrcimm-taattaaccaaryr`) | [link](https://archive.org/details/tdl.000103-tirupputtkullli-srii-nrcimm-taattaaccaaryr) | Subject to be confirmed; book-level only | metadata-verified |
| TA-132 | Tamil text (`tdl.34873-nuul-nv-naattikllilonnnrraakiy-cootittcntir-naatti`) | [link](https://archive.org/details/tdl.34873-nuul-nv-naattikllilonnnrraakiy-cootittcntir-naatti) | Subject to be confirmed; book-level only | metadata-verified |
| TA-133 | Tamil text (`tdl.52511-nuul-cootitt-vinnnaavittai`) | [link](https://archive.org/details/tdl.52511-nuul-cootitt-vinnnaavittai) | Subject to be confirmed; book-level only | metadata-verified |
| TA-134 | Tamil text (`tdl.21734-nuul-ticaa-putti-antr-plnnn-ennnnnnum-cukr-peru-naatti`) | [link](https://archive.org/details/tdl.21734-nuul-ticaa-putti-antr-plnnn-ennnnnnum-cukr-peru-naatti) | Subject to be confirmed; book-level only | metadata-verified |
| TA-135 | Tamil text (`tdl.25255-nuul-tiruccinnnaapplllli-aannttaarviitiyil-vcittirunt-cootitt-tinnnpl-knnitv`) | [link](https://archive.org/details/tdl.25255-nuul-tiruccinnnaapplllli-aannttaarviitiyil-vcittirunt-cootitt-tinnnpl-knnitv) | Subject to be confirmed; book-level only | metadata-verified |
| TA-136 | Tamil text (`tdl.8550`) | [link](https://archive.org/details/tdl.8550) | Subject to be confirmed; book-level only | metadata-verified |
| TA-137 | Tamil text (`tdl.50077-nuul-sriipti-annnupv-jaatkm-paakm-2`) | [link](https://archive.org/details/tdl.50077-nuul-sriipti-annnupv-jaatkm-paakm-2) | Subject to be confirmed; book-level only | metadata-verified |
| TA-138 | Tamil text (`tdl.8545-nuul-vaastuvityai`) | [link](https://archive.org/details/tdl.8545-nuul-vaastuvityai) | Subject to be confirmed; book-level only | metadata-verified |
| TA-139 | Tamil text (`tdl.8548-nuul-ilingknnn-iyrrrriy-vraakr-ooraa-caattirm-plllaiy-uraiyuttnnn`) | [link](https://archive.org/details/tdl.8548-nuul-ilingknnn-iyrrrriy-vraakr-ooraa-caattirm-plllaiy-uraiyuttnnn) | Subject to be confirmed; book-level only | metadata-verified |

### 3o. tamilnavarasam.in astrology PDFs - NOT citable (56)

The listing page was opened. The PDF files could not be fetched on 2026-10-10, so every row is `linked-not-opened`: a lead list, not an authority. Numerology and Vaastu rows are not astrology.

| ID | நூல் / Title | URL | Subject | Verified |
|---|---|---|---|---|
| TA-140 | அதிர்ஷ்ட நியுமராலஜி | [PDF](https://tamilnavarasam.in/Books/astrologybook/Numerology%20lucky%20numbers.PDF) | numerology | linked-not-opened |
| TA-141 | தமிழ்முறை எண் கணிதம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Tamil%20numerology.PDF) | numerology | linked-not-opened |
| TA-142 | வீட்டைக் கட்டிப் பார் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Veettai%20katti%20paar.PDF) | vaastu | linked-not-opened |
| TA-143 | ஆயுட் பாவகம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Ayut%20pagavam.PDF) | astrology | linked-not-opened |
| TA-144 | ஆரம்ப விண்ணியல் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Basic%20astronomy.PDF) | astronomy | linked-not-opened |
| TA-145 | சந்திர காவியம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Chandira%20kaviyam.PDF) | astrology | linked-not-opened |
| TA-146 | குருநாடி சாஸ்திரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Gurunadi%20sasthiram.PDF) | astrology | linked-not-opened |
| TA-147 | பஞ்சாங்கம் (1952-61) | [PDF](https://tamilnavarasam.in/Books/astrologybook/Panchangam%20(%201952-61%20).PDF) | panchangam | linked-not-opened |
| TA-148 | பஞ்சாங்கம் (1962-71) | [PDF](https://tamilnavarasam.in/Books/astrologybook/Panchangam%20(%201962-71%20).PDF) | panchangam | linked-not-opened |
| TA-149 | பஞ்சாங்கம் (1972-81) | [PDF](https://tamilnavarasam.in/Books/astrologybook/Panchangam%20(%201972-81%20).PDF) | panchangam | linked-not-opened |
| TA-150 | பஞ்சாங்கம் (1982-91) | [PDF](https://tamilnavarasam.in/Books/astrologybook/Panchangam%20(%201982-91%20).PDF) | panchangam | linked-not-opened |
| TA-151 | பஞ்சாங்கம் (1992-01) | [PDF](https://tamilnavarasam.in/Books/astrologybook/Panchangam%20(%201991-01%20).PDF) | panchangam | linked-not-opened |
| TA-152 | பஞ்சாங்கம் (2002-11) | [PDF](https://tamilnavarasam.in/Books/astrologybook/Panchangam%20(%202002-11%20).PDF) | panchangam | linked-not-opened |
| TA-153 | பஞ்சபட்சி சாஸ்திரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Panjapatchi%20sasthiram.PDF) | astrology | linked-not-opened |
| TA-154 | சப்தரிஷி நாடி (கன்யா லக்னம்) | [PDF](https://tamilnavarasam.in/Books/astrologybook/Saptarishi%20nadi%20-%20kanya%20lagnam.PDF) | nadi | linked-not-opened |
| TA-155 | சப்தரிஷி நாடி (மேஷ லக்னம்) | [PDF](https://tamilnavarasam.in/Books/astrologybook/Saptarishi%20nadi%20-%20mesa%20lagnam.PDF) | nadi | linked-not-opened |
| TA-156 | விதி விளக்கம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Vithi%20vilakkam.PDF) | astrology | linked-not-opened |
| TA-157 | வராகர் ஓரா சாத்திரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Varagar%20ora%20sathiram.PDF) | astrology | linked-not-opened |
| TA-158 | ஜோதிடத் திறவுகோல் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Astrological.pdf) | astrology | linked-not-opened |
| TA-159 | ஜோதிடம் - I | [PDF](https://tamilnavarasam.in/Books/astrologybook/Astrology.pdf) | astrology | linked-not-opened |
| TA-160 | ஜோதிடம் - II | [PDF](https://tamilnavarasam.in/Books/astrologybook/Jothidaragalam.pdf) | astrology | linked-not-opened |
| TA-161 | மனைக்குறி சாஸ்திரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Manaikurisasthiram.pdf) | vaastu | linked-not-opened |
| TA-162 | மனையடி சாஸ்திரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/ManaiyadiSasthiram.pdf) | vaastu | linked-not-opened |
| TA-163 | திருமணப் பொருத்தம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Marriagematching.pdf) | astrology | linked-not-opened |
| TA-164 | எண் ஐோதிடம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Numerology.pdf) | numerology | linked-not-opened |
| TA-165 | எண்ணியல் கைரேகை சோதிடக் கலைஞானம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Numerologyhands.pdf) | numerology | linked-not-opened |
| TA-166 | என்ன அதிர்ஷ்டம் பெறுவீர்கள் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Numerologylucky.pdf) | numerology | linked-not-opened |
| TA-167 | எண் கணித சோதிடத்தில் 'கர்ம எண்' | [PDF](https://tamilnavarasam.in/Books/astrologybook/Numerologynumber.pdf) | numerology | linked-not-opened |
| TA-168 | பாச்சிகை சாஸ்திரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Patchikaisastram.pdf) | astrology | linked-not-opened |
| TA-169 | வாஸ்து சாஸ்திரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Vasdusasthra.PDF) | vaastu | linked-not-opened |
| TA-170 | சுந்தர சேகரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Sundarasegaram.PDF) | astrology | linked-not-opened |
| TA-171 | ராம சேகரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Rama-sekaram.PDF) | astrology | linked-not-opened |
| TA-172 | சூக்கும பஞ்சபட்சி நூல் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Sookkuma-panja-patchi.PDF) | astrology | linked-not-opened |
| TA-173 | சில்லரைக் கோவை | [PDF](https://tamilnavarasam.in/Books/astrologybook/Sillarai%20kovai.PDF) | astrology | linked-not-opened |
| TA-174 | வானியல் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Vaniyal.PDF) | astronomy | linked-not-opened |
| TA-175 | ஜாதக அலங்காரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Jathaga%20alankaram.PDF) | astrology | linked-not-opened |
| TA-176 | ஜோதிடக் களஞ்சியம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Jothida%20kalanjiyam.PDF) | astrology | linked-not-opened |
| TA-177 | நாடி ஜோதிடம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Nadi%20jothidam.PDF) | nadi | linked-not-opened |
| TA-178 | பஞ்சாங்க கணனம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Panchanka%20kananam.PDF) | panchangam | linked-not-opened |
| TA-179 | ஜோதிட பாஸ்கரன் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Jathaga%20baskaran.PDF) | astrology | linked-not-opened |
| TA-180 | ஜாதகத்தில் உங்கள் எதிர்காலம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Jathakathil%20ungal%20ethirkalam.PDF) | astrology | linked-not-opened |
| TA-181 | மயமதம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Maya%20matham.PDF) | astrology | linked-not-opened |
| TA-182 | எண் ஜோதிட ஜோதி | [PDF](https://tamilnavarasam.in/Books/astrologybook/Numerology%20jothida%20jothi.PDF) | numerology | linked-not-opened |
| TA-183 | ஆஸ்திக விஞ்ஞான சாகரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Asthiga%20vingnana%20sagaram.PDF) | astrology | linked-not-opened |
| TA-184 | ஜயமுனி வாக்கியம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Jayamunivaakkiyam.PDF) | astrology | linked-not-opened |
| TA-185 | ஜோதிட நுணுக்கங்கள் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Jothida%20nunukkam.PDF) | astrology | linked-not-opened |
| TA-186 | கன்ம காண்டம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Kanma%20kandam.PDF) | astrology | linked-not-opened |
| TA-187 | கேரள ஜோதிடம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Kerala%20jothidam.PDF) | astrology | linked-not-opened |
| TA-188 | சந்தானமணி | [PDF](https://tamilnavarasam.in/Books/astrologybook/Santhanamani.PDF) | astrology | linked-not-opened |
| TA-189 | ஜோதிடம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Jothidam.PDF) | astrology | linked-not-opened |
| TA-190 | வாதக்கோவை | [PDF](https://tamilnavarasam.in/Books/astrologybook/Vadha%20kovai.PDF) | astrology | linked-not-opened |
| TA-191 | ஜோதிஷ சாஸ்திரம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Jothisha-sasthiram.pdf) | astrology | linked-not-opened |
| TA-192 | பஞ்சபட்சி சாஸ்திரம் (second file) | [PDF](https://tamilnavarasam.in/Books/astrologybook/Panjapatchi-sasthiram.pdf) | astrology | linked-not-opened |
| TA-193 | சாமக்கோள் ஆருடம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Samakkoal-arudam.pdf) | astrology | linked-not-opened |
| TA-194 | ஜோதிடம் கற்றுக்கொள்ளுங்கள் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Jothidam-katrukollungal.pdf) | astrology | linked-not-opened |
| TA-195 | குடும்ப ஜோதிடம் | [PDF](https://tamilnavarasam.in/Books/astrologybook/Kudumba-jothidam.pdf) | astrology | linked-not-opened |

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
