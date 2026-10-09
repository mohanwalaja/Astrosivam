#!/usr/bin/env python3
"""
ASTRO SIVAM - logo concept exploration (5 candidates).

Each concept is drawn with real geometry (same approach as modern_mark.py):
twelve dots / twelve rasi glyphs on a ring, plus Surya (sun) and Chandra
(crescent). Output is flat gold artwork on a transparent background, so the
mark sits cleanly on the navy navbar, on white pages and inside PDF reports.

    /tmp/venv/bin/python scripts/logo_concepts.py --out design/concepts

Everything is rendered at 4x and downsampled, which is what keeps the circles
and the crescent edge smooth without any AI raster in the pipeline.
"""

from __future__ import annotations

import argparse
import math
import sys
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from modern_mark_geometry import P  # noqa: E402  (live tuning, single source of truth)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "api", "astrology", "fonts")
GLYPH_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

SS = 4  # supersampling factor

# Brand colours
NAVY = (13, 27, 62)
NAVY_DEEP = (9, 16, 41)
GOLD = (201, 150, 44)
GOLD_LIGHT = (224, 183, 95)
GOLD_DEEP = (176, 124, 32)
CREAM = (247, 244, 236)
WHITE = (255, 255, 255)

ZODIAC = "\u2648\u2649\u264a\u264b\u264c\u264d\u264e\u264f\u2650\u2651\u2652\u2653"


# --------------------------------------------------------------------------- #
# masks
# --------------------------------------------------------------------------- #
def blank(px: int) -> Image.Image:
    return Image.new("L", (px, px), 0)


def disc(px: int, cx: float, cy: float, r: float, fill: int = 255) -> Image.Image:
    layer = blank(px)
    ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    return layer


def ring(px: int, cx: float, cy: float, r_out: float, r_in: float) -> Image.Image:
    return ImageChops.subtract(disc(px, cx, cy, r_out), disc(px, cx, cy, r_in))


def dilate(mask: Image.Image, px: float) -> Image.Image:
    if px <= 0:
        return mask
    blurred = mask.filter(ImageFilter.GaussianBlur(px * 0.5))
    return blurred.point(lambda v: 255 if v >= 128 else 0)


def dot(mask: Image.Image, cx: float, cy: float, r: float) -> None:
    ImageDraw.Draw(mask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)


def polar(c: float, radius: float, index: int, count: int = 12, start_deg: float = -90.0):
    a = math.radians(start_deg + 360.0 * index / count)
    return c + radius * math.cos(a), c + radius * math.sin(a)


def dots_ring(px: int, c: float, ring_r: float, dot_r: float, count: int = 12) -> Image.Image:
    m = blank(px)
    for i in range(count):
        x, y = polar(c, ring_r, i, count)
        dot(m, x, y, dot_r)
    return m


def crescent(px: int, c: float, cx: float, cy: float, r: float, bite: float,
             keep_clear_of: Image.Image | None = None, gap: float = 0.0) -> Image.Image:
    """moon circle minus a same-size circle pushed left, optionally cleared off the sun."""
    moon = ImageChops.subtract(disc(px, cx, cy, r), disc(px, cx - bite, cy, r))
    if keep_clear_of is not None and gap > 0:
        moon = ImageChops.subtract(moon, dilate(keep_clear_of, gap))
    return moon


def luminaries(px: int, c: float, sun_r: float, sun_dx: float, moon_r: float,
               moon_dx: float, bite: float, gap: float) -> tuple[Image.Image, Image.Image]:
    sun = disc(px, c + sun_dx, c, sun_r)
    moon = crescent(px, c, c + moon_dx, c, moon_r, bite, keep_clear_of=sun, gap=gap)
    return sun, moon


