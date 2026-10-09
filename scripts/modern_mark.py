#!/usr/bin/env python3
"""
ASTRO SIVAM - Modern brand mark, drawn geometrically.

Why this is drawn rather than generated
---------------------------------------
The modern mark is pure geometry: twelve dots on a ring, a sun disc, a crescent
moon. Drawing it with real primitives (instead of shipping an AI raster) gives us:

  * exactly twelve dots, mathematically even spacing
  * a perfectly smooth crescent at any size, no AI edge artefacts
  * true transparent backgrounds and crisp output from 16px to 2048px
  * one place to retune proportions (Proportions below)

Every shape is a white silhouette mask combined with ImageChops, then tinted, so
the mark is one flat colour and behaves like a real vector logo.

Composition note
----------------
The sun / crescent separation is produced BY CONSTRUCTION, not by carving a gap:
the crescent's two tips are placed to fall a deliberate distance outside the sun
disc, so the negative space between the luminaries is even and reproducible at
any size. An optional extra gap (`gap`) dilates the crescent away from the sun
if a client ever wants more air.

Usage
-----
    from modern_mark import render_mark, render_lockup, render_stacked
    img = render_mark(1024, with_dots=True)
"""

from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

from modern_mark_geometry import (  # noqa: F401  (re-exported for callers)
    DOTS_MIN_PX,
    P,
    Proportions,
    crescent_metrics,
    mark_for_size,
    verify_composition,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "api", "astrology", "fonts")

# Brand colours - kept in sync with index.html theme-color and site.webmanifest
NAVY = (13, 27, 62)
GOLD = (201, 150, 44)
GOLD_LIGHT = (222, 178, 82)
WHITE = (255, 255, 255)

SS = 4  # supersampling factor


# --------------------------------------------------------------------------- #
# masks
# --------------------------------------------------------------------------- #
def _disc(size: int, cx: float, cy: float, r: float) -> Image.Image:
    """A solid white disc on a black mask (255 = ink)."""
    layer = Image.new("L", (size, size), 0)
    ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    return layer


def _dilate(mask: Image.Image, px: float) -> Image.Image:
    """
    Near-circular dilation. A Gaussian blur re-thresholded at its midpoint grows
    the shape by roughly `px` with round edges - cheaper and smoother than a
    square MaxFilter structuring element.
    """
    if px <= 0:
        return mask
    blurred = mask.filter(ImageFilter.GaussianBlur(px * 0.5))
    return blurred.point(lambda v: 255 if v >= 128 else 0)


def _mark_mask(size: int, with_dots: bool = True, p: Proportions = P) -> Image.Image:
    """White silhouette of the whole mark (255 = ink) on a black field."""
    c = size / 2.0
    sun_cx = c + p.sun_offset_x * size
    sun_r = p.sun_radius * size
    moon_cx = c + p.moon_offset_x * size
    moon_r = p.moon_radius * size
    bite_cx = moon_cx - p.moon_bite * size

    # crescent = moon circle minus the carving circle pushed to its left
    crescent = ImageChops.subtract(
        _disc(size, moon_cx, c, moon_r),
        _disc(size, bite_cx, c, moon_r),
    )

    sun = _disc(size, sun_cx, c, sun_r)
    if p.gap > 0:
        sun = ImageChops.subtract(sun, _dilate(crescent, p.gap * size))

    mask = ImageChops.lighter(sun, crescent)

    # twelve dots, first at 12 o'clock, clockwise
    if with_dots:
        dots = Image.new("L", (size, size), 0)
        dd = ImageDraw.Draw(dots)
        dot_r = p.dot_radius * size
        ring_r = p.ring_radius * size
        for i in range(12):
            a = (math.pi * 2 * i / 12) - (math.pi / 2)
            x = c + ring_r * math.cos(a)
            y = c + ring_r * math.sin(a)
            dd.ellipse([x - dot_r, y - dot_r, x + dot_r, y + dot_r], fill=255)
        mask = ImageChops.lighter(mask, dots)

    return mask


# --------------------------------------------------------------------------- #
# renderers
# --------------------------------------------------------------------------- #
def render_mark(size: int, colour=GOLD, with_dots: bool = True,
                background=None, pad: float = 0.0) -> Image.Image:
    """
    The Surya-Chandra monogram.

    size        : canvas edge in px
    colour      : flat fill for the silhouette
    with_dots   : False for the reduced mark used at favicon sizes
    background  : None for transparency, or an (r,g,b) fill
    pad         : margin around the mark, as a fraction of `size`
    """
    inner = max(size - int(size * pad * 2), 4)
    mask = _mark_mask(inner * SS, with_dots).resize((inner, inner), Image.LANCZOS)

    layer = Image.new("RGBA", (inner, inner), tuple(colour) + (255,))
    layer.putalpha(mask)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if background is not None:
        canvas.paste(Image.new("RGBA", (size, size), tuple(background) + (255,)), (0, 0))
    canvas.alpha_composite(layer, (int(size * pad), int(size * pad)))
    return canvas


