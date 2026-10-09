#!/usr/bin/env python3
"""
Build api/astrology/ephemeris_tables.php — the coefficient tables used by the
pure-PHP ephemeris in api/astrology/engine.php.

Sources (all public-domain astronomical theories):
  * VSOP87D (Bretagnon & Francou 1988) heliocentric series for Earth,
    Mercury, Venus, Mars, Jupiter, Saturn — full series taken from PyMeeus,
    truncated here by amplitude so that each planet stays within ~1" of the
    full theory between 1900 and 2100.
  * ELP2000-82 lunar periodic terms as abridged in Meeus, "Astronomical
    Algorithms" 2nd ed., Tables 47.A (longitude/distance) and 47.B (latitude).
  * IAU 1980 nutation series (Meeus Table 22.A, 63 terms).
  * Observed annual ΔT (TT − UT1) 1900–2026, IERS/USNO values.

Usage:
    pip install pymeeus pyswisseph
    python3 scripts/build-ephemeris-tables.py
"""
import datetime as _dt
import importlib
import os
import sys

try:
    import swisseph as swe
except ImportError:  # ΔT table only needs Swiss Ephemeris; fall back to the bundled copy
    swe = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'api', 'astrology', 'ephemeris_tables.php')

# Per-planet amplitude thresholds (radians for L/B, AU for R). The geocentric
# angular error of a heliocentric error scales with r/Δ, so Mars/Venus (which
# approach Earth) keep more terms than Jupiter/Saturn.
VSOP_THRESHOLDS = {
    'earth': 2.0e-7,
    'mercury': 5.0e-7,
    'venus': 2.0e-7,
    'mars': 2.0e-7,
    'jupiter': 1.0e-6,
    'saturn': 1.0e-6,
}
T_MAX = 1.1  # |T| ≤ 1.1 centuries (1890–2110) is the supported span

# Observed ΔT (seconds) at 0h UT on 1 January of each year, 1900–2026.
# Reproduced from the IERS/USNO historical series (identical to the values
# Swiss Ephemeris 2.10 uses for the same dates). Regenerated when pyswisseph is
# available so the table never diverges from the reference used in tests.
DELTA_T_START_YEAR = 1900
DELTA_T_FALLBACK = [
    -1.99, -0.76, 0.61, 2.05, 3.5, 4.91, 6.23, 7.48, 8.68, 9.89,
    11.13, 12.43, 13.74, 15.05, 16.31, 17.47, 18.51, 19.43, 20.25, 20.97,
    21.61, 22.18, 22.68, 23.12, 23.48, 23.78, 24.02, 24.19, 24.31, 24.39,
    24.42, 24.41, 24.37, 24.32, 24.24, 24.16, 24.08, 24.04, 24.06, 24.17,
    24.42, 24.83, 25.35, 25.92, 26.51, 27.05, 27.5, 27.89, 28.24, 28.58,
    28.93, 29.32, 29.7, 30.18, 30.62, 31.07, 31.35, 31.68, 32.18, 32.68,
    33.15, 33.59, 34.0, 34.47, 35.03, 35.73, 36.54, 37.43, 38.29, 39.2,
    40.18, 41.17, 42.23, 43.37, 44.49, 45.48, 46.46, 47.52, 48.54, 49.59,
    50.54, 51.38, 52.17, 52.96, 53.79, 54.34, 54.87, 55.32, 55.82, 56.3,
    56.86, 57.57, 58.31, 59.12, 59.99, 60.79, 61.63, 62.3, 62.97, 63.47,
    63.83, 64.09, 64.3, 64.47, 64.57, 64.69, 64.85, 65.15, 65.46, 65.78,
    66.07, 66.32, 66.6, 66.91, 67.28, 67.64, 68.1, 68.59, 68.97, 69.22,
    69.36, 69.36, 69.29, 69.18, 69.1, 69.0, 68.9,
]


def php_num(x):
    if isinstance(x, int):
        return str(x)
    s = repr(float(x))
    if s.endswith('.0'):
        s = s[:-2]
    return s


def php_list(values, depth=1):
    return '[' + ', '.join(php_num(v) for v in values) + ']'


def build_vsop():
    out = {}
    counts = {}
    for planet, thr in VSOP_THRESHOLDS.items():
        mod = importlib.import_module('pymeeus.' + planet.capitalize())
        series = {}
        n = 0
        for key, attr in (('L', 'VSOP87_L'), ('B', 'VSOP87_B'), ('R', 'VSOP87_R')):
            orders = []
            for k, terms in enumerate(getattr(mod, attr)):
                kept = [(a, b, c) for a, b, c in terms if a * 1e-8 * (T_MAX ** k) >= thr]
                # The series is ordered by decreasing amplitude, so the kept
                # set is always a prefix: this keeps truncation reproducible.
                orders.append(kept)
                n += len(kept)
            while orders and not orders[-1]:
                orders.pop()
            series[key] = orders
        out[planet] = series
        counts[planet] = n
    return out, counts


