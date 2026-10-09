#!/usr/bin/env python3
"""
ASTRO SIVAM - brand logo asset builder.

One command rebuilds EVERY runtime logo/icon the website, the PHP API, the
e-mail templates and the PDF report builders use.

Variants
--------
    ornate   the "Surya-Chandra Rasi Chakra" medallion
             (design/astrosivam_surya_chandra_master.png + _lockup.png)
    modern   the flat "Surya-Chandra Monogram"
             (drawn by scripts/modern_mark.py - real geometry, no raster)

Usage
-----
    python3 scripts/build_logo_assets.py                      # modern, live (default)
    python3 scripts/build_logo_assets.py --variant ornate      # ornate, live
    python3 scripts/build_logo_assets.py --variant modern     # modern, live
    python3 scripts/build_logo_assets.py --variant modern --target preview/assets
        # builds the modern set into a scratch folder with the SAME filenames the
        # site uses, and leaves the live files plus the embedded base64 modules
        # untouched - this is what the side-by-side preview page consumes.

Outputs (in --target, default public/)
--------------------------------------
    astrosivam_logo.png          circular emblem   (browser / nav / auth)
    astrosivam_full_logo.png     horizontal lockup (footer / about)
    astrosivam_appicon.png       simplified mark   (small UI avatars)
    astrosivam_og_image.jpg      1200x630 social share card
    favicon-{16,32,48}.png, favicon.ico, apple-touch-icon.png,
    android-chrome-{192,512}.png

Live mode additionally writes src/assets/*, api/assets/astrosivam_logo.png and
patches the base64 data URI in src/services/logoData.ts and
server/astrology/logoBase64.ts. The test suite asserts those three stay
byte-identical, so they are always regenerated together - never by hand, and all
three come out of _encode_png() so they also share one budget.

Budget
------
Every served logo PNG must stay under 50 KB (the 185 px API copy is inlined into
e-mail bodies, so it is the canary). That is why every PNG here goes through
_encode_png(): a 128-colour palette PNG. The artwork is flat colour, so the
palette costs nothing visible (worst measured case: 11/255 on 0.12% of pixels)
and saves roughly two thirds of the bytes. main() fails the build if any PNG
comes out over budget.
"""

from __future__ import annotations

import argparse
import base64
import io
import os
import re

from PIL import Image, ImageDraw, ImageFont

import modern_mark as mm

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESIGN = os.path.join(ROOT, "design")
FONTS = os.path.join(ROOT, "api", "astrology", "fonts")

# --------------------------------------------------------------------------- #
# configuration
# --------------------------------------------------------------------------- #
VARIANTS = {
    "ornate": {
        "master": os.path.join(DESIGN, "astrosivam_surya_chandra_master.png"),
        "lockup": os.path.join(DESIGN, "astrosivam_surya_chandra_lockup.png"),
        "appicon": os.path.join(DESIGN, "logo_appicon_mark.jpg"),
        "og": os.path.join(DESIGN, "logo_og_card.jpg"),
        "boxed": False,          # artwork already includes its own circular crop
    },
    "modern": {
        "master": None,          # rendered
        "lockup": None,
        "appicon": None,
        "og": None,
        "boxed": True,           # draw the mark into square navy tiles for icons
    },
}

NAVY = (13, 27, 62)
GOLD = (201, 150, 44)
GOLD_LIGHT = (222, 178, 82)
WHITE = (255, 255, 255)