# --------------------------------------------------------------------------- #
# the five concepts -> (sun, moon, extras) in gold-space masks
# --------------------------------------------------------------------------- #
def concept_1(size: int) -> dict:
    """
    Rasi Ring - SELECTED, and now the live mark.

    Reads modern_mark_geometry.P directly, so this board can never drift from
    what scripts/build_logo_assets.py actually ships. That is also why the
    crescent follows the live rule (sun carved by the dilated crescent) instead
    of the standalone construction the other concepts use.
    """
    px = size * SS
    c = px / 2.0
    sun_r, sun_dx = P.sun_radius * px, P.sun_offset_x * px
    moon_r, moon_dx, bite = P.moon_radius * px, P.moon_offset_x * px, P.moon_bite * px
    sun = disc(px, c + sun_dx, c, sun_r)
    moon = crescent(px, c, c + moon_dx, c, moon_r, bite,
                    keep_clear_of=sun, gap=P.gap * px)
    sun = ImageChops.subtract(sun, dilate(moon, 0))
    return {"gold": ImageChops.lighter(dots_ring(px, c, P.ring_radius * px,
                                                 P.dot_radius * px), sun),
            "accent": moon, "px": px}


def concept_2(size: int) -> dict:
    """Zodiac Wheel - the twelve rasi glyphs in a ring around Surya-Chandra."""
    px = size * SS
    c = px / 2.0
    sun, moon = luminaries(px, c, sun_r=0.150 * px, sun_dx=-0.044 * px,
                           moon_r=0.140 * px, moon_dx=0.070 * px,
                           bite=0.086 * px, gap=0.010 * px)
    glyphs = blank(px)
    font = ImageFont.truetype(GLYPH_FONT, int(0.150 * px))
    d = ImageDraw.Draw(glyphs)
    for i, ch in enumerate(ZODIAC):
        x, y = polar(c, 0.375 * px, i)
        box = d.textbbox((0, 0), ch, font=font)
        d.text((x - (box[2] - box[0]) / 2 - box[0], y - (box[3] - box[1]) / 2 - box[1]),
               ch, font=font, fill=255)
    guide = ring(px, c, c, 0.300 * px, 0.2975 * px)
    return {"gold": ImageChops.lighter(glyphs, sun), "accent": moon, "extra": guide, "px": px}


def concept_3(size: int) -> dict:
    """Eclipse - a bolder Surya with Chandra riding just clear of its limb."""
    px = size * SS
    c = px / 2.0
    sun = disc(px, c - 0.045 * px, c, 0.200 * px)
    moon = crescent(px, c, c + 0.155 * px, c, 0.185 * px, bite=0.105 * px,
                    keep_clear_of=sun, gap=0.012 * px)
    corona = dots_ring(px, c, 0.410 * px, 0.036 * px)
    return {"gold": ImageChops.lighter(sun, corona), "accent": moon, "px": px}


def concept_4(size: int) -> dict:
    """Medallion - a navy disc carrying the gold rim dots and the luminaries."""
    px = size * SS
    c = px / 2.0
    rim = dots_ring(px, c, 0.362 * px, 0.042 * px)
    sun, moon = luminaries(px, c, sun_r=0.150 * px, sun_dx=-0.042 * px,
                           moon_r=0.140 * px, moon_dx=0.068 * px,
                           bite=0.086 * px, gap=0.010 * px)
    return {"gold": ImageChops.lighter(rim, sun), "accent": moon,
            "field": disc(px, c, c, 0.470 * px), "px": px}


def concept_5(size: int) -> dict:
    """Surya Rays - twelve tapered rays, with Chandra in an opening at 4 o'clock."""
    px = size * SS
    c = px / 2.0
    sun_r = 0.208 * px
    rays = blank(px)
    d = ImageDraw.Draw(rays)
    for i in range(12):
        a = math.radians(-90.0 + 30.0 * i)
        hb = math.radians(5.6)
        tip = (c + 0.318 * px * math.cos(a), c + 0.318 * px * math.sin(a))
        b1 = (c + sun_r * 0.96 * math.cos(a - hb), c + sun_r * 0.96 * math.sin(a - hb))
        b2 = (c + sun_r * 0.96 * math.cos(a + hb), c + sun_r * 0.96 * math.sin(a + hb))
        d.polygon([tip, b1, b2], fill=255)

    # open a clean wedge in the corona for the crescent to sit in
    wedge = blank(px)
    wd = ImageDraw.Draw(wedge)
    wd.pieslice([c - 0.42 * px, c - 0.42 * px, c + 0.42 * px, c + 0.42 * px],
                start=-6.0, end=44.0, fill=255)
    wedge = ImageChops.subtract(wedge, disc(px, c, c, 0.250 * px))
    rays = ImageChops.subtract(rays, wedge)

    sun = disc(px, c, c, sun_r)
    a = math.radians(16.0)
    moon = crescent(px, c, c + 0.262 * px * math.cos(a), c + 0.262 * px * math.sin(a),
                    0.132 * px, bite=0.078 * px)
    return {"gold": ImageChops.lighter(rays, sun), "accent": moon, "px": px}


