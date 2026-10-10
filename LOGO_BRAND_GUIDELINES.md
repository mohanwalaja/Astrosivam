# ASTRO SIVAM — Logo & Brand Mark Guidelines

> **Historical note (October 2026):** This file records work from before the Node.js application server was removed. Production is now a static React frontend plus the PHP API in `api/`; Node.js remains build/test tooling only. Any `server/` paths and Node-server behaviors below describe the retired implementation, not the current deployment.


**Mark name:** *Surya–Chandra Rasi Chakra* (ornate) · *Surya–Chandra Monogram* (modern)
**Introduced:** 30 Sep 2026
**Replaces:** the previous navy medallion with the trishul / snake / single-sun artwork

> **The brand line is the name plus its slogan.** Nothing else goes in brand
> artwork — no service lists, no phone numbers, no URLs. Services belong in page
> copy. `tests/logo-assets.test.ts` asserts no service name can appear in any
> asset generator.

> **The modern monogram is the live mark across the website and every generated
> report.** The ornate medallion remains available as an alternate, but it is not
> used by current report, invoice or e-mail outputs — see [§8 Switching variants](#8-switching-variants).

---

## 1. What the live mark is

The **Surya–Chandra Monogram** is a flat gold emblem on a deep-navy circular disc,
transparent outside the disc:

| Element | Meaning |
| --- | --- |
| **Twelve evenly spaced dots** | The twelve rasis in a Vedic chart |
| **Sun disc** | Surya — vitality, the self and the ascendant |
| **Crescent** | Chandra — the mind and the moon-sign (rasi) |

The live emblem is used consistently in the website navbar and in all generated
reports, invoices and e-mail headers. The modern mark is pure geometry, drawn by
`scripts/modern_mark.py`; it is not an AI-generated raster.

The alternate **Surya–Chandra Rasi Chakra** is an illustrated gold medallion with
Surya, Chandra and twelve temple-art rasi figures. It remains in `design/` as an
alternate / historical variant and is not the current report mark.

---

## 2. The two lockups

### A. Emblem (primary clinical mark)
Circular, square-cropped, transparent outside the disc.
Used for: navbar, footer, login / register / admin-login hero, PWA icons, PDF report
headers, invoice headers, e-mail headers, social share card.

### B. Horizontal lockup
Emblem on the left, `ASTRO SIVAM` / `INDIAN VEDIC ASTROLOGY` stacked on the right.
Used for: About page, marketing material, anywhere there is wide, short space.

### C. Simplified mark (app icon)
Surya + Chandra only — **no rasi ring**. Used wherever the full emblem would turn to
mush: favicons (16 / 32 / 48 px), the PWA tile, and inline UI avatars
(home-page badges, admin banner).

> **Rule of thumb:** full emblem at **≥ 48 px**; simplified mark below that.

---

## 3. Colour

| Role | Hex | Notes |
| --- | --- | --- |
| Midnight navy (primary field) | `#091038` → `#0b0813` | matches `theme-color` / `background_color` |
| Metallic gold (artwork) | `#c9962c` | matches `--gold` in the report HTML builders |
| Gold highlight | `#ffe58f` → `#f59e0b` | gradients in the UI wordmark |
| Temple maroon (secondary) | `#3d0a12` | social card background only |

Never recolour the gold to silver/copper, and never place the gold artwork on a light
background without the navy disc behind it — the contrast is what makes it legible.

---

## 4. Files

### Source of truth — `design/`
| File | Purpose |
| --- | --- |
| `astrosivam_surya_chandra_master.png` | **master** — circular emblem with wordmark, 1024×1024 |
| `astrosivam_surya_chandra_lockup.png` | horizontal emblem + wordmark lockup |
| `logo_appicon_mark.jpg` | simplified Surya + Chandra app mark |
| `logo_og_card.jpg` | social share card artwork |
| `logo_concept_1_emblem.jpg` | alternate — letter-free emblem |
| `logo_concept_2_rasi_chart.jpg` | alternate — South Indian rasi-chart + gopuram concept (unused) |

### Generated — do not edit by hand
Everything below is produced by `scripts/build_logo_assets.py`. Change the masters in
`design/`, then re-run the script.

```bash
python3 -m venv /tmp/venv && /tmp/venv/bin/pip install pillow
/tmp/venv/bin/python scripts/build_logo_assets.py
```

| Generated file | Size | Consumer |
| --- | --- | --- |
| `public/astrosivam_logo.png` | 854×854 | browser (navbar, footer, auth pages) |
| `src/assets/astrosivam_logo.png` | 854×854 | vite import |
| `public/astrosivam_full_logo.png` | 1220×~470 | browser (About, footer) |
| `src/assets/astrosivam_full_logo.png` | 1220×~470 | vite import |
| `src/assets/astrosivam_appicon.png` | 256×256 | small UI avatars |
| `public/astrosivam_og_image.jpg` | 1200×630 | `og:image`, `twitter:image` |
| `api/assets/astrosivam_logo.png` | 185×185 | PHP mPDF headers + e-mail `Content-ID` |
| `src/services/logoData.ts` | base64 | React HTML→PDF report / invoice builders |
| `server/astrology/logoBase64.ts` | base64 | Node PDF + e-mail fallback |
| `public/favicon-{16,32,48}.png`, `favicon.ico` | 16–256 | browser tabs |
| `public/apple-touch-icon.png` | 180×180 | iOS home screen |
| `public/android-chrome-{192,512}.png` | 192 / 512 | Android / PWA |

**Invariant enforced by the test suite:** `src/services/logoData.ts`,
`server/astrology/logoBase64.ts` and `api/assets/astrosivam_logo.png` must all be
byte-identical (the API PNG must also stay under 80 KB so it can be inlined in
e-mail). In the current live build these report copies use the same variant as
the website assets; they are smaller only because the report image is rendered at
185 px. The builder regenerates the report copies together — never patch one by hand.

---

## 5. Clear space & minimum sizes

- **Clear space:** keep at least `0.15 × emblem diameter` of empty space on every side.
- **Minimum emblem size:** 48 px on screen, 12 mm in print.
- **Minimum lockup width:** 180 px.
- **Never draw a ring around the mark.** The navy disc *is* the outline. No CSS,
  mPDF or jsPDF border (gold or red) may be added around it; the former invoice
  red outline was removed along with the report-logo rings.
- **Centered report and invoice lockup:** use the Baby Naming certificate as the
  reference — emblem above the centered ASTRO SIVAM title, localized/document
  subtitle, contact details, optional page/order/invoice metadata and divider.
  Do not put the emblem beside the text or apply a left/right horizontal nudge.
  `src/services/reportHeader.ts` is the shared browser helper;
  `AstroReportViews::topHeader()` is the mPDF report helper; and
  `drawCenteredBrandHeader()` is the Latin-safe Node/jsPDF helper.
- Do not stretch, rotate, re-colour, drop-shadow the disc, or place the emblem on a
  busy photographic background.

---

## 6. Cache-busting

Icon and social URLs in `index.html` / `src/components/common/SEO.tsx` carry a
`?v=YYYYMMDD` query string. **Bump it whenever the artwork changes**, otherwise
browsers and social scrapers keep serving the old mark.
Current value: `v=20260930`.

---

## 7. A note on the artwork

The ornate masters in `design/` were produced with an AI image model and then
cleaned up (circular alpha cutout, white-background knockout, exact-ratio cropping)
by `scripts/build_logo_assets.py`. The live modern monogram is generated from
geometry instead. All delivered assets are **raster PNG/JPEG**; there is no SVG.
For large-format print, start from the 1024 px ornate source or ask a designer for
a vector version.


---

## 8. Switching variants

Two artwork variants are supported by the same builder:

| Variant | Artwork | Source |
| --- | --- | --- |
| `ornate` | the illustrated medallion | `design/astrosivam_surya_chandra_master.png` + `_lockup.png` |
| `modern` | the flat Surya–Chandra monogram | **drawn** by `scripts/modern_mark.py` |

### Which is live right now

**Unified modern mark** — the website and every generated report use the same
Surya–Chandra Monogram:

| Placement | Variant |
| --- | --- |
| Navbar, footer, auth pages, About | modern |
| Favicons, PWA tiles, UI avatars | modern |
| Social share card | modern |
| Browser, Node and PHP PDF reports; invoices; e-mail headers | **modern** |

Rebuild the current live state with either command:

```bash
python3 scripts/build_logo_assets.py
python3 scripts/build_logo_assets.py --variant modern
```

The builder defaults to `modern`, and `--pdf-variant` defaults to `--variant`.
This keeps the 185 px API logo and both embedded report-logo modules in lockstep
with the website emblem. Set `--pdf-variant` only for an explicitly requested
alternate report variant; routine builds should not split the branding.

```bash
# switch the whole product to the ornate alternate, if desired
python3 scripts/build_logo_assets.py --variant ornate

# build a variant into a scratch folder WITHOUT touching the live files
# (this is what preview/modern-logo.html consumes)
python3 scripts/build_logo_assets.py --variant modern --target preview/assets
```

Passing `--target` implies `--no-live`: the public-asset folder is written but
`src/assets/`, `api/assets/` and the two base64 modules are left alone, so the
running site keeps rendering whatever is currently live.

### The modern monogram is drawn, not generated

The ornate masters are AI artwork. The modern mark is **pure geometry** —
twelve dots on a ring, a sun disc, a crescent — rendered with real primitives in
`scripts/modern_mark.py`. That buys us:

* exactly twelve dots, mathematically even spacing
* a mathematically smooth crescent at any size (no AI edge artefacts)
* genuine transparency and crisp output from 16 px to 2048 px
* **~20× smaller files**: 72 KB vs 1.28 MB for the emblem, 66 KB vs 361 KB for the social card
* no sketchy provenance on the shape itself

### Composition rule

The sun / crescent separation is produced **by construction**: the crescent's two
tips are placed a deliberate distance *outside* the sun disc, rather than carving
a gap afterwards. The crossing points of the moon circle and the bite circle are:

```
x = (moon_cx + bite_cx) / 2          (midway — the radii are equal)
y = centre_y ± h,  h = sqrt(r² − (d/2)²)
```

`scripts/modern_mark_geometry.py` holds those rules and `verify_composition()`
**fails the build** if a retuned `Proportions` collapses the clearance below
`0.010` of the canvas (which merges the two luminaries into a blob) or drifts the
combined group more than `0.02` off centre. It is deliberately stdlib-only so the
guard is testable by a bare `python3` with no imaging library installed.
`tests/logo-assets.test.ts` executes it both ways — that the shipped tuning
passes, and that a deliberately collapsed tuning is rejected.

### Preview

`preview/modern-logo.html` (served by the dev server at
`/preview/modern-logo.html`) shows the live modern set in situ — navbar, favicons
at actual size, both lockups, the social card, and a former-vs-live comparison.

### Trade-off

The modern mark is cleaner and far more contemporary, but it **abstracts the
twelve rasi to twelve dots** rather than showing the symbols. The ornate medallion
literally names every rasi and reads as unmistakably Indian / traditional. The
current brand decision favors consistency: the modern monogram is used on the
website and all generated reports, invoices and e-mail. Do not split variants in
routine asset builds.


---

## 9. Brand line rule (read this before touching artwork)

**In brand artwork, the line is exactly:**

```
ASTRO SIVAM
INDIAN VEDIC ASTROLOGY
```

and nothing else.

### What was removed and why

The original social card carried a third line under the slogan:

```
Jathagam  •  Porutham  •  Baby Naming  •  Muhurtham
```

It is gone, and the ornamental divider that separated it is gone with it. Reasons:

* the mark should be **name + slogan**; a service carousel is marketing copy, and it
  dates the artwork the moment the service list changes
* it read as clutter at the sizes the card is actually seen (timeline thumbnails)
* it forced the wordmark to sit above the card's optical centre

`scripts/strip_og_tagline.py` records the one-time edit to
`design/logo_og_card.jpg`. It fills the vacated band by interpolating each column
between a clean row above and a clean row below, so the soft glow and faded kolam
pattern carry through seamlessly. It then asserts the band is gold-free and that
the emblem region is untouched. **Do not re-run it** — it is a migration record,
not an idempotent step.

Removing that line is what lets the wordmark sit optically centred against the
emblem (emblem centre y=298, text now spans y=215..368, centre y=292 - a 6 px
difference, down from 31 px).

### Standing rule for new artwork

Any generator in `scripts/` must produce **name + slogan only**. If a service name
appears in `scripts/build_logo_assets.py` or `scripts/modern_mark.py`, the asset
test fails.

### A note on the wordmark itself

`ASTRO SIVAM` / `INDIAN VEDIC ASTROLOGY` is the **original** gold-bevel wordmark
from the source artwork, preserved byte-for-byte — only the line beneath it was
removed. Its bevel is not reproducible by re-rendering, which is why the strip
interpolates rather than redraws.

If you ever want the text itself changed (different wording, ordering or spelling),
say so — that is a **redraw**, not an edit, and the modern variant can re-render
its wordmark in any face on demand.


---

## 10. Size rule for the modern mark

**The twelve-dot ring cannot survive small rendering.** The threshold lives in
`scripts/modern_mark_geometry.py` as `DOTS_MIN_PX` (currently 44) and the asset
builder consumes it rather than keeping its own copy — one source of truth:

```python
DOTS_MIN_PX = 44

def mark_for_size(size_px): return "dotted" if size_px >= DOTS_MIN_PX else "reduced"
```

Measured by rendering both variants at 16/24/32/48/68/96 px and inspecting each
magnified:

| Rendered size | What the dots do | Mark used |
| --- | --- | --- |
| 16–32 px | blur into a broken ring — reads as a muddy donut | **reduced** (sun + crescent) |
| 44 px and up | separate cleanly, full mark legible | dotted |

So `favicon-16` and `favicon-32` are now the reduced mark on a navy tile, while
`favicon-48`, `apple-touch-icon`, the Android tiles and `favicon.ico` (256 px)
carry the dotted mark. `tests/logo-assets.test.ts` executes `mark_for_size`
either side of the threshold so the rule cannot silently drift.

---

## 11. Current live state

The modern monogram is used consistently by the website and all generated PDF
reports, invoices and e-mail. See `preview/modern-logo.html` for a view of the
live production assets. `preview/current-state.png` is an archival snapshot of the
former hybrid setup and no longer represents the shipped report logo.


---

## 12. 2026 refresh — Design 1 "Rasi Ring" (SHIPPED)

The approved refresh. `scripts/logo_concepts.py` drew five candidates for the
"modern + simple, Surya–Chandra with the twelve rasi" brief; **concept 1, Rasi
Ring** was selected and is now the live mark everywhere.

| # | Name | Structure | Delivered PNG |
| --- | --- | --- | --- |
| **1** | **Rasi Ring** ← shipped | Twelve dots on an open ring, Surya + Chandra at the centre — the mark retuned: bolder luminaries, calmer ring. | ~10 KB |
| 2 | Zodiac Wheel | The twelve **rasi glyphs** (♈♉♊♋♌♍♎♏♐♑♒♓) around the luminaries, with a thin chart ring. | ~19 KB |
| 3 | Eclipse | One bold Surya with Chandra riding clear of its limb, twelve dots as a close corona. | ~9 KB |
| 4 | Medallion | Solid navy disc with the gold rim dots and gold luminaries. | ~17 KB |
| 5 | Surya Rays | Twelve tapered rays instead of dots, Chandra in an opening in the corona. | ~9 KB |

Board previews `public/logos/design-option-{1..5}.jpg`, strip
`public/logos/design-options-overview.jpg`, all regenerated by:

```bash
python3 -m venv /tmp/venv && /tmp/venv/bin/pip install pillow
/tmp/venv/bin/python scripts/logo_concepts.py     # writes public/logos/
```

Concept 1 imports `Proportions` from `scripts/modern_mark_geometry.py`, so its
board can never drift from what the live builder ships. Concepts 2–5 are kept as
the design record; they are not wired into the asset pipeline.

### What changed on the live mark

The geometry moved in `scripts/modern_mark_geometry.py` — one place, as always:

| | before | after |
| --- | --- | --- |
| `ring_radius` | 0.435 | **0.400** — the dots read as a halo, not an outer fence |
| `dot_radius` | 0.042 | **0.040** |
| `sun_radius` | 0.156 | **0.182** — Surya is now the anchor of the mark |
| `sun_offset_x` | −0.066 | **−0.075** |
| `moon_radius` | 0.148 | **0.168** |
| `moon_offset_x` | 0.092 | **0.090** |
| `moon_bite` | 0.098 | **0.102** |
| `tip_clearance` | 0.0212 | **0.0145** (guard needs ≥ 0.010, still passes) |
| `group_centre` | +0.0090 | **0.0000** (dead centre) |

The sun/crescent separation is still produced **by construction** — no shaving
gap — so §8's composition rule and its guard are unchanged.

**Wordmark (lockup only).** `render_lockup()` now sets the name in
Cinzel-Bold and the slogan in letterspaced Noto Sans Regular, matching the type
treatment on every design board. The live navbar and footer are CSS/text
lockups, not this PNG, so their typography is untouched. `render_stacked()` is
unchanged.

**Small sizes.** The `DOTS_MIN_PX = 44` crossover in §10 was re-verified against
the bolder ring (render 24–68 px and inspect): the dots still separate cleanly at
44 px, so the rule stands — reduced mark below 44 px, dotted mark at and above.

**Cache-bust** bumped `v=20260930` → **`v=20261003`** in `index.html` and
`src/components/common/SEO.tsx` (§6).

### Delivery budget: every web logo file ≤ 50 KB

Two PNG-level steps in `scripts/build_logo_assets.py`, both of which leave the
file **straight RGBA** (colour type 6 — mPDF and several mail clients mishandle
indexed PNGs, and `tests/full-suite.test.ts` asserts byte 25 stays 6):

1. `_snap_alpha()` — the alpha channel is rounded to **32 even steps**. An 8/255
   jump on the anti-aliased boundary only; 0 stays transparent and 255 stays
   opaque, so the flat fills are untouched. Worst visible delta measured at
   22/255 on 0.5 % of pixels, and the browser re-antialiases when it draws the
   asset at UI size.
2. `_palette()` — a 128-entry palette round-trip for the flat fills.

Result at 854 px: **72.9 KB raw → 44 KB palette-only → 31.3 KB shipped**. The
1220 px lockup 153 KB → **38.9 KB**.

```bash
python3 scripts/build_logo_assets.py        # and it will not let you ship a fat logo
```

`main()` now **fails the build** if any served logo PNG (including `src/assets/`
and `public/logos/`) comes out over `LOGO_MAX_BYTES` (50 KB). The 185 px
`api/assets/astrosivam_logo.png` has the hardest limit because it is inlined into
e-mail bodies — it is the canary at 5.1 KB. `public/astrosivam_og_image.jpg` is a
JPEG and carries no such limit.

**Nothing about the palette/alpha steps changes the bytes shared between the
browser, the report modules and the API:** `_encode_png()` is the single exit
point, so `api/assets/astrosivam_logo.png`, the `src/services/logoData.ts` data
URI and `server/astrology/logoBase64.ts` remain byte-identical.