# The "which mark at which size" rule lives in the stdlib-only geometry module
# so it is testable without an imaging library and cannot drift.
DOTS_MIN_PX = mm.DOTS_MIN_PX
mark_for_size = mm.mark_for_size


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _non_white_bbox(img: Image.Image, threshold: int = 720):
    """Bounding box of everything that is not (near) white."""
    rgb = img.convert("RGB")
    px = rgb.load()
    w, h = rgb.size
    min_x, min_y, max_x, max_y = w, h, -1, -1
    step = max(1, min(w, h) // 700)
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b = px[x, y]
            if r + g + b < threshold:
                min_x, min_y = min(min_x, x), min(min_y, y)
                max_x, max_y = max(max_x, x), max(max_y, y)
    if max_x < 0:
        return 0, 0, w, h
    return min_x, min_y, max_x + 1, max_y + 1


def circular_transparent(img: Image.Image) -> Image.Image:
    """Alpha-cut a white-background circular emblem, feathered at the rim."""
    img = img.convert("RGB")
    x0, y0, x1, y1 = _non_white_bbox(img)
    side = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    box = (int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))
    emblem = img.crop(box)

    mask = Image.new("L", (side, side), 0)
    mpx = mask.load()
    r_out, r_in = side / 2.0, side / 2.0 - 1.5
    c = (side - 1) / 2.0
    for y in range(side):
        dy = y - c
        for x in range(side):
            dx = x - c
            d = (dx * dx + dy * dy) ** 0.5
            mpx[x, y] = 255 if d <= r_in else (0 if d >= r_out else int(255 * (r_out - d) / (r_out - r_in)))

    out = emblem.convert("RGBA")
    out.putalpha(mask)
    return out


def knockout_white(img: Image.Image, threshold: int = 735) -> Image.Image:
    """Flatten a white background to transparency (keeps anti-aliased edges soft)."""
    img = img.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, _ = px[x, y]
            if r + g + b > threshold:
                px[x, y] = (r, g, b, 0)
    return img


def _down(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.LANCZOS)


# Every delivered logo file has a hard 50 KB budget. The artwork is flat colour,
# so routing it through a 128-entry palette and back to RGBA carries the same
# pixels in half the bytes: 854 px emblem 38.5 KB -> 19.6 KB, 185 px API logo
# 6.8 KB -> 2.2 KB. Measured worst case at 854 px: a channel delta of 29/255 on
# 0.11% of pixels, all of it on the anti-aliased boundary - the flat fills and
# the transparency are untouched.
#
# _palette() converts BACK to straight RGBA on purpose: the PNG must keep colour
# type 6. mPDF and several mail clients render an indexed PNG (colour type 3)
# badly or not at all, and tests/full-suite.test.ts asserts byte 25 stays 6.
LOGO_PALETTE_COLOURS = 128
LOGO_ALPHA_LEVELS = 32
LOGO_MAX_BYTES = 50 * 1024

# The social card is a JPEG (social scrapers handle flat navy plates badly as
# PNG). quality=88 with 4:4:4 chroma lands it at ~49 KB, just inside the budget,
# and the flat navy still looks clean at 2x. Lower it if the card ever grows.
LOGO_OG_QUALITY = 88