CONCEPTS = [
    ("1", "Rasi Ring", concept_1),
    ("2", "Zodiac Wheel", concept_2),
    ("3", "Eclipse", concept_3),
    ("4", "Medallion", concept_4),
    ("5", "Surya Rays", concept_5),
]


# --------------------------------------------------------------------------- #
# colour
# --------------------------------------------------------------------------- #
def _clean_alpha(img: Image.Image) -> Image.Image:
    """
    Snap near-transparent and near-opaque pixels to 0 / 255.

    The art is flat colour with a hard edge, so the only real information in the
    alpha channel is the anti-aliased boundary. Collapsing the two extremes
    removes a long tail of distinct values and roughly halves the PNG.
    """
    a = img.getchannel("A").point(lambda v: 0 if v < 5 else (255 if v > 250 else v))
    out = img.copy()
    out.putalpha(a)
    return out


def gold_layer(mask: Image.Image, size: int, colour=GOLD) -> Image.Image:
    """Tint a supersampled mask with a flat colour and downsample to `size`."""
    small = mask.resize((size, size), Image.LANCZOS)
    layer = Image.new("RGBA", (size, size), colour + (0,))
    layer.putalpha(small)
    return _clean_alpha(layer)


def gradient_layer(mask: Image.Image, size: int, top=GOLD_LIGHT, bottom=GOLD_DEEP) -> Image.Image:
    grad = Image.new("RGBA", (size, size))
    gd = ImageDraw.Draw(grad)
    for y in range(size):
        t = y / max(size - 1, 1)
        gd.line([(0, y), (size, y)], fill=tuple(
            int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    grad.putalpha(mask.resize((size, size), Image.LANCZOS))
    return grad


def render_mark(concept, size: int) -> Image.Image:
    """The mark alone: flat gold artwork, transparent background."""
    parts = concept(size)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if "field" in parts:
        img = Image.alpha_composite(img, gold_layer(parts["field"], size, NAVY))
    for key, colour in (("extra", GOLD), ("gold", GOLD), ("accent", GOLD_LIGHT)):
        if key in parts:
            img = Image.alpha_composite(img, gold_layer(parts[key], size, colour))
    return img


def render_tile(concept, size: int, bg=NAVY, radius_frac: float = 0.0, pad_frac: float = 0.10) -> Image.Image:
    """The mark on a navy tile - app icon / favicon presentation."""
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    r = int(size * radius_frac)
    if r:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=bg + (255,))
    else:
        d.ellipse([0, 0, size - 1, size - 1], fill=bg + (255,))
    inner = int(size * (1 - 2 * pad_frac))
    mark = render_mark(concept, inner)
    base.alpha_composite(mark, (int(size * pad_frac), int(size * pad_frac)))
    return base


# --------------------------------------------------------------------------- #
# wordmark / lockup
# --------------------------------------------------------------------------- #
def tracked_text(draw, xy, text, font, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


def wordmark_height(scale: float, text: str = "ASTRO SIVAM", font_path: str | None = None):
    size = int(round(58 * scale))
    font = ImageFont.truetype(font_path or os.path.join(FONT_DIR, "Cinzel-Bold.ttf"), size)
    return font


def render_lockup(concept, height: int = 150, on_dark: bool = False,
                  word_gold=None, word_navy=None) -> Image.Image:
    """Horizontal lockup: emblem + ASTRO SIVAM / VEDIC ASTROLOGY."""
    name_font = ImageFont.truetype(os.path.join(FONT_DIR, "Cinzel-Bold.ttf"), int(height * 0.44))
    tag_font = ImageFont.truetype(os.path.join(FONT_DIR, "NotoSans-Regular.ttf"), int(height * 0.155))
    mark_px = int(height * 0.86)
    mark = render_mark(concept, mark_px)

    probe = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    name = "ASTRO SIVAM"
    track_name = height * 0.030
    name_w = sum(probe.textlength(ch, font=name_font) + track_name for ch in name) - track_name
    tag = "VEDIC ASTROLOGY"
    track_tag = height * 0.115
    tag_w = sum(probe.textlength(ch, font=tag_font) + track_tag for ch in tag) - track_tag

    gap = height * 0.20
    w = int(mark_px + gap + max(name_w, tag_w) + height * 0.08)
    img = Image.new("RGBA", (w, height), (0, 0, 0, 0))
    img.alpha_composite(mark, (0, int((height - mark_px) / 2)))
    d = ImageDraw.Draw(img)

    text_x = mark_px + gap
    name_fill = word_gold or (GOLD if on_dark else NAVY)
    tag_fill = (216, 200, 160) if on_dark else (120, 116, 104)
    if word_navy:
        name_fill = word_navy
    name_y = int(height * 0.20)
    tracked_text(d, (text_x, name_y), name, name_font, name_fill + (255,), track_name)
    tag_y = int(height * 0.70)
    tracked_text(d, (text_x + height * 0.012, tag_y), tag, tag_font, tag_fill + (255,), track_tag)
    return img


# --------------------------------------------------------------------------- #
# presentation board (what the user sees in chat)
# --------------------------------------------------------------------------- #
def render_board(index: str, title: str, concept, path: str) -> None:
    W, H = 1400, 660
    board = Image.new("RGBA", (W, H), CREAM + (255,))
    d = ImageDraw.Draw(board)

    head_font = ImageFont.truetype(os.path.join(FONT_DIR, "Cinzel-Bold.ttf"), 34)
    sub_font = ImageFont.truetype(os.path.join(FONT_DIR, "NotoSans-Regular.ttf"), 22)
    tiny_font = ImageFont.truetype(os.path.join(FONT_DIR, "NotoSans-Regular.ttf"), 18)

    d.text((48, 38), f"DESIGN {index}", font=head_font, fill=NAVY + (255,))
    d.text((48 + d.textlength(f"DESIGN {index}", font=head_font) + 22, 50), title,
           font=sub_font, fill=(122, 116, 100, 255))
    d.line([(48, 96), (W - 48, 96)], fill=(220, 213, 197, 255), width=2)

    # 1. app tile
    tile = render_tile(concept, 260, bg=NAVY, radius_frac=0.22, pad_frac=0.11)
    board.alpha_composite(tile, (48, 140))
    d.text((48, 412), "app tile", font=tiny_font, fill=(140, 134, 118, 255))

    # 2. the mark on white (gold art, transparent background)
    mark = render_mark(concept, 260)
    board.alpha_composite(mark, (356, 140))
    d.text((356, 412), "emblem (on light)", font=tiny_font, fill=(140, 134, 118, 255))

    # 3. horizontal lockup on white and on navy
    lock = render_lockup(concept, height=132)
    board.alpha_composite(lock, (664, 152))
    d.rectangle([664, 300, W - 48, 300 + 132], fill=NAVY_DEEP + (255,))
    lock_dark = render_lockup(concept, height=132, on_dark=True)
    board.alpha_composite(lock_dark, (664, 300))
    d.text((664, 444), "lockup on light / on navy", font=tiny_font, fill=(140, 134, 118, 255))

    # 4. size test row
    d.text((48, 486), "at real size", font=tiny_font, fill=(140, 134, 118, 255))
    x = 48
    for px in (16, 24, 32, 48, 68):
        tile = render_tile(concept, px, bg=NAVY, radius_frac=0.22, pad_frac=0.08)
        board.alpha_composite(tile, (x, 516 + (68 - px)))
        x += px + 22
    x += 14
    d.text((x, 540), "16 - 68 px", font=tiny_font, fill=(140, 134, 118, 255))

    # 5. favicon-ish navy strip with the mark and the name
    strip_x, strip_y, strip_w, strip_h = 700, 516, 652, 96
    d.rounded_rectangle([strip_x, strip_y, strip_x + strip_w, strip_y + strip_h],
                        radius=14, fill=NAVY + (255,))
    nav_mark = render_mark(concept, 62)
    board.alpha_composite(nav_mark, (strip_x + 22, strip_y + 17))
    nav_font = ImageFont.truetype(os.path.join(FONT_DIR, "Cinzel-Bold.ttf"), 30)
    tracked_text(d, (strip_x + 104, strip_y + 22), "ASTRO SIVAM", nav_font,
                 GOLD + (255,), 6)
    nav_tag = ImageFont.truetype(os.path.join(FONT_DIR, "NotoSans-Regular.ttf"), 13)
    tracked_text(d, (strip_x + 108, strip_y + 62), "INDIAN VEDIC ASTROLOGY", nav_tag,
                 (198, 190, 172, 255), 3)
    d.text((strip_x, strip_y - 32), "navbar strip", font=tiny_font, fill=(140, 134, 118, 255))

    board.convert("RGB").save(path, "JPEG", quality=90, optimize=True)


def save_web_png(img: Image.Image, path: str) -> None:
    """
    Write a compact PNG for the web.

    The artwork is flat colour, so a 128-entry palette carries the same pixels at
    a fraction of the size: ~10 KB at 1024 px instead of ~30-60 KB. That is what
    keeps every delivered logo file inside the 50 KB budget.
    """
    img.convert("RGBA").quantize(colors=128, method=Image.FASTOCTREE).save(
        path, "PNG", optimize=True)


def render_overview(path: str) -> None:
    """One strip showing all five marks as app tiles plus name and file size."""
    cw, ch = 268, 372
    W, H = cw * 5 + 24 * 6, 470
    sheet = Image.new("RGB", (W, H), (249, 247, 242))
    d = ImageDraw.Draw(sheet)
    f_num = ImageFont.truetype(os.path.join(FONT_DIR, "Cinzel-Bold.ttf"), 30)
    f_name = ImageFont.truetype(os.path.join(FONT_DIR, "NotoSans-Regular.ttf"), 21)
    f_small = ImageFont.truetype(os.path.join(FONT_DIR, "NotoSans-Regular.ttf"), 17)
    for idx, (i, title, concept) in enumerate(CONCEPTS):
        x = 24 + idx * (cw + 24)
        sheet.paste(render_tile(concept, 232, bg=NAVY, radius_frac=0.20,
                                pad_frac=0.10).convert("RGB"), (x + 18, 24))
        emb = render_mark(concept, 120)
        sheet.paste(emb.convert("RGB"), (x + 18, 282), emb)
        d.text((x + 152, 286), i, font=f_num, fill=NAVY)
        d.text((x + 152, 330), title, font=f_name, fill=(60, 58, 52))
        kb = os.path.getsize(os.path.join(os.path.dirname(path),
                                         f"design-option-{i}-mark.png")) / 1024
        d.text((x + 152, 362), f"{kb:.0f} KB", font=f_small, fill=(140, 134, 118))
        d.text((x + 18, 414), "tap / open to zoom", font=f_small, fill=(180, 174, 158))
    sheet.save(path, "JPEG", quality=92)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "public", "logos"))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    for index, title, concept in CONCEPTS:
        mark = render_mark(concept, 1024)
        mark_path = os.path.join(args.out, f"design-option-{index}-mark.png")
        save_web_png(mark, mark_path)
        board_path = os.path.join(args.out, f"design-option-{index}.jpg")
        render_board(index, title, concept, board_path)
        print(f"design {index}  {title:<14} mark {os.path.getsize(mark_path)/1024:6.1f} KB  "
              f"board {os.path.getsize(board_path)/1024:6.1f} KB")

    render_overview(os.path.join(args.out, "design-options-overview.jpg"))


if __name__ == "__main__":
    main()
