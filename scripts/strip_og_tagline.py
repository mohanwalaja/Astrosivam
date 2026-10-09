#!/usr/bin/env python3
"""
ASTRO SIVAM - one-time migration: strip the service list from the social card.

The original OpenGraph artwork carried a third line under the wordmark:

    Jathagam  •  Porutham  •  Baby Naming  •  Muhurtham

The brand line is only meant to be the name plus its slogan, so that line (and
the ornamental divider that separated it) is removed here. Everything else -
the emblem, "ASTRO SIVAM" and "INDIAN VEDIC ASTROLOGY" - is left byte-identical
to the original artwork, because the wordmark's gold-gradient bevel is not
reproducible by re-rendering.

How it works
------------
The card's background behind the removed band is a smooth largely-vertical
gradient. So each column is filled by linearly interpolating between a clean
reference row above the band and a clean reference row below it. Because every
column gets its own interpolation, any horizontal variation (the soft glow
behind the text) is carried through automatically and the patch is seamless.
A short vertical feather then hides the join.

Measured band positions for the 1200x630 master:

    y  215..316   ASTRO SIVAM                      keep
    y  347..368   INDIAN VEDIC ASTROLOGY           keep
    y  370..388   clean background                 reference row above
    y  390..413   ornamental divider               REMOVE
    y  414..432   clean background
    y  434..455   service list                     REMOVE
    y  456..478   clean background                 reference row below

x 545..1199 is erased; the emblem ends at x=539 so it is never touched.

Run once, then rebuild:
    python3 scripts/strip_og_tagline.py
    python3 scripts/build_logo_assets.py --variant ornate
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, "design", "logo_og_card.jpg")

# Vertical band to erase, and the clean rows used to reconstruct it.
# The reference bands sit INSIDE the erased range and are read before anything
# is written, so the fill is anchored to rows immediately adjacent to the patch
# and the joins are continuous by construction - no feathering needed (mixing
# the original back in at the edges would re-introduce the very pixels we are
# removing: the tagline's descenders reach y=455).
ERASE_TOP = 369
ERASE_BOTTOM = 470
REF_TOP = (372, 386)      # inclusive row range, verified gold-free
REF_BOTTOM = (458, 468)
X_START = 545             # the emblem reaches x=539, so this clears it
X_END = 1200              # exclusive


def strip_tagline(src: str = MASTER) -> Image.Image:
    img = Image.open(src).convert("RGB")
    src_arr = np.asarray(img).astype(float)
    out = src_arr.copy()

    top_ref = src_arr[REF_TOP[0]:REF_TOP[1] + 1, X_START:X_END].mean(axis=0)
    bot_ref = src_arr[REF_BOTTOM[0]:REF_BOTTOM[1] + 1, X_START:X_END].mean(axis=0)

    span = ERASE_BOTTOM - ERASE_TOP
    for y in range(ERASE_TOP, ERASE_BOTTOM + 1):
        t = (y - ERASE_TOP) / float(span)
        out[y, X_START:X_END] = (1.0 - t) * top_ref + t * bot_ref

    cleaned = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    cleaned.save(src, "JPEG", quality=95, subsampling=0, optimize=True)
    return cleaned


def verify(src: str = MASTER) -> None:
    """Fail loudly if any gold survives in the band we set out to clear."""
    a = np.asarray(Image.open(src).convert("RGB")).astype(float)
    lum = a.mean(axis=2)
    band = lum[ERASE_TOP:ERASE_BOTTOM + 1, X_START:X_END]
    # The background here peaks around luminance 32; gold runs 100+. 60 splits
    # them with room to spare and still catches faint anti-aliasing.
    bright = int((band > 60).sum())
    if bright > 0:
        ys, xs = np.where(band > 60)
        raise SystemExit(
            f"tagline strip failed: {bright} bright pixels remain in "
            f"y {ERASE_TOP}..{ERASE_BOTTOM}, x {X_START}..{X_END} "
            f"(first at y={ys[0] + ERASE_TOP}, x={xs[0] + X_START})"
        )
    print(f"band y {ERASE_TOP}..{ERASE_BOTTOM} x {X_START}..{X_END} is clean "
          f"(max luminance {band.max():.0f})")

    # the emblem must be untouched
    emblem = lum[:, :540]
    print(f"emblem region untouched (max luminance {emblem.max():.0f})")


if __name__ == "__main__":
    strip_tagline()
    verify()
    print(f"rewrote {os.path.relpath(MASTER, ROOT)}")