def _snap_alpha(img: Image.Image, levels: int = LOGO_ALPHA_LEVELS) -> Image.Image:
    """
    Round the alpha channel to `levels` even steps.

    A logo edge is the only place alpha carries information, and PNG pays for
    every distinct value in the channel. 32 steps (1/31 of the way, i.e. an 8/255
    jump) is invisible on screen - and the browser re-antialiases anyway when the
    asset is drawn at UI size - while it takes the 854 px emblem from 44 KB to
    26 KB and the 1220 px lockup from 48 KB to 36 KB. 0 stays fully transparent
    and 255 stays fully opaque, so the flat fills are untouched.
    """
    if levels >= 256:
        return img
    step = 255 // (levels - 1)
    lut = [min(255, (v + step // 2) // step * step) for v in range(256)]
    out = img.convert("RGBA")
    out.putalpha(out.getchannel("A").point(lut))
    return out


def _palette(img: Image.Image) -> Image.Image:
    """Flat-colour artwork -> compact, still-RGBA PNG payload (colour type 6)."""
    return (_snap_alpha(img)
            .quantize(colors=LOGO_PALETTE_COLOURS, method=Image.FASTOCTREE)
            .convert("RGBA"))


def _encode_png(img: Image.Image, optimize: bool = True) -> bytes:
    """
    The ONE place a logo becomes bytes.

    Both the written file and the embedded base64 in src/services/logoData.ts /
    server/astrology/logoBase64.ts go through here, so the three stay
    byte-identical (asserted by tests/logo-assets.test.ts) and share the budget.
    """
    buf = io.BytesIO()
    _palette(img).save(buf, "PNG", optimize=optimize)
    return buf.getvalue()


def _write_png(img: Image.Image, path: str, optimize: bool = True) -> int:
    data = _encode_png(img, optimize)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(data)
    return len(data)


def _font(name: str, px: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(os.path.join(FONTS, name), max(int(round(px)), 4))


def _tracked(draw, x, baseline, text, font, fill, tracking):
    for ch in text:
        draw.text((x, baseline), ch, font=font, fill=fill, anchor="ls")
        x += draw.textlength(ch, font=font) + tracking


def _tracked_width(text, font, tracking):
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    return sum(probe.textlength(ch, font=font) for ch in text) + tracking * (len(text) - 1)


# --------------------------------------------------------------------------- #
# modern sources (drawn)
# --------------------------------------------------------------------------- #
def _modern_emblem(size: int = 1024) -> Image.Image:
    return mm.render_mark(size, colour=GOLD, with_dots=True)


def _modern_appicon(size: int = 1024) -> Image.Image:
    """Reduced mark: sun + crescent only, no dot ring."""
    return mm.render_mark(size, colour=GOLD, with_dots=False)


def _modern_icon_tile(size: int, mark: Image.Image, inset_ratio: float = 0.10) -> Image.Image:
    """Square icon: gold mark centred on a flat navy tile."""
    tile = Image.new("RGBA", (size, size), NAVY + (255,))
    inner = int(size * (1 - inset_ratio * 2))
    small = _down(mark, inner)
    tile.alpha_composite(small, ((size - inner) // 2, (size - inner) // 2))
    return tile


def _fit_font(text: str, font_name: str, tracking_ratio: float,
              max_px: float, avail_w: float):
    """
    Largest font size (<= max_px) at which `text` fits `avail_w` with tracking
    proportional to the font size. Keeps the social card typography honest
    instead of letting it spill off the canvas.
    """
    lo, hi, best = 6.0, max_px, 6.0
    for _ in range(24):
        mid = (lo + hi) / 2.0
        font = _font(font_name, mid)
        if _tracked_width(text, font, mid * tracking_ratio) <= avail_w:
            best, lo = mid, mid
        else:
            hi = mid
    return _font(font_name, best), best * tracking_ratio


def _modern_og_card() -> Image.Image:
    """
    1200x630 flat navy social card: mark left, wordmark right, auto-fitted.

    The brand line is ONLY the name plus its slogan. A list of services must
    never be baked into brand artwork again - services belong in page copy, not
    in the logo. (tests/logo-assets.test.ts asserts no service name can reappear
    anywhere in this file or in modern_mark.py.)
    """
    W, H = 1200, 630
    card = Image.new("RGBA", (W, H), NAVY + (255,))

    pad = 64
    mark_h = H - pad * 2
    mark = mm.render_mark(mark_h, colour=GOLD, with_dots=True)
    card.alpha_composite(mark, (pad, pad))

    x0 = pad + mark_h + 54
    avail = W - pad - x0

    name = "ASTRO SIVAM"
    sub = "VEDIC ASTROLOGY"

    name_font, name_track = _fit_font(name, "NotoSans-Bold.ttf", 0.075, 92, avail)
    sub_font, sub_track = _fit_font(sub, "NotoSans-Medium.ttf", 0.30, 42, avail)

    # two lines only, optically centred against the mark (which spans pad..H-pad)
    d = ImageDraw.Draw(card)
    _tracked(d, x0, H * 0.495, name, name_font, WHITE + (255,), name_track)
    _tracked(d, x0, H * 0.615, sub, sub_font, GOLD_LIGHT + (255,), sub_track)
    return card


# --------------------------------------------------------------------------- #
# build
# --------------------------------------------------------------------------- #
def _load_sources(variant: str) -> dict:
    """Everything a variant can render, loaded once."""
    cfg = VARIANTS[variant]
    if variant == "modern":
        mm.verify_composition()
        return {
            "emblem": _modern_emblem(),
            "mark_reduced": _modern_appicon(),
            "lockup": mm.render_lockup(400, colour=NAVY, mark_colour=GOLD),
            "og": _modern_og_card(),
        }

    lk = Image.open(cfg["lockup"]).convert("RGB")
    lx0, ly0, lx1, ly1 = _non_white_bbox(lk)
    return {
        "emblem": circular_transparent(Image.open(cfg["master"])),
        "mark_reduced": Image.open(cfg["appicon"]).convert("RGB"),
        "lockup": knockout_white(lk.crop((lx0, ly0, lx1, ly1))),
        "og": Image.open(cfg["og"]).convert("RGB"),
    }


def build(variant: str, target_pub: str, live: bool, report: list,
          pdf_variant: str | None = None):
    """
    variant      artwork for the browser assets (nav, lockup, favicons, social)
    pdf_variant  artwork for the 185px API logo + embedded base64 used by the
                 PDF reports, invoices and e-mail. Defaults to `variant`.

    Both targets default to the same variant. An explicit pdf_variant allows a
    deliberate hybrid when one is requested, without changing the live default.
    """
    cfg = VARIANTS[variant]
    src = _load_sources(variant)
    emblem = src["emblem"]
    mark_reduced = src["mark_reduced"]
    lockup = src["lockup"]
    og = src["og"]

    # ---- 1. emblem, browser + vite import -------------------------------- #
    logo = _down(emblem, 854)
    pub_logo = os.path.join(target_pub, "astrosivam_logo.png")
    report.append((os.path.relpath(pub_logo, ROOT), 854, _write_png(logo, pub_logo)))
    if live:
        p = os.path.join(ROOT, "src", "assets", "astrosivam_logo.png")
        report.append((os.path.relpath(p, ROOT), 854, _write_png(logo, p)))

    # ---- 2. horizontal lockup -------------------------------------------- #
    tw = 1220
    lock = lockup.resize((tw, max(1, round(lockup.height * tw / lockup.width))), Image.LANCZOS)
    pub_lock = os.path.join(target_pub, "astrosivam_full_logo.png")
    report.append((os.path.relpath(pub_lock, ROOT), tw, _write_png(lock, pub_lock)))
    if live:
        p = os.path.join(ROOT, "src", "assets", "astrosivam_full_logo.png")
        report.append((os.path.relpath(p, ROOT), tw, _write_png(lock, p)))

    # ---- 3. reduced mark for small UI avatars ---------------------------- #
    app = _down(mark_reduced, 256)
    if live:
        p = os.path.join(ROOT, "src", "assets", "astrosivam_appicon.png")
        report.append((os.path.relpath(p, ROOT), 256, _write_png(app, p)))
    else:
        p = os.path.join(target_pub, "astrosivam_appicon.png")
        report.append((os.path.relpath(p, ROOT), 256, _write_png(app, p)))

    # ---- 4. social share card, exact 1200x630 ---------------------------- #
    ratio = 1200 / 630
    w, h = og.size
    if w / h > ratio:
        nw = int(round(h * ratio))
        og = og.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(round(w / ratio))
        og = og.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    og = og.convert("RGB").resize((1200, 630), Image.LANCZOS)
    pub_og = os.path.join(target_pub, "astrosivam_og_image.jpg")
    os.makedirs(os.path.dirname(pub_og), exist_ok=True)
    og.save(pub_og, "JPEG", quality=LOGO_OG_QUALITY, subsampling=0,
            optimize=True, progressive=True)
    report.append((os.path.relpath(pub_og, ROOT), 1200, os.path.getsize(pub_og)))

    # ---- 5. API copy + embedded base64 (live only, must stay in lockstep) - #
    if live:
        pdf_emblem = emblem if (pdf_variant or variant) == variant else _load_sources(pdf_variant)["emblem"]
        api_logo = _down(pdf_emblem, 185)
        api_path = os.path.join(ROOT, "api", "assets", "astrosivam_logo.png")
        report.append((os.path.relpath(api_path, ROOT), 185, _write_png(api_logo, api_path)))

        buf = io.BytesIO()
        buf.write(_encode_png(api_logo))
        data_uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

        for rel, const in (
            (os.path.join("src", "services", "logoData.ts"), "ASTRO_LOGO_BASE64"),
            (os.path.join("server", "astrology", "logoBase64.ts"), "EMBEDDED_LOGO_BASE64"),
        ):
            path = os.path.join(ROOT, rel)
            if not os.path.isfile(path):
                continue
            with open(path, "r", encoding="utf-8") as fh:
                src = fh.read()
            src, n = re.subn(rf'(export const {const} = ")[^"]*(";)',
                             lambda m: m.group(1) + data_uri + m.group(2), src, count=1)
            if n:
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(src)
                report.append((rel, 185, os.path.getsize(path)))
            else:
                print(f"WARNING: {const} not found in {rel}")

    # ---- 6. favicons + PWA icons ----------------------------------------- #
    if variant == "modern":
        # The full mark is a liability below DOTS_MIN_PX - see the note there.
        # Reduced mark for small favicons, full mark once the dots can breathe.
        def icon(size):
            source = mark_reduced if mark_for_size(size) == "reduced" else emblem
            return _modern_icon_tile(size, source)
    else:
        # The ornate artwork already carries its own navy field, so the favicon is
        # simply the square app-icon source scaled down - no extra tile, no rounding.
        app_src = Image.open(cfg["appicon"]).convert("RGB")
        ax0, ay0, ax1, ay1 = _non_white_bbox(app_src, threshold=740)
        if ax1 > ax0 and ay1 > ay0:
            app_src = app_src.crop((ax0, ay0, ax1, ay1))
        side = min(app_src.size)
        app_src = app_src.crop(((app_src.width - side) // 2, (app_src.height - side) // 2,
                                (app_src.width - side) // 2 + side,
                                (app_src.height - side) // 2 + side))

        def icon(size):
            return _down(app_src, size)

    for size in (16, 32, 48):
        p = os.path.join(target_pub, f"favicon-{size}x{size}.png")
        report.append((os.path.relpath(p, ROOT), size, _write_png(icon(size), p)))
    p = os.path.join(target_pub, "apple-touch-icon.png")
    report.append((os.path.relpath(p, ROOT), 180, _write_png(icon(180), p)))
    for size in (192, 512):
        p = os.path.join(target_pub, f"android-chrome-{size}x{size}.png")
        report.append((os.path.relpath(p, ROOT), size, _write_png(icon(size), p)))

    ico = os.path.join(target_pub, "favicon.ico")
    icon(256).save(ico, sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    report.append((os.path.relpath(ico, ROOT), 256, os.path.getsize(ico)))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--variant", choices=sorted(VARIANTS), default="modern")
    ap.add_argument("--pdf-variant", choices=sorted(VARIANTS), default=None,
                    help="artwork for the PDF report / invoice / e-mail logo. "
                         "Defaults to --variant; only set it explicitly when a "
                         "different report variant is intended.")
    ap.add_argument("--target", default=None,
                    help="output folder for the public assets (default: public/). "
                         "Passing a custom folder implies --no-live.")
    ap.add_argument("--live", dest="live", action="store_true", default=None,
                    help="also update src/assets, api/assets and the base64 modules")
    ap.add_argument("--no-live", dest="live", action="store_false")
    args = ap.parse_args()

    target_pub = args.target or os.path.join(ROOT, "public")
    if not os.path.isabs(target_pub):
        target_pub = os.path.join(ROOT, target_pub)
    live = (args.live if args.live is not None else args.target is None)

    pdf_variant = args.pdf_variant or args.variant
    report: list = []
    build(args.variant, target_pub, live, report, pdf_variant)

    suffix = "" if pdf_variant == args.variant else f"   reports: {pdf_variant}"
    print(f"variant: {args.variant}   target: {os.path.relpath(target_pub, ROOT)}   "
          f"live: {live}{suffix}")
    print(f"{'file':56s} {'px':>5s} {'bytes':>10s}")
    print("-" * 74)
    over = []
    for name, px, size in report:
        flag = ""
        if name.endswith((".png", ".jpg")) and size > LOGO_MAX_BYTES:
            flag = "  <-- OVER 50 KB BUDGET"
            over.append(name)
        print(f"{name:56s} {px:5d} {size:10,d}{flag}")

    if over:
        raise SystemExit(
            "logo budget exceeded: " + ", ".join(over)
            + f". Every served logo PNG must stay under {LOGO_MAX_BYTES // 1024} KB "
              "(the 185 px copy is inlined into e-mail bodies). Retune the mark or "
              "lower LOGO_PALETTE_COLOURS."
        )


if __name__ == "__main__":
    main()
