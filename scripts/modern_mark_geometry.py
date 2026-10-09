#!/usr/bin/env python3
"""
ASTRO SIVAM - modern mark geometry (stdlib only).

Kept separate from modern_mark.py on purpose: the composition rules are pure
mathematics, so they can be unit-tested with a bare `python3` that has no
imaging library installed. modern_mark.py imports everything here.

The mark is a sun disc and a crescent moon. The crescent is
`moon_circle - bite_circle`, where the bite circle has the same radius and sits
`moon_bite` to the left. The two circles cross at:

    x = (moon_cx + bite_cx) / 2        (midway, since the radii are equal)
    y = centre_y +/- h,  h = sqrt(r^2 - (d/2)^2)

Those crossing points are the crescent's tips. Their distance from the sun's
centre is what decides whether the two luminaries stay visually separate.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Proportions:
    """Every dimension as a fraction of the canvas edge. Tune here, nowhere else."""

    # 2026 refresh (concept 1, "Rasi Ring"): the luminaries are bolder - Surya
    # 0.156 -> 0.182, Chandra 0.148 -> 0.168 - and the ring sits a touch closer
    # in, 0.435 -> 0.400, so the twelve rasi dots read as a halo rather than an
    # outer fence. The crescent's tips still clear the sun disc by construction
    # (0.0145 of the canvas, up from 0.0212 at the old, smaller sizes), so the
    # two luminaries never merge and no shaving gap is needed.
    ring_radius: float = 0.400    # centre of the twelve-dot ring
    dot_radius: float = 0.040     # each of the twelve rasi dots

    sun_radius: float = 0.182
    sun_offset_x: float = -0.0750

    moon_radius: float = 0.168
    moon_offset_x: float = 0.0900
    moon_bite: float = 0.102      # crescent thickness = how far the carving circle sits left

    gap: float = 0.0              # extra air between crescent and sun; 0 = tangent-by-design


P = Proportions()


def crescent_metrics(p: Proportions = P) -> dict:
    """
    Where the sun and crescent sit, and how much air separates them.
    All values are fractions of the canvas edge.
    """
    sun_cx = 0.5 + p.sun_offset_x
    moon_cx = 0.5 + p.moon_offset_x
    bite_cx = moon_cx - p.moon_bite
    d = moon_cx - bite_cx
    h = math.sqrt(max(p.moon_radius ** 2 - (d / 2.0) ** 2, 0.0))
    tip_x = (moon_cx + bite_cx) / 2.0

    return {
        "sun_spans": (sun_cx - p.sun_radius, sun_cx + p.sun_radius),
        "tip_x": tip_x,
        "tip_h": h,
        # how far the crescent's nearest tip sits OUTSIDE the sun disc
        "tip_clearance": math.hypot(tip_x - sun_cx, h) - p.sun_radius,
        # the horizontal air between the sun's right edge and the crescent's belly
        "side_gap": (bite_cx + p.moon_radius) - (sun_cx + p.sun_radius),
        "group_spans": (sun_cx - p.sun_radius, moon_cx + p.moon_radius),
        "group_centre": ((sun_cx - p.sun_radius) + (moon_cx + p.moon_radius)) / 2.0,
    }


def verify_composition(p: Proportions = P, min_clearance: float = 0.010) -> None:
    """
    Guard rail. The sun / crescent separation is produced by construction, so if
    anyone retunes Proportions and the crescent's tips end up inside - or
    tangent to - the sun disc, the two shapes merge into a blob. Fail loudly at
    build time instead of shipping it.

    Also keeps the combined sun+crescent group visually centred, since the mark
    is used as a standalone emblem.
    """
    m = crescent_metrics(p)

    if m["tip_clearance"] < min_clearance:
        raise SystemExit(
            f"modern mark composition collapsed: crescent tips clear the sun by only "
            f"{m['tip_clearance']:.4f} of the canvas (need >= {min_clearance}). "
            f"Shrink sun_radius / moon_radius or increase moon_offset_x."
        )

    off_centre = m["group_centre"] - 0.5
    if abs(off_centre) > 0.02:
        raise SystemExit(
            f"modern mark group is off-centre by {off_centre:+.4f} of the canvas. "
            f"Shift sun_offset_x and moon_offset_x to rebalance."
        )


# --------------------------------------------------------------------------- #
# legibility: which mark at which size
# --------------------------------------------------------------------------- #
# Measured by rendering the dotted and reduced variants at 16/24/32/48/68/96 px
# and inspecting each magnified:
#
#   <= 32px   the twelve dots blur into a broken ring - it reads as a muddy
#             donut, not a logo. The reduced mark (sun + crescent, no ring)
#             stays clean and instantly recognisable.
#   >= 48px   the dots separate cleanly and the full mark is legible.
#
# 44px is the crossover with margin either side. Anything rendered below it
# must use the reduced mark.
DOTS_MIN_PX = 44


def mark_for_size(size_px: float) -> str:
    """
    Which modern mark a render size needs: 'dotted' or 'reduced'.

    Single source of truth - the asset builder calls this rather than keeping
    its own copy of the threshold, so the rule cannot drift between the two.
    """
    return "dotted" if size_px >= DOTS_MIN_PX else "reduced"


if __name__ == "__main__":
    verify_composition()
    m = crescent_metrics()
    print(f"tip clearance {m['tip_clearance']:.4f}   side gap {m['side_gap']:.4f}")
    print(f"group spans {m['group_spans'][0]:.3f}..{m['group_spans'][1]:.3f} "
          f"(centre {m['group_centre']:.3f})")
