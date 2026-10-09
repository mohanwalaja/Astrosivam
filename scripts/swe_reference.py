#!/usr/bin/env python3
"""
Generate Swiss Ephemeris (Lahiri / Chitra Paksha) reference longitudes.

Used to validate the pure-PHP ephemeris in api/astrology/engine.php.
Swiss Ephemeris is NOT a runtime dependency of the application; this script
only produces fixtures for scripts/php-ephemeris-accuracy.php.

Usage:
    pip install pyswisseph
    python3 scripts/swe_reference.py            # rewrites tests/fixtures/swiss-ephemeris-lahiri-reference.json
    python3 scripts/swe_reference.py -          # prints the JSON to stdout instead
"""
import os
import json
import sys
from datetime import datetime, timedelta, timezone

import swisseph as swe

swe.set_sid_mode(swe.SIDM_LAHIRI)

BODIES = {
    'sun': swe.SUN, 'moon': swe.MOON, 'mercury': swe.MERCURY, 'venus': swe.VENUS,
    'mars': swe.MARS, 'jupiter': swe.JUPITER, 'saturn': swe.SATURN,
    'rahu': swe.TRUE_NODE, 'meanNode': swe.MEAN_NODE,
}

# Moshier mode: no ephemeris files needed, planets ≈0.1", Moon ≈ 1-2" vs DE431.
FLAGS = swe.FLG_MOSEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED
FLAGS_TROP = swe.FLG_MOSEPH | swe.FLG_SPEED


def jd_utc(dt):
    return swe.julday(dt.year, dt.month, dt.day,
                      dt.hour + dt.minute / 60.0 + dt.second / 3600.0, swe.GREG_CAL)


def main():
    samples = []
    # Fixed dates already used by the TS regression suite.
    fixed = [
        datetime(2000, 1, 1, 12, 0, 0),
        datetime(2024, 4, 8, 18, 0, 0),
        datetime(2050, 1, 1, 0, 0, 0),
        datetime(1990, 1, 5, 6, 30, 0),
    ]
    # Sweep 1900..2100 at irregular spacing (prime-ish day step).
    start = datetime(1900, 1, 1, 3, 17, 0)
    end = datetime(2100, 12, 31, 0, 0, 0)
    step = timedelta(days=997, hours=11, minutes=23)
    d = start
    while d <= end:
        fixed.append(d)
        d += step
    # Dense sample across 2024-2026 (current use), every 37 days + 7 hours.
    d = datetime(2024, 1, 3, 9, 41, 0)
    while d < datetime(2026, 12, 31):
        fixed.append(d)
        d += timedelta(days=37, hours=7)

    for dt in fixed:
        jd = jd_utc(dt)
        row = {'utc': dt.strftime('%Y-%m-%dT%H:%M:%SZ'), 'jd_ut': jd}
        # swe_get_ayanamsa_ut() = MEAN ayanamsa (no nutation);
        # swe_get_ayanamsa_ex_ut() = TRUE ayanamsa (mean + Δψ), as shown by Drik Panchang.
        row['ayanamsaMean'] = swe.get_ayanamsa_ut(jd)
        row['ayanamsaTrue'] = swe.get_ayanamsa_ex_ut(jd, swe.FLG_MOSEPH)[1]
        row['ayanamsa'] = row['ayanamsaTrue']
        row['deltaT'] = swe.deltat(jd) * 86400.0
        sid = {}
        trop = {}
        speed = {}
        for name, body in BODIES.items():
            xx, _ = swe.calc_ut(jd, body, FLAGS)
            sid[name] = xx[0]
            speed[name] = xx[3]
            xt, _ = swe.calc_ut(jd, body, FLAGS_TROP)
            trop[name] = xt[0]
        sid['ketu'] = (sid['rahu'] + 180.0) % 360.0
        row['sidereal'] = sid
        row['tropical'] = trop
        row['speed'] = speed
        samples.append(row)

    r7 = lambda v: round(float(v), 7)
    for row in samples:
        for key in ('ayanamsaMean', 'ayanamsaTrue', 'ayanamsa'):
            row[key] = r7(row[key])
        row['deltaT'] = round(row['deltaT'], 3)
        for key in ('sidereal', 'tropical', 'speed'):
            row[key] = {k: r7(v) for k, v in row[key].items()}
    payload = {'sweVersion': swe.version, 'sidMode': 'SIDM_LAHIRI', 'flags': 'FLG_MOSEPH|FLG_SIDEREAL|FLG_SPEED', 'samples': samples}
    if len(sys.argv) > 1 and sys.argv[1] == '-':
        json.dump(payload, sys.stdout, indent=1)
        return
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'tests', 'fixtures', 'swiss-ephemeris-lahiri-reference.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w') as fh:
        json.dump(payload, fh, separators=(',', ':'))
        fh.write('\n')
    print('Wrote %s (%d samples)' % (os.path.relpath(out, root), len(samples)))


if __name__ == '__main__':
    main()