def build_moon():
    moon = importlib.import_module('pymeeus.Moon')
    lr = [[int(d), int(m), int(mp), int(f), float(l), float(r)] for d, m, mp, f, l, r in moon.PERIODIC_TERMS_LR_TABLE]
    b = [[int(d), int(m), int(mp), int(f), float(bb)] for d, m, mp, f, bb in moon.PERIODIC_TERMS_B_TABLE]
    assert len(lr) == 60 and len(b) == 60
    return lr, b


def build_nutation():
    coords = importlib.import_module('pymeeus.Coordinates')
    rows = []
    cosine = list(coords.NUTATION_COSINE_COEF_TABLE)
    # The final 14 rows of Meeus Table 22.A carry no Δε (cosine) coefficient.
    cosine += [[0.0, 0.0]] * (len(coords.NUTATION_ARG_TABLE) - len(cosine))
    for args, s, c in zip(coords.NUTATION_ARG_TABLE, coords.NUTATION_SINE_COEF_TABLE, cosine):
        rows.append([int(v) for v in args] + [float(s[0]), float(s[1]), float(c[0]), float(c[1])])
    assert len(rows) == 63
    return rows


def build_delta_t():
    if swe is None:
        return list(DELTA_T_FALLBACK)
    values = []
    for year in range(DELTA_T_START_YEAR, 2027):
        jd = swe.julday(year, 1, 1, 0.0)
        values.append(round(swe.deltat(jd) * 86400.0, 2))
    return values


def main():
    vsop, counts = build_vsop()
    moon_lr, moon_b = build_moon()
    nutation = build_nutation()
    delta_t = build_delta_t()

    lines = []
    w = lines.append
    w('<?php')
    w('/**')
    w(' * GENERATED FILE — do not edit by hand.')
    w(' * Rebuild with: python3 scripts/build-ephemeris-tables.py')
    w(' *')
    w(' * Coefficient tables for the pure-PHP Vedic ephemeris (api/astrology/engine.php).')
    w(' *  - vsop87: VSOP87D heliocentric series (Bretagnon & Francou 1988), truncated by')
    w(' *    amplitude; units 1e-8 rad (L, B) and 1e-8 AU (R); argument B + C*tau, tau in')
    w(' *    Julian millennia TT from J2000.0.')
    w(' *  - moonLR / moonB: ELP2000-82 periodic terms (Meeus Tables 47.A / 47.B);')
    w(' *    multipliers of D, M, M\', F then coefficient(s) in 1e-6 deg / 1e-3 km.')
    w(' *  - nutation: IAU 1980 series (Meeus Table 22.A); multipliers of D, M, M\', F, Ω')
    w(' *    then sine (Δψ) and cosine (Δε) coefficients in 1e-4 arcsec with T-rate.')
    w(' *  - deltaT: observed TT−UT1 in seconds on 1 January, from deltaTStartYear.')
    w(' *')
    w(' * Generated %s. Term counts: %s.' % (
        _dt.date.today().isoformat(), ', '.join('%s=%d' % kv for kv in counts.items())))
    w(' */')
    w('return [')
    w("    'generated' => '%s'," % _dt.date.today().isoformat())
    w("    'vsop87Thresholds' => [%s]," % ', '.join("'%s' => %s" % (k, php_num(v)) for k, v in VSOP_THRESHOLDS.items()))
    w("    'vsop87' => [")
    for planet, series in vsop.items():
        w("        '%s' => [" % planet)
        for key in ('L', 'B', 'R'):
            w("            '%s' => [" % key)
            for order in series[key]:
                if not order:
                    w('                [],')
                    continue
                w('                [')
                for a, b, c in order:
                    w('                    [%s, %s, %s],' % (php_num(a), php_num(b), php_num(c)))
                w('                ],')
            w('            ],')
        w('        ],')
    w('    ],')
    w("    'moonLR' => [")
    for row in moon_lr:
        w('        %s,' % php_list(row))
    w('    ],')
    w("    'moonB' => [")
    for row in moon_b:
        w('        %s,' % php_list(row))
    w('    ],')
    w("    'nutation' => [")
    for row in nutation:
        w('        %s,' % php_list(row))
    w('    ],')
    w("    'deltaTStartYear' => %d," % DELTA_T_START_YEAR)
    w("    'deltaT' => [")
    for i in range(0, len(delta_t), 10):
        w('        %s,' % ', '.join(php_num(v) for v in delta_t[i:i + 10]))
    w('    ],')
    w('];')
    w('')

    with open(OUT, 'w') as fh:
        fh.write('\n'.join(lines))
    total = sum(counts.values())
    print('Wrote %s (%d VSOP87 terms, %d ΔT years)' % (os.path.relpath(OUT, ROOT), total, len(delta_t)))
    if swe is not None and delta_t != DELTA_T_FALLBACK:
        print('NOTE: ΔT table differs from DELTA_T_FALLBACK in this script; update the fallback list:')
        print(delta_t)


if __name__ == '__main__':
    sys.exit(main())
