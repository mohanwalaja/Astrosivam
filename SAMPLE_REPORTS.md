# Public Sample Reports — one system, four services

> *"Users want to know how the reports will look."* — Visitors can now open a
> complete sample report for **every** service before they order, and download it
> as a PDF. The sample is built from **fixed example details**, so there is no
> form to fill and no user choice anywhere:
>
> **01 January 2000, 2:00 AM, Chennai (India) — IST (+5:30)**

---

## 1. What was added

| Service | Page | Button |
|---|---|---|
| Birth Jathagam | `/birth-jathagam` | **View Sample Report (PDF)** |
| Marriage Compatibility (10 Poruthams) | `/marriage-compatibility` | **View Sample Report (PDF)** |
| Baby Naming (Namakaranam) | `/baby-naming` | **View Sample Report (PDF)** |
| Subha Muhurtham | `/muhurtham` | **View Sample Report (PDF)** |

On every service page the sample block sits **outside / after the order form**
(never inside the `<form>` element), so filling the form is never mixed with
browsing the sample — the Muhurtham page follows the same placement as Birth
Jathagam, Marriage Compatibility and Baby Naming.

Each button opens the **same live PDF preview modal the real reports use**
(page-by-page preview, English / Tamil / Hindi switch, zoom, and
*"Download PDF (exactly this preview)"*). The download is a real, print-quality
A4 PDF of the sample.

No sign-in is required — the samples are public, which is the whole point: a
visitor can judge the report before paying.

## 2. The fixed sample details (no user choice)

```
Date of birth : 01 January 2000
Time of birth : 2:00 AM
Birth place   : Chennai, Tamil Nadu, India
Coordinates   : 13.0827 N, 80.2707 E
Time zone     : IST +5:30 (Asia/Kolkata)
```

The same birth is used by **all four** samples, so they describe the same
example person. Everything else is fixed too:

| Sample | Fixed content |
|---|---|
| Birth Jathagam | Devotee **Karthik Raman** (male), full 3-page report |
| Marriage Compatibility | Groom **Karthik Raman** — 01 Jan 2000, 2:00 AM, Chennai · Bride **Priya Devi** — 15 Jun 1998, 6:30 AM, Chennai (a second hard-coded sample person, so the porutham table shows a realistic result) |
| Baby Naming | Baby **Aarav** (male), full naming certificate + pada syllables |
| Subha Muhurtham | **Wedding** ceremony; the six-month window automatically anchors on the current month + 2 (the same default the Muhurtham page uses), so the calendar always shows upcoming dates |

To change any of this, edit **only** the constants at the top of
`src/services/sampleReports.ts` (`SAMPLE_BIRTH`, `SAMPLE_BRIDE`,
`SAMPLE_DEVOTEE_NAME`, `SAMPLE_BABY_NAME`, `SAMPLE_MUHURTHAM_EVENT_KEY`).

## 3. How it works (one shared system)

```
SampleReportButton (src/components/common/SampleReportButton.tsx)
        │  click
        ▼
calculateSampleResult(serviceType)            src/services/sampleReports.ts
        │  • buildSamplePayload() — the FIXED payload (Muhurtham also builds
        │    its six-month panchangam scan with the tested client scanner)
        ▼
POST /api/services/calculate-preview           real astrology service (Node or PHP)
        ▼
LivePdfPreviewModal  →  buildJathagamHtml / buildWeddingMatchHtml /
                        buildBabyNamingHtml / buildMuhurthamHtml
        │               (the SAME builders the paid PDF pipeline uses)
        ▼
applySampleWatermark(html)  →  light “SAMPLE” watermark on every A4 page
        ▼
Preview iframe + “Download PDF (exactly this preview)”
```

* Samples live in **one module** (`src/services/sampleReports.ts`) and are
  rendered by the **existing** report builders, so a sample can never drift
  away from the real report format.
* Results are cached per service for the session — the second click opens
  instantly.
* Hindi / Tamil previews work too (the modal language selector).
* The invoice is intentionally **not** sampled: it contains order-specific data.

## 4. The SAMPLE watermark

Every page of a sample carries a light diagonal **SAMPLE** stamp
(`.astro-sample-watermark`, ~13 % opacity, behind nothing, above the page
content). It is injected **into the report HTML itself**, so it is present in:

* the live preview iframe,
* the html2canvas “exactly this preview” PDF download,
* the server-rendered direct-download recovery path (mPDF only; paid email delivery never uses it).

`applySampleWatermark()` is idempotent (a page can never be double-stamped) and
leaves the report markup untouched, so a sample PDF can never be mistaken for a
paid report — while still showing the real layout, charts, tables and text.

The preview modal additionally shows a banner:

> **SAMPLE REPORT** • Fixed example: 01 Jan 2000, 2:00 AM, Chennai (India) —
> no customer data is used. Your own report is calculated from the birth
> details you enter.

Downloaded file names are explicit, e.g.
`ASTRO_SIVAM_Sample_Birth_Jathagam_EN.pdf`,
`ASTRO_SIVAM_Sample_Marriage_Matching_TA.pdf`,
`ASTRO_SIVAM_Sample_Baby_Naming_HI.pdf`,
`ASTRO_SIVAM_Sample_Subha_Muhurtham_EN.pdf`.

## 5. Regression tests

`tests/sample-reports.test.ts` (wired into `npm test`) asserts:

* the fixed date/time/place is exactly 01 Jan 2000, 2:00 AM, Chennai (IST);
* the Marriage sample’s second person is the fixed bride (never a user choice);
* all four sample payloads are accepted by the **real** calculation engines and
  produce complete results (3 pages for Jathagam, 2 for Marriage/Baby Naming,
  six months for Muhurtham);
* each page of every sample is watermarked exactly once, the watermark is
  idempotent, and the HTML document stays intact;
* sample titles/organisation labels/file names are correct.

Run it alone:

```bash
npx tsx tests/sample-reports.test.ts
```