def _load_font(name: str, px: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(os.path.join(FONT_DIR, name), max(int(round(px)), 4))


def _tracked_width(text: str, font: ImageFont.FreeTypeFont, tracking: float) -> float:
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    return sum(probe.textlength(ch, font=font) for ch in text) + tracking * (len(text) - 1)


def _draw_tracked(draw: ImageDraw.ImageDraw, x: float, baseline: float, text: str,
                  font: ImageFont.FreeTypeFont, fill, tracking: float) -> None:
    for ch in text:
        draw.text((x, baseline), ch, font=font, fill=fill, anchor="ls")
        x += draw.textlength(ch, font=font) + tracking


def render_lockup(height: int, colour=NAVY, mark_colour=GOLD,
                  background=None, with_dots: bool = True) -> Image.Image:
    """
    Horizontal lockup: mark on the left, ASTRO SIVAM / VEDIC ASTROLOGY stacked right.

    `height` is the finished mark height in px. The whole lockup is laid out at
    SS x and downscaled once, so the mark and the type stay equally crisp.

    Typography is the approved 2026 treatment: the name in Cinzel-Bold (the
    letterforms shown on every design board), the slogan in letterspaced Noto
    Sans so it reads as a caption rather than a second headline.
    """
    H = height * SS
    mark = render_mark(H, colour=mark_colour, with_dots=with_dots)
    gap = H * 0.34

    name_font = _load_font("Cinzel-Bold.ttf", H * 0.420)
    sub_font = _load_font("NotoSans-Regular.ttf", H * 0.150)
    name, sub = "ASTRO SIVAM", "VEDIC ASTROLOGY"
    name_track, sub_track = H * 0.032, H * 0.105

    text_w = max(_tracked_width(name, name_font, name_track),
                 _tracked_width(sub, sub_font, sub_track))

    canvas = Image.new("RGBA", (int(H + gap + text_w) + 8, H), (0, 0, 0, 0))
    if background is not None:
        canvas.paste(Image.new("RGBA", canvas.size, tuple(background) + (255,)), (0, 0))

    canvas.alpha_composite(mark, (0, 0))

    d = ImageDraw.Draw(canvas)
    x0 = H + gap
    _draw_tracked(d, x0, H * 0.505, name, name_font, tuple(colour) + (255,), name_track)
    _draw_tracked(d, x0, H * 0.815, sub, sub_font, tuple(colour) + (255,), sub_track)

    bbox = canvas.getbbox()
    if bbox:
        canvas = canvas.crop(bbox)
    return canvas.resize(
        (max(canvas.width // SS, 1), max(canvas.height // SS, 1)), Image.LANCZOS
    )


def render_stacked(height: int, colour=NAVY, mark_colour=GOLD,
                   background=None, with_dots: bool = True) -> Image.Image:
    """Vertical lockup: mark on top, wordmark centred underneath."""
    H = height * SS
    mark_h = int(H * 0.60)

    name_font = _load_font("NotoSans-Bold.ttf", H * 0.112)
    sub_font = _load_font("NotoSans-Medium.ttf", H * 0.046)
    name, sub = "ASTRO SIVAM", "VEDIC ASTROLOGY"
    name_track, sub_track = H * 0.014, H * 0.018

    text_w = max(_tracked_width(name, name_font, name_track),
                 _tracked_width(sub, sub_font, sub_track))
    width = int(max(mark_h, text_w)) + 8

    canvas = Image.new("RGBA", (width, H), (0, 0, 0, 0))
    if background is not None:
        canvas.paste(Image.new("RGBA", canvas.size, tuple(background) + (255,)), (0, 0))

    mark = render_mark(mark_h, colour=mark_colour, with_dots=with_dots)
    canvas.alpha_composite(mark, ((width - mark_h) // 2, 0))

    d = ImageDraw.Draw(canvas)
    _draw_tracked(d, (width - _tracked_width(name, name_font, name_track)) / 2,
                  H * 0.80, name, name_font, tuple(colour) + (255,), name_track)
    _draw_tracked(d, (width - _tracked_width(sub, sub_font, sub_track)) / 2,
                  H * 0.945, sub, sub_font, tuple(colour) + (255,), sub_track)

    bbox = canvas.getbbox()
    if bbox:
        canvas = canvas.crop(bbox)
    return canvas.resize(
        (max(canvas.width // SS, 1), max(canvas.height // SS, 1)), Image.LANCZOS
    )


if __name__ == "__main__":
    verify_composition()
    m = crescent_metrics()
    print(f"tip clearance {m['tip_clearance']:.4f}   side gap {m['side_gap']:.4f}")
    print(f"group spans {m['group_spans'][0]:.3f}..{m['group_spans'][1]:.3f} "
          f"(centre {(m['group_spans'][0] + m['group_spans'][1]) / 2:.3f})")

    out = os.path.join(ROOT, "build")
    os.makedirs(out, exist_ok=True)
    render_mark(1024).save(os.path.join(out, "modern_mark_gold.png"))
    render_mark(1024, background=NAVY).save(os.path.join(out, "modern_mark_navy_bg.png"))
    render_mark(1024, background=WHITE).save(os.path.join(out, "modern_mark_white_bg.png"))
    render_mark(1024, with_dots=False).save(os.path.join(out, "modern_core_only.png"))
    render_lockup(200).save(os.path.join(out, "modern_lockup_light.png"))
    render_lockup(200, colour=WHITE, mark_colour=GOLD_LIGHT, background=NAVY).save(
        os.path.join(out, "modern_lockup_dark.png"))
    render_stacked(420).save(os.path.join(out, "modern_stacked.png"))
    print("wrote modern mark previews to build/")
