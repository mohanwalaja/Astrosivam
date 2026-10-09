<?php
/**
 * ASTRO SIVAM - Pure PHP Vedic Ephemeris & Calculation Engine
 * 100% Standalone - No external node or python dependencies required
 */

// Load Composer autoloader (mPDF and dependencies in public_html/vendor/)
if (is_file(__DIR__ . '/../../vendor/autoload.php')) {
    require_once __DIR__ . '/../../vendor/autoload.php';
}

require_once __DIR__ . '/mpdf_fontconfig.php';
require_once __DIR__ . '/pdf_mpdf_reports.php';
require_once __DIR__ . '/namakaran_meanings.php';
require_once __DIR__ . '/namakaran_meaning_localizer.php';

class AstroEngine {
    /** Validate the strict ISO calendar portion without silently normalising overflow dates. */
    public static function isValidBirthDate($value): bool {
        $dob = trim((string) $value);
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dob, $match)) {
            return false;
        }
        $year = (int) $match[1];
        $month = (int) $match[2];
        $day = (int) $match[3];
        return $year >= 1900 && $year <= 2100 && checkdate($month, $day, $year);
    }

    /** Normalize supported birth-time inputs to the engine's canonical HH:MM. */
    public static function normalizeBirthTime($value): ?string {
        $time = trim((string) $value);
        if (preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/', $time, $match)) {
            $hour = (int) $match[1];
            $minute = (int) $match[2];
            $second = isset($match[3]) ? (int) $match[3] : 0;
            if ($hour > 23 || $minute > 59 || $second > 59) {
                return null;
            }
            return sprintf('%02d:%02d', $hour, $minute);
        }
        if (preg_match('/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i', $time, $match)) {
            $hour = (int) $match[1];
            $minute = (int) $match[2];
            if ($hour < 1 || $hour > 12 || $minute > 59) {
                return null;
            }
            $meridian = strtoupper($match[3]);
            $hour = ($hour % 12) + ($meridian === 'PM' ? 12 : 0);
            return sprintf('%02d:%02d', $hour, $minute);
        }
        return null;
    }

    /**
     * IANA identifiers PHP can evaluate with full historical DST rules.
     * Abbreviations such as "EST"/"IST" are deliberately not accepted: they
     * carry no region-specific transition history.
     */
    public static function isValidIanaTimeZoneId($value): bool {
        $id = is_string($value) ? trim($value) : '';
        if ($id === '' || strlen($id) > 64 || !preg_match('#^[A-Za-z0-9_+\-/]+$#', $id)) {
            return false;
        }
        // PHP's backward-compatible list still contains fixed abbreviations
        // (EST, HST, CET, GB, PRC, ...). Only Area/Location identifiers
        // (including Etc/GMT±N) and UTC carry real transition history.
        if ($id !== 'UTC' && strpos($id, '/') === false) {
            return false;
        }
        static $index = null;
        if ($index === null) {
            $index = array_fill_keys(DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true);
            $index['UTC'] = true;
        }
        return isset($index[$id]);
    }

    /**
     * Coordinate → IANA zone lookup. PHP port of the tz-lookup npm package
     * decoder (CC0-1.0); the quadtree lives in tz_lookup_data.php, regenerated
     * with `node scripts/build-tz-lookup-table.mjs` so the browser's
     * TypeScript calculator and this PHP API agree on the zone for a place.
     * Territorial waters belong to their country; open ocean resolves to the
     * nautical "Etc/GMT±N" zones. Returns null when the table is unavailable.
     */
    public static function timeZoneIdForCoordinates($latitude, $longitude): ?string {
        if (!is_numeric($latitude) || !is_numeric($longitude)) return null;
        $lat = (float) $latitude;
        $lng = (float) $longitude;
        if (!is_finite($lat) || !is_finite($lng) || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) return null;

        static $table = null;
        if ($table === null) {
            $file = __DIR__ . '/tz_lookup_data.php';
            $loaded = is_file($file) ? include $file : null;
            $table = (is_array($loaded) && is_string($loaded['tree'] ?? null) && is_array($loaded['zones'] ?? null)) ? $loaded : false;
            if ($table === false) {
                error_log('AstroEngine: tz_lookup_data.php missing or invalid; coordinate time-zone lookup disabled.');
            }
        }
        if ($table === false) return null;

        $tree = $table['tree'];
        $zones = $table['zones'];
        $zoneCount = count($zones);
        if ($lat >= 90) return 'Etc/GMT'; // North Pole: same convention as tz-lookup

        // Mirrors tz-lookup exactly, including its slightly widened divisors
        // that keep lng=180 / lat=-90 inside the last quadtree cell.
        $x = 48 * (180 + $lng) / 360.00000000000006;
        $y = 24 * (90 - $lat) / 180.00000000000003;
        $xi = (int) floor($x);
        $yi = (int) floor($y);
        $node = -1;
        $index = 96 * $yi + 2 * $xi;
        $index = 56 * ord($tree[$index]) + ord($tree[$index + 1]) - 1995;
        while ($index + $zoneCount < 3136) {
            $node = $node + $index + 1;
            $y = fmod(2 * ($y - $yi), 2);
            $yi = (int) floor($y);
            $x = fmod(2 * ($x - $xi), 2);
            $xi = (int) floor($x);
            $index = 8 * $node + 4 * $yi + 2 * $xi + 2304;
            $index = 56 * ord($tree[$index]) + ord($tree[$index + 1]) - 1995;
        }
        $zone = $zones[$index + $zoneCount - 3136] ?? null;
        return is_string($zone) && self::isValidIanaTimeZoneId($zone) ? $zone : null;
    }

    /**
     * Resolve the IANA zone to use for a birth payload: an explicit valid
     * `timeZoneId` wins, otherwise the coordinates are looked up. Returns
     * ['timeZoneId' => string|null, 'source' => 'payload'|'coordinates'|null].
     */
    public static function resolveBirthTimeZoneId($payload): array {
        $payload = is_array($payload) ? $payload : [];
        $explicit = trim((string) ($payload['timeZoneId'] ?? ''));
        if ($explicit !== '' && self::isValidIanaTimeZoneId($explicit)) {
            return ['timeZoneId' => $explicit, 'source' => 'payload'];
        }
        $derived = self::timeZoneIdForCoordinates($payload['latitude'] ?? null, $payload['longitude'] ?? null);
        if ($derived !== null) {
            return ['timeZoneId' => $derived, 'source' => 'coordinates'];
        }
        return ['timeZoneId' => null, 'source' => null];
    }

    /**
     * Evaluate a wall-clock time against the zone's real transition history.
     * Returns the UTC instants that display exactly this local time: one
     * normally, none inside a spring-forward gap, two inside an autumn fold.
     */
    private static function wallClockInstantsInZone(DateTimeZone $zone, string $localDateTime): array {
        $wallClockUtc = DateTime::createFromFormat('!Y-m-d H:i:s', $localDateTime, new DateTimeZone('UTC'));
        if ($wallClockUtc === false) return [];
        $wallTs = $wallClockUtc->getTimestamp();

        // Candidate offsets: every offset in force within ±2 days of the wall
        // clock (getTransitions() returns the state at the window start first).
        $offsets = [];
        $transitions = $zone->getTransitions($wallTs - 2 * 86400, $wallTs + 2 * 86400);
        if (is_array($transitions)) {
            foreach ($transitions as $transition) {
                if (isset($transition['offset'])) $offsets[(int) $transition['offset']] = true;
            }
        }
        foreach ([$wallTs - 2 * 86400, $wallTs, $wallTs + 2 * 86400] as $probe) {
            $offsets[$zone->getOffset(new DateTime('@' . $probe))] = true;
        }

        $instants = [];
        foreach (array_keys($offsets) as $offset) {
            $candidate = new DateTime('@' . ($wallTs - $offset));
            $candidate->setTimezone($zone);
            if ($candidate->format('Y-m-d H:i:s') === $localDateTime) {
                $instants[$candidate->getTimestamp()] = [
                    'timestamp' => $candidate->getTimestamp(),
                    'offsetSeconds' => (int) $offset,
                    'abbreviation' => $candidate->format('T'),
                    'dst' => $candidate->format('I') === '1'
                ];
            }
        }
        ksort($instants);
        return array_values($instants);
    }

    /**
     * Resolve a birth payload to a single UTC instant, strictly honouring the
     * historical standard/daylight-saving rules of the birth region.
     *
     * Zone precedence: valid `timeZoneId` → zone derived from latitude/longitude
     * → the submitted fixed `timezoneOffsetHours` (only when no zone can be
     * determined at all). Inside a DST gap or fold the result is invalid
     * rather than guessed; `ambiguous`/`nonexistent` tell the caller why.
     *
     * Returns an array with: ok, error, timestamp, timeZoneId, timeZoneSource
     * ('payload'|'coordinates'|'offset'), offsetHours (the offset actually in
     * force), suppliedOffsetHours, offsetAdjusted (supplied offset was wrong by
     * ≥ 30 minutes, e.g. a DST hour), abbreviation, dst, ambiguous, nonexistent.
     */
    public static function resolveBirthInstant($payload): array {
        $result = [
            'ok' => false, 'error' => null, 'timestamp' => null,
            'timeZoneId' => null, 'timeZoneSource' => null,
            'offsetHours' => null, 'suppliedOffsetHours' => null, 'offsetAdjusted' => false,
            'abbreviation' => null, 'dst' => null, 'ambiguous' => false, 'nonexistent' => false
        ];
        if (!is_array($payload)) {
            $result['error'] = 'Birth details are missing.';
            return $result;
        }
        if (!self::isValidBirthDate($payload['dob'] ?? '')) {
            $result['error'] = 'A valid birth date (YYYY-MM-DD) is required.';
            return $result;
        }
        $tob = self::normalizeBirthTime($payload['tob'] ?? '');
        if ($tob === null) {
            $result['error'] = 'A valid birth time (HH:MM, 24-hour) is required.';
            return $result;
        }
        if (trim((string) ($payload['birthPlace'] ?? '')) === '') {
            $result['error'] = 'The birth place is required.';
            return $result;
        }
        $latitude = $payload['latitude'] ?? null;
        $longitude = $payload['longitude'] ?? null;
        if (!is_numeric($latitude) || (float) $latitude < -90 || (float) $latitude > 90
            || !is_numeric($longitude) || (float) $longitude < -180 || (float) $longitude > 180) {
            $result['error'] = 'Verified birth place coordinates are required.';
            return $result;
        }
        $offset = $payload['timezoneOffsetHours'] ?? null;
        if (!is_numeric($offset) || (float) $offset < -14 || (float) $offset > 14) {
            $result['error'] = 'A valid birth time-zone offset is required.';
            return $result;
        }
        $suppliedOffset = (float) $offset;
        $result['suppliedOffsetHours'] = $suppliedOffset;

        $explicitZoneId = trim((string) ($payload['timeZoneId'] ?? ''));
        if ($explicitZoneId !== '' && !self::isValidIanaTimeZoneId($explicitZoneId)) {
            // Fail closed: an unknown zone ID means we cannot prove the offset.
            $result['error'] = 'Unsupported time zone "' . $explicitZoneId . '". Use an IANA identifier such as Asia/Kolkata or Pacific/Fiji.';
            return $result;
        }

        $dob = trim((string) $payload['dob']);
        $localDateTime = $dob . ' ' . $tob . ':00';
        try {
            $resolution = self::resolveBirthTimeZoneId($payload);
            $zoneId = $resolution['timeZoneId'];
            if ($zoneId !== null) {
                $zone = new DateTimeZone($zoneId);
                $instants = self::wallClockInstantsInZone($zone, $localDateTime);
                $result['timeZoneId'] = $zone->getName();
                $result['timeZoneSource'] = $resolution['source'];
                if (count($instants) === 0) {
                    // Spring-forward gap: this wall-clock time never happened.
                    $result['nonexistent'] = true;
                    $result['error'] = 'The birth time ' . $tob . ' did not exist on ' . $dob . ' in ' . $zone->getName()
                        . ' because clocks were moved forward for daylight saving. Please re-check the recorded birth time.';
                    return $result;
                }
                if (count($instants) > 1) {
                    // Autumn fold: both instants are plausible; do not guess.
                    $result['ambiguous'] = true;
                    $result['error'] = 'The birth time ' . $tob . ' occurred twice on ' . $dob . ' in ' . $zone->getName()
                        . ' because clocks were set back for daylight saving. Please confirm the recorded birth time.';
                    return $result;
                }
                $instant = $instants[0];
                $result['timestamp'] = $instant['timestamp'];
                $result['offsetHours'] = $instant['offsetSeconds'] / 3600.0;
                $result['abbreviation'] = $instant['abbreviation'];
                $result['dst'] = $instant['dst'];
            } else {
                // No zone could be determined: trust the submitted fixed offset.
                // Parse the wall clock in UTC explicitly so php.ini's server
                // timezone cannot influence the chart.
                $wallClockUtc = DateTime::createFromFormat('!Y-m-d H:i:s', $localDateTime, new DateTimeZone('UTC'));
                $errors = DateTime::getLastErrors();
                if ($wallClockUtc === false || (is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
                    $result['error'] = 'The birth date and time could not be interpreted.';
                    return $result;
                }
                $result['timestamp'] = (int) round($wallClockUtc->getTimestamp() - $suppliedOffset * 3600.0);
                $result['timeZoneSource'] = 'offset';
                $result['offsetHours'] = $suppliedOffset;
            }
        } catch (Throwable $e) {
            $result['error'] = 'The birth time zone could not be evaluated.';
            return $result;
        }

        $result['offsetAdjusted'] = abs($result['offsetHours'] - $suppliedOffset) >= 0.5;
        if ($result['timestamp'] > time()) {
            $result['error'] = 'The birth date and time must be in the past.';
            return $result;
        }
        $result['ok'] = true;
        return $result;
    }

    /**
     * Validate the birth particulars: calendar date, 24-hour time, place,
     * coordinates and offset, plus a strict wall-clock evaluation against the
     * historical DST transitions of the birth region. The region comes from a
     * valid IANA `timeZoneId` when supplied, otherwise from the coordinates;
     * the numeric offset alone is trusted only when neither is available.
     * Nonexistent (DST gap) and repeated (DST fold) local times, unknown zone
     * IDs and future instants all fail closed.
     */
    public static function hasValidBirthDetails($payload): bool {
        return self::resolveBirthInstant($payload)['ok'] === true;
    }

    /** Human-readable reason why hasValidBirthDetails() rejected a payload (null when valid). */
    public static function describeBirthDetailsProblem($payload): ?string {
        $resolution = self::resolveBirthInstant($payload);
        return $resolution['ok'] ? null : (string) $resolution['error'];
    }

    // =====================================================================
    //  Ephemeris core — pure PHP (8.1+), no binary dependencies.
    //
    //  Accuracy versus Swiss Ephemeris 2.10 (Lahiri sidereal, 1900–2100):
    //    Sun ≈ 1″, Moon ≤ 15″ (target ±0.01° = 36″), Mercury–Saturn ≈ 1–3″,
    //    Rahu (osculating true node) ≈ 1′, Lahiri ayanamsa < 0.01″.
    //  See scripts/php-ephemeris-accuracy.php for the verification harness.
    //
    //  Models:
    //    • Time scale ........ UT → TT via observed ΔT table (1900–2026) with
    //                          projection beyond the table.
    //    • Sun & planets ..... VSOP87D heliocentric series (Bretagnon &
    //                          Francou 1988) truncated to ~1″, geocentric
    //                          reduction with light-time + aberration.
    //    • Moon .............. ELP2000-82 periodic terms (Meeus Tables
    //                          47.A/47.B, 60 + 60 terms, E-factor and the
    //                          A1/A2/A3 planetary & flattening terms).
    //    • Nutation .......... IAU 1980, full 63-term Δψ / Δε series.
    //    • Ayanamsa .......... Chitra Paksha (Lahiri): J2000 constant +
    //                          IAU 2006 general precession p_A, plus Δψ for
    //                          the true ayanamsa shown by Drik Panchang /
    //                          swe_get_ayanamsa_ex().
    //    • Rahu/Ketu ......... osculating ("true") node from the lunar
    //                          state vector r × v, like SE_TRUE_NODE.
    // =====================================================================

    private const J2000 = 2451545.0;
    /** Light-time for one astronomical unit, in days (IAU 2012 AU, c = 299 792.458 km/s). */
    private const LIGHT_TIME_PER_AU_DAYS = 0.0057755183;
    private const SPEED_OF_LIGHT_KM_PER_DAY = 299792.458 * 86400.0;
    /**
     * Lahiri (Chitra Paksha) MEAN ayanamsa at J2000.0 TT in degrees = 23°51′25.53″.
     * This is Swiss Ephemeris SIDM_LAHIRI without nutation; adding Δψ gives the
     * "true" ayanamsa (23°51′11.6″ at J2000) printed by Drik Panchang.
     */
    private const LAHIRI_AYANAMSA_J2000 = 23.857092334;

    /** Combustion orbs (degrees from the Sun), mirrored from the TypeScript engine. */
    private const COMBUSTION_LIMITS = [
        'moon' => 12.0, 'mars' => 17.0, 'mercury' => 14.0, 'jupiter' => 11.0, 'venus' => 10.0, 'saturn' => 15.0,
    ];

    /** Rahu/Ketu conventions (see nodeType()). */
    public const NODE_TYPE_TRUE = 'TRUE';
    public const NODE_TYPE_MEAN = 'MEAN';

    /** @var string|null Runtime override of the configured node type (tests / admin tooling). */
    private static $nodeTypeOverride = null;

    /** @var array<string,mixed>|null */
    private static $ephemerisTables = null;

    /**
     * Which lunar node convention Rahu uses: 'TRUE' (osculating node, the
     * Swiss Ephemeris SE_TRUE_NODE / Drik Panchang default) or 'MEAN'. The two
     * differ by up to ≈1°45′, so the choice is a single global setting:
     *   1. AstroEngine::setNodeType() runtime override,
     *   2. the ASTRO_RAHU_NODE_TYPE constant defined in api/config.php,
     *   3. the ASTRO_RAHU_NODE_TYPE environment variable,
     *   4. 'TRUE'.
     * engine.php never loads config.php itself (that file emits HTTP headers
     * and starts sessions), so the constant is consulted only when defined.
     * The default is MEAN (the classical, always-retrograde convention) and
     * matches the TypeScript engine's ASTRO_RAHU_NODE_TYPE default; unknown values
     * fall back to MEAN and are logged once per process.
     */
    public static function nodeType(): string {
        if (self::$nodeTypeOverride !== null) {
            return self::$nodeTypeOverride;
        }
        $configured = null;
        if (defined('ASTRO_RAHU_NODE_TYPE')) {
            $configured = constant('ASTRO_RAHU_NODE_TYPE');
        } else {
            $env = getenv('ASTRO_RAHU_NODE_TYPE');
            if (is_string($env) && trim($env) !== '') {
                $configured = $env;
            }
        }
        if ($configured === null) {
            return self::NODE_TYPE_MEAN;
        }
        $normalized = self::normalizeNodeType($configured);
        if ($normalized === null) {
            static $warned = false;
            if (!$warned) {
                $warned = true;
                error_log('AstroEngine: invalid ASTRO_RAHU_NODE_TYPE "' . (string) $configured . '"; expected TRUE or MEAN. Using MEAN.');
            }
            return self::NODE_TYPE_MEAN;
        }
        return $normalized;
    }

    /**
     * Override the configured node type for the rest of the process (pass
     * null to return to the config.php / environment setting).
     * @throws InvalidArgumentException for anything other than TRUE / MEAN
     */
    public static function setNodeType(?string $type): void {
        if ($type === null) {
            self::$nodeTypeOverride = null;
            return;
        }
        $normalized = self::normalizeNodeType($type);
        if ($normalized === null) {
            throw new InvalidArgumentException("Unsupported Rahu node type '{$type}'; expected 'TRUE' or 'MEAN'.");
        }
        self::$nodeTypeOverride = $normalized;
    }

    /** Accepts TRUE/MEAN case-insensitively (also 'OSCULATING' as an alias of TRUE); null when invalid. */
    private static function normalizeNodeType($value): ?string {
        if (!is_string($value)) return null;
        $v = strtoupper(trim($value));
        if ($v === self::NODE_TYPE_TRUE || $v === 'OSCULATING') return self::NODE_TYPE_TRUE;
        if ($v === self::NODE_TYPE_MEAN) return self::NODE_TYPE_MEAN;
        return null;
    }

    /** Lazily load the generated coefficient tables (api/astrology/ephemeris_tables.php). */
    private static function ephemerisTables(): array {
        if (self::$ephemerisTables === null) {
            $path = __DIR__ . '/ephemeris_tables.php';
            $tables = is_file($path) ? require $path : null;
            if (!is_array($tables) || empty($tables['vsop87']) || empty($tables['moonLR'])
                || empty($tables['moonB']) || empty($tables['nutation']) || empty($tables['deltaT'])) {
                throw new RuntimeException('Ephemeris coefficient tables are missing or corrupt: ' . $path);
            }
            self::$ephemerisTables = $tables;
        }
        return self::$ephemerisTables;
    }

    private static function norm360($x) {
        $x = fmod($x, 360.0);
        if ($x < 0) $x += 360.0;
        return $x;
    }

    /** Signed angular difference a − b folded into (−180°, +180°]. */
    private static function angleDelta(float $a, float $b): float {
        $d = fmod($a - $b + 540.0, 360.0);
        if ($d < 0) $d += 360.0;
        return $d - 180.0;
    }

    // ---------------------------------------------------------------------
    //  Time scale
    // ---------------------------------------------------------------------

    /**
     * ΔT = TT − UT in seconds. Observed annual values 1900–2026 are linearly
     * interpolated; later dates use a gentle quadratic projection that agrees
     * with the Swiss Ephemeris 2.10 extrapolation to ≈0.5 s through 2100;
     * earlier dates fall back to the Espenak–Meeus (NASA) polynomials.
     * Using TT instead of UT matters: ΔT ≈ 69 s moves the Moon by ≈ 38″.
     */
    public static function deltaT(float $jdUt): float {
        $tables = self::ephemerisTables();
        $values = $tables['deltaT'];
        $startYear = (int) $tables['deltaTStartYear'];
        $count = count($values);
        $endYear = $startYear + $count - 1;
        $year = 2000.0 + ($jdUt - 2451544.5) / 365.2425;

        if ($year >= $startYear && $year <= $endYear) {
            $i = (int) floor($year - $startYear);
            if ($i >= $count - 1) $i = $count - 2;
            $f = ($year - $startYear) - $i;
            return $values[$i] + ($values[$i + 1] - $values[$i]) * $f;
        }
        if ($year > $endYear) {
            $t = $year - $endYear;
            return $values[$count - 1] + 0.1919 * $t + 0.001854 * $t * $t;
        }
        if ($year >= 1860) {
            $t = $year - 1860;
            return 7.62 + 0.5737 * $t - 0.251754 * $t ** 2 + 0.01680668 * $t ** 3 - 0.0004473624 * $t ** 4 + $t ** 5 / 233174.0;
        }
        if ($year >= 1800) {
            $t = $year - 1800;
            return 13.72 - 0.332447 * $t + 0.0068612 * $t ** 2 + 0.0041116 * $t ** 3 - 0.00037436 * $t ** 4
                + 0.0000121272 * $t ** 5 - 0.0000001699 * $t ** 6 + 0.000000000875 * $t ** 7;
        }
        $u = ($year - 1820.0) / 100.0;
        return -20.0 + 32.0 * $u * $u;
    }

    /** Julian Day in Terrestrial Time from a Julian Day in UT. */
    public static function julianDayTT(float $jdUt): float {
        return $jdUt + self::deltaT($jdUt) / 86400.0;
    }

    // ---------------------------------------------------------------------
    //  Nutation, obliquity, ayanamsa
    // ---------------------------------------------------------------------

    /**
     * IAU 1980 nutation, full 63-term series (Meeus ch. 22 / Table 22.A).
     * @param  float $T Julian centuries TT from J2000.0
     * @return array{dpsi: float, deps: float} degrees (Δψ in longitude, Δε in obliquity)
     */
    public static function nutation(float $T): array {
        $T2 = $T * $T;
        $T3 = $T2 * $T;
        $D  = deg2rad(self::norm360(297.85036 + 445267.111480 * $T - 0.0019142 * $T2 + $T3 / 189474.0));
        $M  = deg2rad(self::norm360(357.52772 + 35999.050340 * $T - 0.0001603 * $T2 - $T3 / 300000.0));
        $Mp = deg2rad(self::norm360(134.96298 + 477198.867398 * $T + 0.0086972 * $T2 + $T3 / 56250.0));
        $F  = deg2rad(self::norm360(93.27191 + 483202.017538 * $T - 0.0036825 * $T2 + $T3 / 327270.0));
        $Om = deg2rad(self::norm360(125.04452 - 1934.136261 * $T + 0.0020708 * $T2 + $T3 / 450000.0));

        $dpsi = 0.0;
        $deps = 0.0;
        foreach (self::ephemerisTables()['nutation'] as $row) {
            $arg = $row[0] * $D + $row[1] * $M + $row[2] * $Mp + $row[3] * $F + $row[4] * $Om;
            $dpsi += ($row[5] + $row[6] * $T) * sin($arg);
            $deps += ($row[7] + $row[8] * $T) * cos($arg);
        }
        // Coefficients are in units of 0.0001 arcsecond.
        return ['dpsi' => $dpsi * 0.0001 / 3600.0, 'deps' => $deps * 0.0001 / 3600.0];
    }

    /** Mean obliquity of the ecliptic (Laskar 1986, Meeus 22.3), degrees. */
    public static function meanObliquity(float $T): float {
        $U = $T / 100.0;
        $seconds = 84381.448
            + $U * (-4680.93 + $U * (-1.55 + $U * (1999.25 + $U * (-51.38 + $U * (-249.67
            + $U * (-39.05 + $U * (7.12 + $U * (27.87 + $U * (5.79 + $U * 2.45)))))))));
        return $seconds / 3600.0;
    }

    /**
     * Chitra Paksha / Lahiri MEAN ayanamsa (no nutation), degrees.
     * Growth follows the IAU 2006 general precession in longitude
     * p_A = 5028.796195″T + 1.1054348″T² + 0.00007964″T³ − 0.000023857″T⁴ − 0.0000000383″T⁵.
     * Reproduces Swiss Ephemeris SIDM_LAHIRI (swe_get_ayanamsa_ut) to < 0.001″ for 1800–2200.
     * @param float $T Julian centuries TT from J2000.0
     */
    public static function lahiriAyanamsaMean(float $T): float {
        $pA = (((((-0.0000000383 * $T) - 0.000023857) * $T + 0.00007964) * $T + 1.1054348) * $T + 5028.796195) * $T;
        return self::LAHIRI_AYANAMSA_J2000 + $pA / 3600.0;
    }

    /**
     * TRUE Lahiri ayanamsa = mean ayanamsa + nutation in longitude (Δψ).
     * This is the value Drik Panchang displays and what swe_get_ayanamsa_ex_ut()
     * returns; subtract it from APPARENT (nutated) tropical longitudes.
     * @param float      $T    Julian centuries TT from J2000.0
     * @param float|null $dpsi Δψ in degrees when already known (avoids recomputing the series)
     */
    public static function lahiriAyanamsa(float $T, ?float $dpsi = null): float {
        if ($dpsi === null) $dpsi = self::nutation($T)['dpsi'];
        return self::lahiriAyanamsaMean($T) + $dpsi;
    }

    /** Convenience: true Lahiri ayanamsa for a UT Julian Day (handles ΔT internally). */
    public static function lahiriAyanamsaForJulianDayUT(float $jdUt): float {
        $T = (self::julianDayTT($jdUt) - self::J2000) / 36525.0;
        return self::lahiriAyanamsa($T);
    }

    // ---------------------------------------------------------------------
    //  Sun & planets — VSOP87D
    // ---------------------------------------------------------------------

    /**
     * Heliocentric spherical coordinates from the truncated VSOP87D series,
     * referred to the mean ecliptic and equinox of date.
     * @param  float $tau Julian millennia TT from J2000.0
     * @return array{0: float, 1: float, 2: float} [L rad, B rad, R AU]
     */
    private static function vsop87(string $planet, float $tau): array {
        $series = self::ephemerisTables()['vsop87'][$planet] ?? null;
        if ($series === null) {
            throw new InvalidArgumentException("No VSOP87 series for '{$planet}'.");
        }
        $out = [];
        foreach (['L', 'B', 'R'] as $key) {
            $sum = 0.0;
            $tn = 1.0;
            foreach ($series[$key] as $order) {
                $s = 0.0;
                foreach ($order as $term) {
                    $s += $term[0] * cos($term[1] + $term[2] * $tau);
                }
                $sum += $s * $tn;
                $tn *= $tau;
            }
            $out[] = $sum * 1e-8;
        }
        return $out;
    }

    /** Heliocentric rectangular coordinates (AU, mean ecliptic of date). */
    private static function heliocentricXYZ(string $planet, float $tau): array {
        [$L, $B, $R] = self::vsop87($planet, $tau);
        $cb = cos($B);
        return [$R * $cb * cos($L), $R * $cb * sin($L), $R * sin($B)];
    }

    /**
     * Meeus 32.3 — reduce VSOP87 dynamical-ecliptic longitudes to the FK5 frame
     * (≈ 0.09″). Returns [Δλ°, Δβ°].
     */
    private static function fk5Correction(float $lonDeg, float $latDeg, float $T): array {
        $Lp = deg2rad($lonDeg - 1.397 * $T - 0.00031 * $T * $T);
        $dLon = (-0.09033 + 0.03916 * (cos($Lp) + sin($Lp)) * tan(deg2rad($latDeg))) / 3600.0;
        $dLat = (0.03916 * (cos($Lp) - sin($Lp))) / 3600.0;
        return [$dLon, $dLat];
    }

    /**
     * Apparent geocentric Sun (light-time + aberration included, nutation NOT
     * included — longitudes are referred to the mean equinox of date so that
     * sidereal = λ − mean ayanamsa, identical to λ_apparent − true ayanamsa).
     * @return array{lon: float, lat: float, dist: float}
     */
    private static function sunGeocentric(float $jdTt): array {
        $T = ($jdTt - self::J2000) / 36525.0;
        [, , $R] = self::vsop87('earth', $T / 10.0);
        // Evaluate Earth at the retarded epoch t − τ: the direction −E(t − τ)
        // is the apparent direction corrected for both light-time and annual
        // aberration (−20.4898″/R) to first order in v/c.
        $tauRetarded = ($jdTt - self::LIGHT_TIME_PER_AU_DAYS * $R - self::J2000) / 365250.0;
        [$L, $B, $R] = self::vsop87('earth', $tauRetarded);
        $lon = self::norm360(rad2deg($L) + 180.0);
        $lat = -rad2deg($B);
        [$dLon, $dLat] = self::fk5Correction($lon, $lat, $T);
        return ['lon' => self::norm360($lon + $dLon), 'lat' => $lat + $dLat, 'dist' => $R];
    }

    /**
     * Apparent geocentric planet (light-time iterated, aberration included,
     * mean equinox of date). The planet AND the Earth are both evaluated at
     * the retarded instant t − τ, which yields the aberrated direction.
     * @return array{lon: float, lat: float, dist: float, lightTime: float}
     */
    private static function planetGeocentric(string $planet, float $jdTt): array {
        $T = ($jdTt - self::J2000) / 36525.0;
        $lightTime = 0.0;
        $x = $y = $z = 0.0;
        for ($i = 0; $i < 5; $i++) {
            $tau = ($jdTt - $lightTime - self::J2000) / 365250.0;
            [$xp, $yp, $zp] = self::heliocentricXYZ($planet, $tau);
            [$xe, $ye, $ze] = self::heliocentricXYZ('earth', $tau);
            $x = $xp - $xe;
            $y = $yp - $ye;
            $z = $zp - $ze;
            $delta = sqrt($x * $x + $y * $y + $z * $z);
            $next = self::LIGHT_TIME_PER_AU_DAYS * $delta;
            $converged = abs($next - $lightTime) < 1e-10;
            $lightTime = $next;
            if ($converged) break;
        }
        $delta = sqrt($x * $x + $y * $y + $z * $z);
        $lon = self::norm360(rad2deg(atan2($y, $x)));
        $lat = rad2deg(atan2($z, sqrt($x * $x + $y * $y)));
        [$dLon, $dLat] = self::fk5Correction($lon, $lat, $T);
        return ['lon' => self::norm360($lon + $dLon), 'lat' => $lat + $dLat, 'dist' => $delta, 'lightTime' => $lightTime];
    }

    // ---------------------------------------------------------------------
    //  Moon — ELP2000-82 (Meeus ch. 47)
    // ---------------------------------------------------------------------

    /**
     * Geometric geocentric Moon referred to the mean equinox of date.
     * Longitude accuracy ≈ 10″, latitude ≈ 4″, distance ≈ 4 km (Meeus).
     * @param  float $T Julian centuries TT from J2000.0
     * @return array{lon: float, lat: float, dist: float} degrees, degrees, km
     */
    private static function moonGeometric(float $T): array {
        $T2 = $T * $T;
        $T3 = $T2 * $T;
        $T4 = $T3 * $T;
        // Mean longitude, elongation, Sun/Moon anomalies, argument of latitude (47.1–47.5)
        $Lp = self::norm360(218.3164477 + 481267.88123421 * $T - 0.0015786 * $T2 + $T3 / 538841.0 - $T4 / 65194000.0);
        $D  = self::norm360(297.8501921 + 445267.1114034 * $T - 0.0018819 * $T2 + $T3 / 545868.0 - $T4 / 113065000.0);
        $M  = self::norm360(357.5291092 + 35999.0502909 * $T - 0.0001536 * $T2 + $T3 / 24490000.0);
        $Mp = self::norm360(134.9633964 + 477198.8675055 * $T + 0.0087414 * $T2 + $T3 / 69699.0 - $T4 / 14712000.0);
        $F  = self::norm360(93.2720950 + 483202.0175233 * $T - 0.0036539 * $T2 - $T3 / 3526000.0 + $T4 / 863310000.0);
        // Venus / Jupiter perturbations and Earth flattening arguments
        $A1 = deg2rad(self::norm360(119.75 + 131.849 * $T));
        $A2 = deg2rad(self::norm360(53.09 + 479264.290 * $T));
        $A3 = deg2rad(self::norm360(313.45 + 481266.484 * $T));
        // Secular decrease of the Earth's orbital eccentricity (47.6)
        $E = 1.0 - 0.002516 * $T - 0.0000074 * $T2;
        $E2 = $E * $E;

        $Dr = deg2rad($D); $Mr = deg2rad($M); $Mpr = deg2rad($Mp); $Fr = deg2rad($F); $Lpr = deg2rad($Lp);
        $tables = self::ephemerisTables();

        $sumL = 0.0;
        $sumR = 0.0;
        foreach ($tables['moonLR'] as $row) {
            $arg = $row[0] * $Dr + $row[1] * $Mr + $row[2] * $Mpr + $row[3] * $Fr;
            $m = (int) $row[1];
            $e = $m === 0 ? 1.0 : (abs($m) === 1 ? $E : $E2);
            $sumL += $row[4] * $e * sin($arg);
            $sumR += $row[5] * $e * cos($arg);
        }
        $sumB = 0.0;
        foreach ($tables['moonB'] as $row) {
            $arg = $row[0] * $Dr + $row[1] * $Mr + $row[2] * $Mpr + $row[3] * $Fr;
            $m = (int) $row[1];
            $e = $m === 0 ? 1.0 : (abs($m) === 1 ? $E : $E2);
            $sumB += $row[4] * $e * sin($arg);
        }
        $sumL += 3958.0 * sin($A1) + 1962.0 * sin($Lpr - $Fr) + 318.0 * sin($A2);
        $sumB += -2235.0 * sin($Lpr) + 382.0 * sin($A3) + 175.0 * sin($A1 - $Fr) + 175.0 * sin($A1 + $Fr)
            + 127.0 * sin($Lpr - $Mpr) - 115.0 * sin($Lpr + $Mpr);

        return [
            'lon' => self::norm360($Lp + $sumL / 1000000.0),
            'lat' => $sumB / 1000000.0,
            'dist' => 385000.56 + $sumR / 1000.0,
        ];
    }

    /**
     * Apparent geocentric Moon (mean equinox of date): the geometric position
     * retarded by the ≈1.3 s light-time (≈ 0.7″), matching Swiss Ephemeris'
     * default (non-SEFLG_TRUEPOS) convention.
     */
    private static function moonGeocentric(float $T): array {
        $geometric = self::moonGeometric($T);
        $lightTimeCenturies = ($geometric['dist'] / self::SPEED_OF_LIGHT_KM_PER_DAY) / 36525.0;
        return self::moonGeometric($T - $lightTimeCenturies);
    }

    /** Lunar geocentric rectangular position (km, mean ecliptic of date). */
    private static function moonXYZ(float $T): array {
        $m = self::moonGeometric($T);
        $lon = deg2rad($m['lon']);
        $lat = deg2rad($m['lat']);
        $cb = cos($lat);
        return [$m['dist'] * $cb * cos($lon), $m['dist'] * $cb * sin($lon), $m['dist'] * sin($lat)];
    }

    /**
     * Osculating ("true") ascending node of the Moon, degrees, mean equinox of
     * date — the SE_TRUE_NODE convention used by Drik Panchang. The node is
     * the direction ẑ × h of the instantaneous orbital plane, where
     * h = r × v is the specific angular momentum of the geocentric lunar
     * state vector (velocity by a central difference over ±0.01 day).
     * @param float $T Julian centuries TT from J2000.0
     */
    private static function moonOsculatingNode(float $T): float {
        $hDays = 0.01;
        $h = $hDays / 36525.0;
        [$x, $y, $z] = self::moonXYZ($T);
        [$x1, $y1, $z1] = self::moonXYZ($T - $h);
        [$x2, $y2, $z2] = self::moonXYZ($T + $h);
        $vx = ($x2 - $x1) / (2.0 * $hDays);
        $vy = ($y2 - $y1) / (2.0 * $hDays);
        $vz = ($z2 - $z1) / (2.0 * $hDays);
        $hx = $y * $vz - $z * $vy;
        $hy = $z * $vx - $x * $vz;
        return self::norm360(rad2deg(atan2($hx, -$hy)));
    }

    /** Mean ascending node of the lunar orbit (Meeus 47.7), degrees. */
    private static function meanLunarNode($T) {
        return self::norm360(125.0445479 - 1934.1362891 * $T + 0.0020754 * $T * $T + pow($T, 3) / 467441.0 - pow($T, 4) / 60616000.0);
    }

    // ---------------------------------------------------------------------
    //  Combined geocentric chart positions
    // ---------------------------------------------------------------------

    /**
     * Compute every chart body for a UT Julian Day.
     *
     * Returns tropical longitudes in two conventions plus sidereal (Lahiri):
     *   tropicalMean[]  — mean equinox of date (no nutation)
     *   tropical[]      — apparent / true equinox of date (Δψ added)
     *   sidereal[]      — tropical − ayanamsa(true) == tropicalMean − ayanamsa(mean)
     * together with latitudes, geocentric distances (AU; Moon in km), daily
     * sidereal motion (deg/day, negative when retrograde), the ayanamsa pair,
     * nutation and obliquity. Bodies: sun, moon, mercury, venus, mars,
     * jupiter, saturn, rahu, ketu, plus both node conventions as trueNode and
     * meanNode. 'rahu' is whichever convention $nodeType selects (default:
     * the ASTRO_RAHU_NODE_TYPE setting, see nodeType()); 'ketu' is always
     * exactly rahu + 180°. The convention used is echoed back as 'nodeType'.
     *
     * @param float       $jdUt      Julian Day (UT/UTC)
     * @param bool        $withSpeed Also evaluate ±0.5 day to derive daily motion / retrogression
     * @param string|null $nodeType  'TRUE' | 'MEAN' | null (= configured value)
     */
    public static function computeGeocentricPositions(float $jdUt, bool $withSpeed = true, ?string $nodeType = null): array {
        if (!is_finite($jdUt)) {
            throw new InvalidArgumentException('A finite Julian Day is required for ephemeris calculations.');
        }
        if ($nodeType === null) {
            $nodeType = self::nodeType();
        } else {
            $normalizedNodeType = self::normalizeNodeType($nodeType);
            if ($normalizedNodeType === null) {
                throw new InvalidArgumentException("Unsupported Rahu node type '{$nodeType}'; expected 'TRUE' or 'MEAN'.");
            }
            $nodeType = $normalizedNodeType;
        }
        $jdTt = self::julianDayTT($jdUt);
        $T = ($jdTt - self::J2000) / 36525.0;
        $nut = self::nutation($T);
        $epsMean = self::meanObliquity($T);
        $epsTrue = $epsMean + $nut['deps'];
        $ayanamsaMean = self::lahiriAyanamsaMean($T);
        $ayanamsaTrue = $ayanamsaMean + $nut['dpsi'];

        $mean = [];
        $lat = [];
        $dist = [];
        $sun = self::sunGeocentric($jdTt);
        $mean['sun'] = $sun['lon']; $lat['sun'] = $sun['lat']; $dist['sun'] = $sun['dist'];
        $moon = self::moonGeocentric($T);
        $mean['moon'] = $moon['lon']; $lat['moon'] = $moon['lat']; $dist['moon'] = $moon['dist'];
        foreach (['mercury', 'venus', 'mars', 'jupiter', 'saturn'] as $planet) {
            $p = self::planetGeocentric($planet, $jdTt);
            $mean[$planet] = $p['lon']; $lat[$planet] = $p['lat']; $dist[$planet] = $p['dist'];
        }
        // Both node conventions are always evaluated so results can be audited;
        // Rahu follows the configured convention and Ketu is exactly opposite.
        $mean['trueNode'] = self::moonOsculatingNode($T);
        $mean['meanNode'] = self::meanLunarNode($T);
        $mean['rahu'] = $nodeType === self::NODE_TYPE_MEAN ? $mean['meanNode'] : $mean['trueNode'];
        $mean['ketu'] = self::norm360($mean['rahu'] + 180.0);
        $lat['rahu'] = $lat['ketu'] = $lat['trueNode'] = $lat['meanNode'] = 0.0;

        $tropical = [];
        $sidereal = [];
        foreach ($mean as $body => $lon) {
            $tropical[$body] = self::norm360($lon + $nut['dpsi']);
            $sidereal[$body] = self::norm360($lon - $ayanamsaMean);
        }

        $speed = [];
        if ($withSpeed) {
            // Centered ±0.5 day difference of SIDEREAL longitude: robust near
            // the stations of slow planets, identical to the TypeScript engine.
            $before = self::computeGeocentricPositions($jdUt - 0.5, false, $nodeType);
            $after = self::computeGeocentricPositions($jdUt + 0.5, false, $nodeType);
            foreach ($sidereal as $body => $_) {
                $speed[$body] = self::angleDelta($after['sidereal'][$body], $before['sidereal'][$body]);
            }
        }

        return [
            'jdUt' => $jdUt,
            'jdTt' => $jdTt,
            'deltaT' => ($jdTt - $jdUt) * 86400.0,
            'T' => $T,
            'nodeType' => $nodeType,
            'nutation' => $nut,
            'obliquity' => ['mean' => $epsMean, 'true' => $epsTrue],
            'ayanamsa' => $ayanamsaTrue,
            'ayanamsaMean' => $ayanamsaMean,
            'tropicalMean' => $mean,
            'tropical' => $tropical,
            'sidereal' => $sidereal,
            'latitude' => $lat,
            'distance' => $dist,
            'speed' => $speed,
        ];
    }

    /**
     * Sidereal (Lahiri) Ascendant. Uses apparent sidereal time (GMST + equation
     * of the equinoxes), the true obliquity and the true ayanamsa — the same
     * reduction Swiss Ephemeris applies in swe_houses_ex(SEFLG_SIDEREAL).
     * @param array $positions Result of computeGeocentricPositions() for the same instant
     * @return array{tropical: float, sidereal: float, ramc: float}
     */
    public static function computeAscendant(float $jdUt, float $latitudeDeg, float $longitudeDeg, array $positions): array {
        $d = $jdUt - self::J2000;
        $Tut = $d / 36525.0;
        $gmst = 280.46061837 + 360.98564736629 * $d + 0.000387933 * $Tut * $Tut - $Tut * $Tut * $Tut / 38710000.0;
        $epsTrue = deg2rad($positions['obliquity']['true']);
        $gast = $gmst + $positions['nutation']['dpsi'] * cos($epsTrue);
        $ramc = self::norm360($gast + $longitudeDeg);
        $ramcRad = deg2rad($ramc);
        $latRad = deg2rad($latitudeDeg);
        $ascTropical = self::norm360(rad2deg(atan2(cos($ramcRad),
            -(sin($ramcRad) * cos($epsTrue) + tan($latRad) * sin($epsTrue)))));
        return [
            'tropical' => $ascTropical,
            'sidereal' => self::norm360($ascTropical - $positions['ayanamsa']),
            'ramc' => $ramc,
        ];
    }

    // ---------------------------------------------------------------------
    //  Legacy wrappers (kept for callers that pass Julian centuries directly).
    //  $T is now interpreted as Julian centuries TT from J2000.0 and the
    //  returned longitudes are APPARENT tropical (true equinox of date).
    // ---------------------------------------------------------------------

    private static function sunTropicalLongitude($T) {
        $jdTt = self::J2000 + $T * 36525.0;
        return self::norm360(self::sunGeocentric($jdTt)['lon'] + self::nutation((float) $T)['dpsi']);
    }

    private static function moonTropicalLongitude($T) {
        return self::norm360(self::moonGeocentric((float) $T)['lon'] + self::nutation((float) $T)['dpsi']);
    }

    /** Osculating true node (apparent tropical longitude). Ignores ASTRO_RAHU_NODE_TYPE by design. */
    private static function trueLunarNode($T) {
        return self::norm360(self::moonOsculatingNode((float) $T) + self::nutation((float) $T)['dpsi']);
    }

    /**
     * Rahu's apparent tropical longitude under the configured (or given) node
     * convention — the single switch between trueLunarNode() and meanLunarNode().
     * Ketu is always rahuTropicalLongitude() + 180°.
     */
    private static function rahuTropicalLongitude($T, ?string $nodeType = null) {
        $nodeType = $nodeType === null ? self::nodeType() : (self::normalizeNodeType($nodeType) ?? self::NODE_TYPE_TRUE);
        if ($nodeType === self::NODE_TYPE_MEAN) {
            return self::norm360(self::meanLunarNode((float) $T) + self::nutation((float) $T)['dpsi']);
        }
        return self::trueLunarNode($T);
    }

    private static function planetGeocentricLongitude($key, $T) {
        $jdTt = self::J2000 + $T * 36525.0;
        return self::norm360(self::planetGeocentric($key, $jdTt)['lon'] + self::nutation((float) $T)['dpsi']);
    }

    /** Format dasha boundaries in the native's local civil date, never the PHP server zone. */
    private static function formatDashaDate($timestamp, $timeZoneId = '', $timezoneOffsetHours = 0.0): string {
        try {
            if (is_string($timeZoneId) && trim($timeZoneId) !== '') {
                $zone = new DateTimeZone(trim($timeZoneId));
            } else {
                $offsetMinutes = (int) round(((float) $timezoneOffsetHours) * 60.0);
                $offsetSign = $offsetMinutes >= 0 ? '+' : '-';
                $absoluteMinutes = abs($offsetMinutes);
                $offsetName = sprintf('%s%02d:%02d', $offsetSign, intdiv($absoluteMinutes, 60), $absoluteMinutes % 60);
                $zone = new DateTimeZone($offsetName);
            }
        } catch (Throwable $e) {
            $zone = new DateTimeZone('UTC');
        }

        $instant = new DateTimeImmutable('@' . (string) (int) floor((float) $timestamp));
        return $instant->setTimezone($zone)->format('Y-m-d');
    }

    private static function calculateVimshottariDasha($moonSiderealDeg, $birthTimestamp, $targetTimestamp = null, $timeZoneId = '', $timezoneOffsetHours = 0.0) {
        $lordsTa = ['Ketu'=>'கேது','Venus'=>'சுக்கிரன்','Sun'=>'சூரியன்','Moon'=>'சந்திரன்','Mars'=>'செவ்வாய்','Rahu'=>'ராகு','Jupiter'=>'குரு','Saturn'=>'சனி','Mercury'=>'புதன்'];
        $lordsHi = ['Ketu'=>'केतु','Venus'=>'शुक्र','Sun'=>'सूर्य','Moon'=>'चंद्र','Mars'=>'मंगल','Rahu'=>'राहु','Jupiter'=>'गुरु','Saturn'=>'शनि','Mercury'=>'बुध'];
        $years = ['Ketu'=>7,'Venus'=>20,'Sun'=>6,'Moon'=>10,'Mars'=>7,'Rahu'=>18,'Jupiter'=>16,'Saturn'=>19,'Mercury'=>17];
        $YEAR = 365.25 * 86400;
        $target = $targetTimestamp ?? time();

        $lordsOrder = ['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
        $span = 360.0 / 27.0;
        $nakIndex = (int) floor($moonSiderealDeg / $span) % 27;
        $posInNak = fmod(fmod($moonSiderealDeg, $span) + $span, $span);
        $elapsedFraction = $posInNak / $span;
        $startLordIdx = $nakIndex % 9;
        $startLord = $lordsOrder[$startLordIdx];

        // Balance at birth: (1 - elapsedFraction) * years[startLord]
        $balanceRemainingYears = (1.0 - $elapsedFraction) * $years[$startLord];
        $balYrs = (int) floor($balanceRemainingYears);
        $balMonths = (int) round(($balanceRemainingYears - $balYrs) * 12);
        if ($balMonths === 12) {
            $balYrs += 1;
            $balMonths = 0;
        }

        // Walk FULL Mahadashas until the target timestamp falls inside one
        $birthMahaStart = $birthTimestamp - ($elapsedFraction * $years[$startLord] * $YEAR);
        $cursor = $birthMahaStart;
        $mIdx = $startLordIdx;
        $mahaDur = $years[$lordsOrder[$mIdx]] * $YEAR;

        while ($cursor + $mahaDur <= $target) {
            $cursor += $mahaDur;
            $mIdx = ($mIdx + 1) % 9;
            $mahaDur = $years[$lordsOrder[$mIdx]] * $YEAR;
        }

        $currentMahaLord = $lordsOrder[$mIdx];
        $mahaStart = $cursor;
        $mahaEnd = $cursor + $mahaDur;

        // Locate Antardasha (starts with Mahadasha lord, duration = mahaYears * antarYears / 120)
        $aCursor = $mahaStart;
        $aIdx = $mIdx;
        $aDur = ($mahaDur * $years[$lordsOrder[$aIdx]]) / 120.0;

        for ($i = 0; $i < 9; $i++) {
            $aDur = ($mahaDur * $years[$lordsOrder[$aIdx]]) / 120.0;
            if ($target < $aCursor + $aDur || $i === 8) {
                break;
            }
            $aCursor += $aDur;
            $aIdx = ($aIdx + 1) % 9;
        }

        $currentAntarLord = $lordsOrder[$aIdx];
        $antarStart = $aCursor;
        $antarEnd = $aCursor + $aDur;

        // Locate Pratyantardasha (starts with Antardasha lord, duration = antarYears * pratYears / 120)
        $pCursor = $antarStart;
        $pIdx = $aIdx;
        $pDur = ($aDur * $years[$lordsOrder[$pIdx]]) / 120.0;

        for ($i = 0; $i < 9; $i++) {
            $pDur = ($aDur * $years[$lordsOrder[$pIdx]]) / 120.0;
            if ($target < $pCursor + $pDur || $i === 8) {
                break;
            }
            $pCursor += $pDur;
            $pIdx = ($pIdx + 1) % 9;
        }

        $currentPratyantarLord = $lordsOrder[$pIdx];
        $pratStart = $pCursor;
        $pratEnd = $pCursor + $pDur;

        return [
            'currentLord' => $currentMahaLord,
            'currentLordTa' => $lordsTa[$currentMahaLord] ?? $currentMahaLord,
            'currentLordHi' => $lordsHi[$currentMahaLord] ?? $currentMahaLord,
            'subLord' => $currentAntarLord,
            'subLordTa' => $lordsTa[$currentAntarLord] ?? $currentAntarLord,
            'subLordHi' => $lordsHi[$currentAntarLord] ?? $currentAntarLord,
            'pratyantarLord' => $currentPratyantarLord,
            'pratyantarLordTa' => $lordsTa[$currentPratyantarLord] ?? $currentPratyantarLord,
            'pratyantarLordHi' => $lordsHi[$currentPratyantarLord] ?? $currentPratyantarLord,
            'period' => self::formatDashaDate($mahaStart, $timeZoneId, $timezoneOffsetHours) . ' to ' . self::formatDashaDate($mahaEnd, $timeZoneId, $timezoneOffsetHours),
            'antarPeriod' => self::formatDashaDate($antarStart, $timeZoneId, $timezoneOffsetHours) . ' - ' . self::formatDashaDate($antarEnd, $timeZoneId, $timezoneOffsetHours),
            'pratyantarPeriod' => self::formatDashaDate($pratStart, $timeZoneId, $timezoneOffsetHours) . ' - ' . self::formatDashaDate($pratEnd, $timeZoneId, $timezoneOffsetHours),
            'balanceAtBirth' => "{$balYrs} Years " . max(0, $balMonths) . " Months",
        ];
    }

    /**
     * Build the birth-start Mahadasha sequence and each Mahadasha's nine
     * Antardashas from the computed Moon longitude. The first Mahadasha is
     * shown from birth to its remaining balance; its sub-periods retain their
     * true starts, which can predate birth.
     */
    private static function calculateVimshottariDashaPeriods($moonSiderealDeg, $birthTimestamp, $targetTimestamp, $timeZoneId = '', $timezoneOffsetHours = 0.0): array {
        $lordsTa = ['Ketu'=>'கேது','Venus'=>'சுக்கிரன்','Sun'=>'சூரியன்','Moon'=>'சந்திரன்','Mars'=>'செவ்வாய்','Rahu'=>'ராகு','Jupiter'=>'குரு','Saturn'=>'சனி','Mercury'=>'புதன்'];
        $lordsHi = ['Ketu'=>'केतु','Venus'=>'शुक्र','Sun'=>'सूर्य','Moon'=>'चंद्र','Mars'=>'मंगल','Rahu'=>'राहु','Jupiter'=>'गुरु','Saturn'=>'शनि','Mercury'=>'बुध'];
        $lordsOrder = ['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
        $years = ['Ketu'=>7,'Venus'=>20,'Sun'=>6,'Moon'=>10,'Mars'=>7,'Rahu'=>18,'Jupiter'=>16,'Saturn'=>19,'Mercury'=>17];
        $lordKeys = ['Ketu'=>'ketu','Venus'=>'venus','Sun'=>'sun','Moon'=>'moon','Mars'=>'mars','Rahu'=>'rahu','Jupiter'=>'jupiter','Saturn'=>'saturn','Mercury'=>'mercury'];
        $yearSeconds = 365.25 * 86400.0;
        $span = 360.0 / 27.0;
        $nakIndex = (int) floor(self::norm360((float) $moonSiderealDeg) / $span) % 27;
        $posInNak = fmod(fmod((float) $moonSiderealDeg, $span) + $span, $span);
        $elapsedFraction = $posInNak / $span;
        $startLordIdx = $nakIndex % 9;
        $startLord = $lordsOrder[$startLordIdx];
        $balanceYears = (1.0 - $elapsedFraction) * $years[$startLord];
        $birthMahaStart = (float) $birthTimestamp - ($elapsedFraction * $years[$startLord] * $yearSeconds);
        $periods = [];
        $mahaCursor = $birthMahaStart;
        $mahaLordIdx = $startLordIdx;

        for ($mahaNumber = 0; $mahaNumber < 9; $mahaNumber++) {
            $mahaLord = $lordsOrder[$mahaLordIdx];
            $mahaDurationYears = $years[$mahaLord];
            $mahaDuration = $mahaDurationYears * $yearSeconds;
            $mahaEnd = $mahaCursor + $mahaDuration;
            $antardashas = [];
            $antarCursor = $mahaCursor;

            for ($antarNumber = 0; $antarNumber < 9; $antarNumber++) {
                $antarLord = $lordsOrder[($mahaLordIdx + $antarNumber) % 9];
                $antarDurationYears = ($mahaDurationYears * $years[$antarLord]) / 120.0;
                $antarEnd = $antarCursor + ($antarDurationYears * $yearSeconds);
                $antardashas[] = [
                    'lord' => $lordKeys[$antarLord],
                    'lordNameEn' => $antarLord,
                    'lordNameTa' => $lordsTa[$antarLord],
                    'lordNameHi' => $lordsHi[$antarLord],
                    'startDate' => self::formatDashaDate($antarCursor, $timeZoneId, $timezoneOffsetHours),
                    'endDate' => self::formatDashaDate($antarEnd, $timeZoneId, $timezoneOffsetHours),
                    'months' => round($antarDurationYears * 12.0, 1),
                    'isCurrent' => (float) $targetTimestamp >= $antarCursor && (float) $targetTimestamp < $antarEnd,
                ];
                $antarCursor = $antarEnd;
            }

            $displayStart = $mahaNumber === 0 ? (float) $birthTimestamp : $mahaCursor;
            $displayEnd = $mahaNumber === 0
                ? (float) $birthTimestamp + ($balanceYears * $yearSeconds)
                : $mahaEnd;
            $displayYears = $mahaNumber === 0 ? $balanceYears : (float) $mahaDurationYears;
            $periods[] = [
                'mahadashaLord' => $lordKeys[$mahaLord],
                'lordNameEn' => $mahaLord,
                'lordNameTa' => $lordsTa[$mahaLord],
                'lordNameHi' => $lordsHi[$mahaLord],
                'startDate' => self::formatDashaDate($displayStart, $timeZoneId, $timezoneOffsetHours),
                'endDate' => self::formatDashaDate($displayEnd, $timeZoneId, $timezoneOffsetHours),
                'years' => round($displayYears, 1),
                'durationYears' => round($displayYears, 1),
                // The first displayed span is the balance from birth, not
                // the full Mahadasha whose reference Antardashas may predate it.
                'periodKind' => $mahaNumber === 0 ? 'BIRTH_BALANCE' : 'FULL_MAHADASHA',
                'fullStartDate' => self::formatDashaDate($mahaCursor, $timeZoneId, $timezoneOffsetHours),
                'fullYears' => $mahaDurationYears,
                'antardashas' => $antardashas,
                'isCurrent' => (float) $targetTimestamp >= $mahaCursor && (float) $targetTimestamp < $mahaEnd,
            ];

            $mahaCursor = $mahaEnd;
            $mahaLordIdx = ($mahaLordIdx + 1) % 9;
        }

        return $periods;
    }

    private static $NAK_GANA = [0,1,2,1,0,1,0,0,2,2,1,1,0,2,0,2,0,2,2,1,1,0,2,2,1,1,0];
    private static $NAK_YONI = [
        ['horse','m'],['elephant','f'],['goat','f'],['serpent','m'],['serpent','f'],['dog','f'],
        ['cat','f'],['goat','m'],['cat','m'],['rat','m'],['rat','f'],['cow','m'],
        ['buffalo','f'],['tiger','f'],['buffalo','m'],['tiger','m'],['deer','f'],['deer','m'],
        ['dog','m'],['monkey','m'],['mongoose','m'],['monkey','f'],['lion','f'],['horse','f'],
        ['lion','m'],['cow','f'],['elephant','m']
    ];
    private static $YONI_FRIEND = [
        'horse'=>['elephant'],'elephant'=>['horse'],'goat'=>['elephant'],'serpent'=>['goat'],
        'dog'=>['cat'],'cat'=>['dog'],'rat'=>['cat'],'cow'=>['tiger'],'buffalo'=>['horse'],
        'tiger'=>['cow'],'deer'=>['serpent'],'monkey'=>['tiger'],'mongoose'=>[],'lion'=>['monkey'],
    ];
    private static $YONI_ENEMY = [
        'horse'=>['dog'],'elephant'=>['lion'],'goat'=>['monkey'],'serpent'=>['mongoose'],
        'dog'=>['horse','deer','monkey'],'cat'=>['monkey'],'rat'=>['buffalo'],'cow'=>['dog'],
        'buffalo'=>['tiger'],'tiger'=>['elephant'],'deer'=>['dog'],'monkey'=>['dog','cat'],
        'mongoose'=>[],'lion'=>['elephant'],
    ];
    // The five-group Rajju mapping in the same Nakshatra order as the
    // TypeScript matchmaking engine (0=Siro, 1=Kanda, 2=Udhara, 3=Uru, 4=Pada):
    //
    //   Siro   (head):  Mrigashirsha, Chitra, Dhanishta (Avittam)
    //   Kanda  (neck):  Rohini, Ardra (Thiruvadhirai), Hasta, Swati, Shravana (Thiruvonam), Shatabhisha (Sathayam)
    //   Udhara (navel): Krittika (Karthigai), Punarvasu (Punarpoosam), Uttara Phalguni (Uthiram), Vishakha (Visakam), Uttara Ashadha (Uthiradam), Purva Bhadrapada (Poorattathi)
    //   Uru    (thigh): Bharani, Pushya (Poosam), Purva Phalguni (Pooram), Anuradha (Anusham), Purva Ashadha (Pooradam), Uttara Bhadrapada (Uthirattathi)
    //   Pada   (foot):  Ashwini, Ashlesha (Ayilyam), Magha (Magam), Jyeshtha (Kettai), Mula (Moolam), Revati (Revathi)
    //
    // The five groups repeat identically over each nine-Nakshatra arc, so the
    // table is the nine-value pattern (4,3,2,1,0,1,2,3,4) three times. Rajju
    // MATCHES when the two stars are in DIFFERENT groups. The former table
    // rotated 4,3,2,1,0 every five stars, shifting Ardra..Ashlesha,
    // Swati..Jyeshtha and Shatabhisha..Uttara Bhadrapada by one group and
    // wrongly failing e.g. bride Avittam (Siro) + groom Swati (Kanda).
    private static function rajjuTable() {
        static $table = null;
        return $table ?? ($table = json_decode(file_get_contents(__DIR__ . '/rajju.json'), true, 512, JSON_THROW_ON_ERROR));
    }
    private static $VASYA_GROUP = [0,0,1,2,1,3,1,4,1,0,2,2];
    private static $VEDHA_PAIR = [17,16,15,14,22,21,20,19,18,26,25,24,23,null,3,2,1,0,8,7,6,5,4,12,11,10,9];

    private static function planetFriendship($p1, $p2) {
        $friends = [
            'sun' => ['moon','mars','jupiter'], 'moon' => ['sun','mercury'],
            'mars' => ['sun','moon','jupiter'], 'mercury' => ['sun','venus'],
            'jupiter' => ['sun','moon','mars'], 'venus' => ['mercury','saturn'],
            'saturn' => ['mercury','venus'],
        ];
        $enemies = [
            'sun' => ['venus','saturn'], 'moon' => [],
            'mars' => ['mercury'], 'mercury' => ['moon'],
            'jupiter' => ['mercury','venus'], 'venus' => ['sun','moon'],
            'saturn' => ['sun','moon','mars'],
        ];
        if (in_array($p2, $friends[$p1] ?? [])) return 'friend';
        if (in_array($p2, $enemies[$p1] ?? [])) return 'enemy';
        return 'neutral';
    }

    private static function grahaMaitriScore($lord1, $lord2) {
        $rel1 = self::planetFriendship($lord1, $lord2);
        $rel2 = self::planetFriendship($lord2, $lord1);
        if ($rel1 === 'friend' && $rel2 === 'friend') return 5;
        if ($rel1 === 'enemy' && $rel2 === 'enemy') return 0;
        if ($rel1 === 'neutral' && $rel2 === 'neutral') return 3;
        if (($rel1 === 'friend' && $rel2 === 'enemy') || ($rel1 === 'enemy' && $rel2 === 'friend')) return 1;
        return 4;
    }

    /**
     * Houses (whole-sign, counted from a reference rasi) that constitute
     * Sevvay/Kuja Dosha.
     *
     * DEFAULT = the South Indian (Tamil) rule: 2, 4, 7, 8 and 12 from the Lagna,
     * the Moon and Venus. The 1st house is deliberately NOT part of this rule
     * set; ASTRO_KUJA_HOUSES can override the list (e.g.
     * ASTRO_KUJA_HOUSES=1,2,4,7,8,12 for the North Indian / BPHS reading).
     */
    private const KUJA_DOSHA_HOUSES = [2, 4, 7, 8, 12];

    /**
     * House list used by the live evaluation: the ASTRO_KUJA_HOUSES environment
     * override when it holds a valid 1-12 list, else the South Indian default —
     * the exact behaviour of activeKujaHouses() in src/lib/astrology/kujaDosha.ts.
     */
    private static function kujaDoshaHouses(): array {
        $raw = getenv('ASTRO_KUJA_HOUSES');
        $raw = is_string($raw) ? trim($raw) : '';
        if ($raw === '') { return self::KUJA_DOSHA_HOUSES; }
        $parsed = [];
        foreach (explode(',', $raw) as $part) {
            $value = trim($part);
            if ($value === '' || !ctype_digit($value)) { continue; }
            $number = (int) $value;
            if ($number >= 1 && $number <= 12) { $parsed[$number] = true; }
        }
        if ($parsed === []) {
            error_log('ASTRO SIVAM: ASTRO_KUJA_HOUSES="' . $raw . '" is not a house list. Using the default.');
            return self::KUJA_DOSHA_HOUSES;
        }
        $houses = array_keys($parsed);
        sort($houses);
        return $houses;
    }

    /**
     * House-specific signs in which Mars does NOT cause Kuja Dosha (the Tamil
     * Sevvai Dosha Vilakku lists: Sakthi Vikatan "செவ்வாய் தோஷம் விதிவிலக்குகள்",
     * Tirumana Porutham's twelve exemptions, neerkondar's top-10 exemptions).
     * Keys are the house of Mars counted from the reference point; values are
     * 1-based rasi numbers (Mesham = 1 … Meenam = 12).
     *   1st  : Mesham/Viruchigam (own), Magaram (exalted)           → via own/exalted rule
     *   2nd  : Mithunam, Kanni (Budha's signs) — Kadagam is NOT exempt here: the
     *          Tamil lists name Mithunam/Kanni only (astroved is the lone list
     *          that adds Kadagam; the majority reading was chosen)
     *   4th  : Mesham, Viruchigam (own)                              → via own rule
     *   7th  : Kadagam, Magaram (debilitation/exaltation axis)
     *   8th  : Dhanusu, Meenam (Guru's signs)
     *   12th : Rishabam, Thulam (Sukra's signs)
     * Simham (Leo) and Kumbam (Aquarius) are exempt in every dosha house.
     */
    private const KUJA_HOUSE_SIGN_EXCEPTIONS = [
        2 => [3, 6],
        7 => [4, 10],
        8 => [9, 12],
        12 => [2, 7],
    ];
    private const KUJA_UNIVERSAL_SIGN_EXCEPTIONS = [5, 11]; // Simham, Kumbam

    /**
     * Classical Sevvay (Kuja / Mangala) Dosha evaluation with the standard
     * exceptions. Whole-sign houses; rasi numbers are 1-based (Mesham = 1).
     *
     * Dosha trigger (South Indian rule): Mars in the 2nd, 4th, 7th, 8th or 12th
     * house counted from the Lagna, from the Moon (Chandra Lagna) and from Venus
     * (Sukra). The 1st house is only screened when ASTRO_KUJA_HOUSES asks for it.
     *
     * Cancelling exceptions (status DOSHA_CANCELLED):
     *   OWN_SIGN          Mars in Mesham or Viruchigam
     *   EXALTED           Mars in Magaram
     *   HOUSE_SIGN        house/sign pairs in KUJA_HOUSE_SIGN_EXCEPTIONS
     *   LEO_AQUARIUS      Mars in Simham or Kumbam
     *   YOGAKARAKA_LAGNA  Kadagam/Simham Lagna (Mars is Yogakaraka)
     *   GURU_MANGALA      Mars conjunct Jupiter (same rasi)
     *   CHANDRA_MANGALA   Mars conjunct the Moon (same rasi)
     *   GURU_DRISHTI      Jupiter's 5th/7th/9th aspect on Mars
     *
     * Mitigating conditions (status DOSHA_MILD when no cancellation applies):
     *   NOT_FROM_LAGNA    dosha arises only from the Moon and/or Venus
     *   MOON_ONLY / VENUS_ONLY (recorded for the explanation)
     *   SATURN_NODE_BALANCE Saturn, Rahu or Ketu also occupy a Kuja house from
     *                     the Lagna (in-chart mutual neutralisation)
     *
     * @param array $chart 1-based rasi numbers: mars, lagna, moon, venus,
     *                     jupiter (required); saturn, rahu, ketu (optional).
     * @return array status NOT_ASSESSED | DOSHA_NONE | DOSHA_CANCELLED |
     *               DOSHA_MILD | DOSHA_PRESENT, plus isPresent (effective
     *               dosha, null when not assessed), raw, cancelled, mild,
     *               houses (per reference), afflictedFrom, exceptions,
     *               mitigations and trilingual severity/explanation text.
     */
    private static function evaluateKujaDosha(array $chart): array {
        $rasi = static function ($value): ?int {
            return is_numeric($value) && (int) $value >= 1 && (int) $value <= 12 ? (int) $value : null;
        };
        $mars = $rasi($chart['mars'] ?? null);
        $lagna = $rasi($chart['lagna'] ?? null);
        $moon = $rasi($chart['moon'] ?? null);
        $venus = $rasi($chart['venus'] ?? null);
        $jupiter = $rasi($chart['jupiter'] ?? null);
        $saturn = $rasi($chart['saturn'] ?? null);
        $rahu = $rasi($chart['rahu'] ?? null);
        $ketu = $rasi($chart['ketu'] ?? null);

        $result = [
            'status' => 'NOT_ASSESSED',
            'isPresent' => null, 'raw' => null, 'cancelled' => null, 'mild' => null,
            'marsRasi' => $mars, 'marsRasiNameEn' => $mars ? self::$RASIS[$mars - 1]['en'] : null,
            'marsRasiNameTa' => $mars ? self::$RASIS[$mars - 1]['ta'] : null,
            'marsBhava' => null,
            'houses' => ['lagna' => null, 'moon' => null, 'venus' => null],
            'afflictedFrom' => [], 'exceptions' => [], 'mitigations' => [],
            'severityEn' => 'N/A', 'severityTa' => 'N/A', 'severityHi' => 'N/A',
            'explanationEn' => 'Required Mars, Lagna, Moon, Venus or Jupiter placement data is unavailable; Sevvay Dosha is not assessed.',
            'explanationTa' => 'செவ்வாய், லக்னம், சந்திரன், சுக்கிரன் அல்லது குருவின் ராசி நிலை கிடைக்கவில்லை; செவ்வாய் தோஷம் மதிப்பிடப்படவில்லை.',
            'explanationHi' => 'मंगल, लग्न, चंद्र, शुक्र अथवा गुरु की राशि स्थिति उपलब्ध नहीं है; मंगल दोष का आकलन नहीं हुआ।',
        ];
        if ($mars === null || $lagna === null || $moon === null || $venus === null || $jupiter === null) {
            return $result; // Missing data must stay N/A, never a false "clean" result.
        }

        $houseFrom = static fn(int $reference): int => (($mars - $reference + 12) % 12) + 1;
        $houses = ['lagna' => $houseFrom($lagna), 'moon' => $houseFrom($moon), 'venus' => $houseFrom($venus)];
        $result['houses'] = $houses;
        $result['marsBhava'] = $houses['lagna'];
        $afflictedFrom = [];
        foreach ($houses as $reference => $house) {
            if (in_array($house, self::kujaDoshaHouses(), true)) $afflictedFrom[] = $reference;
        }
        $result['afflictedFrom'] = $afflictedFrom;
        $raw = count($afflictedFrom) > 0;
        $result['raw'] = $raw;

        $signName = static fn(int $r): string => self::$RASIS[$r - 1]['en'];
        $signNameTa = static fn(int $r): string => self::$RASIS[$r - 1]['ta'];
        $referenceEn = ['lagna' => 'Lagna', 'moon' => 'Moon', 'venus' => 'Venus'];
        $referenceFromEn = ['lagna' => 'the Lagna', 'moon' => 'the Moon (Chandra Lagna)', 'venus' => 'Venus (Sukra)'];
        $referenceTa = ['lagna' => 'லக்னம்', 'moon' => 'சந்திரன்', 'venus' => 'சுக்கிரன்'];
        $referenceHi = ['lagna' => 'लग्न', 'moon' => 'चंद्र', 'venus' => 'शुक्र'];

        if (!$raw) {
            $result['status'] = 'DOSHA_NONE';
            $result['isPresent'] = false; $result['cancelled'] = false; $result['mild'] = false;
            $result['severityEn'] = 'No Sevvay Dosha';
            $result['severityTa'] = 'செவ்வாய் தோஷம் இல்லை';
            $result['severityHi'] = 'मंगल दोष नहीं';
            $result['explanationEn'] = sprintf('Mars in %s occupies the %s house from the Lagna, the %s from the Moon and the %s from Venus - none of the Kuja Dosha houses (%s).',
                $signName($mars), self::ordinalEn($houses['lagna']), self::ordinalEn($houses['moon']), self::ordinalEn($houses['venus']), implode(', ', self::kujaDoshaHouses()));
            $result['explanationTa'] = sprintf('%s ராசியில் உள்ள செவ்வாய் லக்னத்திலிருந்து %d-ஆம், சந்திரனிலிருந்து %d-ஆம், சுக்கிரனிலிருந்து %d-ஆம் இடத்தில் உள்ளார்; இவை தோஷ ஸ்தானங்கள் (%s) அல்ல.',
                $signNameTa($mars), $houses['lagna'], $houses['moon'], $houses['venus'], implode(', ', self::kujaDoshaHouses()));
            $result['explanationHi'] = sprintf('%s राशि में स्थित मंगल लग्न से %dवें, चंद्र से %dवें तथा शुक्र से %dवें भाव में है; ये मंगल दोष के भाव (%s) नहीं हैं।',
                $signName($mars), $houses['lagna'], $houses['moon'], $houses['venus'], implode(', ', self::kujaDoshaHouses()));
            return $result;
        }

        // ---- Cancelling exceptions -------------------------------------------------
        $exceptions = [];
        $add = static function (array &$list, string $code, string $en, string $ta, string $hi): void {
            $list[] = ['code' => $code, 'en' => $en, 'ta' => $ta, 'hi' => $hi];
        };
        if (in_array($mars, [1, 8], true)) {
            $add($exceptions, 'OWN_SIGN',
                "Mars is in its own sign {$signName($mars)} (Swakshetra); Sevvay Dosha does not apply.",
                "செவ்வாய் தனது ஆட்சி வீடான {$signNameTa($mars)} ராசியில் உள்ளதால் செவ்வாய் தோஷம் இல்லை.",
                "मंगल अपनी स्वराशि {$signName($mars)} में है; मंगल दोष लागू नहीं होता।");
        }
        if ($mars === 10) {
            $add($exceptions, 'EXALTED',
                'Mars is exalted in Magaram (Capricorn); an exalted Mars does not give Sevvay Dosha.',
                'செவ்வாய் மகர ராசியில் உச்சம் பெற்றுள்ளதால் செவ்வாய் தோஷம் இல்லை.',
                'मंगल मकर राशि में उच्च का है; उच्च मंगल से मंगल दोष नहीं होता।');
        }
        if (in_array($mars, self::KUJA_UNIVERSAL_SIGN_EXCEPTIONS, true)) {
            $add($exceptions, 'LEO_AQUARIUS',
                "Mars in {$signName($mars)} is exempt from Sevvay Dosha in every dosha house (Simha/Kumbha exception).",
                "{$signNameTa($mars)} ராசியில் உள்ள செவ்வாய்க்கு எந்த தோஷ ஸ்தானத்திலும் தோஷம் இல்லை (சிம்ம/கும்ப விலக்கு).",
                "{$signName($mars)} राशि का मंगल किसी भी दोष भाव में मंगल दोष नहीं देता (सिंह/कुंभ अपवाद)।");
        }
        // House-sign exceptions neutralise only the reference point whose
        // count they match; the dosha is cancelled on this ground only when
        // every afflicted reference is covered.
        $houseSignExceptions = [];
        $neutralisedBySign = [];
        foreach ($afflictedFrom as $reference) {
            $house = $houses[$reference];
            if (in_array($mars, self::KUJA_HOUSE_SIGN_EXCEPTIONS[$house] ?? [], true)) {
                $neutralisedBySign[] = $reference;
                $houseSignExceptions[] = ['reference' => $reference, 'house' => $house];
            }
        }
        $remaining = array_values(array_diff($afflictedFrom, $neutralisedBySign));
        if ($houseSignExceptions && !$remaining) {
            $en = []; $ta = []; $hi = [];
            foreach ($houseSignExceptions as $item) {
                $en[] = sprintf('the %s house from %s', self::ordinalEn($item['house']), $referenceFromEn[$item['reference']]);
                $ta[] = sprintf('%s-இலிருந்து %d-ஆம் இடம்', $referenceTa[$item['reference']], $item['house']);
                $hi[] = sprintf('%s से %dवां भाव', $referenceHi[$item['reference']], $item['house']);
            }
            $add($exceptions, 'HOUSE_SIGN',
                sprintf('Mars in %s in %s is a classical house-sign exception (Sevvay Dosha Vilakku), so the dosha does not apply.', $signName($mars), implode(' and ', $en)),
                sprintf('%s ராசியில் உள்ள செவ்வாய்க்கு %s ஆகிய இடங்களுக்கான சாஸ்திர விலக்கு உண்டு; எனவே தோஷம் இல்லை.', $signNameTa($mars), implode(', ', $ta)),
                sprintf('%s राशि का मंगल %s के लिए शास्त्रीय भाव-राशि अपवाद में आता है; अतः दोष लागू नहीं होता।', $signName($mars), implode(' एवं ', $hi)));
        }
        if (in_array($lagna, [4, 5], true) && in_array($houses['lagna'], self::kujaDoshaHouses(), true)) {
            $add($exceptions, 'YOGAKARAKA_LAGNA',
                "For a {$signName($lagna)} Lagna Mars is the Yogakaraka; its placement does not create Sevvay Dosha.",
                "{$signNameTa($lagna)} லக்னத்திற்கு செவ்வாய் யோககாரகர்; அவரது நிலை செவ்வாய் தோஷத்தை உண்டாக்காது.",
                "{$signName($lagna)} लग्न के लिए मंगल योगकारक है; उसकी स्थिति से मंगल दोष नहीं बनता।");
        }
        if ($jupiter === $mars) {
            $add($exceptions, 'GURU_MANGALA',
                'Jupiter is conjunct Mars (Guru-Mangala Yoga); this classical Dosha Nivrutti rule relieves the dosha.',
                'குரு செவ்வாயுடன் இணைந்துள்ளார் (குரு-மங்கள யோகம்); இந்த சாஸ்திர தோஷ நிவர்த்தி விதி தோஷத்தைத் தணிக்கிறது.',
                'गुरु मंगल के साथ युति में है (गुरु-मंगल योग); यह शास्त्रीय दोष निवृत्ति नियम दोष को शमित करता है।');
        }
        if ($moon === $mars) {
            $add($exceptions, 'CHANDRA_MANGALA',
                'The Moon is conjunct Mars (Chandra-Mangala / Kuja-Chandra Yoga); this classical rule relieves the dosha.',
                'சந்திரன் செவ்வாயுடன் இணைந்துள்ளார் (சந்திர-மங்கள யோகம்); இந்த சாஸ்திர விதி தோஷத்தைத் தணிக்கிறது.',
                'चंद्र मंगल के साथ युति में है (चंद्र-मंगल योग); यह शास्त्रीय नियम दोष को शमित करता है।');
        }
        $guruAspectCount = (($mars - $jupiter + 12) % 12) + 1;
        if ($jupiter !== $mars && in_array($guruAspectCount, [5, 7, 9], true)) {
            $add($exceptions, 'GURU_DRISHTI',
                sprintf('Jupiter aspects Mars with its %s-house aspect (Guru Drishti); the benefic aspect relieves Sevvay Dosha.', self::ordinalEn($guruAspectCount)),
                sprintf('குரு தனது %d-ஆம் பார்வையால் செவ்வாயைப் பார்க்கிறார்; குரு பார்வை தோஷத்தைத் தணிக்கிறது.', $guruAspectCount),
                sprintf('गुरु अपनी %dवीं दृष्टि से मंगल को देखता है; गुरु दृष्टि दोष को शमित करती है।', $guruAspectCount));
        }

        // ---- Mitigating conditions (evaluated on the references still afflicted) ----
        $mitigations = [];
        if ($remaining && $houseSignExceptions) {
            $covered = implode(' and ', array_map(static fn($i) => sprintf('the %s house from %s', self::ordinalEn($i['house']), $referenceFromEn[$i['reference']]), $houseSignExceptions));
            $add($mitigations, 'HOUSE_SIGN_PARTIAL',
                sprintf('Mars in %s in %s is a classical house-sign exception, so that count does not add to the dosha.', $signName($mars), $covered),
                sprintf('%s ராசியில் உள்ள செவ்வாய்க்கு %s-இலிருந்து ஆன எண்ணிக்கைக்கு சாஸ்திர விலக்கு உண்டு.', $signNameTa($mars), implode(', ', array_map(static fn($i) => $referenceTa[$i['reference']], $houseSignExceptions))),
                sprintf('%s राशि का मंगल %s से गिनती में शास्त्रीय अपवाद में आता है।', $signName($mars), implode(' एवं ', array_map(static fn($i) => $referenceHi[$i['reference']], $houseSignExceptions))));
        }
        if ($remaining && !in_array('lagna', $remaining, true)) {
            $only = implode(' and ', array_map(static fn($r) => $referenceFromEn[$r], $remaining));
            $onlyTa = implode(' மற்றும் ', array_map(static fn($r) => $referenceTa[$r], $remaining));
            $onlyHi = implode(' एवं ', array_map(static fn($r) => $referenceHi[$r], $remaining));
            $add($mitigations, 'NOT_FROM_LAGNA',
                "The dosha arises only from {$only}, not from the Lagna, so it is considered mild.",
                "{$onlyTa} அடிப்படையில் மட்டுமே தோஷம்; லக்னத்திலிருந்து இல்லை - எனவே மிதமானது.",
                "दोष केवल {$onlyHi} से बनता है, लग्न से नहीं; अतः यह अल्प माना जाता है।");
        }
        $balancers = [];
        foreach (['saturn' => $saturn, 'rahu' => $rahu, 'ketu' => $ketu] as $graha => $grahaRasi) {
            if ($grahaRasi !== null && in_array((($grahaRasi - $lagna + 12) % 12) + 1, self::kujaDoshaHouses(), true)) $balancers[] = $graha;
        }
        if ($balancers) {
            $namesEn = ['saturn' => 'Saturn', 'rahu' => 'Rahu', 'ketu' => 'Ketu'];
            $namesTa = ['saturn' => 'சனி', 'rahu' => 'ராகு', 'ketu' => 'கேது'];
            $namesHi = ['saturn' => 'शनि', 'rahu' => 'राहु', 'ketu' => 'केतु'];
            $add($mitigations, 'SATURN_NODE_BALANCE',
                implode(', ', array_map(static fn($g) => $namesEn[$g], $balancers)) . ' also occupies a Kuja house from the Lagna, which reduces the intensity of the dosha (in-chart balance).',
                implode(', ', array_map(static fn($g) => $namesTa[$g], $balancers)) . ' லக்னத்திலிருந்து தோஷ ஸ்தானத்தில் இருப்பதால் தோஷத்தின் தீவிரம் குறைகிறது.',
                implode(', ', array_map(static fn($g) => $namesHi[$g], $balancers)) . ' भी लग्न से मंगल दोष भाव में है, जिससे दोष की तीव्रता घटती है।');
        }

        $cancelled = count($exceptions) > 0;
        $result['exceptions'] = $exceptions;
        $result['mitigations'] = $cancelled ? [] : $mitigations; // moot once cancelled
        $mild = !$cancelled && count($mitigations) > 0;
        $result['cancelled'] = $cancelled;
        $result['mild'] = $mild;
        $result['isPresent'] = !$cancelled; // DOSHA_MILD still counts as present (reduced)

        $placementEn = sprintf('Mars in %s is in the %s house from the Lagna, the %s from the Moon and the %s from Venus (dosha from: %s).',
            $signName($mars), self::ordinalEn($houses['lagna']), self::ordinalEn($houses['moon']), self::ordinalEn($houses['venus']),
            implode(', ', array_map(static fn($r) => $referenceEn[$r], $afflictedFrom)));
        $placementTa = sprintf('%s ராசியில் உள்ள செவ்வாய் லக்னத்திலிருந்து %d, சந்திரனிலிருந்து %d, சுக்கிரனிலிருந்து %d-ஆம் இடத்தில் உள்ளார் (தோஷம்: %s).',
            $signNameTa($mars), $houses['lagna'], $houses['moon'], $houses['venus'],
            implode(', ', array_map(static fn($r) => $referenceTa[$r], $afflictedFrom)));
        $placementHi = sprintf('%s राशि का मंगल लग्न से %dवें, चंद्र से %dवें तथा शुक्र से %dवें भाव में है (दोष: %s से)।',
            $signName($mars), $houses['lagna'], $houses['moon'], $houses['venus'],
            implode(', ', array_map(static fn($r) => $referenceHi[$r], $afflictedFrom)));
        $join = static fn(array $items, string $key): string => implode(' ', array_column($items, $key));

        if ($cancelled) {
            $result['status'] = 'DOSHA_CANCELLED';
            // A cancelled indication is not an active dosha. Keep the
            // exception in the detailed explanation, while the summary uses
            // the same effective result as `isPresent`.
            $result['severityEn'] = 'No active Sevvay Dosha (Dosha Nivrutti applies)';
            $result['severityTa'] = 'தோஷம் இல்லை (தோஷ நிவர்த்தி விதி பொருந்துகிறது)';
            $result['severityHi'] = 'मंगल दोष नहीं (दोष निवृत्ति नियम लागू)';
            $result['explanationEn'] = $placementEn . ' ' . $join($exceptions, 'en') . ' Under Dosha Nivrutti this count is relieved for marriage matching; this is an indicator only and guarantees no particular outcome.';
            $result['explanationTa'] = $placementTa . ' ' . $join($exceptions, 'ta') . ' திருமணப் பொருத்தத்தில் தோஷ நிவர்த்தி விதியால் இது தணிக்கப்படுகிறது; இது குறியீடு மட்டுமே, உறுதியான பலனை உறுதி செய்யாது.';
            $result['explanationHi'] = $placementHi . ' ' . $join($exceptions, 'hi') . ' विवाह मिलान में दोष निवृत्ति नियम से इसे शमित माना जाता है; यह केवल संकेत है, किसी निश्चित परिणाम की गारंटी नहीं।';
        } elseif ($mild) {
            $result['status'] = 'DOSHA_MILD';
            $result['severityEn'] = 'Mild Sevvay Dosha (reduced by classical rules)';
            $result['severityTa'] = 'மிதமான செவ்வாய் தோஷம் (சாஸ்திர விதிகளால் குறைக்கப்பட்டது)';
            $result['severityHi'] = 'अल्प मंगल दोष (शास्त्रीय नियमों से न्यून)';
            $result['explanationEn'] = $placementEn . ' ' . $join($mitigations, 'en') . ' Simple remedies and a compatible partner chart are sufficient; it is not a severe dosha.';
            $result['explanationTa'] = $placementTa . ' ' . $join($mitigations, 'ta') . ' எளிய பரிகாரங்களும் பொருத்தமான ஜாதகமும் போதுமானவை; இது கடுமையான தோஷம் அல்ல.';
            $result['explanationHi'] = $placementHi . ' ' . $join($mitigations, 'hi') . ' सरल उपाय एवं अनुकूल कुंडली मिलान पर्याप्त है; यह गंभीर दोष नहीं है।';
        } else {
            $result['status'] = 'DOSHA_PRESENT';
            $result['severityEn'] = 'Sevvay Dosha Present (remedies & Dosha Samyam match advised)';
            $result['severityTa'] = 'செவ்வாய் தோஷம் உள்ளது (பரிகாரம் மற்றும் தோஷ சம்யப் பொருத்தம் நலம்)';
            $result['severityHi'] = 'मंगल दोष उपस्थित (उपाय एवं दोष साम्य मिलान आवश्यक)';
            $result['explanationEn'] = $placementEn . ' No classical Dosha Nivrutti rule (own/exalted sign, Leo/Aquarius, house-sign exception, Jupiter or Moon association) applies. Traditional remedies and a partner with matching Sevvay Dosha are advised.';
            $result['explanationTa'] = $placementTa . ' ஆட்சி/உச்சம், சிம்ம/கும்பம், இட-ராசி விலக்கு, குரு அல்லது சந்திர சேர்க்கை போன்ற எந்த தோஷ நிவர்த்தி விதியும் பொருந்தவில்லை. பரிகாரங்களும் செவ்வாய் தோஷம் உள்ள ஜாதகப் பொருத்தமும் நலம்.';
            $result['explanationHi'] = $placementHi . ' स्वराशि/उच्च, सिंह/कुंभ, भाव-राशि अपवाद, गुरु अथवा चंद्र युति जैसा कोई अपवाद लागू नहीं है। पारंपरिक उपाय तथा मंगल दोष वाले साथी से मिलान की सलाह है।';
        }
        return $result;
    }

    private static function ordinalEn(int $n): string {
        if ($n % 100 >= 11 && $n % 100 <= 13) return $n . 'th';
        return $n . (['th', 'st', 'nd', 'rd'][$n % 10] ?? 'th');
    }

    private static function calculatePoruthams($boyNakIdx, $boyRasiIdx, $girlNakIdx, $girlRasiIdx, $boyLord, $girlLord) {
        $results = [];

        $dinaCount = (($boyNakIdx - $girlNakIdx + 27) % 27) + 1;
        $dinaRem = $dinaCount % 9;
        $dinaGood = in_array($dinaRem, [2, 4, 6, 8, 0], true) || ($boyNakIdx === $girlNakIdx && in_array($girlNakIdx, [3, 5, 9, 15, 21, 25, 26], true));
        $results['dina'] = ['pts' => $dinaGood ? 3 : 0, 'max' => 3, 'pass' => $dinaGood];

        $bg = self::$NAK_GANA[$boyNakIdx]; $gg = self::$NAK_GANA[$girlNakIdx];
        $ganaPts = ($bg === $gg) ? 6 : (($bg === 0 && $gg === 2) || ($bg === 2 && $gg === 0) ? 0 : 5);
        $results['gana'] = ['pts' => round($ganaPts * 4 / 6, 1), 'max' => 4, 'pass' => $ganaPts >= 5];

        $mahendraCount = (($boyNakIdx - $girlNakIdx + 27) % 27) + 1;
        // Traditional favorable counts are 4, 7, 10, 13, 16, 19, 22, and 25
        // from the bride's Nakshatra to the groom's. Count 1 (same star) is
        // not Mahendra Porutham; a broad modulo check incorrectly included it.
        $mahendraGood = in_array($mahendraCount, [4, 7, 10, 13, 16, 19, 22, 25], true);
        $results['mahendra'] = ['pts' => $mahendraGood ? 3 : 0, 'max' => 3, 'pass' => $mahendraGood];

        $sdGood = $dinaCount >= 7;
        $results['stree_deergha'] = ['pts' => $sdGood ? 2 : 0, 'max' => 2, 'pass' => $sdGood];

        // Nakshatra indexes are passed as groom first, bride second. Keep the
        // report labels tied to those same computed indexes instead of using a
        // generic "neutral or inimical" explanation for every partial result.
        [$groomAnimal, $groomGender] = self::$NAK_YONI[$boyNakIdx];
        [$brideAnimal, $brideGender] = self::$NAK_YONI[$girlNakIdx];
        $isYoniFriend = in_array($brideAnimal, self::$YONI_FRIEND[$groomAnimal] ?? [], true);
        $isYoniEnemy = in_array($brideAnimal, self::$YONI_ENEMY[$groomAnimal] ?? [], true);
        if ($groomAnimal === $brideAnimal) {
            $yoniPts = ($groomGender !== $brideGender) ? 4 : 3;
        } elseif ($isYoniFriend) {
            $yoniPts = 3;
        } elseif ($isYoniEnemy) {
            $yoniPts = 0;
        } else {
            $yoniPts = 2;
        }
        $yoniRelationship = $groomAnimal === $brideAnimal
            ? 'same'
            : ($isYoniEnemy ? 'enemy' : ($isYoniFriend ? 'friend' : 'neutral'));
        $yoniAnimalNames = [
            'horse' => ['en' => 'Horse', 'ta' => 'குதிரை', 'hi' => 'घोड़ा'],
            'elephant' => ['en' => 'Elephant', 'ta' => 'யானை', 'hi' => 'हाथी'],
            'goat' => ['en' => 'Goat', 'ta' => 'ஆடு', 'hi' => 'बकरी'],
            'serpent' => ['en' => 'Serpent', 'ta' => 'பாம்பு', 'hi' => 'सर्प'],
            'dog' => ['en' => 'Dog', 'ta' => 'நாய்', 'hi' => 'कुत्ता'],
            'cat' => ['en' => 'Cat', 'ta' => 'பூனை', 'hi' => 'बिल्ली'],
            'rat' => ['en' => 'Rat', 'ta' => 'எலி', 'hi' => 'चूहा'],
            'cow' => ['en' => 'Cow', 'ta' => 'பசு', 'hi' => 'गाय'],
            'buffalo' => ['en' => 'Buffalo', 'ta' => 'எருமை', 'hi' => 'भैंस'],
            'tiger' => ['en' => 'Tiger', 'ta' => 'புலி', 'hi' => 'बाघ'],
            'deer' => ['en' => 'Deer', 'ta' => 'மான்', 'hi' => 'हिरण'],
            'monkey' => ['en' => 'Monkey', 'ta' => 'குரங்கு', 'hi' => 'बंदर'],
            'mongoose' => ['en' => 'Mongoose', 'ta' => 'கீரி', 'hi' => 'नेवला'],
            'lion' => ['en' => 'Lion', 'ta' => 'சிங்கம்', 'hi' => 'सिंह'],
        ];
        $yoniRelationshipText = [
            'same' => ['en' => 'same yoni', 'ta' => 'ஒரே யோனி', 'hi' => 'समान योनि'],
            'friend' => ['en' => 'friendly', 'ta' => 'நட்பு', 'hi' => 'मैत्रीपूर्ण'],
            'neutral' => ['en' => 'neutral', 'ta' => 'நடுநிலை', 'hi' => 'तटस्थ'],
            'enemy' => ['en' => 'enmity', 'ta' => 'பகை', 'hi' => 'शत्रुता'],
        ][$yoniRelationship];
        $brideYoniNames = $yoniAnimalNames[$brideAnimal];
        $groomYoniNames = $yoniAnimalNames[$groomAnimal];
        $results['yoni'] = [
            'pts' => $yoniPts,
            'max' => 4,
            'pass' => $yoniPts >= 2,
            'yoniRelationship' => $yoniRelationship,
            'yoniRelationshipEn' => $yoniRelationshipText['en'],
            'yoniRelationshipTa' => $yoniRelationshipText['ta'],
            'yoniRelationshipHi' => $yoniRelationshipText['hi'],
            'yoniBrideAnimalEn' => $brideYoniNames['en'],
            'yoniBrideAnimalTa' => $brideYoniNames['ta'],
            'yoniBrideAnimalHi' => $brideYoniNames['hi'],
            'yoniGroomAnimalEn' => $groomYoniNames['en'],
            'yoniGroomAnimalTa' => $groomYoniNames['ta'],
            'yoniGroomAnimalHi' => $groomYoniNames['hi'],
            'explanationEn' => 'Bride: ' . $brideYoniNames['en'] . '; Groom: ' . $groomYoniNames['en'] . '. Yoni relationship: ' . $yoniRelationshipText['en'] . '.',
            'explanationTa' => 'மணமகள்: ' . $brideYoniNames['ta'] . '; மணமகன்: ' . $groomYoniNames['ta'] . '. யோனி உறவு: ' . $yoniRelationshipText['ta'] . '.',
            'explanationHi' => 'वधू: ' . $brideYoniNames['hi'] . '; वर: ' . $groomYoniNames['hi'] . '। योनि संबंध: ' . $yoniRelationshipText['hi'] . '।',
        ];

        $rasiDiff = (($girlRasiIdx - $boyRasiIdx + 12) % 12) + 1;
        $rasiBad = in_array($rasiDiff, [2, 5, 6, 8, 9, 12], true);
        $lordsFriendly = self::planetFriendship($boyLord, $girlLord) === 'friend' && self::planetFriendship($girlLord, $boyLord) === 'friend';
        $rasiGood = (!$rasiBad) || $lordsFriendly;
        $results['rasi'] = ['pts' => $rasiGood ? 5 : 0, 'max' => 5, 'pass' => $rasiGood];

        $gmScore = self::grahaMaitriScore($boyLord, $girlLord);
        $results['rasiyadhipathi'] = ['pts' => round($gmScore * 4 / 5, 1), 'max' => 4, 'pass' => $gmScore >= 3];

        $vasyaGood = self::$VASYA_GROUP[$boyRasiIdx] === self::$VASYA_GROUP[$girlRasiIdx];
        $results['vasiya'] = ['pts' => $vasyaGood ? 2 : 0, 'max' => 2, 'pass' => $vasyaGood];

        $boyGroup = self::rajjuTable()['groups'][$boyNakIdx];
        $girlGroup = self::rajjuTable()['groups'][$girlNakIdx];
        $rajjuGood = ($boyGroup !== $girlGroup);
        $results['rajju'] = ['pts' => $rajjuGood ? 5 : 0, 'max' => 5, 'pass' => $rajjuGood, 'crucial' => true];

        $vedhaHit = (self::$VEDHA_PAIR[$boyNakIdx] === $girlNakIdx);
        $results['vedha'] = ['pts' => $vedhaHit ? 0 : 3, 'max' => 3, 'pass' => !$vedhaHit, 'crucial' => true];

        return $results;
    }


    
    public static $NAKSHATRAS_EN = [
        'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha', 'Arudra',
        'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
        'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
        'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
        'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
    ];

    public static $NAKSHATRAS_TA = [
        'அஸ்வினி', 'பரணி', 'கிருத்திகை', 'ரோகிணி', 'மிருகசீரிடம்', 'திருவாதிரை',
        'புனர்பூசம்', 'பூசம்', 'ஆயில்யம்', 'மகம்', 'பூரம்', 'உத்திரம்',
        'அஸ்தம்', 'சித்திரை', 'சுவாதி', 'விசாகம்', 'அனுஷம்', 'கேட்டை',
        'மூலம்', 'பூராடம்', 'உத்திராடம்', 'திருவோணம்', 'அவிட்டம்', 'சதயம்',
        'பூரட்டாதி', 'உத்திரட்டாதி', 'ரேவதி'
    ];

    public static $RASIS = [
        ['en' => 'Mesham (Aries)', 'ta' => 'மேஷம்', 'lord' => 'Mars', 'lordTa' => 'செவ்வாய்', 'hi' => 'मेष (Aries)'],
        ['en' => 'Rishabam (Taurus)', 'ta' => 'ரிஷபம்', 'lord' => 'Venus', 'lordTa' => 'சுக்கிரன்', 'hi' => 'वृषभ (Taurus)'],
        ['en' => 'Mithunam (Gemini)', 'ta' => 'மிதுனம்', 'lord' => 'Mercury', 'lordTa' => 'புதன்', 'hi' => 'मिथुन (Gemini)'],
        ['en' => 'Kadagam (Cancer)', 'ta' => 'கடகம்', 'lord' => 'Moon', 'lordTa' => 'சந்திரன்', 'hi' => 'कर्क (Cancer)'],
        ['en' => 'Simham (Leo)', 'ta' => 'சிம்மம்', 'lord' => 'Sun', 'lordTa' => 'சூரியன்', 'hi' => 'सिंह (Leo)'],
        ['en' => 'Kanni (Virgo)', 'ta' => 'கன்னி', 'lord' => 'Mercury', 'lordTa' => 'புதன்', 'hi' => 'कन्या (Virgo)'],
        ['en' => 'Thulam (Libra)', 'ta' => 'துலாம்', 'lord' => 'Venus', 'lordTa' => 'சுக்கிரன்', 'hi' => 'तुला (Libra)'],
        ['en' => 'Viruchigam (Scorpio)', 'ta' => 'விருச்சிகம்', 'lord' => 'Mars', 'lordTa' => 'செவ்வாய்', 'hi' => 'वृश्चिक (Scorpio)'],
        ['en' => 'Dhanusu (Sagittarius)', 'ta' => 'தனுசு', 'lord' => 'Jupiter', 'lordTa' => 'குரு', 'hi' => 'धनु (Sagittarius)'],
        ['en' => 'Magaram (Capricorn)', 'ta' => 'மகரம்', 'lord' => 'Saturn', 'lordTa' => 'சனி', 'hi' => 'मकर (Capricorn)'],
        ['en' => 'Kumbam (Aquarius)', 'ta' => 'கும்பம்', 'lord' => 'Saturn', 'lordTa' => 'சனி', 'hi' => 'कुंभ (Aquarius)'],
        ['en' => 'Meenam (Pisces)', 'ta' => 'மீனம்', 'lord' => 'Jupiter', 'lordTa' => 'குரு', 'hi' => 'मीन (Pisces)']
    ];

    // ------------------------------------------------------------------
    // Items 3/4/6/7 — dignity, Neecha Bhanga, Graha Yuddha, Kendradhipati,
    // yoga notes and the next Mahadasa. Every table below mirrors
    // src/lib/astrology/dignity.ts and the TypeScript engine value-for-value, so a
    // PHP-rendered PDF can never disagree with the browser preview.
    // ------------------------------------------------------------------
    private const DIGNITY_EXALTATION_SIGN = ['sun' => 1, 'moon' => 2, 'mars' => 10, 'mercury' => 6, 'jupiter' => 4, 'venus' => 12, 'saturn' => 7];
    private const DIGNITY_OWN_SIGNS = [
        'sun' => [5], 'moon' => [4], 'mars' => [1, 8], 'mercury' => [3, 6],
        'jupiter' => [9, 12], 'venus' => [2, 7], 'saturn' => [10, 11],
    ];
    private const DIGNITY_SIGN_LORDS = [1 => 'mars', 2 => 'venus', 3 => 'mercury', 4 => 'moon', 5 => 'sun', 6 => 'mercury', 7 => 'venus', 8 => 'mars', 9 => 'jupiter', 10 => 'saturn', 11 => 'saturn', 12 => 'jupiter'];
    private const DIGNITY_SIGN_EXALTED_BY = [1 => 'sun', 2 => 'moon', 4 => 'jupiter', 6 => 'mercury', 7 => 'saturn', 10 => 'mars', 12 => 'venus'];
    private const DIGNITY_GRAHA_TEXT = [
        'sun' => ['en' => 'Sun', 'ta' => 'சூரியன்', 'hi' => 'सूर्य'],
        'moon' => ['en' => 'Moon', 'ta' => 'சந்திரன்', 'hi' => 'चंद्र'],
        'mars' => ['en' => 'Mars', 'ta' => 'செவ்வாய்', 'hi' => 'मंगल'],
        'mercury' => ['en' => 'Mercury', 'ta' => 'புதன்', 'hi' => 'बुध'],
        'jupiter' => ['en' => 'Jupiter', 'ta' => 'குரு', 'hi' => 'गुरु'],
        'venus' => ['en' => 'Venus', 'ta' => 'சுக்கிரன்', 'hi' => 'शुक्र'],
        'saturn' => ['en' => 'Saturn', 'ta' => 'சனி', 'hi' => 'शनि'],
        'rahu' => ['en' => 'Rahu', 'ta' => 'ராகு', 'hi' => 'राहु'],
        'ketu' => ['en' => 'Ketu', 'ta' => 'கேது', 'hi' => 'केतु'],
    ];

    /** Debilitation sign of a graha (exaltation + 6 signs), or null for the nodes. */
    private static function debilitationSign(string $graha): ?int {
        $exalted = self::DIGNITY_EXALTATION_SIGN[$graha] ?? null;
        return $exalted === null ? null : (($exalted - 1 + 6) % 12) + 1;
    }

    /** Whole-sign house number of `target` counted from `reference` (both 1-based). */
    private static function dignityHouseFrom(int $target, int $reference): int {
        return (($target - $reference + 12) % 12) + 1;
    }

    /**
     * Neecha Bhanga for a debilitated graha: the graha exalted in the occupied
     * sign is conjunct it or sits in a kendra (1/4/7/10) from the Lagna or the
     * Moon, OR the dispositor (lord of the occupied sign) sits in such a kendra.
     *
     * Each reason carries a short rule tag, so the report can print
     * "Neecha Bhanga (by Jupiter conjunction)" instead of a flat "cancelled".
     * The Moon is never used as a kendra reference for itself (it is always in
     * the 1st house from the Moon), which would invent a reason on every chart
     * whose dispositor is the Moon (Kadagam).
     */
    private static function evaluateNeechaBhanga(string $graha, int $rasi, int $lagnaRasi, int $moonRasi, array $rasiByGraha): array {
        $reasons = [];
        $exaltationGraha = self::DIGNITY_SIGN_EXALTED_BY[$rasi] ?? null;
        $dispositor = self::DIGNITY_SIGN_LORDS[$rasi] ?? null;
        $debilitatedName = self::DIGNITY_GRAHA_TEXT[$graha] ?? ['en' => $graha, 'ta' => $graha, 'hi' => $graha];
        if ($exaltationGraha !== null) {
            $exaltName = self::DIGNITY_GRAHA_TEXT[$exaltationGraha] ?? ['en' => $exaltationGraha, 'ta' => $exaltationGraha, 'hi' => $exaltationGraha];
            $exaltRasi = $rasiByGraha[$exaltationGraha] ?? null;
            if ($exaltRasi === $rasi) {
                $reasons[] = [
                    'code' => 'EXALTATION_LORD_CONJUNCT',
                    'en' => $exaltName['en'] . ', the graha exalted in this sign, is conjunct the debilitated ' . $debilitatedName['en'] . '.',
                    'ta' => 'இந்த ராசியில் உச்சம் பெறும் ' . $exaltName['ta'] . ' நீச நிலையில் உள்ள ' . $debilitatedName['ta'] . ' உடன் இணைந்துள்ளார்.',
                    'hi' => 'इस राशि में उच्च का ' . $exaltName['hi'] . ' नीच स्थिति वाले ' . $debilitatedName['hi'] . ' के साथ युति में है।',
                    'tagEn' => 'by ' . $exaltName['en'] . ' conjunction',
                    'tagTa' => $exaltName['ta'] . ' சேர்க்கையால்',
                    'tagHi' => $exaltName['hi'] . ' युति के कारण',
                ];
            }
            if ($exaltRasi !== null) {
                $fromLagna = self::dignityHouseFrom($exaltRasi, $lagnaRasi);
                $fromMoon = $exaltationGraha === 'moon' ? 0 : self::dignityHouseFrom($exaltRasi, $moonRasi);
                if (in_array($fromLagna, [1, 4, 7, 10], true)) {
                    $reasons[] = [
                        'code' => 'EXALTATION_LORD_KENDRA_LAGNA',
                        'en' => $exaltName['en'] . ' is in a kendra (' . $fromLagna . ') from the Lagna.',
                        'ta' => 'உச்ச கிரகம் ' . $exaltName['ta'] . ' லக்னத்திலிருந்து ' . $fromLagna . '-ஆம் கேந்திரத்தில் உள்ளார்.',
                        'hi' => $exaltName['hi'] . ' लग्न से ' . $fromLagna . 'वें केंद्र में है।',
                        'tagEn' => 'by ' . $exaltName['en'] . ' in a kendra (' . $fromLagna . ') from the Lagna',
                        'tagTa' => $exaltName['ta'] . ' லக்னத்திலிருந்து ' . $fromLagna . '-ஆம் கேந்திரத்தில் இருப்பதால்',
                        'tagHi' => $exaltName['hi'] . ' लग्न से ' . $fromLagna . 'वें केंद्र में होने के कारण',
                    ];
                }
                if (in_array($fromMoon, [1, 4, 7, 10], true)) {
                    $reasons[] = [
                        'code' => 'EXALTATION_LORD_KENDRA_MOON',
                        'en' => $exaltName['en'] . ' is in a kendra (' . $fromMoon . ') from the Moon.',
                        'ta' => 'உச்ச கிரகம் ' . $exaltName['ta'] . ' சந்திரனிலிருந்து ' . $fromMoon . '-ஆம் கேந்திரத்தில் உள்ளார்.',
                        'hi' => $exaltName['hi'] . ' चंद्र से ' . $fromMoon . 'वें केंद्र में है।',
                        'tagEn' => 'by ' . $exaltName['en'] . ' in a kendra (' . $fromMoon . ') from the Moon',
                        'tagTa' => $exaltName['ta'] . ' சந்திரனிலிருந்து ' . $fromMoon . '-ஆம் கேந்திரத்தில் இருப்பதால்',
                        'tagHi' => $exaltName['hi'] . ' चंद्र से ' . $fromMoon . 'वें केंद्र में होने के कारण',
                    ];
                }
            }
        }
        if ($dispositor !== null && $dispositor !== $graha) {
            $dispositorRasi = $rasiByGraha[$dispositor] ?? null;
            $dispositorName = self::DIGNITY_GRAHA_TEXT[$dispositor] ?? ['en' => $dispositor, 'ta' => $dispositor, 'hi' => $dispositor];
            if ($dispositorRasi !== null) {
                $fromLagna = self::dignityHouseFrom($dispositorRasi, $lagnaRasi);
                $fromMoon = $dispositor === 'moon' ? 0 : self::dignityHouseFrom($dispositorRasi, $moonRasi);
                if (in_array($fromLagna, [1, 4, 7, 10], true)) {
                    $reasons[] = [
                        'code' => 'DISPOSITOR_KENDRA_LAGNA',
                        'en' => 'The dispositor ' . $dispositorName['en'] . ' is in a kendra (' . $fromLagna . ') from the Lagna.',
                        'ta' => 'அதிபதி ' . $dispositorName['ta'] . ' லக்னத்திலிருந்து ' . $fromLagna . '-ஆம் கேந்திரத்தில் உள்ளார்.',
                        'hi' => 'राशीश ' . $dispositorName['hi'] . ' लग्न से ' . $fromLagna . 'वें केंद्र में है।',
                        'tagEn' => 'by dispositor ' . $dispositorName['en'] . ' in a kendra (' . $fromLagna . ') from the Lagna',
                        'tagTa' => 'அதிபதி ' . $dispositorName['ta'] . ' லக்னத்திலிருந்து ' . $fromLagna . '-ஆம் கேந்திரத்தில் இருப்பதால்',
                        'tagHi' => 'राशीश ' . $dispositorName['hi'] . ' लग्न से ' . $fromLagna . 'वें केंद्र में होने के कारण',
                    ];
                }
                if (in_array($fromMoon, [1, 4, 7, 10], true)) {
                    $reasons[] = [
                        'code' => 'DISPOSITOR_KENDRA_MOON',
                        'en' => 'The dispositor ' . $dispositorName['en'] . ' is in a kendra (' . $fromMoon . ') from the Moon.',
                        'ta' => 'அதிபதி ' . $dispositorName['ta'] . ' சந்திரனிலிருந்து ' . $fromMoon . '-ஆம் கேந்திரத்தில் உள்ளார்.',
                        'hi' => 'राशीश ' . $dispositorName['hi'] . ' चंद्र से ' . $fromMoon . 'वें केंद्र में है।',
                        'tagEn' => 'by dispositor ' . $dispositorName['en'] . ' in a kendra (' . $fromMoon . ') from the Moon',
                        'tagTa' => 'அதிபதி ' . $dispositorName['ta'] . ' சந்திரனிலிருந்து ' . $fromMoon . '-ஆம் கேந்திரத்தில் இருப்பதால்',
                        'tagHi' => 'राशीश ' . $dispositorName['hi'] . ' चंद्र से ' . $fromMoon . 'वें केंद्र में होने के कारण',
                    ];
                }
            }
        }
        $isCancelled = count($reasons) > 0;
        if (!$isCancelled) {
            return ['isCancelled' => false, 'reasons' => [], 'tagEn' => '', 'tagTa' => '', 'tagHi' => '', 'en' => '', 'ta' => '', 'hi' => ''];
        }
        // Heading only — the rule is always named next to it. Never a flat
        // "cancelled" and never a promise that the debilitation is erased.
        $heading = ['en' => 'Neecha Bhanga', 'ta' => 'நீச பங்க', 'hi' => 'नीच भंग'];
        $caveat = [
            'en' => 'This rule reduces the effect of the debilitation; it does not erase it, and no particular result is guaranteed.',
            'ta' => 'இந்த விதி நீச நிலையின் விளைவைத் தணிக்கிறது; அதை முழுமையாக நீக்குவதுமில்லை, உறுதியான பலனை உறுதி செய்வதுமில்லை.',
            'hi' => 'यह नियम नीच स्थिति के प्रभाव को कम करता है; उसे मिटाता नहीं और किसी निश्चित परिणाम की गारंटी नहीं देता।',
        ];
        $tagEn = implode('; ', array_column($reasons, 'tagEn'));
        $tagTa = implode('; ', array_column($reasons, 'tagTa'));
        $tagHi = implode('; ', array_column($reasons, 'tagHi'));
        return [
            'isCancelled' => true,
            'reasons' => $reasons,
            'tagEn' => $tagEn,
            'tagTa' => $tagTa,
            'tagHi' => $tagHi,
            'en' => $heading['en'] . ' (' . $tagEn . '): ' . implode(' ', array_column($reasons, 'en')) . ' ' . $caveat['en'],
            'ta' => $heading['ta'] . ' (' . $tagTa . '): ' . implode(' ', array_column($reasons, 'ta')) . ' ' . $caveat['ta'],
            'hi' => $heading['hi'] . ' (' . $tagHi . '): ' . implode(' ', array_column($reasons, 'hi')) . ' ' . $caveat['hi'],
        ];
    }

    /** Exalted / own / debilitated / combust / retrograde + Neecha Bhanga. */
    private static function computePlanetDignity(string $graha, int $rasi, bool $isCombust, bool $isRetrograde, int $lagnaRasi, int $moonRasi, array $rasiByGraha): array {
        $exalted = (self::DIGNITY_EXALTATION_SIGN[$graha] ?? null) === $rasi;
        $own = in_array($rasi, self::DIGNITY_OWN_SIGNS[$graha] ?? [], true);
        $debilitated = self::debilitationSign($graha) === $rasi;
        $isNode = $graha === 'rahu' || $graha === 'ketu';
        $status = 'neutral';
        if ($isNode) {
            $status = 'not-applicable';
        } elseif ($exalted) {
            $status = 'exalted';
        } elseif ($own) {
            $status = 'own';
        } elseif ($debilitated) {
            $status = 'debilitated';
        }
        $statusTexts = [
            'exalted' => ['en' => 'Exalted (Uchcha)', 'ta' => 'உச்சம் (உச்ச நிலை)', 'hi' => 'उच्च (उच्च स्थान)'],
            'own' => ['en' => 'Own sign (Swakshetra)', 'ta' => 'ஆட்சி (சுய ராசி)', 'hi' => 'स्वराशि (स्वक्षेत्र)'],
            'debilitated' => ['en' => 'Debilitated (Neecha)', 'ta' => 'நீசம் (நீச நிலை)', 'hi' => 'नीच (नीच स्थान)'],
            'neutral' => ['en' => 'Neutral', 'ta' => 'சம நிலை', 'hi' => 'सामान्य स्थिति'],
            'not-applicable' => ['en' => 'No classical sign dignity (node)', 'ta' => 'சிறப்பு நிலை இல்லை (சாயா கிரகம்)', 'hi' => 'शास्त्रीय राशि-स्थिति नहीं (छाया ग्रह)'],
        ];
        $statusText = $statusTexts[$status];
        $combustText = ['en' => 'Combust (Astangata)', 'ta' => 'அஸ்தமனம் (சூரியனுக்கு அருகில்)', 'hi' => 'अस्त (सूर्य के निकट)'];
        $retroText = ['en' => 'Retrograde (Vakri)', 'ta' => 'வக்கிரம்', 'hi' => 'वक्री'];
        // Heading only — the tag always names the rule that applies, e.g.
        // "Neecha Bhanga (by Jupiter conjunction)". Never a flat "cancelled".
        $neechaText = ['en' => 'Neecha Bhanga', 'ta' => 'நீச பங்க', 'hi' => 'नीच भंग'];
        $neecha = $debilitated
            ? self::evaluateNeechaBhanga($graha, $rasi, $lagnaRasi, $moonRasi, $rasiByGraha)
            : ['isCancelled' => false, 'reasons' => [], 'tagEn' => '', 'tagTa' => '', 'tagHi' => '', 'en' => '', 'ta' => '', 'hi' => ''];
        $tags = [];
        foreach (['en', 'ta', 'hi'] as $lang) {
            $parts = [$statusText[$lang]];
            if ($isCombust) { $parts[] = $combustText[$lang]; }
            if ($isRetrograde) { $parts[] = $retroText[$lang]; }
            if ($neecha['isCancelled']) {
                $tag = $lang === 'ta' ? $neecha['tagTa'] : ($lang === 'hi' ? $neecha['tagHi'] : $neecha['tagEn']);
                $parts[] = $neechaText[$lang] . ' (' . $tag . ')';
            }
            $tags[$lang] = implode(', ', array_filter($parts, static function ($part) { return $part !== ''; }));
        }
        return [
            'graha' => $graha,
            'status' => $status,
            'statusEn' => $statusText['en'], 'statusTa' => $statusText['ta'], 'statusHi' => $statusText['hi'],
            'isExalted' => $exalted, 'isOwnSign' => $own, 'isDebilitated' => $debilitated,
            'isCombust' => $isCombust, 'isRetrograde' => $isRetrograde,
            'isNeechaBhanga' => $neecha['isCancelled'],
            'neechaBhangaEn' => $neecha['en'], 'neechaBhangaTa' => $neecha['ta'], 'neechaBhangaHi' => $neecha['hi'],
            'neechaBhangaTagEn' => $neecha['tagEn'], 'neechaBhangaTagTa' => $neecha['tagTa'], 'neechaBhangaTagHi' => $neecha['tagHi'],
            'neechaBhangaReasons' => array_column($neecha['reasons'], 'code'),
            'tagsEn' => $tags['en'], 'tagsTa' => $tags['ta'], 'tagsHi' => $tags['hi'],
        ];
    }

    /**
     * One-line dignity summary for report cards — mirror of dignityCardLine()
     * in src/lib/astrology/dignity.ts. When Neecha Bhanga applies the line names
     * the rule that caused it and carries the "reduces, does not erase"
     * caveat; '' means there is nothing to say.
     */
    private static function dignityCardLine(array $dignity, string $lang): string {
        if ($dignity === []) { return ''; }
        $status = (string) ($lang === 'ta' ? ($dignity['statusTa'] ?? '') : ($lang === 'hi' ? ($dignity['statusHi'] ?? '') : ($dignity['statusEn'] ?? '')));
        $tags = (string) ($lang === 'ta' ? ($dignity['tagsTa'] ?? '') : ($lang === 'hi' ? ($dignity['tagsHi'] ?? '') : ($dignity['tagsEn'] ?? '')));
        $note = (string) ($lang === 'ta' ? ($dignity['neechaBhangaTa'] ?? '') : ($lang === 'hi' ? ($dignity['neechaBhangaHi'] ?? '') : ($dignity['neechaBhangaEn'] ?? '')));
        $isNeecha = !empty($dignity['isNeechaBhanga']);
        $isCombust = !empty($dignity['isCombust']);
        $statusKey = (string) ($dignity['status'] ?? 'neutral');
        if ($statusKey === 'neutral' && !$isNeecha && !$isCombust) { return ''; }
        return ($isNeecha && $note !== '') ? ($status !== '' ? $status . '. ' : '') . $note : $tags;
    }

    /**
     * Graha Yuddha (item 7a): two of Mars, Mercury, Jupiter, Venus or Saturn in
     * the same rasi within 1°; the northern (greater) ecliptic latitude wins.
     */
    private static function grahaYuddhaPairs(array $siderealByGraha, array $latitudes, array $rasiByGraha): array {
        $pairs = [];
        $warlike = ['mars', 'mercury', 'jupiter', 'venus', 'saturn'];
        for ($i = 0; $i < count($warlike); $i += 1) {
            for ($k = $i + 1; $k < count($warlike); $k += 1) {
                $planetA = $warlike[$i];
                $planetB = $warlike[$k];
                if (($rasiByGraha[$planetA] ?? null) !== ($rasiByGraha[$planetB] ?? null)) { continue; }
                $separation = abs(self::angleDelta($siderealByGraha[$planetA], $siderealByGraha[$planetB]));
                if ($separation >= 1.0) { continue; }
                $latitudeA = (float) ($latitudes[$planetA] ?? 0.0);
                $latitudeB = (float) ($latitudes[$planetB] ?? 0.0);
                $winner = $latitudeA >= $latitudeB ? $planetA : $planetB;
                $loser = $winner === $planetA ? $planetB : $planetA;
                $winnerLatitude = $winner === $planetA ? $latitudeA : $latitudeB;
                $loserLatitude = $winner === $planetA ? $latitudeB : $latitudeA;
                $sign = self::$RASIS[($rasiByGraha[$planetA] ?? 1) - 1];
                $sepText = number_format($separation, 2, '.', '');
                $nameA = self::DIGNITY_GRAHA_TEXT[$planetA];
                $nameB = self::DIGNITY_GRAHA_TEXT[$planetB];
                $nameW = self::DIGNITY_GRAHA_TEXT[$winner];
                $nameL = self::DIGNITY_GRAHA_TEXT[$loser];
                $pairs[] = [
                    'planetA' => $planetA, 'planetB' => $planetB,
                    'planetANameEn' => $nameA['en'], 'planetANameTa' => $nameA['ta'], 'planetANameHi' => $nameA['hi'],
                    'planetBNameEn' => $nameB['en'], 'planetBNameTa' => $nameB['ta'], 'planetBNameHi' => $nameB['hi'],
                    'separationDegrees' => round($separation, 3),
                    'winner' => $winner, 'loser' => $loser,
                    'winnerNameEn' => $nameW['en'], 'winnerNameTa' => $nameW['ta'], 'winnerNameHi' => $nameW['hi'],
                    'loserNameEn' => $nameL['en'], 'loserNameTa' => $nameL['ta'], 'loserNameHi' => $nameL['hi'],
                    'winnerLatitude' => round($winnerLatitude, 4), 'loserLatitude' => round($loserLatitude, 4),
                    'descriptionEn' => $nameA['en'] . ' and ' . $nameB['en'] . ' are ' . $sepText . '° apart in ' . $sign['en'] . ' — Graha Yuddha. Decided by ecliptic latitude (north wins): ' . $nameW['en'] . ' (' . ($winnerLatitude >= 0 ? '+' : '') . number_format($winnerLatitude, 3, '.', '') . '°) defeats ' . $nameL['en'] . ' (' . number_format($loserLatitude, 3, '.', '') . '°).',
                    'descriptionTa' => $sign['ta'] . ' ராசியில் ' . $nameA['ta'] . '–' . $nameB['ta'] . ' இடையே ' . $sepText . '° இடைவெளி — கிரக யுத்தம். வடக்கு அகலாங்கு (ecliptic latitude) விதிப்படி ' . $nameW['ta'] . ' (' . number_format($winnerLatitude, 3, '.', '') . '°) ' . $nameL['ta'] . '-ஐ (' . number_format($loserLatitude, 3, '.', '') . '°) வெல்கிறார்.',
                    'descriptionHi' => ($sign['hi'] ?? $sign['en']) . ' राशि में ' . $nameA['hi'] . '–' . $nameB['hi'] . ' के बीच ' . $sepText . '° — ग्रह युद्ध। उत्तर दिशा के अक्षांश (ecliptic latitude) के नियम से ' . $nameW['hi'] . ' (' . number_format($winnerLatitude, 3, '.', '') . '°) ने ' . $nameL['hi'] . ' (' . number_format($loserLatitude, 3, '.', '') . '°) को पराजित किया।',
                ];
            }
        }
        return $pairs;
    }

    /** Kendradhipati (item 7b): Jupiter or Mercury owning two kendras. */
    private static function kendradhipatiDosha(int $lagnaRasi): array {
        $kendraSignNumbers = [];
        foreach ([1, 4, 7, 10] as $offset) {
            $kendraSignNumbers[] = (($lagnaRasi - 1 + ($offset - 1)) % 12) + 1;
        }
        $entries = [];
        $ordinal = static function (int $n): string {
            if ($n % 100 >= 11 && $n % 100 <= 13) { return $n . 'th'; }
            $suffix = ['th', 'st', 'nd', 'rd'][$n % 10] ?? 'th';
            return $n . $suffix;
        };
        foreach (['jupiter', 'mercury'] as $graha) {
            $ownedSigns = [];
            foreach ($kendraSignNumbers as $sign) {
                if ((self::DIGNITY_SIGN_LORDS[$sign] ?? null) === $graha) { $ownedSigns[] = $sign; }
            }
            if (count($ownedSigns) < 2) { continue; }
            $houses = [];
            foreach ($ownedSigns as $sign) { $houses[] = self::dignityHouseFrom($sign, $lagnaRasi); }
            sort($houses);
            $appliesToLagnaLord = in_array(1, $houses, true);
            $names = self::DIGNITY_GRAHA_TEXT[$graha];
            $houseListEn = implode(' and ', array_map($ordinal, $houses));
            $signListEn = implode(', ', array_map(static function ($sign) { return self::$RASIS[$sign - 1]['en']; }, $ownedSigns));
            $signListTa = implode(', ', array_map(static function ($sign) { return self::$RASIS[$sign - 1]['ta']; }, $ownedSigns));
            $housesTa = implode(', ', array_map(static function ($house) { return $house . '-ஆம்'; }, $houses));
            $entries[] = [
                'graha' => $graha,
                'grahaNameEn' => $names['en'], 'grahaNameTa' => $names['ta'], 'grahaNameHi' => $names['hi'],
                'houses' => $houses, 'signs' => $ownedSigns,
                'appliesToLagnaLord' => $appliesToLagnaLord,
                'isDosha' => !$appliesToLagnaLord,
                'descriptionEn' => $names['en'] . ' rules the ' . $houseListEn . ' houses (' . $signListEn . ') for this Lagna — Kendradhipati dosha. A natural benefic owning two kendras is read as a caution for those houses.'
                    . ($appliesToLagnaLord ? ' As the Lagna lord it is traditionally exempt, but the note is kept.' : ''),
                'descriptionTa' => $names['ta'] . ' இந்த லக்னத்திற்கு ' . $housesTa . ' பாவங்களை (' . $signListTa . ') ஆள்கிறார் — கேந்திராதிபதி தோஷம். நல்ல கிரகம் இரண்டு கேந்திரங்களை ஆள்வது அந்த பாவ விஷயங்களுக்கு எச்சரிக்கையாகக் கருதப்படுகிறது.'
                    . ($appliesToLagnaLord ? ' லக்னாதிபதி என்பதால் மரபு விலக்கு உண்டு; குறிப்பு மட்டும் வைக்கப்பட்டுள்ளது.' : ''),
                'descriptionHi' => $names['hi'] . ' इस लग्न के लिए ' . $houseListEn . ' भावों (' . $signListEn . ') के स्वामी हैं — केंद्राधिपति दोष। शुभ ग्रह का दो केंद्रों पर स्वामित्व सावधानी माना जाता है।'
                    . ($appliesToLagnaLord ? ' लग्नेश होने से छूट है, फिर भी उल्लेख रखा गया है।' : ''),
            ];
        }
        return $entries;
    }

    /**
     * Yoga notes (item 6): Sarala yoga (8th lord in the 8th), Saturn in its own
     * sign, and the 9th lord in the 8th as a caution (never a benefit).
     */
    private static function yogaNotes(int $lagnaRasi, array $rasiByGraha, array $bhavaByGraha): array {
        $yogas = [];
        $names = self::DIGNITY_GRAHA_TEXT;
        $lordOfBhava = static function (int $bhava) use ($lagnaRasi): string {
            $sign = (($lagnaRasi - 1 + ($bhava - 1)) % 12) + 1;
            return self::DIGNITY_SIGN_LORDS[$sign];
        };
        $eighthLord = $lordOfBhava(8);
        if (($bhavaByGraha[$eighthLord] ?? null) === 8) {
            $info = $names[$eighthLord];
            $yogas[] = [
                'code' => 'SARALA',
                'nameEn' => 'Sarala Yoga — 8th lord ' . $info['en'] . ' in the 8th',
                'nameTa' => 'சரள யோகம் — 8-ஆம் அதிபதி ' . $info['ta'] . ' 8-ஆம் பாவத்தில்',
                'nameHi' => 'सरल योग — अष्टमेश ' . $info['hi'] . ' अष्टम भाव में',
                'severity' => 'auspicious',
                'descriptionEn' => $info['en'] . ', lord of the 8th house, occupies the 8th house itself (Sarala Yoga). Traditionally this protects longevity and turns crises into endurance, research depth and inheritance of knowledge rather than sudden loss.',
                'descriptionTa' => '8-ஆம் பாவ அதிபதி ' . $info['ta'] . ' அதே 8-ஆம் பாவத்தில் அமர்ந்துள்ளார் (சரள யோகம்). மரபில் இது ஆயுள் மற்றும் தைரியத்தைப் பாதுகாக்கும்; நெருக்கடிகளை அறிவுத் தேடலாக மாற்றும்.',
                'descriptionHi' => 'अष्टम भाव के स्वामी ' . $info['hi'] . ' स्वयं अष्टम भाव में हैं (सरल योग)। परंत्रा में यह आयु और धैर्य की रक्षा करता है।',
            ];
        }
        $saturnSign = $rasiByGraha['saturn'] ?? null;
        if ($saturnSign === 10 || $saturnSign === 11) {
            $saturnInfo = $names['saturn'];
            $signName = self::$RASIS[$saturnSign - 1];
            $yogas[] = [
                'code' => 'SATURN_OWN_SIGN',
                'nameEn' => 'Saturn in its own sign ' . $signName['en'],
                'nameTa' => 'சனி தனது ஆட்சி ராசி ' . $signName['ta'] . '-இல்',
                'nameHi' => 'शनि अपनी स्वराशि ' . ($signName['hi'] ?? $signName['en']) . ' में',
                'severity' => 'auspicious',
                'descriptionEn' => $saturnInfo['en'] . ' occupies its own sign ' . $signName['en'] . '. Own-sign Saturn gives structure, discipline and slow but durable results.',
                'descriptionTa' => $saturnInfo['ta'] . ' தனது ஆட்சி ராசி ' . $signName['ta'] . '-இல் உள்ளார். ஆட்சி சனி கட்டமைப்பு, ஒழுக்கம், நிலைத்த வெற்றியைத் தரும்.',
                'descriptionHi' => $saturnInfo['hi'] . ' अपनी स्वराशि ' . ($signName['hi'] ?? $signName['en']) . ' में है। स्वराशि का शनि अनुशासन और स्थायी उपलब्धि देता है।',
            ];
        }
        $ninthLord = $lordOfBhava(9);
        if (($bhavaByGraha[$ninthLord] ?? null) === 8) {
            $info = $names[$ninthLord];
            $yogas[] = [
                'code' => 'NINTH_LORD_IN_EIGHTH',
                'nameEn' => '9th lord ' . $info['en'] . ' in the 8th house — caution',
                'nameTa' => '9-ஆம் அதிபதி ' . $info['ta'] . ' 8-ஆம் பாவத்தில் — கவனம்',
                'nameHi' => 'नवमेश ' . $info['hi'] . ' अष्टम भाव में — सावधानी',
                'severity' => 'caution',
                'descriptionEn' => $info['en'] . ', lord of the 9th (fortune, dharma, teachers, long journeys), sits in the 8th house. Read this as a caution, not as a blessing: fortune arrives through effort, delay, research or transformation, and documents/journeys need care.',
                'descriptionTa' => '9-ஆம் பாவ (பாக்கியம், தர்மம், குரு, தூர பயணம்) அதிபதி ' . $info['ta'] . ' 8-ஆம் பாவத்தில் உள்ளார். இதை நன்மை எனக் கூறக்கூடாது — கவனமே: பாக்கியம் முயற்சி, தாமதம், ஆராய்ச்சி அல்லது மாற்றத்தின் வழியே வரும்.',
                'descriptionHi' => 'नवम भाव (भाग्य, धर्म, गुरु, दूर यात्रा) के स्वामी ' . $info['hi'] . ' अष्टम भाव में हैं। इसे शुभ न मानें — सावधानी: भाग्य परिश्रम, विलंब, शोध या परिवर्तन से मिलता है।',
            ];
        }
        return $yogas;
    }

    /**
     * The Mahadasa that follows the running one, plus the "begins on <date>"
     * notice that is ALWAYS emitted when the change lands inside 12 months.
     */
    private static function nextMahadasaInfo(array $dashaPeriods): array {
        $now = time();
        $next = null;
        foreach ($dashaPeriods as $period) {
            $start = strtotime((string) ($period['startDate'] ?? ''));
            if ($start !== false && $start > $now) { $next = $period; $startTs = $start; break; }
        }
        if ($next === null || !isset($startTs)) {
            return ['within12Months' => false, 'noticeEn' => '', 'noticeTa' => '', 'noticeHi' => ''];
        }
        $daysAhead = (int) floor(($startTs - $now) / 86400);
        $monthsAhead = max(1, (int) round($daysAhead / 30.44));
        $within = $daysAhead <= 366;
        $beginsOn = date('Y-m-d', $startTs);
        $lordEn = (string) ($next['lordNameEn'] ?? '');
        $lordTa = (string) ($next['lordNameTa'] ?? '');
        $lordHi = (string) ($next['lordNameHi'] ?? '');
        return [
            'lord' => (string) ($next['mahadashaLord'] ?? ''),
            'lordNameEn' => $lordEn, 'lordNameTa' => $lordTa, 'lordNameHi' => $lordHi,
            'beginsOn' => $beginsOn,
            'monthsAhead' => round($daysAhead / 30.44, 1),
            'within12Months' => $within,
            'noticeEn' => $within ? $lordEn . ' Mahadasa begins on ' . $beginsOn . ' (about ' . $monthsAhead . ' month' . ($monthsAhead === 1 ? '' : 's') . ' from now).' : '',
            'noticeTa' => $within ? $lordTa . ' மகாதிசை ' . $beginsOn . ' அன்று தொடங்குகிறது (இன்னும் சுமார் ' . $monthsAhead . ' மாதங்கள்).' : '',
            'noticeHi' => $within ? $lordHi . ' महादशा ' . $beginsOn . ' को आरंभ होगी (लगभग ' . $monthsAhead . ' माह में)।' : '',
        ];
    }

    public static function calculateHoroscope($payload) {
        $payload = is_array($payload) ? $payload : [];
        if (!self::hasValidBirthDetails($payload)) {
            throw new RuntimeException('A valid past birth date, birth time, birth place, coordinates and time zone are required for an accurate horoscope.');
        }
        $dob = trim((string) $payload['dob']);
        $tob = self::normalizeBirthTime($payload['tob']);
        $lat = (float) $payload['latitude'];
        $lng = (float) $payload['longitude'];
        $name = trim((string) ($payload['name'] ?? 'Native')) ?: 'Native';

        // One resolver for validation and calculation: the UTC instant comes
        // from the IANA zone (explicit `timeZoneId`, else derived from the
        // coordinates) evaluated against the region's historical standard/DST
        // transitions. The submitted numeric offset is only trusted when no
        // zone can be determined, so a 1990s Fiji or US-DST birth no longer
        // shifts the Lagna by an hour because a client sent today's offset.
        $birthInstant = self::resolveBirthInstant($payload);
        $timeTs = (int) $birthInstant['timestamp'];
        $tz = (float) $birthInstant['offsetHours'];
        $timeZoneId = (string) ($birthInstant['timeZoneId'] ?? '');
        $timeZoneSource = (string) $birthInstant['timeZoneSource'];
        if ($birthInstant['offsetAdjusted']) {
            error_log(sprintf(
                'AstroEngine: birth offset corrected from UTC%+.2f to UTC%+.2f using %s (%s) for %s %s',
                (float) $birthInstant['suppliedOffsetHours'], $tz, $timeZoneId, $timeZoneSource, $dob, $tob
            ));
        }
        $julianDay = ($timeTs / 86400.0) + 2440587.5; // UT

        // Full geocentric ephemeris: UT→TT, VSOP87D planets, ELP2000-82 Moon,
        // osculating node, IAU 1980 nutation and the true Lahiri ayanamsa.
        $ephemeris = self::computeGeocentricPositions($julianDay);
        $ayanamsa = $ephemeris['ayanamsa'];          // true (Chitra Paksha + Δψ)
        $siderealLongitudes = $ephemeris['sidereal'];
        $dailyMotion = $ephemeris['speed'];
        $eclipticLatitudes = $ephemeris['latitude'];
        // Item 1: print the ayanamsa the chart actually used, so a report can
        // be audited against any other ephemeris without guessing the mode.
        error_log(sprintf(
            'AstroEngine: Lahiri (Chitra Paksha) ayanamsa used = %.6f° (true) | mean %.6f° | JD(UT) %.6f | node %s',
            $ayanamsa, $ephemeris['ayanamsaMean'], $julianDay, $ephemeris['nodeType']
        ));

        $sunTropical = $ephemeris['tropical']['sun'];
        $sunSidereal = $siderealLongitudes['sun'];
        $moonTropical = $ephemeris['tropical']['moon'];
        $moonSidereal = $siderealLongitudes['moon'];
        $marsSidereal = $siderealLongitudes['mars'];
        $mercurySidereal = $siderealLongitudes['mercury'];
        $jupiterSidereal = $siderealLongitudes['jupiter'];
        $venusSidereal = $siderealLongitudes['venus'];
        $saturnSidereal = $siderealLongitudes['saturn'];
        $rahuSidereal = $siderealLongitudes['rahu'];
        $ketuSidereal = $siderealLongitudes['ketu'];

        $ascendant = self::computeAscendant($julianDay, $lat, $lng, $ephemeris);
        $ascTropical = $ascendant['tropical'];
        $lagnaSidereal = $ascendant['sidereal'];

        $moonRasiIndex = intval(floor($moonSidereal / 30.0)) % 12;
        $lagnaRasiIndex = intval(floor($lagnaSidereal / 30.0)) % 12;
        $sunRasiIndex = intval(floor($sunSidereal / 30.0)) % 12;
        $marsRasiIndex = intval(floor($marsSidereal / 30.0)) % 12;
        $mercuryRasiIndex = intval(floor($mercurySidereal / 30.0)) % 12;
        $jupiterRasiIndex = intval(floor($jupiterSidereal / 30.0)) % 12;
        $venusRasiIndex = intval(floor($venusSidereal / 30.0)) % 12;
        $saturnRasiIndex = intval(floor($saturnSidereal / 30.0)) % 12;
        $rahuRasiIndex = intval(floor($rahuSidereal / 30.0)) % 12;
        $ketuRasiIndex = intval(floor($ketuSidereal / 30.0)) % 12;

        $nakshatraSpan = 360.0 / 27.0;
        $nakshatraIndex = intval(floor($moonSidereal / $nakshatraSpan)) % 27;
        $padaIndex = (intval(floor(($moonSidereal - ($nakshatraIndex * $nakshatraSpan)) / ($nakshatraSpan / 4.0))) % 4) + 1;

        $rasi = self::$RASIS[$moonRasiIndex];
        $lagna = self::$RASIS[$lagnaRasiIndex];

        $planets = [
            ['name' => 'Lagna', 'nameTa' => 'லக்னம்', 'rasi' => $lagna['en'], 'rasiTa' => $lagna['ta'], 'degree' => round(fmod($lagnaSidereal, 30), 2), 'house' => 1, 'isBenefic' => true],
            ['name' => 'Surya (Sun)', 'nameTa' => 'சூரியன்', 'rasi' => self::$RASIS[$sunRasiIndex]['en'], 'rasiTa' => self::$RASIS[$sunRasiIndex]['ta'], 'degree' => round(fmod($sunSidereal, 30), 2), 'house' => (($sunRasiIndex - $lagnaRasiIndex + 12) % 12) + 1, 'isBenefic' => true],
            ['name' => 'Chandra (Moon)', 'nameTa' => 'சந்திரன்', 'rasi' => $rasi['en'], 'rasiTa' => $rasi['ta'], 'degree' => round(fmod($moonSidereal, 30), 2), 'house' => (($moonRasiIndex - $lagnaRasiIndex + 12) % 12) + 1, 'isBenefic' => true],
            ['name' => 'Chevvai (Mars)', 'nameTa' => 'செவ்வாய்', 'rasi' => self::$RASIS[$marsRasiIndex]['en'], 'rasiTa' => self::$RASIS[$marsRasiIndex]['ta'], 'degree' => round(fmod($marsSidereal, 30), 2), 'house' => (($marsRasiIndex - $lagnaRasiIndex + 12) % 12) + 1, 'isBenefic' => false],
            ['name' => 'Budha (Mercury)', 'nameTa' => 'புதன்', 'rasi' => self::$RASIS[$mercuryRasiIndex]['en'], 'rasiTa' => self::$RASIS[$mercuryRasiIndex]['ta'], 'degree' => round(fmod($mercurySidereal, 30), 2), 'house' => (($mercuryRasiIndex - $lagnaRasiIndex + 12) % 12) + 1, 'isBenefic' => true],
            ['name' => 'Guru (Jupiter)', 'nameTa' => 'குரு', 'rasi' => self::$RASIS[$jupiterRasiIndex]['en'], 'rasiTa' => self::$RASIS[$jupiterRasiIndex]['ta'], 'degree' => round(fmod($jupiterSidereal, 30), 2), 'house' => (($jupiterRasiIndex - $lagnaRasiIndex + 12) % 12) + 1, 'isBenefic' => true],
            ['name' => 'Sukra (Venus)', 'nameTa' => 'சுக்கிரன்', 'rasi' => self::$RASIS[$venusRasiIndex]['en'], 'rasiTa' => self::$RASIS[$venusRasiIndex]['ta'], 'degree' => round(fmod($venusSidereal, 30), 2), 'house' => (($venusRasiIndex - $lagnaRasiIndex + 12) % 12) + 1, 'isBenefic' => true],
            ['name' => 'Sani (Saturn)', 'nameTa' => 'சனி', 'rasi' => self::$RASIS[$saturnRasiIndex]['en'], 'rasiTa' => self::$RASIS[$saturnRasiIndex]['ta'], 'degree' => round(fmod($saturnSidereal, 30), 2), 'house' => (($saturnRasiIndex - $lagnaRasiIndex + 12) % 12) + 1, 'isBenefic' => false],
            ['name' => 'Rahu', 'nameTa' => 'ராகு', 'rasi' => self::$RASIS[$rahuRasiIndex]['en'], 'rasiTa' => self::$RASIS[$rahuRasiIndex]['ta'], 'degree' => round(fmod($rahuSidereal, 30), 2), 'house' => (($rahuRasiIndex - $lagnaRasiIndex + 12) % 12) + 1, 'isBenefic' => false],
            ['name' => 'Ketu', 'nameTa' => 'கேது', 'rasi' => self::$RASIS[$ketuRasiIndex]['en'], 'rasiTa' => self::$RASIS[$ketuRasiIndex]['ta'], 'degree' => round(fmod($ketuSidereal, 30), 2), 'house' => (($ketuRasiIndex - $lagnaRasiIndex + 12) % 12) + 1, 'isBenefic' => false]
        ];

        $siderealByGraha = [
            'sun' => $sunSidereal, 'moon' => $moonSidereal, 'mars' => $marsSidereal, 'mercury' => $mercurySidereal,
            'jupiter' => $jupiterSidereal, 'venus' => $venusSidereal, 'saturn' => $saturnSidereal,
            'rahu' => $rahuSidereal, 'ketu' => $ketuSidereal,
        ];
        $rawPlanets = [];
        foreach ([
            ['sun', 'Surya (Sun)', 'சூரியன்', $sunRasiIndex],
            ['moon', 'Chandra (Moon)', 'சந்திரன்', $moonRasiIndex],
            ['mars', 'Chevvai (Mars)', 'செவ்வாய்', $marsRasiIndex],
            ['mercury', 'Budha (Mercury)', 'புதன்', $mercuryRasiIndex],
            ['jupiter', 'Guru (Jupiter)', 'குரு', $jupiterRasiIndex],
            ['venus', 'Sukra (Venus)', 'சுக்கிரன்', $venusRasiIndex],
            ['saturn', 'Sani (Saturn)', 'சனி', $saturnRasiIndex],
            ['rahu', 'Rahu', 'ராகு', $rahuRasiIndex],
            ['ketu', 'Ketu', 'கேது', $ketuRasiIndex],
        ] as [$graha, $nameEn, $nameTa, $rasiIdx]) {
            $longitude = $siderealByGraha[$graha];
            $isNode = $graha === 'rahu' || $graha === 'ketu';
            $rawPlanets[] = [
                'graha' => $graha,
                'nameEn' => $nameEn,
                'nameTa' => $nameTa,
                'rasiIdx' => $rasiIdx,
                'longitude' => $longitude,
                'degrees' => round(fmod($longitude, 30), 2),
                'house' => (($rasiIdx - $lagnaRasiIndex + 12) % 12) + 1,
                // Nodes always move backwards; luminaries never do.
                'isRetrograde' => $isNode ? true : (($graha !== 'sun' && $graha !== 'moon') && ($dailyMotion[$graha] ?? 0.0) < 0),
                'isCombust' => isset(self::COMBUSTION_LIMITS[$graha])
                    && abs(self::angleDelta($longitude, $sunSidereal)) < self::COMBUSTION_LIMITS[$graha],
            ];
        }

        
        $planetPositions = [];
        $bhavaByGraha = []; // e.g. 'mars' => 8  (used for dosha + house-lord lookups below)
        // 1-based rasi of every graha, for the dignity / Neecha Bhanga checks.
        $rasiByGraha = [];
        foreach ($rawPlanets as $rpLookup) { $rasiByGraha[$rpLookup['graha']] = $rpLookup['rasiIdx'] + 1; }
        foreach ($rawPlanets as $rp) {
            // Use the exact longitude (not the 0.01°-rounded display value) so a
            // body within 36″ of a Nakshatra Sandhi is never placed on the wrong side.
            $totalDeg = $rp['longitude'];
            $pNakIndex = intval(floor($totalDeg / $nakshatraSpan)) % 27;
            $pPada = (intval(floor(($totalDeg - ($pNakIndex * $nakshatraSpan)) / ($nakshatraSpan / 4.0))) % 4) + 1;
            // D9 (Navamsa): each sign holds nine 3°20′ parts, so the navamsa rasi is
            // floor(longitude / 3°20′) % 12 + 1 — the same rule the TypeScript engine uses.
            $navRasiForPlanet = (intval(floor($totalDeg / (360.0 / 108.0))) % 12) + 1;
            $planetPositions[] = [
                'graha' => $rp['graha'],
                'nameEn' => $rp['nameEn'],
                'nameTa' => $rp['nameTa'],
                'rasi' => $rp['rasiIdx'] + 1,
                'rasiNameEn' => self::$RASIS[$rp['rasiIdx']]['en'],
                'rasiNameTa' => self::$RASIS[$rp['rasiIdx']]['ta'],
                'degrees' => $rp['degrees'],
                // Sidereal longitude (2dp) and D9 placement, so the report and the
                // browser preview draw the Navamsa chart from the engine's own values.
                'totalDegrees' => round($totalDeg, 2),
                'navamsaRasi' => $navRasiForPlanet,
                'isVargottama' => $navRasiForPlanet === ($rp['rasiIdx'] + 1),
                'house' => $rp['house'],
                'bhavaNumber' => $rp['house'],
                'nakshatramEn' => self::$NAKSHATRAS_EN[$pNakIndex],
                'nakshatramTa' => self::$NAKSHATRAS_TA[$pNakIndex],
                'pada' => $pPada,
                'isRetrograde' => $rp['isRetrograde'],
                'isCombust' => $rp['isCombust'],
                // Item 3: ecliptic latitude (Graha Yuddha input) + dignity.
                'eclipticLatitude' => round((float) ($eclipticLatitudes[$rp['graha']] ?? 0.0), 3),
                'dignity' => self::computePlanetDignity(
                    $rp['graha'], $rp['rasiIdx'] + 1, (bool) $rp['isCombust'], (bool) $rp['isRetrograde'],
                    $lagnaRasiIndex + 1, $moonRasiIndex + 1, $rasiByGraha
                )
            ];
            $bhavaByGraha[$rp['graha']] = $rp['house'];
        }

        // Dignity by graha (same source as the planet table) so the card text
        // can name a Neecha Bhanga rule without recomputing anything.
        $dignityByGraha = [];
        foreach ($planetPositions as $dignityPosition) {
            if (is_array($dignityPosition['dignity'] ?? null)) {
                $dignityByGraha[$dignityPosition['graha']] = $dignityPosition['dignity'];
            }
        }

        // English rasi-lord name -> planetPositions graha key
        $lordNameToGraha = [
            'Mars' => 'mars', 'Venus' => 'venus', 'Mercury' => 'mercury', 'Moon' => 'moon',
            'Sun' => 'sun', 'Jupiter' => 'jupiter', 'Saturn' => 'saturn'
        ];

        $rasiIdxByGraha = [
            'sun' => $sunRasiIndex, 'moon' => $moonRasiIndex, 'mars' => $marsRasiIndex,
            'mercury' => $mercuryRasiIndex, 'jupiter' => $jupiterRasiIndex, 'venus' => $venusRasiIndex,
            'saturn' => $saturnRasiIndex, 'rahu' => $rahuRasiIndex, 'ketu' => $ketuRasiIndex,
        ];

        // Ordinal helper for proper grammar (1st, 2nd, 3rd, 4th, 11th, 12th, 13th, etc.)
        $ordinal = function ($n) {
            $n = (int)$n;
            if ($n % 100 >= 11 && $n % 100 <= 13) {
                return $n . 'th';
            }
            switch ($n % 10) {
                case 1: return $n . 'st';
                case 2: return $n . 'nd';
                case 3: return $n . 'rd';
                default: return $n . 'th';
            }
        };

        // Placement of the lord of a given house (1-12), mirroring getHousePlacement().
        // Missing planet data remains unavailable instead of borrowing the target house/sign.
        $getHousePlacement = function ($houseNum) use ($lagnaRasiIndex, $lordNameToGraha, $bhavaByGraha, $rasiIdxByGraha, $dignityByGraha) {
            $unavailable = [
                'bhava' => null,
                'isOwnHouse' => null,
                'isOwnSign' => null,
                'isDusthana' => null,
                'lordName' => null,
                'placedSignIdx' => null,
                'isAvailable' => false,
                'dignityNoteEn' => '',
                'dignityNoteTa' => '',
                'dignityNoteHi' => '',
            ];
            if (!is_int($houseNum) || $houseNum < 1 || $houseNum > 12) {
                return $unavailable;
            }

            $targetSignIdx = ($lagnaRasiIndex + ($houseNum - 1)) % 12;
            $lordEnName = self::$RASIS[$targetSignIdx]['lord'] ?? null;
            $lordGraha = $lordEnName !== null ? ($lordNameToGraha[$lordEnName] ?? null) : null;
            if ($lordGraha === null) {
                return $unavailable;
            }

            $bhava = $bhavaByGraha[$lordGraha] ?? null;
            $placedSignIdx = $rasiIdxByGraha[$lordGraha] ?? null;
            if (!is_int($bhava) || $bhava < 1 || $bhava > 12 ||
                !is_int($placedSignIdx) || $placedSignIdx < 0 || $placedSignIdx > 11) {
                return $unavailable;
            }

            $placedSignLord = self::$RASIS[$placedSignIdx]['lord'] ?? null;
            if ($placedSignLord === null) {
                return $unavailable;
            }
            return [
                'bhava' => $bhava,
                'isOwnHouse' => ($bhava === $houseNum),
                'isOwnSign' => ($placedSignLord === $lordEnName),
                'isDusthana' => in_array($bhava, [6, 8, 12], true),
                'lordName' => $lordEnName,
                'placedSignIdx' => $placedSignIdx,
                'isAvailable' => true,
                // Item 3: the Health/Career/etc. cards name the dignity state and
                // the Neecha Bhanga rule when it applies to that house's lord.
                'dignityNoteEn' => self::dignityCardLine($dignityByGraha[$lordGraha] ?? [], 'en'),
                'dignityNoteTa' => self::dignityCardLine($dignityByGraha[$lordGraha] ?? [], 'ta'),
                'dignityNoteHi' => self::dignityCardLine($dignityByGraha[$lordGraha] ?? [], 'hi'),
            ];
        };

        $h1 = $getHousePlacement(1);
        $h2 = $getHousePlacement(2);
        $h4 = $getHousePlacement(4);
        $h5 = $getHousePlacement(5);
        $h7 = $getHousePlacement(7);
        $h9 = $getHousePlacement(9);
        $h10 = $getHousePlacement(10);

        // Sevvay / Kuja (Mars) Dosha: Mars in house 2, 4, 7, 8 or 12 (the
        // South Indian rule) from the Lagna, Moon or Venus, subject to the classical exceptions (own /
        // exalted sign, Leo/Aquarius, house-sign Vilakku, Yogakaraka Lagna,
        // Guru-Mangala / Chandra-Mangala yoga, Guru Drishti) and mitigations.
        // Missing data must remain N/A, never a false clean result.
        $kujaDosha = self::evaluateKujaDosha([
            'mars' => $marsRasiIndex + 1, 'lagna' => $lagnaRasiIndex + 1, 'moon' => $moonRasiIndex + 1,
            'venus' => $venusRasiIndex + 1, 'jupiter' => $jupiterRasiIndex + 1, 'saturn' => $saturnRasiIndex + 1,
            'rahu' => $rahuRasiIndex + 1, 'ketu' => $ketuRasiIndex + 1,
        ]);
        $marsBhava = $kujaDosha['marsBhava'];
        $isKujaDosha = $kujaDosha['isPresent'];          // null (N/A) | true (present or mild) | false
        $isKujaCancelled = $kujaDosha['cancelled'];
        $isKujaMild = $kujaDosha['mild'];
        $kujaStatus = $kujaDosha['status'];

        // Items 6/7: Graha Yuddha, Kendradhipati and the yoga notes the report
        // prints. All three mirror the TypeScript engine field-for-field.
        $grahaYuddha = self::grahaYuddhaPairs($siderealByGraha, $eclipticLatitudes, $rasiByGraha);
        $kendradhipati = self::kendradhipatiDosha($lagnaRasiIndex + 1);
        $yogas = self::yogaNotes($lagnaRasiIndex + 1, $rasiByGraha, $bhavaByGraha);
        $kendraCareerNoteEn = '';
        $kendraCareerNoteTa = '';
        $kendraCareerNoteHi = '';
        $kendraMarriageNoteEn = '';
        $kendraMarriageNoteTa = '';
        $kendraMarriageNoteHi = '';
        foreach ($kendradhipati as $kendraEntry) {
            if (in_array(10, $kendraEntry['houses'], true)) {
                $kendraCareerNoteEn = ' ' . $kendraEntry['descriptionEn'];
                $kendraCareerNoteTa = ' ' . $kendraEntry['descriptionTa'];
                $kendraCareerNoteHi = ' ' . $kendraEntry['descriptionHi'];
            }
            if (in_array(7, $kendraEntry['houses'], true)) {
                $kendraMarriageNoteEn = ' ' . $kendraEntry['descriptionEn'];
                $kendraMarriageNoteTa = ' ' . $kendraEntry['descriptionTa'];
                $kendraMarriageNoteHi = ' ' . $kendraEntry['descriptionHi'];
            }
        }

        // Kala Sarpa Dosha: all 7 classical planets fall on one side of the Rahu-Ketu axis
        $lonMap = ['sun' => $sunSidereal, 'moon' => $moonSidereal, 'mars' => $marsSidereal, 'mercury' => $mercurySidereal, 'jupiter' => $jupiterSidereal, 'venus' => $venusSidereal, 'saturn' => $saturnSidereal];
        $sideFlags = [];
        foreach ($lonMap as $lon) {
            $diff = self::norm360($lon - $rahuSidereal);
            $sideFlags[] = $diff < 180.0;
        }
        $isKalaSarpaDosha = (count(array_unique($sideFlags, SORT_REGULAR)) === 1);

        // Simplified Pitru indicator: Sun shares a sign with Rahu/Ketu, or Saturn occupies the 9th whole-sign house.
        // Broader traditions, including additional 9th-lord affliction rules, are not assessed here.
        $sunHouse = $bhavaByGraha['sun'] ?? null;
        $rahuHouse = $bhavaByGraha['rahu'] ?? null;
        $ketuHouse = $bhavaByGraha['ketu'] ?? null;
        $saturnHouse = $bhavaByGraha['saturn'] ?? null;
        // A missing input placement leaves this limited indicator unassessed instead of clean.
        $pitruInputsAvailable = is_int($sunHouse) && $sunHouse >= 1 && $sunHouse <= 12 &&
            is_int($rahuHouse) && $rahuHouse >= 1 && $rahuHouse <= 12 &&
            is_int($ketuHouse) && $ketuHouse >= 1 && $ketuHouse <= 12 &&
            is_int($saturnHouse) && $saturnHouse >= 1 && $saturnHouse <= 12;
        // Item 5: the Sun-node pair only counts inside a 12° orb; a wider
        // same-sign pair remains a weak (same sign only) indicator. The
        // Saturn-in-the-9th rule is unchanged.
        $sunRasiIdxNow = $rasiIdxByGraha['sun'] ?? null;
        $sunNodeSeparation = null;
        $closestNodeKey = null;
        foreach (['rahu', 'ketu'] as $nodeKey) {
            $nodeRasiIdx = $rasiIdxByGraha[$nodeKey] ?? null;
            if (!is_int($sunRasiIdxNow) || !is_int($nodeRasiIdx) || $sunRasiIdxNow !== $nodeRasiIdx) { continue; }
            $separationNow = abs(self::angleDelta($sunSidereal, $siderealByGraha[$nodeKey]));
            if ($sunNodeSeparation === null || $separationNow < $sunNodeSeparation) {
                $sunNodeSeparation = $separationNow;
                $closestNodeKey = $nodeKey;
            }
        }
        $sunNodeWithinOrb = $sunNodeSeparation !== null && $sunNodeSeparation < 12.0;
        $isSaturnIn9th = $pitruInputsAvailable && $saturnHouse === 9;
        $isPitruDosha = $pitruInputsAvailable
            ? ($sunNodeWithinOrb || $isSaturnIn9th)
            : null;
        $pitruStrength = $isPitruDosha === null
            ? null
            : ($isPitruDosha ? 'present' : ($sunNodeSeparation !== null ? 'weak' : 'none'));
        $nodeNameEn = $closestNodeKey === 'ketu' ? 'Ketu' : 'Rahu';
        $nodeNameTa = $closestNodeKey === 'ketu' ? 'கேது' : 'ராகு';
        $nodeNameHi = $closestNodeKey === 'ketu' ? 'केतु' : 'राहु';
        $sunNodeSeparationText = $sunNodeSeparation === null ? '' : number_format($sunNodeSeparation, 1, '.', '');
        $pitruStrengthLabelEn = $pitruStrength === 'weak' ? 'Weak (same sign only) — Sun and ' . $nodeNameEn . ' are ' . $sunNodeSeparationText . '° apart' : '';
        $pitruStrengthLabelTa = $pitruStrength === 'weak' ? 'பலவீனம் (ஒரே ராசி மட்டும்) — சூரியனும் ' . $nodeNameTa . ' உம் ' . $sunNodeSeparationText . '° இடைவெளியில்' : '';
        $pitruStrengthLabelHi = $pitruStrength === 'weak' ? 'दुर्बल (केवल समान राशि) — सूर्य और ' . $nodeNameHi . ' ' . $sunNodeSeparationText . '° की दूरी पर' : '';

        // Guru Chandala Dosha: Jupiter conjunct or in full 7th-sign opposition to Rahu/Ketu.
        // NOTE: $rasiIdxByGraha holds 0-based sign indices, for which (guru - node) % 12 === 6
        // is the exact opposition test (mirrors the TypeScript engine).
        $jupiterSignIdx = $rasiIdxByGraha['jupiter'] ?? null;
        $rahuSignIdx = $rasiIdxByGraha['rahu'] ?? null;
        $ketuSignIdx = $rasiIdxByGraha['ketu'] ?? null;
        $guruChandalaInputsAvailable = is_int($jupiterSignIdx) && $jupiterSignIdx >= 0 && $jupiterSignIdx <= 11 &&
            is_int($rahuSignIdx) && $rahuSignIdx >= 0 && $rahuSignIdx <= 11 &&
            is_int($ketuSignIdx) && $ketuSignIdx >= 0 && $ketuSignIdx <= 11;
        $isGuruWithRahu = $guruChandalaInputsAvailable && $jupiterSignIdx === $rahuSignIdx;
        $isGuruWithKetu = $guruChandalaInputsAvailable && $jupiterSignIdx === $ketuSignIdx;
        $isGuruAspectRahu = $guruChandalaInputsAvailable && ((($jupiterSignIdx - $rahuSignIdx + 12) % 12) === 6);
        $isGuruAspectKetu = $guruChandalaInputsAvailable && ((($jupiterSignIdx - $ketuSignIdx + 12) % 12) === 6);
        $isGuruChandalaDosha = $guruChandalaInputsAvailable
            ? ($isGuruWithRahu || $isGuruWithKetu || $isGuruAspectRahu || $isGuruAspectKetu)
            : null;

        $doshas = [
            [
                'nameEn' => 'Mars (Kuja) Dosha', 'nameTa' => 'செவ்வாய் தோஷம் (Kuja Dosha)', 'nameHi' => 'मंगल (कुज) दोष',
                'isPresent' => $isKujaDosha,
                // NOT_ASSESSED | DOSHA_NONE | DOSHA_CANCELLED | DOSHA_MILD | DOSHA_PRESENT
                'status' => $kujaStatus,
                'severityEn' => $kujaDosha['severityEn'],
                'severityTa' => $kujaDosha['severityTa'],
                'severityHi' => $kujaDosha['severityHi'],
                // Item 3: the Kuja card also states Mars's dignity and names the
                // Neecha Bhanga rule ("by Jupiter conjunction") when it applies.
                'descriptionEn' => self::dignityCardLine($dignityByGraha['mars'] ?? [], 'en') !== ''
                    ? $kujaDosha['explanationEn'] . ' ' . self::dignityCardLine($dignityByGraha['mars'] ?? [], 'en')
                    : $kujaDosha['explanationEn'],
                'descriptionTa' => self::dignityCardLine($dignityByGraha['mars'] ?? [], 'ta') !== ''
                    ? $kujaDosha['explanationTa'] . ' ' . self::dignityCardLine($dignityByGraha['mars'] ?? [], 'ta')
                    : $kujaDosha['explanationTa'],
                'descriptionHi' => self::dignityCardLine($dignityByGraha['mars'] ?? [], 'hi') !== ''
                    ? $kujaDosha['explanationHi'] . ' ' . self::dignityCardLine($dignityByGraha['mars'] ?? [], 'hi')
                    : $kujaDosha['explanationHi'],
                'traditionalRemedyEn' => 'Pray to Karthikeyan (Murugan) or Lord Hanuman.',
                'traditionalRemedyTa' => 'முருகன் (கார்த்திகேயன்) அல்லது அனுமனைப் பிரார்த்தனை செய்யுங்கள்.',
                'traditionalRemedyHi' => 'भगवान कार्तिकेय या हनुमान जी से प्रार्थना करें।',
            ],
            [
                'nameEn' => 'Kala Sarpa Dosha', 'nameTa' => 'காலசர்ப தோஷம்', 'nameHi' => 'काल सर्प दोष',
                'isPresent' => $isKalaSarpaDosha,
                'severityEn' => $isKalaSarpaDosha ? 'Present' : 'Not present',
                'severityTa' => $isKalaSarpaDosha ? 'தோஷம் உள்ளது' : 'தோஷம் இல்லை',
                'severityHi' => $isKalaSarpaDosha ? 'उपस्थित' : 'अनुपस्थित',
                'descriptionEn' => $isKalaSarpaDosha ? 'All seven classical planets fall within the Rahu-Ketu axis.' : 'Planets are spread outside the Rahu-Ketu axis.',
                'descriptionTa' => $isKalaSarpaDosha ? 'அனைத்து கிரகங்களும் ராகு-கேது அச்சுக்குள் அமைந்துள்ளன.' : 'ராகு-கேது அச்சுக்கு வெளியே கிரகங்கள் பரவலாக அமைந்துள்ளன.',
                'descriptionHi' => $isKalaSarpaDosha ? 'सभी सात ग्रह राहु-केतु अक्ष के भीतर स्थित हैं।' : 'ग्रह राहु-केतु अक्ष से बाहर फैले हुए हैं।',
                'traditionalRemedyEn' => 'Pray to Lord Shiva.',
                'traditionalRemedyTa' => 'சிவன் பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.',
                'traditionalRemedyHi' => 'भगवान शिव का नाम लेकर प्रार्थना करें।',
            ],
            [
                'nameEn' => 'Pitru Dosha', 'nameTa' => 'பித்ரு தோஷம்', 'nameHi' => 'पितृ दोष',
                'isPresent' => $isPitruDosha,
                'severityEn' => $isPitruDosha === null ? 'N/A' : ($isPitruDosha ? 'Moderate' : 'Favourable'),
                'severityTa' => $isPitruDosha === null ? 'N/A' : ($isPitruDosha ? 'மிதமான தோஷம்' : 'நல்ல நிலை'),
                'severityHi' => $isPitruDosha === null ? 'N/A' : ($isPitruDosha ? 'मध्यम' : 'शुभ स्थिति'),
                'descriptionEn' => $isPitruDosha === null ? 'Required Sun, Rahu, Ketu or Saturn house data is unavailable; this indicator is not assessed.' : ($isPitruDosha ? 'The Sun shares a sign with Rahu or Ketu, or Saturn occupies the 9th house under this simplified rule.' : 'No Sun-node same-sign or Saturn-in-9th trigger was found under this limited rule; it does not assess all traditional Pitru criteria or the strength of the 9th lord.'),
                'descriptionTa' => $isPitruDosha === null ? 'சூரியன், ராகு, கேது அல்லது சனியின் தேவையான பாவத் தகவல் கிடைக்கவில்லை; இந்தக் குறியீடு மதிப்பிடப்படவில்லை.' : ($isPitruDosha ? 'இந்த எளிய விதிப்படி சூரியன் ராகு/கேதுவுடன் ஒரே ராசியில் உள்ளார் அல்லது சனி 9-ஆம் பாவத்தில் உள்ளார்.' : 'இந்த வரையறுக்கப்பட்ட விதியில் சூரியன்-ராகு/கேது ஒரே ராசி அல்லது சனி 9-ஆம் பாவக் குறியீடு இல்லை; இது 9-ஆம் அதிபதியின் பலத்தையோ பிற பாரம்பரிய பித்ரு விதிகளையோ மதிப்பிடாது.'),
                'descriptionHi' => $isPitruDosha === null ? 'सूर्य, राहु, केतु या शनि के आवश्यक भाव-डेटा उपलब्ध नहीं हैं; इस संकेत का आकलन नहीं हुआ।' : ($isPitruDosha ? 'इस सरल नियम के अनुसार सूर्य राहु/केतु के साथ एक राशि में हैं, या शनि नवम भाव में है।' : 'इस सीमित नियम में सूर्य-राहु/केतु की एक-राशि युति या शनि-नवम भाव का संकेत नहीं मिला; यह नवमेश के बल या अन्य पारंपरिक पितृ नियमों का मूल्यांकन नहीं करता।'),
                'traditionalRemedyEn' => 'Pray to Maha Vishnu.',
                'traditionalRemedyTa' => 'மகா விஷ்ணு பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.',
                'traditionalRemedyHi' => 'महाविष्णु का नाम लेकर प्रार्थना करें।',
            ],
            [
                'nameEn' => 'Guru Chandala Dosha', 'nameTa' => 'குரு சண்டாள தோஷம் (Guru Chandala)', 'nameHi' => 'गुरु चांडाल दोष',
                'isPresent' => $isGuruChandalaDosha,
                'severityEn' => $isGuruChandalaDosha === null ? 'N/A' : ($isGuruChandalaDosha ? 'Moderate' : 'Not triggered under this sign-level rule'),
                'severityTa' => $isGuruChandalaDosha === null ? 'N/A' : ($isGuruChandalaDosha ? 'மிதமான தோஷம்' : 'இந்த ராசி விதியில் குறியீடு இல்லை'),
                'severityHi' => $isGuruChandalaDosha === null ? 'N/A' : ($isGuruChandalaDosha ? 'मध्यम' : 'इस राशि-आधारित नियम में संकेत नहीं'),
                'descriptionEn' => $isGuruChandalaDosha === null ? 'Jupiter, Rahu or Ketu sign data is unavailable; Guru Chandala Dosha is not assessed.' : ($isGuruChandalaDosha ? 'Jupiter shares a sign with or is opposite Rahu/Ketu under this sign-level rule; interpretations vary.' : 'No trigger was found under this limited sign-level rule; this does not establish the absence of other afflictions.'),
                'descriptionTa' => $isGuruChandalaDosha === null ? 'குரு, ராகு அல்லது கேதுவின் ராசித் தகவல் கிடைக்கவில்லை; குரு சண்டாள தோஷம் மதிப்பிடப்படவில்லை.' : ($isGuruChandalaDosha ? 'இந்த ராசி விதிப்படி குரு ராகு/கேதுவுடன் ஒரே ராசி அல்லது எதிர் ராசியில் உள்ளார்; விளக்கங்கள் மரபுக்கு மாறுபடும்.' : 'இந்த வரையறுக்கப்பட்ட ராசி விதியில் குறியீடு இல்லை; இதனால் பிற பாதிப்புகள் இல்லை என உறுதிப்படுத்த முடியாது.'),
                'descriptionHi' => $isGuruChandalaDosha === null ? 'गुरु, राहु या केतु की राशि-संबंधी जानकारी उपलब्ध नहीं है; गुरु चांडाल दोष का आकलन नहीं हुआ।' : ($isGuruChandalaDosha ? 'इस राशि-आधारित नियम के अनुसार गुरु राहु/केतु के साथ या उनसे विपरीत राशि में हैं; व्याख्याएँ भिन्न हो सकती हैं।' : 'इस सीमित राशि-आधारित नियम में संकेत नहीं मिला; इससे अन्य ग्रह-दोषों की अनुपस्थिति सिद्ध नहीं होती।'),
                'traditionalRemedyEn' => 'Pray to Lord Dakshinamurthy or Lord Shiva.',
                'traditionalRemedyTa' => 'தட்சிணாமூர்த்தி அல்லது சிவன் பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.',
                'traditionalRemedyHi' => 'भगवान दक्षिणामूर्ति या भगवान शिव का नाम लेकर प्रार्थना करें।',
            ]
        ];

        // Simple Navagraha screening: traditional debilitation sign, houses 6/8/12,
        // or same-house placement with a natural malefic. Interpretations differ.
        $debilitationSigns = [
            'sun' => 6, 'moon' => 7, 'mars' => 3, 'mercury' => 11, 'jupiter' => 9,
            'venus' => 5, 'saturn' => 0, 'rahu' => 7, 'ketu' => 1,
        ];
        $malefics = ['mars', 'saturn', 'rahu', 'ketu'];

        $navagrahaMeta = [
            'sun' => ['nameEn' => 'Surya (Sun) Affliction Indicator', 'nameTa' => 'சூரிய கிரகப் பாதிப்பு குறியீடு', 'nameHi' => 'सूर्य ग्रह पीड़ा संकेत',
                'planetEn' => 'Sun (Surya)', 'planetTa' => 'சூரியன்', 'planetHi' => 'सूर्य',
                'remEn' => 'Pray to Lord Surya.', 'remTa' => 'சூரிய பகவானைப் பிரார்த்தனை செய்யுங்கள்.', 'remHi' => 'भगवान सूर्य से प्रार्थना करें।',
                'fullRemEn' => 'Pray to: Lord Surya, the Sun God. Day: Sunday. Colour: Red or copper. Give in charity: Wheat, jaggery, red cloth or copper. Conduct: Offer clean water to the rising sun in the morning, and honour your father and elders.', 'fullRemTa' => 'வழிபாடு: சூரிய பகவான். நாள்: ஞாயிறு. நிறம்: சிவப்பு அல்லது செம்பு நிறம். கொடை: கோதுமை, வெல்லம், சிவப்புத் துணி. நடத்தை: காலையில் எழும் சூரியனுக்குத் தூய நீர் வழங்கி வணங்குங்கள்; தந்தையையும் மூத்தோரையும் மதியுங்கள்.', 'fullRemHi' => 'आराधना: भगवान सूर्य। वार: रविवार। रंग: लाल या ताम्र। सहायता सामग्री: गेहूँ, गुड़, लाल वस्त्र। आचरण: उगते सूर्य को शुद्ध जल अर्पित करें, और पिता तथा वृद्धों का सम्मान करें।'],
            'moon' => ['nameEn' => 'Chandra (Moon) Affliction Indicator', 'nameTa' => 'சந்திர கிரகப் பாதிப்பு குறியீடு', 'nameHi' => 'चंद्र ग्रह पीड़ा संकेत',
                'planetEn' => 'Moon (Chandra)', 'planetTa' => 'சந்திரன்', 'planetHi' => 'चंद्र',
                'remEn' => 'Pray to Lord Shiva.', 'remTa' => 'சிவபெருமானைப் பிரார்த்தனை செய்யுங்கள்.', 'remHi' => 'भगवान शिव से प्रार्थना करें।',
                'fullRemEn' => 'Pray to: Lord Shiva. Day: Monday. Colour: White or silver. Give in charity: Rice, milk, sugar or white cloth. Conduct: Care for your mother and keep a calm, regular daily routine.', 'fullRemTa' => 'வழிபாடு: சிவபெருமான். நாள்: திங்கள். நிறம்: வெள்ளை அல்லது வெள்ளி நிறம். கொடை: அரிசி, பால், சர்க்கரை, வெள்ளைத் துணி. நடத்தை: தாயைக் கவனித்துக் கொள்ளுங்கள்; அமைதியான ஒழுங்கான நாள்வழக்கத்தைக் கடைப்பிடியுங்கள்.', 'fullRemHi' => 'आराधना: भगवान शिव। वार: सोमवार। रंग: सफेद या चाँदी। सहायता सामग्री: चावल, दूध, चीनी या सफेद वस्त्र। आचरण: माता की सेवा करें और शांत, नियमित दिनचर्या रखें।'],
            'mars' => ['nameEn' => 'Mangala (Mars) Affliction Indicator', 'nameTa' => 'செவ்வாய் கிரகப் பாதிப்பு குறியீடு', 'nameHi' => 'मंगल ग्रह पीड़ा संकेत',
                'planetEn' => 'Mars (Mangala)', 'planetTa' => 'செவ்வாய்', 'planetHi' => 'मंगल',
                'remEn' => 'Pray to Karthikeyan (Murugan) or Lord Hanuman.', 'remTa' => 'முருகன் (கார்த்திகேயன்) அல்லது அனுமனைப் பிரார்த்தனை செய்யுங்கள்.', 'remHi' => 'भगवान कार्तिकेय या हनुमान जी से प्रार्थना करें।',
                'fullRemEn' => 'Pray to: Lord Murugan (Karthikeya) or Lord Hanuman. Day: Tuesday. Colour: Red. Give in charity: Red lentils, jaggery or red cloth. Conduct: Control anger and impatience, and keep cordial relations with your brothers and sisters.', 'fullRemTa' => 'வழிபாடு: முருகன் (கார்த்திகேயன்) அல்லது அனுமன். நாள்: செவ்வாய். நிறம்: சிவப்பு. கொடை: சிவப்புப் பயறு, வெல்லம், சிவப்புத் துணி. நடத்தை: கோபத்தையும் பொறுமையின்மையையும் கட்டுப்படுத்துங்கள்; சகோதரர்களுடன் நல்லுறவைப் பேணுங்கள்.', 'fullRemHi' => 'आराधना: भगवान कार्तिकेय या हनुमान जी। वार: मंगलवार। रंग: लाल। सहायता सामग्री: लाल दाल, गुड़ या लाल वस्त्र। आचरण: क्रोध और अधीरता पर नियंत्रण रखें, और भाइयों-बहनों से सौहार्द रखें।'],
            'mercury' => ['nameEn' => 'Budha (Mercury) Affliction Indicator', 'nameTa' => 'புதன் கிரகப் பாதிப்பு குறியீடு', 'nameHi' => 'बुध ग्रह पीड़ा संकेत',
                'planetEn' => 'Mercury (Budha)', 'planetTa' => 'புதன்', 'planetHi' => 'बुध',
                'remEn' => 'Pray to Lord Vishnu.', 'remTa' => 'மகா விஷ்ணுவைப் பிரார்த்தனை செய்யுங்கள்.', 'remHi' => 'भगवान विष्णु से प्रार्थना करें।',
                'fullRemEn' => 'Pray to: Lord Vishnu or Lord Ganesha. Day: Wednesday. Colour: Green. Give in charity: Green gram (mung beans), green cloth or books. Conduct: Speak the truth and avoid deceit or careless speech.', 'fullRemTa' => 'வழிபாடு: மகா விஷ்ணு அல்லது விநாயகர். நாள்: புதன். நிறம்: பச்சை. கொடை: பச்சைப் பயறு, பச்சைத் துணி, நூல்கள். நடத்தை: உண்மையே பேசுங்கள்; வஞ்சகத்தையும் சிந்தியாத பேச்சையும் தவிருங்கள்.', 'fullRemHi' => 'आराधना: भगवान विष्णु या भगवान गणेश। वार: बुधवार। रंग: हरा। सहायता सामग्री: हरी मूँग, हरा वस्त्र या पुस्तकें। आचरण: सत्य बोलें और छल तथा असावधान वाणी से बचें।'],
            'jupiter' => ['nameEn' => 'Guru (Jupiter) Affliction Indicator', 'nameTa' => 'குரு கிரகப் பாதிப்பு குறியீடு', 'nameHi' => 'गुरु ग्रह पीड़ा संकेत',
                'planetEn' => 'Jupiter (Guru)', 'planetTa' => 'குரு', 'planetHi' => 'गुरु',
                'remEn' => 'Pray to Lord Brihaspati or Lord Dakshinamurthy.', 'remTa' => 'குரு பகவான் அல்லது தட்சிணாமூர்த்தியைப் பிரார்த்தனை செய்யுங்கள்.', 'remHi' => 'भगवान बृहस्पति या दक्षिणामूर्ति से प्रार्थना करें।',
                'fullRemEn' => 'Pray to: Lord Brihaspati or Lord Dakshinamurthy. Day: Thursday. Colour: Yellow. Give in charity: Chickpeas, turmeric, bananas, yellow cloth or books. Conduct: Honour your teachers and elders, and set ego aside.', 'fullRemTa' => 'வழிபாடு: குரு பகவான் அல்லது தட்சிணாமூர்த்தி. நாள்: வியாழன். நிறம்: மஞ்சள். கொடை: கொண்டைக்கடலை, மஞ்சள், வாழைப்பழம், மஞ்சள் துணி. நடத்தை: ஆசிரியர்களையும் மூத்தோரையும் மதியுங்கள்; அகந்தையை விடுங்கள்.', 'fullRemHi' => 'आराधना: भगवान बृहस्पति या दक्षिणामूर्ति। वार: गुरुवार। रंग: पीला। सहायता सामग्री: चना, हल्दी, केले, पीला वस्त्र। आचरण: गुरुओं और वृद्धों का सम्मान करें, और अहंकार त्यागें।'],
            'venus' => ['nameEn' => 'Shukra (Venus) Affliction Indicator', 'nameTa' => 'சுக்கிர கிரகப் பாதிப்பு குறியீடு', 'nameHi' => 'शुक्र ग्रह पीड़ा संकेत',
                'planetEn' => 'Venus (Shukra)', 'planetTa' => 'சுக்கிரன்', 'planetHi' => 'शुक्र',
                'remEn' => 'Pray to Goddess Maha Lakshmi.', 'remTa' => 'மகா லட்சுமியைப் பிரார்த்தனை செய்யுங்கள்.', 'remHi' => 'माँ महालक्ष्मी से प्रार्थना करें।',
                'fullRemEn' => 'Pray to: Goddess Maha Lakshmi. Day: Friday. Colour: White or cream. Give in charity: Rice, yoghurt, white sweets or white cloth. Conduct: Treat women with respect and keep your home and surroundings clean.', 'fullRemTa' => 'வழிபாடு: மகா லட்சுமி. நாள்: வெள்ளி. நிறம்: வெள்ளை அல்லது வெண்மை. கொடை: அரிசி, தயிர், வெள்ளை இனிப்பு, வெள்ளைத் துணி. நடத்தை: பெண்களை மதியுங்கள்; வீட்டையும் சுற்றுப்புறத்தையும் தூய்மையாக வையுங்கள்.', 'fullRemHi' => 'आराधना: माँ महालक्ष्मी। वार: शुक्रवार। रंग: सफेद या क्रीम। सहायता सामग्री: चावल, दही, सफेद मिठाई या सफेद वस्त्र। आचरण: स्त्रियों का सम्मान करें और घर तथा परिवेश को स्वच्छ रखें।'],
            'saturn' => ['nameEn' => 'Shani (Saturn) Affliction Indicator', 'nameTa' => 'சனி கிரகப் பாதிப்பு குறியீடு', 'nameHi' => 'शनि ग्रह पीड़ा संकेत',
                'planetEn' => 'Saturn (Shani)', 'planetTa' => 'சனி', 'planetHi' => 'शनि',
                'remEn' => 'Pray to Lord Shani or Lord Hanuman.', 'remTa' => 'சனி பகவான் அல்லது அனுமனைப் பிரார்த்தனை செய்யுங்கள்.', 'remHi' => 'भगवान शनि या हनुमान जी से प्रार्थना करें।',
                'fullRemEn' => 'Pray to: Lord Shani or Lord Hanuman. Day: Saturday. Colour: Black or dark blue. Give in charity: Black sesame seeds, sesame oil (nallennai), iron, black cloth or warm blankets. Conduct: Serve the poor, the elderly and the disabled, and stay patient and disciplined.', 'fullRemTa' => 'வழிபாடு: சனி பகவான் அல்லது அனுமன். நாள்: சனி. நிறம்: கருப்பு அல்லது அடர் நீலம். கொடை: கருப்பு எள்ளு, நல்லெண்ணெய், இரும்பு, போர்வைகள். நடத்தை: ஏழைகள், முதியோர், மாற்றுத்திறனாளிகளுக்கு உதவுங்கள்; பொறுமையும் ஒழுக்கமும் கடைப்பிடியுங்கள்.', 'fullRemHi' => 'आराधना: भगवान शनि या हनुमान जी। वार: शनिवार। रंग: काला या गहरा नीला। सहायता सामग्री: काले तिल, तिल का तेल, लोहा, कंबल। आचरण: निर्धनों, वृद्धों और दिव्यांगों की सेवा करें, और धैर्य तथा अनुशासन रखें।'],
            'rahu' => ['nameEn' => 'Rahu Affliction Indicator', 'nameTa' => 'ராகு கிரகப் பாதிப்பு குறியீடு', 'nameHi' => 'राहु ग्रह पीड़ा संकेत',
                'planetEn' => 'Rahu', 'planetTa' => 'ராகு', 'planetHi' => 'राहु',
                'remEn' => 'Pray to Goddess Durga or Lord Bhairava.', 'remTa' => 'துர்க்கை அல்லது பைரவரைப் பிரார்த்தனை செய்யுங்கள்.', 'remHi' => 'माँ दुर्गा या भगवान भैरव से प्रार्थना करें।',
                'fullRemEn' => 'Pray to: Goddess Durga or Lord Bhairava. Day: Saturday. Colour: Blue or smoky grey. Give in charity: Black gram, coconut, sesame seeds or warm blankets. Conduct: Avoid addictions and deception, and live an honest, open life.', 'fullRemTa' => 'வழிபாடு: துர்க்கை அல்லது பைரவர். நாள்: சனி. நிறம்: நீலம் அல்லது புகைச் சாம்பல். கொடை: கருப்பு உளுந்து, தேங்காய், எள், போர்வைகள். நடத்தை: பழக்க அடிமைத்தனத்தையும் வஞ்சகத்தையும் தவிருங்கள்; நேர்மையான திறந்த வாழ்வை வாழுங்கள்.', 'fullRemHi' => 'आराधना: माँ दुर्गा या भगवान भैरव। वार: शनिवार। रंग: नीला या धुँआरा स्लेटी। सहायता सामग्री: काला उड़द, नारियल, तिल के बीज, कंबल। आचरण: व्यसनों और छल से बचें, और ईमानदार, खुला जीवन जिएँ।'],
            'ketu' => ['nameEn' => 'Ketu Affliction Indicator', 'nameTa' => 'கேது கிரகப் பாதிப்பு குறியீடு', 'nameHi' => 'केतु ग्रह पीड़ा संकेत',
                'planetEn' => 'Ketu', 'planetTa' => 'கேது', 'planetHi' => 'केतु',
                'remEn' => 'Pray to Lord Ganesha.', 'remTa' => 'விநாயகரைப் பிரார்த்தனை செய்யுங்கள்.', 'remHi' => 'भगवान गणेश से प्रार्थना करें।',
                'fullRemEn' => 'Pray to: Lord Ganesha. Day: Tuesday or Saturday. Colour: Grey or multi-coloured. Give in charity: Sesame seeds, horse gram or warm blankets. Conduct: Feed and care for stray dogs, set aside time for quiet reflection, and avoid needless conflict.', 'fullRemTa' => 'வழிபாடு: விநாயகர். நாள்: செவ்வாய் அல்லது சனி. நிறம்: சாம்பல் அல்லது பல்நிறம். கொடை: எள்ளு, கொள்ளு, போர்வைகள். நடத்தை: தெரு நாய்களுக்கு உணவளித்துக் கவனியுங்கள்; அமைதியான சிந்தனைக்கு நேரம் ஒதுக்குங்கள்; தேவையற்ற சண்டைகளைத் தவிருங்கள்.', 'fullRemHi' => 'आराधना: भगवान गणेश। वार: मंगलवार या शनिवार। रंग: स्लेटी या बहुरंगी। सहायता सामग्री: तिल, कुल्थी, कंबल। आचरण: आवारा कुत्तों को भोजन दें और उनकी देखभाल करें, शांत चिंतन के लिए समय निकालें, और अनावश्यक विवाद से बचें।'],
        ];

        foreach ($navagrahaMeta as $g => $meta) {
            $rasiIdx = $rasiIdxByGraha[$g] ?? null;
            if (!is_int($rasiIdx) || $rasiIdx < 0 || $rasiIdx > 11) { continue; }
            $isDebilitated = ($rasiIdx === $debilitationSigns[$g]);
            $house = $bhavaByGraha[$g] ?? null;
            $isDusthana = in_array($house, [6, 8, 12], true);
            $conjunctMalefic = null;
            foreach ($malefics as $m) {
                if ($m !== $g && $house !== null && ($bhavaByGraha[$m] ?? null) === $house) { $conjunctMalefic = $m; break; }
            }
            $isAfflicted = $isDebilitated || $isDusthana || ($conjunctMalefic !== null);
            if (!$isAfflicted || ($g === 'mars' && $isKujaDosha)) continue;

            $reasonEn = $isDebilitated ? 'is in its traditional debilitation sign' : ($conjunctMalefic !== null ? 'shares a house with ' . ucfirst($conjunctMalefic) . ', classified as a natural malefic by this rule' : 'is placed in House ' . $house . ', treated as a challenging house by this rule');
            $reasonTa = $isDebilitated ? 'பாரம்பரிய நீச ராசியில் உள்ளது' : ($conjunctMalefic !== null ? 'ஒரு எளிய விதிப்படி பாபக் கிரகமாகக் கருதப்படும் ' . $conjunctMalefic . ' உடன் ஒரே பாவத்தில் உள்ளது' : $house . '-ஆம் பாவத்தில் இந்த எளிய விதிப்படி கணிக்கப்பட்டுள்ளது');
            $reasonHi = $isDebilitated ? 'पारंपरिक नीच राशि में स्थित है' : ($conjunctMalefic !== null ? 'इस सरल नियम में पाप ग्रह माने गए ' . $conjunctMalefic . ' के साथ एक भाव में स्थित है' : 'इस सरल नियम के अनुसार भाव ' . $house . ' में स्थित है');

            $doshas[] = [
                'nameEn' => $meta['nameEn'], 'nameTa' => $meta['nameTa'], 'nameHi' => $meta['nameHi'],
                'isPresent' => true, 'isNavagrahaAfflictionIndicator' => true,
                // Item 7c: the rule that triggered this simplified indicator.
                'ruleCode' => $isDebilitated ? 'DEBILITATED' : ($conjunctMalefic !== null ? 'MALEFIC_HOUSE_CONJUNCTION' : 'DUSTHANA_HOUSE'),
                'ruleEn' => $reasonEn, 'ruleTa' => $reasonTa, 'ruleHi' => $reasonHi,
                'severityEn' => 'Simplified indicator present', 'severityTa' => 'எளிய குறியீட்டின்படி பாதிப்பு உள்ளது', 'severityHi' => 'सरल मानदंड के अनुसार संकेत उपस्थित',
                'descriptionEn' => $meta['planetEn'] . ' ' . $reasonEn . '. This is a simplified screening indicator; interpretations vary by tradition.',
                'descriptionTa' => $meta['planetTa'] . ' ' . $reasonTa . '. இது எளிய குறியீடு மட்டுமே; மரபுகளின் விளக்கங்கள் மாறுபடலாம்.',
                'descriptionHi' => $meta['planetHi'] . ' ' . $reasonHi . '। यह केवल एक सरल संकेत है; परंपराओं में व्याख्याएँ भिन्न हो सकती हैं।',
                'traditionalRemedyEn' => $meta['fullRemEn'] ?? $meta['remEn'],
                'traditionalRemedyTa' => $meta['fullRemTa'] ?? $meta['remTa'],
                'traditionalRemedyHi' => $meta['fullRemHi'] ?? $meta['remHi'],
            ];
        }

        // Items 2/5: verdict, severity labels and the fuller Pitru remedy on
        // the assembled dosha list (by name, so the file stays easy to audit).
        foreach ($doshas as &$doshaRef) {
            if (($doshaRef['nameEn'] ?? '') === 'Mars (Kuja) Dosha') {
                $verdict = $kujaStatus === 'DOSHA_CANCELLED' ? 'present-cancelled'
                    : ($kujaStatus === 'DOSHA_PRESENT' || $kujaStatus === 'DOSHA_MILD' ? 'present'
                    : ($kujaStatus === 'DOSHA_NONE' ? 'none' : 'not-assessed'));
                $exceptionSuffixEn = '';
                $exceptionSuffixTa = '';
                $exceptionSuffixHi = '';
                foreach (($kujaDosha['exceptions'] ?? []) as $exception) {
                    if (($exception['code'] ?? '') === 'GURU_MANGALA') {
                        $exceptionSuffixEn .= ' (Guru-Mangala yoga)';
                        $exceptionSuffixTa .= ' (குரு-மங்கள யோகம்)';
                        $exceptionSuffixHi .= ' (गुरु-मंगल योग)';
                    }
                }
                $doshaRef['verdict'] = $verdict;
                // The machine verdict stays 'present-cancelled'; the label names
                // the Dosha Nivrutti rule instead of a flat "cancelled".
                $doshaRef['verdictLabelEn'] = $verdict === 'present-cancelled' ? 'Kuja Dosha present — Dosha Nivrutti applies' . $exceptionSuffixEn : ($verdict === 'present' ? 'Kuja Dosha present' : ($verdict === 'none' ? 'No Kuja Dosha under the chosen rule set' : 'N/A'));
                $doshaRef['verdictLabelTa'] = $verdict === 'present-cancelled' ? 'செவ்வாய் தோஷம் உள்ளது – தோஷ நிவர்த்தி விதி பொருந்துகிறது' . $exceptionSuffixTa : ($verdict === 'present' ? 'செவ்வாய் தோஷம் உள்ளது' : ($verdict === 'none' ? 'செவ்வாய் தோஷம் இல்லை' : 'N/A'));
                $doshaRef['verdictLabelHi'] = $verdict === 'present-cancelled' ? 'मंगल दोष उपस्थित — दोष निवृत्ति नियम लागू' . $exceptionSuffixHi : ($verdict === 'present' ? 'मंगल दोष उपस्थित' : ($verdict === 'none' ? 'मंगल दोष नहीं' : 'N/A'));
                $doshaRef['ruleEn'] = 'Rule set: Mars in houses ' . implode(', ', self::kujaDoshaHouses()) . ' counted from the Lagna, the Moon and Venus.';
                $doshaRef['ruleTa'] = 'விதி: செவ்வாய் லக்னம், சந்திரன், சுக்கிரன் ஆகியவற்றிலிருந்து ' . implode(', ', self::kujaDoshaHouses()) . ' ஆகிய இடங்களில்.';
                $doshaRef['ruleHi'] = 'नियम: मंगल लग्न, चंद्र और शुक्र से ' . implode(', ', self::kujaDoshaHouses()) . ' भावों में।';
            }
            if (($doshaRef['nameEn'] ?? '') === 'Pitru Dosha') {
                $doshaRef['strength'] = $pitruStrength;
                $doshaRef['strengthLabelEn'] = $pitruStrengthLabelEn;
                $doshaRef['strengthLabelTa'] = $pitruStrengthLabelTa;
                $doshaRef['strengthLabelHi'] = $pitruStrengthLabelHi;
                $doshaRef['extendedRemedyEn'] = 'Offer Amavasya tarpanam; feed crows and cows; pray to Maha Vishnu.';
                $doshaRef['extendedRemedyTa'] = 'அமாவாசை தர்ப்பணம் செய்யுங்கள்; காகங்களுக்கும் பசுக்களுக்கும் உணவளியுங்கள்; மகா விஷ்ணு பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.';
                $doshaRef['extendedRemedyHi'] = 'अमावस्या तर्पण करें; कौओं और गायों को भोजन कराएँ; महाविष्णु का नाम लेकर प्रार्थना करें।';
                if ($pitruStrength === 'weak') {
                    $doshaRef['severityEn'] = $pitruStrengthLabelEn;
                    $doshaRef['severityTa'] = $pitruStrengthLabelTa;
                    $doshaRef['severityHi'] = $pitruStrengthLabelHi;
                    $doshaRef['descriptionEn'] = 'The Sun and ' . $nodeNameEn . ' share a sign but are ' . $sunNodeSeparationText . '° apart — outside the 12° orb, so no dosha is flagged: weak (same sign only).';
                    $doshaRef['descriptionTa'] = 'சூரியனும் ' . $nodeNameTa . ' உம் ஒரே ராசியில் ' . $sunNodeSeparationText . '° இடைவெளியில் உள்ளனர் — 12° எல்லைக்குள் இல்லாததால் தோஷம் கொடுக்கவில்லை; பலவீனமான (ஒரே ராசி மட்டும்) அறிகுறி.';
                    $doshaRef['descriptionHi'] = 'सूर्य और ' . $nodeNameHi . ' एक ही राशि में हैं पर ' . $sunNodeSeparationText . '° दूर — 12° सीमा से बाहर, इसलिए दोष नहीं: दुर्बल (केवल समान राशि)।';
                } elseif ($pitruStrength === 'present') {
                    $doshaRef['descriptionEn'] = 'The Sun is within 12° of ' . $nodeNameEn . ' (' . $sunNodeSeparationText . '° apart)' . ($isSaturnIn9th ? ' and Saturn occupies the 9th house by sign' : '') . '. These are simplified indicators only, not a complete Pitru assessment.';
                    $doshaRef['descriptionTa'] = 'சூரியன் ' . $nodeNameTa . ' உடன் 12° எல்லைக்குள் (' . $sunNodeSeparationText . '°) உள்ளார்' . ($isSaturnIn9th ? '; சனி 9-ஆம் பாவத்திலும் உள்ளார்' : '') . '. இவை தேர்ந்தெடுத்த எளிய குறியீடுகள் மட்டுமே.';
                    $doshaRef['descriptionHi'] = 'सूर्य ' . $nodeNameHi . ' से 12° के भीतर (' . $sunNodeSeparationText . '° अंतर) है' . ($isSaturnIn9th ? ' तथा शनि नवम भाव में है' : '') . '। ये केवल सरल संकेत हैं।';
                }
            }
        }
        unset($doshaRef);

        $ownEn = function ($h) use ($ordinal) {
            if (empty($h['isAvailable'])) return 'placement unavailable (N/A)';
            return $h['isOwnSign'] ? 'in its own sign' : "in the " . $ordinal($h['bhava']) . " house";
        };
        $ownTa = function ($h) {
            if (empty($h['isAvailable'])) return 'நிலை கிடைக்கவில்லை (N/A)';
            return $h['isOwnSign'] ? 'சுய ராசியில்' : "{$h['bhava']}-ஆம் இடத்தில்";
        };
        $ownHi = function ($h) {
            if (empty($h['isAvailable'])) return 'स्थिति उपलब्ध नहीं (N/A)';
            return $h['isOwnSign'] ? 'स्वराशि' : "{$h['bhava']}वें भाव";
        };

        // Live Sani Transit computation
        $nowTs = time();
        $nowJd = ($nowTs / 86400.0) + 2440587.5;
        $saturnTransitSidereal = self::computeGeocentricPositions($nowJd, false)['sidereal']['saturn'];
        $saturnTransitRasiIdx = intval(floor($saturnTransitSidereal / 30.0)) % 12;
        $saturnHouseFromMoon = (($saturnTransitRasiIdx - $moonRasiIndex + 12) % 12) + 1;
        $isSaniFavourable = in_array($saturnHouseFromMoon, [3, 6, 11], true);
        $saturnHouseOrdinal = $ordinal($saturnHouseFromMoon);

        $saniTransitStatusEn = $isSaniFavourable ? 'Favourable Transit' : 'Transit demands remedies';
        $saniTransitStatusTa = $isSaniFavourable ? 'அனுகூலமான சனி பெயர்ச்சி' : 'பரிகாரங்கள் தேவைப்படும் சனி பெயர்ச்சி';
        $saniTransitStatusHi = $isSaniFavourable ? 'अनुकूल शनि गोचर' : 'उपाय योग्य शनि गोचर';

        // Career placement-aware wording (10th lord)
        if (empty($h10['isAvailable'])) {
            $careerEn = 'Career-lord placement is unavailable (N/A); chart-derived career guidance cannot be determined.';
            $careerTa = 'தொழில் அதிபதியின் நிலை கிடைக்கவில்லை (N/A); ஜாதக அடிப்படையிலான வழிகாட்டலைத் தீர்மானிக்க முடியாது.';
            $careerHi = 'दशमेश की स्थिति उपलब्ध नहीं (N/A); कुंडली-आधारित मार्गदर्शन निर्धारित नहीं किया जा सकता।';
        } elseif ($h10['isDusthana'] && !$h10['isOwnSign']) {
            $careerEn = "With the career lord in the " . $ordinal($h10['bhava']) . " house, career progress requires patience, consistent effort, and navigating workplace dynamics with care.";
            $careerTa = "10-ஆம் இட அதிபதி {$h10['bhava']}-ஆம் இடத்தில் அமைந்துள்ளதால், தொழிலில் பொறுமையும் தொடர் முயற்சியும் தேவைப்படும். விவேகமான திட்டமிடல் வெற்றியைத் தரும்.";
            $careerHi = "दशमेश {$h10['bhava']}वें भाव में स्थित होने के कारण कार्यक्षेत्र में धैर्य, निरंतर परिश्रम एवं सावधानीपूर्वक निर्णय लेने की आवश्यकता है।";
        } else {
            $careerEn = "With the career lord " . ($h10['isOwnSign'] ? 'placed in its own sign' : "in the " . $ordinal($h10['bhava']) . " house") . ", career strength is greatly enhanced with natural leadership and recognition.";
            $careerTa = "10-ஆம் இட அதிபதி " . $ownTa($h10) . " அமைந்துள்ளதால், தொழில் மிகவும் பலம் பெறும். இயல்பான தலைமைத்துவமும் அங்கீகாரமும் கிடைக்கும்.";
            $careerHi = "दशमेश " . $ownHi($h10) . " में स्थित होने से कार्यक्षेत्र में उन्नति एवं प्रतिष्ठा प्राप्त होगी।";
        }
        // Item 3: when the 10th lord is debilitated (Mars for a Mithunam Lagna,
        // say) name the Neecha Bhanga rule rather than implying a guaranteed
        // career result either way.
        if (!empty($h10['dignityNoteEn'])) { $careerEn .= ' ' . $h10['dignityNoteEn']; $careerTa .= ' ' . $h10['dignityNoteTa']; $careerHi .= ' ' . $h10['dignityNoteHi']; }

        // Marriage placement-aware wording (7th lord)
        if (empty($h7['isAvailable'])) {
            $marriageEn = '7th-lord placement is unavailable (N/A); chart-derived relationship guidance cannot be determined.';
            $marriageTa = '7-ஆம் அதிபதியின் நிலை கிடைக்கவில்லை (N/A); ஜாதக அடிப்படையிலான உறவு வழிகாட்டலைத் தீர்மானிக்க முடியாது.';
            $marriageHi = 'सप्तमेश की स्थिति उपलब्ध नहीं (N/A); कुंडली-आधारित संबंध मार्गदर्शन निर्धारित नहीं किया जा सकता।';
        } elseif ($h7['isDusthana'] && !$h7['isOwnSign']) {
            $marriageEn = "With the 7th lord in the " . $ordinal($h7['bhava']) . " house, mutual understanding, patient communication, and adjustments are essential for marital harmony.";
            $marriageTa = "7-ஆம் இட அதிபதி {$h7['bhava']}-ஆம் இடத்தில் அமைந்துள்ளதால், திருமண வாழ்வில் பரஸ்பர புரிதலும் பொறுமையும் நல்லிணக்கத்தை வளர்க்கும்.";
            $marriageHi = "सप्तमेश {$h7['bhava']}वें भाव में स्थित होने से दांपत्य जीवन में आपसी समझ, धैर्य एवं सामंजस्य बनाए रखना आवश्यक है।";
        } else {
            $marriageEn = "With the 7th lord " . ($h7['isOwnSign'] ? 'placed in its own sign' : "in the " . $ordinal($h7['bhava']) . " house") . ", married life is strongly supported with natural harmony.";
            $marriageTa = "7-ஆம் இட அதிபதி " . $ownTa($h7) . " அமைந்துள்ளதால், திருமண வாழ்க்கை மிகவும் பலம் பெறும்.";
            $marriageHi = "सप्तमेश " . $ownHi($h7) . " में स्थित होने से दांपत्य जीवन सुखद रहेगा।";
        }

        // Family / Property placement-aware wording (4th lord)
        if (empty($h4['isAvailable'])) {
            $familyEn = '4th-lord placement is unavailable (N/A); chart-derived property guidance cannot be determined.';
            $familyTa = '4-ஆம் அதிபதியின் நிலை கிடைக்கவில்லை (N/A); ஜாதக அடிப்படையிலான சொத்து வழிகாட்டலைத் தீர்மானிக்க முடியாது.';
            $familyHi = 'चतुर्थेश की स्थिति उपलब्ध नहीं (N/A); कुंडली-आधारित संपत्ति मार्गदर्शन निर्धारित नहीं किया जा सकता।';
        } elseif ($h4['isDusthana'] && !$h4['isOwnSign']) {
            $familyEn = "With the 4th lord in the " . $ordinal($h4['bhava']) . " house, property transactions and domestic matters require careful diligence and verification.";
            $familyTa = "சுக அதிபதி {$h4['bhava']}-ஆம் இடத்தில் அமைந்துள்ளதால், சொத்து மற்றும் குடும்ப விவகாரங்களில் கூடுதல் கவனம் தேவைப்படும்.";
            $familyHi = "चतुर्थेश {$h4['bhava']}वें भाव में स्थित होने से भूमि-भवन एवं पारिवारिक मामलों में सावधानी बरतें।";
        } else {
            $familyEn = "With the 4th lord " . ($h4['isOwnSign'] ? 'in its own sign' : "in the " . $ordinal($h4['bhava']) . " house") . ", prospects for owning property/land are favourable and domestic happiness is indicated.";
            $familyTa = "சுக அதிபதி " . $ownTa($h4) . " அமைந்துள்ளதால், சொந்த வீடு/நிலம் வாய்ப்பு நல்ல நிலையில் இருக்கும். குடும்ப மகிழ்ச்சியும் அமையும்.";
            $familyHi = "चतुर्थेश " . $ownHi($h4) . " में स्थित होने से गृह लाभ के योग हैं।";
        }

        // Foreign Travel / Fortune placement-aware wording (9th lord)
        if (empty($h9['isAvailable'])) {
            $foreignTravelEn = '9th-lord placement is unavailable (N/A); chart-derived travel guidance cannot be determined.';
            $foreignTravelTa = '9-ஆம் அதிபதியின் நிலை கிடைக்கவில்லை (N/A); ஜாதக அடிப்படையிலான பயண வழிகாட்டலைத் தீர்மானிக்க முடியாது.';
            $foreignTravelHi = 'नवमेश की स्थिति उपलब्ध नहीं (N/A); कुंडली-आधारित यात्रा मार्गदर्शन निर्धारित नहीं किया जा सकता।';
        } elseif ($h9['isDusthana'] && !$h9['isOwnSign']) {
            $foreignTravelEn = "With the 9th lord in the " . $ordinal($h9['bhava']) . " house, fortunes improve through persistent self-effort, higher learning, and spiritual devotion.";
            $foreignTravelTa = "பாக்கிய அதிபதி {$h9['bhava']}-ஆம் இடத்தில் அமைந்துள்ளதால், சுய முயற்சி மற்றும் ஆன்மீக வழிபாட்டின் மூலம் அதிர்ஷ்டமும் உயர்வும் கிட்டும்.";
            $foreignTravelHi = "नवमेश {$h9['bhava']}वें भाव में स्थित होने से निरंतर प्रयास एवं आध्यात्मिक साधना से भाग्योदय होगा।";
        } else {
            $foreignTravelEn = "With the 9th lord " . ($h9['isOwnSign'] ? 'in its own sign' : "in the " . $ordinal($h9['bhava']) . " house") . ", foreign connections and fortune are favourably indicated.";
            $foreignTravelTa = "பாக்கிய அதிபதி " . $ownTa($h9) . " அமைந்துள்ளதால், வெளிநாட்டு தொடர்பு மற்றும் அதிர்ஷ்டம் சாதகமாக இருக்கும்.";
            $foreignTravelHi = "नवमेश " . $ownHi($h9) . " में स्थित होने से विदेश संपर्क शुभ रहेगा।";
        }

        // Current period guidance (derived from live Sani transit)
        if ($isSaniFavourable) {
            $currentPeriodGuidanceEn = "Saturn's transit in the {$saturnHouseOrdinal} house from Janma Rasi is favourable, supporting career progress and success. Worshipping Lord Ganesha and regular prayers will sustain positive momentum.";
            $currentPeriodGuidanceTa = "ஜென்ம ராசியிலிருந்து {$saturnHouseFromMoon}-ஆம் இடத்தில் சனி பகவான் சஞ்சரிப்பதால் நற்பலன்களும் காரிய வெற்றியும் உண்டாகும். விநாயகர் மற்றும் பெருமாள் வழிபாடு தொடர்ந்து நலம் சேர்க்கும்.";
            $currentPeriodGuidanceHi = "जन्म राशि से {$saturnHouseOrdinal} भाव में शनि का गोचर अनुकूल फल एवं कार्यक्षेत्र में प्रगति प्रदान करेगा। भगवान गणेश एवं विष्णु की आराधना से शुभता बढ़ेगी।";
        } else {
            $currentPeriodGuidanceEn = "Saturn's transit in the {$saturnHouseOrdinal} house from Janma Rasi calls for patience and discipline. Pray to Ganesha or Shiva.";
            $currentPeriodGuidanceTa = "ஜென்ம ராசியிலிருந்து {$saturnHouseFromMoon}-ஆம் இடத்தில் சனி பகவான் சஞ்சரிப்பதால் பொறுமையும் கவனமும் தேவை. விநாயகர் அல்லது சிவனைப் பிரார்த்தனை செய்யுங்கள்.";
            $currentPeriodGuidanceHi = "जन्म राशि से {$saturnHouseOrdinal} भाव में शनि का गोचर सावधानी और धैर्य की मांग करता है। गणेश या शिव से प्रार्थना करें।";
        }

        $healthEn = !empty($h1['isAvailable']) ? "With the Lagna lord " . $ownEn($h1) . ", attention to diet and lifestyle habits is advised. Regular exercise supports good health." : 'Lagna-lord placement unavailable (N/A); chart-derived health guidance cannot be determined.';
        $healthTa = !empty($h1['isAvailable']) ? "லக்னாதிபதி " . $ownTa($h1) . " அமைந்துள்ளதால், உணவு மற்றும் வாழ்க்கை முறையில் கவனம் தேவை. ஒழுங்கான உடற்பயிற்சி நல்ல ஆரோக்கியத்தைத் தரும்." : 'லக்னாதிபதியின் நிலை கிடைக்கவில்லை (N/A); ஜாதக அடிப்படையிலான ஆரோக்கிய வழிகாட்டலைத் தீர்மானிக்க முடியாது.';
        $healthHi = !empty($h1['isAvailable']) ? "लग्नेश " . $ownHi($h1) . " में स्थित होने के कारण खान-पान एवं दिनचर्या पर ध्यान देना लाभकारी रहेगा।" : 'लग्नेश की स्थिति उपलब्ध नहीं (N/A); कुंडली-आधारित स्वास्थ्य मार्गदर्शन निर्धारित नहीं किया जा सकता।';
        // Item 3: the Health card names the Neecha Bhanga rule when the Lagna
        // lord is debilitated, never a flat "cancelled" and never a promise.
        if (!empty($h1['dignityNoteEn'])) { $healthEn .= ' ' . $h1['dignityNoteEn']; $healthTa .= ' ' . $h1['dignityNoteTa']; $healthHi .= ' ' . $h1['dignityNoteHi']; }

        $summary = [
            'healthEn' => $healthEn,
            'healthTa' => $healthTa,
            'healthHi' => $healthHi,
            'wealthEn' => !empty($h2['isAvailable']) ? "With the 2nd lord " . $ownEn($h2) . ", gains arrive through multiple income streams. Consistent saving habits build strong finances over time." : '2nd-lord placement unavailable (N/A); chart-derived financial guidance cannot be determined.',
            'wealthTa' => !empty($h2['isAvailable']) ? "தன அதிபதி " . $ownTa($h2) . " அமைந்துள்ளதால், பல வழிகளிலிருந்து இலாபம் கிடைக்கும். சேமிப்பு பழக்கம் தொடர்ந்தால் நல்ல நிதி நிலை உருவாகும்." : 'தன அதிபதியின் நிலை கிடைக்கவில்லை (N/A); ஜாதக அடிப்படையிலான நிதி வழிகாட்டலைத் தீர்மானிக்க முடியாது.',
            'wealthHi' => !empty($h2['isAvailable']) ? "द्वितीयेश " . $ownHi($h2) . " में स्थित होने से विभिन्न स्रोतों से धन लाभ होगा।" : 'द्वितीयेश की स्थिति उपलब्ध नहीं (N/A); कुंडली-आधारित वित्तीय मार्गदर्शन निर्धारित नहीं किया जा सकता।',
            'educationEn' => !empty($h5['isAvailable']) ? "With the 5th lord " . $ownEn($h5) . ", interest in higher education and spiritual knowledge is indicated." : '5th-lord placement unavailable (N/A); chart-derived education guidance cannot be determined.',
            'educationTa' => !empty($h5['isAvailable']) ? "வித்யா அதிபதி " . $ownTa($h5) . " அமைந்துள்ளதால், உயர்கல்வி மற்றும் ஆன்மீக அறிவில் ஆர்வம் காணப்படும்." : '5-ஆம் அதிபதியின் நிலை கிடைக்கவில்லை (N/A); ஜாதக அடிப்படையிலான கல்வி வழிகாட்டலைத் தீர்மானிக்க முடியாது.',
            'educationHi' => !empty($h5['isAvailable']) ? "पंचमेश " . $ownHi($h5) . " में स्थित होने से उच्च शिक्षा में रुचि रहेगी।" : 'पंचमेश की स्थिति उपलब्ध नहीं (N/A); कुंडली-आधारित शिक्षा मार्गदर्शन निर्धारित नहीं किया जा सकता।',
            'careerEn' => $careerEn,
            'careerTa' => $careerTa,
            'careerHi' => $careerHi,
            'marriageEn' => $marriageEn,
            'marriageTa' => $marriageTa,
            'marriageHi' => $marriageHi,
            'familyEn' => $familyEn,
            'familyTa' => $familyTa,
            'familyHi' => $familyHi,
            'foreignTravelEn' => $foreignTravelEn,
            'foreignTravelTa' => $foreignTravelTa,
            'foreignTravelHi' => $foreignTravelHi,
            'currentPeriodGuidanceEn' => $currentPeriodGuidanceEn,
            'currentPeriodGuidanceTa' => $currentPeriodGuidanceTa,
            'currentPeriodGuidanceHi' => $currentPeriodGuidanceHi
        ];

        $dashaTargetTimestamp = time();
        $dasha = self::calculateVimshottariDasha($moonSidereal, $timeTs, $dashaTargetTimestamp, $timeZoneId, $tz);
        $dashaPeriods = self::calculateVimshottariDashaPeriods($moonSidereal, $timeTs, $dashaTargetTimestamp, $timeZoneId, $tz);

        // Item 4: the guidance card uses the real running dasa and ALWAYS names
        // a Mahadasa that begins inside the next 12 months.
        $nextMahadasa = self::nextMahadasaInfo($dashaPeriods);
        $dasha['nextMahadasa'] = $nextMahadasa;
        $dashaContextEn = sprintf('The running period is %s Mahadasa with %s Bhukti.', $dasha['currentLord'] ?? 'N/A', $dasha['subLord'] ?? 'N/A');
        $dashaContextTa = sprintf('தற்போது %s மகாதிசை, %s புக்தி.', $dasha['currentLordTa'] ?? 'N/A', $dasha['subLordTa'] ?? 'N/A');
        $dashaContextHi = sprintf('वर्तमान में %s महादशा, %s भुक्ति।', $dasha['currentLordHi'] ?? 'N/A', $dasha['subLordHi'] ?? 'N/A');
        $summary['currentPeriodGuidanceEn'] = $dashaContextEn . ' ' . $summary['currentPeriodGuidanceEn'] . ($nextMahadasa['noticeEn'] !== '' ? ' ' . $nextMahadasa['noticeEn'] : '');
        $summary['currentPeriodGuidanceTa'] = $dashaContextTa . ' ' . $summary['currentPeriodGuidanceTa'] . ($nextMahadasa['noticeTa'] !== '' ? ' ' . $nextMahadasa['noticeTa'] : '');
        $summary['currentPeriodGuidanceHi'] = $dashaContextHi . ' ' . $summary['currentPeriodGuidanceHi'] . ($nextMahadasa['noticeHi'] !== '' ? ' ' . $nextMahadasa['noticeHi'] : '');
        // Item 7b: Kendradhipati is quoted by the Career and Marriage cards.
        $summary['careerEn'] = $summary['careerEn'] . $kendraCareerNoteEn;
        $summary['careerTa'] = $summary['careerTa'] . $kendraCareerNoteTa;
        $summary['careerHi'] = $summary['careerHi'] . $kendraCareerNoteHi;
        $summary['marriageEn'] = $summary['marriageEn'] . $kendraMarriageNoteEn;
        $summary['marriageTa'] = $summary['marriageTa'] . $kendraMarriageNoteTa;
        $summary['marriageHi'] = $summary['marriageHi'] . $kendraMarriageNoteHi;

        return [
            'nativeName' => $name,
            'devoteeName' => $name,
            'dob' => $dob,
            'tob' => $tob,
            'birthPlace' => trim((string) $payload['birthPlace']),
            'country' => trim((string) ($payload['country'] ?? '')),
            'latitude' => $lat,
            'longitude' => $lng,
            'timezoneOffsetHours' => $tz,
            'timeZoneId' => $timeZoneId !== '' ? $timeZoneId : null,
            // How the birth instant was fixed: 'payload' (client sent a valid
            // IANA id), 'coordinates' (zone derived from lat/long) or 'offset'
            // (fixed offset only). timezoneOffsetAdjusted is true when the
            // submitted offset disagreed with the historical rules by >= 30 min.
            'timeZoneSource' => $timeZoneSource,
            'timezoneAbbreviation' => $birthInstant['abbreviation'],
            'daylightSaving' => $birthInstant['dst'],
            'submittedTimezoneOffsetHours' => $birthInstant['suppliedOffsetHours'],
            'timezoneOffsetAdjusted' => $birthInstant['offsetAdjusted'],
            'ayanamsa' => round($ayanamsa, 4),
            // Which lunar-node convention produced Rahu/Ketu ('TRUE' | 'MEAN').
            'nodeType' => $ephemeris['nodeType'],
            'ephemeris' => [
                'model' => 'VSOP87D/ELP2000-82, IAU1980 nutation, Lahiri (Chitra Paksha) true ayanamsa',
                'rahuNodeType' => $ephemeris['nodeType'],
                'rahuTrueNode' => round($siderealLongitudes['trueNode'], 5),
                'rahuMeanNode' => round($siderealLongitudes['meanNode'], 5),
                'julianDayUT' => round($julianDay, 6),
                'deltaTSeconds' => round($ephemeris['deltaT'], 2),
                'ayanamsaTrue' => round($ayanamsa, 6),
                'ayanamsaMean' => round($ephemeris['ayanamsaMean'], 6),
                'nutationLongitude' => round($ephemeris['nutation']['dpsi'] * 3600.0, 2), // arcseconds
                'siderealLongitudes' => array_map(static fn($v) => round($v, 5), $siderealLongitudes),
                'lagnaSidereal' => round($lagnaSidereal, 5),
            ],
            'lagnaRasi' => $lagnaRasiIndex + 1,
            'lagnaDegrees' => round(fmod($lagnaSidereal, 30), 2),
            // D9 Ascendant: the same 3°20′ rule, applied to the exact sidereal Lagna.
            'lagnaNavamsaRasi' => (intval(floor($lagnaSidereal / (360.0 / 108.0))) % 12) + 1,
            'isLagnaVargottama' => ((intval(floor($lagnaSidereal / (360.0 / 108.0))) % 12) + 1) === ($lagnaRasiIndex + 1),
            'chandraRasi' => $moonRasiIndex + 1,
            'janmaNakshatraIndex' => $nakshatraIndex,
            'janmaNakshatraEn' => self::$NAKSHATRAS_EN[$nakshatraIndex],
            'janmaNakshatraTa' => self::$NAKSHATRAS_TA[$nakshatraIndex],
            'janmaPada' => $padaIndex,
            'birthDetails' => [
                'dob' => $dob,
                'tob' => $tob,
                'birthPlace' => trim((string) $payload['birthPlace']),
                'country' => trim((string) ($payload['country'] ?? '')),
                'latitude' => $lat,
                'longitude' => $lng,
                'timezoneOffsetHours' => $tz,
                'timeZoneId' => $timeZoneId !== '' ? $timeZoneId : null,
                'timeZoneSource' => $timeZoneSource,
                'daylightSaving' => $birthInstant['dst']
            ],
            'lagna' => [
                'rasi' => $lagna['en'],
                'rasiTa' => $lagna['ta'],
                'lord' => $lagna['lord'],
                'lordTa' => $lagna['lordTa']
            ],
            'rasi' => [
                'name' => $rasi['en'],
                'nameTa' => $rasi['ta'],
                'lord' => $rasi['lord'],
                'lordTa' => $rasi['lordTa']
            ],
            'nakshatram' => [
                'name' => self::$NAKSHATRAS_EN[$nakshatraIndex],
                'nameTa' => self::$NAKSHATRAS_TA[$nakshatraIndex],
                'pada' => $padaIndex
            ],
            'planets' => $planets,
            'planetPositions' => $planetPositions,
            'dasha' => $dasha,
            'dashaPeriods' => $dashaPeriods,
            'saniTransit' => [
                'status' => $saniTransitStatusEn,
                'statusTa' => $saniTransitStatusTa,
                'statusHi' => $saniTransitStatusHi,
                'house' => $saturnHouseFromMoon,
                'phase' => "{$saturnHouseOrdinal} House Transit"
            ],
            'kujaDosha' => $kujaDosha,
            'dosha' => [
                'chevvaiDosha' => $isKujaDosha,
                'chevvaiDoshaStatus' => $kujaStatus,
                'rahuKetuDosha' => $isKalaSarpaDosha,
                'summary' => $isKujaDosha === null
                    ? 'Kuja Dosha assessment unavailable because Mars placement data is missing.'
                    : ($isKujaDosha
                        ? ($isKujaMild
                            ? 'Mild Sevvay Dosha (reduced by classical rules); simple remedies and a compatible horoscope are sufficient.'
                            : 'Sevvay Dosha present; traditional remedies and a Dosha Samyam (matching) partner chart are recommended.')
                        : ($isKujaCancelled
                            ? 'Sevvay Dosha is relieved by a classical Dosha Nivrutti rule; it is an indicator only, not a guarantee of any outcome.'
                            : ($isKalaSarpaDosha || $isPitruDosha === true
                            ? 'Dosha indications present; traditional remedies and prayers recommended.'
                            : 'No trigger was found under the available selected rules; this is not a complete dosha assessment.')))
            ],
            'doshas' => $doshas,
            'grahaYuddha' => $grahaYuddha,
            'kendradhipati' => $kendradhipati,
            'yogas' => $yogas,
            'pitruStrength' => $pitruStrength,
            'summary' => $summary,
            'sevvaiDosha' => [
                'hasDosha' => $isKujaDosha,
                'status' => $kujaStatus,
                'severityEn' => $kujaDosha['severityEn'],
                'severityTa' => $kujaDosha['severityTa'],
                'severityHi' => $kujaDosha['severityHi'],
                'recommendation' => $kujaDosha['explanationEn'],
                'recommendationTa' => $kujaDosha['explanationTa'],
                'recommendationHi' => $kujaDosha['explanationHi']
            ],
            'kalaSarpaDosha' => ['hasDosha' => $isKalaSarpaDosha, 'typeEn' => $isKalaSarpaDosha ? 'Present' : 'None', 'typeTa' => $isKalaSarpaDosha ? 'காலசர்ப தோஷம் உள்ளது' : 'இல்லை'],
            'pitruDosha' => [
                'hasDosha' => $isPitruDosha,
                'severityEn' => $isPitruDosha === null ? 'N/A' : ($isPitruDosha ? 'Moderate' : 'Favourable'),
                'severityTa' => $isPitruDosha === null ? 'N/A' : ($isPitruDosha ? 'மிதமான தோஷம்' : 'நல்ல நிலை')
            ],
            'generatedAt' => date('Y-m-d H:i:s'),
            'certifiedBy' => 'ASTRO SIVAM Astrological Council'
        ];
    }

    public static function calculateMatchmaking($payload) {
        $boy = $payload['groom'] ?? $payload['groomDetails'] ?? $payload['boy'] ?? $payload['boyDetails'] ?? [];
        $girl = $payload['bride'] ?? $payload['brideDetails'] ?? $payload['girl'] ?? $payload['girlDetails'] ?? [];

        if (empty($boy) && empty($girl)) {
            if (isset($payload['p1']) && isset($payload['p2'])) {
                $boy = $payload['p1'];
                $girl = $payload['p2'];
            }
        }

        $boyH = self::calculateHoroscope($boy);
        $girlH = self::calculateHoroscope($girl);

        $poruthamDefs = [
            ['id' => 'dina', 'nameEn' => 'Dina Porutham', 'nameTa' => 'தினப் பொருத்தம்', 'nameHi' => 'दिन पोरुथम', 'pts' => 3, 'max' => 3, 'enum' => 'UTTHAMAM', 'expEn' => 'Longevity, good health and freedom from discord.', 'expTa' => 'நீண்ட ஆயுள், நல்ல ஆரோக்கியம் மற்றும் கருத்து வேறுபாடு இன்மை.', 'expHi' => 'दीर्घायु, अच्छा स्वास्थ्य एवं मतभेद रहित जीवन।', 'lackEn' => 'The star distance does not carry full Dina strength; vitality, health support and freedom from discord are only partly assured.', 'lackTa' => 'நட்சத்திர இடைவெளியில் முழு தின பலம் இல்லை; ஆரோக்கியம், ஆயுள் ஆதரவு மற்றும் கருத்து ஒற்றுமை முழுமையாக இல்லை.', 'lackHi' => 'नक्षत्र दूरी में पूर्ण दिन बल नहीं है; स्वास्थ्य, दीर्घायु एवं मतभेद-रहितता का समर्थन अपूर्ण है।', 'crucial' => false],
            ['id' => 'gana', 'nameEn' => 'Gana Porutham', 'nameTa' => 'கணப் பொருத்தம்', 'nameHi' => 'गण पोरुथम', 'pts' => 4, 'max' => 4, 'enum' => 'UTTHAMAM', 'expEn' => 'Harmonious temperament and mutual affection.', 'expTa' => 'இணக்கமான சுபாவமும் பரஸ்பர பாசமும்.', 'expHi' => 'सामंजस्यपूर्ण स्वभाव एवं परस्पर स्नेह।', 'lackEn' => 'The two Ganas differ, so temperamental harmony and mutual affection are not assured and need deliberate adjustment.', 'lackTa' => 'இரு கணங்கள் வேறுபடுவதால் குண ஒற்றுமையும் பாசமும் தானாக அமையாது; விட்டுக்கொடுத்தல் தேவை.', 'lackHi' => 'दोनों गण भिन्न हैं; स्वभाव-सामंजस्य एवं परस्पर स्नेह के लिए समझदारी आवश्यक है।', 'crucial' => false],
            ['id' => 'mahendra', 'nameEn' => 'Mahendra Porutham', 'nameTa' => 'மகேந்திரப் பொருத்தம்', 'nameHi' => 'महेंद्र पोरुथम', 'pts' => 3, 'max' => 3, 'enum' => 'UTTHAMAM', 'expEn' => 'Children, lineage expansion and wealth generation.', 'expTa' => 'குழந்தைகள், வம்சவிருத்தி மற்றும் செல்வ வளர்ச்சி.', 'expHi' => 'संतान, वंश वृद्धि एवं धन लाभ।', 'lackEn' => 'The star distance gives no Mahendra support, so this blessing for children, lineage growth and wealth is absent.', 'lackTa' => 'நட்சத்திர இடைவெளியில் மகேந்திர ஆதரவு இல்லை; குழந்தை, வம்சவிருத்தி மற்றும் செல்வ வளர்ச்சி ஆசி இல்லை.', 'lackHi' => 'नक्षत्र दूरी से महेंद्र सहायता नहीं मिलती; संतान, वंश वृद्धि एवं धन लाभ का फल नहीं है।', 'crucial' => false],
            ['id' => 'stree_deergha', 'nameEn' => 'Stree Deergha Porutham', 'nameTa' => 'ஸ்திரீ தீர்க்கப் பொருத்தம்', 'nameHi' => 'स्त्री दीर्घ पोरुथम', 'pts' => 2, 'max' => 2, 'enum' => 'UTTHAMAM', 'expEn' => 'Long, prosperous life and all-round growth for the bride.', 'expTa' => 'மனைவிக்கு நீண்ட ஆயுளும் அனைத்துவிதமான வளர்ச்சியும்.', 'expHi' => 'वधू को दीर्घायु, सुख एवं सर्वांगीण उन्नति।', 'lackEn' => 'The star distance is short, so long life and all-round growth for the bride are not strengthened.', 'lackTa' => 'நட்சத்திர இடைவெளி குறைவு; மணமகளுக்கு நீண்ட ஆயுளும் அனைத்துவித வளர்ச்சியும் வலுப்படுத்தப்படவில்லை.', 'lackHi' => 'नक्षत्र दूरी कम है; वधू की दीर्घायु एवं सर्वांगीण उन्नति को बल नहीं मिलता।', 'crucial' => false],
            ['id' => 'yoni', 'nameEn' => 'Yoni Porutham', 'nameTa' => 'யோனிப் பொருத்தம்', 'nameHi' => 'योनि पोरुथम', 'pts' => 4, 'max' => 4, 'enum' => 'UTTHAMAM', 'expEn' => 'Physical and biological compatibility.', 'expTa' => 'உடல் மற்றும் உயிரியல் இணக்கம்.', 'expHi' => 'शारीरिक एवं जैविक अनुकूलता।', 'lackEn' => 'The two Yoni animals are not a strong match (neutral or inimical), so physical and biological harmony is weak or strained.', 'lackTa' => 'இரு யோனி விலங்குகளும் வலுவான பொருத்தம் அல்ல (நடுநிலை அல்லது பகை); உடல் மற்றும் உயிரியல் இணக்கம் பலவீனம் அல்லது வலி.', 'lackHi' => 'दोनों योनि पशु मजबूत मेल नहीं हैं (तटस्थ या शत्रु); शारीरिक एवं जैविक सामंजस्य कमज़ोर है।', 'crucial' => false],
            ['id' => 'rasi', 'nameEn' => 'Rasi Porutham', 'nameTa' => 'ராசிப் பொருத்தம்', 'nameHi' => 'राशि पोरुथम', 'pts' => 5, 'max' => 5, 'enum' => 'UTTHAMAM', 'expEn' => 'Union of families and life stability.', 'expTa' => 'குடும்பங்களின் ஒற்றுமை மற்றும் வாழ்க்கை உறுதி.', 'expHi' => 'परिवारों का मिलन एवं जीवन स्थिरता।', 'lackEn' => 'The Moon signs are an inauspicious distance apart, so family union and life stability need conscious effort.', 'lackTa' => 'சந்திர ராசிகள் சாதகமற்ற இடைவெளியில் உள்ளன; குடும்ப ஒற்றுமையும் வாழ்க்கை உறுதியும் முயற்சியால் மட்டுமே அமையும்.', 'lackHi' => 'चंद्र राशियाँ अशुभ दूरी में हैं; पारिवारिक मिलन एवं जीवन स्थिरता के लिए प्रयास आवश्यक है।', 'crucial' => false],
            ['id' => 'rasiyadhipathi', 'nameEn' => 'Rasiyadhipathi Porutham', 'nameTa' => 'ராசியாதிபதிப் பொருத்தம்', 'nameHi' => 'राशि अधिपति पोरुथम', 'pts' => 4, 'max' => 4, 'enum' => 'UTTHAMAM', 'expEn' => 'Friendly planetary lords bringing peace.', 'expTa' => 'நட்பான ராசி அதிபதிகள் அமைதியைத் தரும்.', 'expHi' => 'मैत्रीपूर्ण राशि स्वामी शांति प्रदान करते हैं।', 'lackEn' => 'The ruling lords are not mutual friends, so peace between the families depends on conscious understanding.', 'lackTa' => 'ராசி அதிபதிகள் பரஸ்பர நண்பர்கள் அல்ல; குடும்பங்களிடையே அமைதி புரிந்துணர்வால் மட்டுமே அமையும்.', 'lackHi' => 'राशि स्वामी परस्पर मित्र नहीं हैं; शांति हेतु समझदारी आवश्यक है।', 'crucial' => false],
            ['id' => 'vasiya', 'nameEn' => 'Vasiya Porutham', 'nameTa' => 'வசியப் பொருத்தம்', 'nameHi' => 'वश्य पोरुथम', 'pts' => 2, 'max' => 2, 'enum' => 'MADHYAMAM', 'expEn' => 'Mutual attraction and mental alignment.', 'expTa' => 'பரஸ்பர ஈர்ப்பும் மன ஒற்றுமையும்.', 'expHi' => 'परस्पर आकर्षण एवं मानसिक तालमेल।', 'lackEn' => 'The special Vasiya pull is absent; mutual attraction and mental alignment stay at an ordinary level.', 'lackTa' => 'விசேஷ வசிய ஈர்ப்பு இல்லை; பரஸ்பர கவர்ச்சியும் மன ஒற்றுமையும் சாதாரண அளவிலேயே இருக்கும்.', 'lackHi' => 'विशेष वश्य आकर्षण नहीं है; परस्पर आकर्षण एवं मानसिक तालमेल सामान्य स्तर पर रहेगा।', 'crucial' => false],
            ['id' => 'rajju', 'nameEn' => 'Rajju Porutham', 'nameTa' => 'ரஜ்ஜுப் பொருத்தம்', 'nameHi' => 'रज्जु पोरुथम', 'pts' => 5, 'max' => 5, 'enum' => 'UTTHAMAM', 'expEn' => 'Aayush and lifelong marital bonding (most essential).', 'expTa' => 'ஆயுளும் வாழ்நாள் முழுவதும் திருமண பந்தமும் (மிக முக்கியமானது).', 'expHi' => 'आयुष्य एवं आजीवन दांपत्य बंधन (सर्वाधिक महत्वपूर्ण)।', 'lackEn' => 'Both stars fall in the SAME Rajju group (Eka Rajju dosha), so the classical protection of lifespan and marital security is missing.', 'lackTa' => 'இரு நட்சத்திரங்களும் ஒரே ரஜ்ஜு குழுவில் உள்ளன (ஏக ரஜ்ஜு தோஷம்); ஆயுள் மற்றும் மாங்கல்ய பாதுகாப்பு இல்லை.', 'lackHi' => 'दोनों नक्षत्र एक ही रज्जु समूह में हैं (एक रज्जु दोष); आयु एवं वैवाहिक सुरक्षा का संरक्षण अनुपस्थित है।', 'crucial' => true],
            ['id' => 'vedha', 'nameEn' => 'Vedha Porutham', 'nameTa' => 'வேதைப் பொருத்தம்', 'nameHi' => 'वेध पोरुथम', 'pts' => 3, 'max' => 3, 'enum' => 'UTTHAMAM', 'expEn' => 'Free from malefic psychic affliction.', 'expTa' => 'தீய நட்சத்திர வேதை இன்மை.', 'expHi' => 'अशुभ वेध दोष से मुक्त।', 'lackEn' => 'A Vedha (obstruction) pair is present, so friction, disputes and avoidable obstacles are indicated.', 'lackTa' => 'வேதை (தடை) ஜோடி உள்ளது; கருத்து வேறுபாடு, தகராறு மற்றும் தடைகள் ஏற்படலாம்.', 'lackHi' => 'वेध (बाधा) युग्म है; मतभेद, विवाद एवं बाधाएँ संभव हैं।', 'crucial' => false]
        ];

        $enumToLegacyStatus = [
            'UTTHAMAM' => 'Uthama (Excellent)',
            'MADHYAMAM' => 'Madhyama (Good)',
            'PORUNDHADHU' => 'Porundhadhu (Not Compatible)'
        ];

        // --- Real calculation FIRST: fill $poruthamDefs with actual results ---
        $lordNameToKey = ['Sun'=>'sun','Moon'=>'moon','Mars'=>'mars','Mercury'=>'mercury','Jupiter'=>'jupiter','Venus'=>'venus','Saturn'=>'saturn'];
        $boyLordKey = $lordNameToKey[$boyH['rasi']['lord']] ?? 'sun';
        $girlLordKey = $lordNameToKey[$girlH['rasi']['lord']] ?? 'sun';
        $boyNakIdx = array_search($boyH['janmaNakshatraEn'], self::$NAKSHATRAS_EN, true);
        $girlNakIdx = array_search($girlH['janmaNakshatraEn'], self::$NAKSHATRAS_EN, true);
        $boyRasiIdx = $boyH['chandraRasi'] - 1;
        $girlRasiIdx = $girlH['chandraRasi'] - 1;

        $realResults = self::calculatePoruthams($boyNakIdx, $boyRasiIdx, $girlNakIdx, $girlRasiIdx, $boyLordKey, $girlLordKey);
        foreach ($poruthamDefs as &$definition) {
            if ($definition['id'] !== 'yoni') { continue; }
            $definition['expEn'] = $definition['lackEn'] = $realResults['yoni']['explanationEn'];
            $definition['expTa'] = $definition['lackTa'] = $realResults['yoni']['explanationTa'];
            $definition['expHi'] = $definition['lackHi'] = $realResults['yoni']['explanationHi'];
        }
        unset($definition);

        // The PHP delivery path retains its traditional weighted point maxima
        // (3+4+3+2+4+5+4+2+5+3 = 35); its denominator is summed from these rows.
        // This intentionally differs from the TypeScript calculator's
        // normalized equal-weight /10 score until a canonical weighting is agreed.
        $totalScore = 0; $maxScore = 0; $anyCrucialFailed = false;
        foreach ($poruthamDefs as &$pd) {
            $r = $realResults[$pd['id']];
            $pd['pts'] = $r['pts'];
            $pd['max'] = $r['max'];
            // Full marks are "Uthamam"; a genuine partial score (for example
            // Yoni 2/4 for a neutral animal pair) is "Mathimam", never
            // "Uthamam" - the old pass/fail flag labelled every >=-half row as
            // excellent and hid the shortfall. A zero row is Porundhadhu.
            $pd['enum'] = $r['pts'] >= $r['max'] ? 'UTTHAMAM' : ($r['pts'] > 0 ? 'MADHYAMAM' : 'PORUNDHADHU');
            $pd['crucial'] = !empty($pd['crucial']) || !empty($r['crucial']);
            if ($pd['crucial'] && !$r['pass']) { $anyCrucialFailed = true; }
            $totalScore += $r['pts'];
            $maxScore += $r['max'];
        }
        unset($pd);
        $scorePercent = $maxScore > 0 ? round(($totalScore / $maxScore) * 100, 1) : 0;

        // --- NOW build $poruthams from the already-updated real $poruthamDefs ---
        $poruthams = [];
        $totalPoruthamsMatched = 0;
        foreach ($poruthamDefs as $pd) {
            // "Matched" counts everything that is not a failed row, exactly like
            // the TypeScript engine's matchedCount (Uthamam + Mathimam).
            if ($pd['enum'] !== 'PORUNDHADHU') { $totalPoruthamsMatched++; }
            $poruthamRow = [
                'name' => $pd['nameEn'],
                'nameTa' => $pd['nameTa'],
                'points' => $pd['pts'],
                'maxPoints' => $pd['max'],
                'status' => $enumToLegacyStatus[$pd['enum']],
                'description' => $pd['expEn'],
                'id' => $pd['id'],
                'nameEn' => $pd['nameEn'],
                'nameHi' => $pd['nameHi'],
                'poruthamKey' => $pd['id'],
                'status2' => $pd['enum'],
                'pointsEarned' => $pd['pts'],
                // A row that did not earn full marks explains the shortfall
                // instead of repeating the benefit the couple does NOT receive.
                'explanationEn' => $pd['enum'] === 'UTTHAMAM' ? $pd['expEn'] : $pd['lackEn'],
                'explanationTa' => $pd['enum'] === 'UTTHAMAM' ? $pd['expTa'] : $pd['lackTa'],
                'explanationHi' => $pd['enum'] === 'UTTHAMAM' ? $pd['expHi'] : $pd['lackHi'],
                'isCrucial' => $pd['crucial']
            ];
            if ($pd['id'] === 'yoni') {
                foreach ([
                    'yoniRelationship', 'yoniRelationshipEn', 'yoniRelationshipTa', 'yoniRelationshipHi',
                    'yoniBrideAnimalEn', 'yoniBrideAnimalTa', 'yoniBrideAnimalHi',
                    'yoniGroomAnimalEn', 'yoniGroomAnimalTa', 'yoniGroomAnimalHi'
                ] as $field) {
                    $poruthamRow[$field] = $realResults['yoni'][$field] ?? null;
                }
            }
            $poruthams[] = $poruthamRow;
        }
        foreach ($poruthams as &$p) {
            $p['statusLabel'] = $p['status'];
            $p['status'] = $p['status2'];
            unset($p['status2']);
        }
        unset($p);

        // Sevvay / Kuja Dosha for both parties, with the classical exceptions
        // (own/exalted Mars, Leo/Aquarius, house-sign Vilakku, Guru-Mangala and
        // Chandra-Mangala yoga, Guru Drishti) already applied by evaluateKujaDosha().
        $groomKuja = is_array($boyH['kujaDosha'] ?? null) ? $boyH['kujaDosha'] : ['status' => 'NOT_ASSESSED', 'isPresent' => null, 'marsBhava' => null];
        $brideKuja = is_array($girlH['kujaDosha'] ?? null) ? $girlH['kujaDosha'] : ['status' => 'NOT_ASSESSED', 'isPresent' => null, 'marsBhava' => null];
        $groomMarsHouse = $groomKuja['marsBhava'];
        $brideMarsHouse = $brideKuja['marsBhava'];
        $groomHasDosha = $groomKuja['isPresent']; // effective dosha: DOSHA_PRESENT or DOSHA_MILD
        $brideHasDosha = $brideKuja['isPresent'];
        $doshaLevel = static function (array $kuja): ?int {
            switch ($kuja['status'] ?? 'NOT_ASSESSED') {
                case 'DOSHA_PRESENT': return 2;
                case 'DOSHA_MILD': return 1;
                case 'DOSHA_NONE':
                case 'DOSHA_CANCELLED': return 0;
                default: return null;
            }
        };
        $groomLevel = $doshaLevel($groomKuja);
        $brideLevel = $doshaLevel($brideKuja);
        // BALANCED: neither has an active dosha, or both do (Dosha Samyam).
        // MINOR_IMBALANCE: one side has only a mild dosha. IMBALANCE: one side
        // carries a full dosha the other does not share.
        if ($groomLevel === null || $brideLevel === null) {
            $samyamStatus = null;
        } elseif (($groomLevel === 0 && $brideLevel === 0) || ($groomLevel > 0 && $brideLevel > 0)) {
            $samyamStatus = 'BALANCED';
        } elseif (max($groomLevel, $brideLevel) === 1) {
            $samyamStatus = 'MINOR_IMBALANCE';
        } else {
            $samyamStatus = 'IMBALANCE';
        }
        $doshaSamyam = $samyamStatus === null ? null : $samyamStatus === 'BALANCED';
        $doshaUnavailableEn = 'N/A - Mars house placement unavailable';
        $doshaUnavailableTa = 'செவ்வாய் பாவ நிலை கிடைக்கவில்லை (N/A)';
        $doshaUnavailableHi = 'मंगल का भाव उपलब्ध नहीं है (N/A)';
        $severityText = static function (array $kuja, string $lang, string $unavailable): string {
            if (($kuja['status'] ?? 'NOT_ASSESSED') === 'NOT_ASSESSED') return $unavailable;
            return (string) ($kuja['severity' . $lang] ?? $unavailable);
        };
        $reasonText = static function (array $kuja, string $lang): ?string {
            $status = $kuja['status'] ?? 'NOT_ASSESSED';
            if ($status === 'NOT_ASSESSED' || $status === 'DOSHA_NONE') return null;
            $items = $status === 'DOSHA_CANCELLED' ? ($kuja['exceptions'] ?? []) : ($kuja['mitigations'] ?? []);
            $text = implode(' ', array_column($items, strtolower($lang)));
            return $text !== '' ? $text : null;
        };
        $bothClean = $groomLevel === 0 && $brideLevel === 0;
        $bothDosha = $groomLevel !== null && $brideLevel !== null && $groomLevel > 0 && $brideLevel > 0;
        $mildSideEn = $groomLevel === 1 ? 'the groom' : 'the bride';
        $mildSideTa = $groomLevel === 1 ? 'மாப்பிள்ளைக்கு' : 'பெண்ணிற்கு';
        $mildSideHi = $groomLevel === 1 ? 'वर' : 'वधू';
        $fullSideEn = ($groomLevel ?? 0) === 2 ? 'the groom' : 'the bride';
        $fullSideTa = ($groomLevel ?? 0) === 2 ? 'மாப்பிள்ளைக்கு' : 'பெண்ணிற்கு';
        $fullSideHi = ($groomLevel ?? 0) === 2 ? 'वर' : 'वधू';

        $sevvayDosham = [
            'isBrideHasDosham' => $brideHasDosha,
            'isGroomHasDosham' => $groomHasDosha,
            // NOT_ASSESSED | DOSHA_NONE | DOSHA_CANCELLED | DOSHA_MILD | DOSHA_PRESENT
            'brideDoshaStatus' => $brideKuja['status'],
            'groomDoshaStatus' => $groomKuja['status'],
            'brideMarsHouses' => $brideKuja['houses'] ?? null,
            'groomMarsHouses' => $groomKuja['houses'] ?? null,
            'brideAfflictedFrom' => $brideKuja['afflictedFrom'] ?? [],
            'groomAfflictedFrom' => $groomKuja['afflictedFrom'] ?? [],
            'brideDoshamSeverityEn' => $severityText($brideKuja, 'En', $doshaUnavailableEn),
            'brideDoshamSeverityTa' => $severityText($brideKuja, 'Ta', $doshaUnavailableTa),
            'brideDoshamSeverityHi' => $severityText($brideKuja, 'Hi', $doshaUnavailableHi),
            'groomDoshamSeverityEn' => $severityText($groomKuja, 'En', $doshaUnavailableEn),
            'groomDoshamSeverityTa' => $severityText($groomKuja, 'Ta', $doshaUnavailableTa),
            'groomDoshamSeverityHi' => $severityText($groomKuja, 'Hi', $doshaUnavailableHi),
            'brideCancellationReasonEn' => $reasonText($brideKuja, 'En'),
            'brideCancellationReasonTa' => $reasonText($brideKuja, 'Ta'),
            'brideCancellationReasonHi' => $reasonText($brideKuja, 'Hi'),
            'groomCancellationReasonEn' => $reasonText($groomKuja, 'En'),
            'groomCancellationReasonTa' => $reasonText($groomKuja, 'Ta'),
            'groomCancellationReasonHi' => $reasonText($groomKuja, 'Hi'),
            'brideExplanationEn' => $brideKuja['explanationEn'] ?? null,
            'brideExplanationTa' => $brideKuja['explanationTa'] ?? null,
            'brideExplanationHi' => $brideKuja['explanationHi'] ?? null,
            'groomExplanationEn' => $groomKuja['explanationEn'] ?? null,
            'groomExplanationTa' => $groomKuja['explanationTa'] ?? null,
            'groomExplanationHi' => $groomKuja['explanationHi'] ?? null,
            // BALANCED | MINOR_IMBALANCE | IMBALANCE | null
            'doshaSamyamStatus' => $samyamStatus,
            'isBalanced' => $doshaSamyam,
            'doshaSamyamStatusEn' => $samyamStatus === null ? $doshaUnavailableEn
                : ($samyamStatus === 'BALANCED'
                    ? ($bothDosha ? 'Balanced (Dosha Samyam - both charts carry Sevvay Dosha)' : 'Balanced (neither chart has an active Sevvay Dosha)')
                    : ($samyamStatus === 'MINOR_IMBALANCE' ? 'Minor imbalance (only a mild dosha on one side)' : 'Not balanced - remedies advised')),
            'doshaSamyamStatusTa' => $samyamStatus === null ? $doshaUnavailableTa
                : ($samyamStatus === 'BALANCED'
                    ? ($bothDosha ? 'சமன் நிலை (தோஷ சம்யம் - இருவருக்கும் செவ்வாய் தோஷம்)' : 'சமன் நிலை (இருவருக்கும் செயலில் உள்ள செவ்வாய் தோஷம் இல்லை)')
                    : ($samyamStatus === 'MINOR_IMBALANCE' ? 'சிறிய சமனின்மை (ஒரு பக்கத்தில் மிதமான தோஷம் மட்டும்)' : 'சமநிலை இல்லை - பரிகாரங்கள் பரிந்துரைக்கப்படுகின்றன')),
            'doshaSamyamStatusHi' => $samyamStatus === null ? $doshaUnavailableHi
                : ($samyamStatus === 'BALANCED'
                    ? ($bothDosha ? 'दोष साम्य संतुलित (दोनों कुंडलियों में मंगल दोष)' : 'संतुलित (किसी भी कुंडली में सक्रिय मंगल दोष नहीं)')
                    : ($samyamStatus === 'MINOR_IMBALANCE' ? 'अल्प असंतुलन (एक पक्ष में केवल अल्प दोष)' : 'दोष साम्य नहीं - उपाय आवश्यक')),
            'recommendationEn' => $samyamStatus === null ? $doshaUnavailableEn
                : ($samyamStatus === 'BALANCED'
                    ? ($bothDosha
                        ? 'Both charts carry Sevvay Dosha, so they neutralise each other (Dosha Samyam); from a Mangal Dosha perspective this match is auspicious.'
                        : ($bothClean && ($groomKuja['status'] === 'DOSHA_CANCELLED' || $brideKuja['status'] === 'DOSHA_CANCELLED')
                            ? 'Mars occupies a dosha house in ' . ($groomKuja['status'] === 'DOSHA_CANCELLED' && $brideKuja['status'] === 'DOSHA_CANCELLED' ? 'both charts' : ($groomKuja['status'] === 'DOSHA_CANCELLED' ? "the groom's chart" : "the bride's chart")) . ', but a classical Dosha Nivrutti rule relieves it. This is an indicator only and does not guarantee any outcome.'
                            : 'From a Mangal Dosha perspective, this match is auspicious.'))
                    : ($samyamStatus === 'MINOR_IMBALANCE'
                        ? "Only a mild Sevvay Dosha is present for {$mildSideEn} (reduced by classical rules). This is not a severe dosha; simple remedies such as Sevvay (Angaraka) worship on Tuesdays are advised for Kuja Dosha alone."
                        : "An active Sevvay Dosha is present for {$fullSideEn} and not for the other partner. Traditional remedies for Mangal Dosha (Angaraka/Subramanya worship, Kuja Shanti) are recommended before proceeding.")),
            'recommendationTa' => $samyamStatus === null ? $doshaUnavailableTa
                : ($samyamStatus === 'BALANCED'
                    ? ($bothDosha
                        ? 'இரு ஜாதகங்களிலும் செவ்வாய் தோஷம் இருப்பதால் தோஷ சம்யம் ஏற்படுகிறது; செவ்வாய் தோஷ கண்ணோட்டத்தில் இந்தப் பொருத்தம் சுபமானது.'
                        : ($bothClean && ($groomKuja['status'] === 'DOSHA_CANCELLED' || $brideKuja['status'] === 'DOSHA_CANCELLED')
                            ? 'செவ்வாய் தோஷ ஸ்தானத்தில் இருந்தாலும் சாஸ்திர விலக்கால் தோஷ நிவர்த்தி பெறுகிறது. செயலில் உள்ள செவ்வாய் தோஷம் இல்லை; இந்தப் பொருத்தம் சுபமானது.'
                            : 'செவ்வாய் தோஷ கண்ணோட்டத்தில் இந்த பொருத்தம் சுபமானது.'))
                    : ($samyamStatus === 'MINOR_IMBALANCE'
                        ? "{$mildSideTa} மட்டும் மிதமான செவ்வாய் தோஷம் உள்ளது (சாஸ்திர விதிகளால் குறைக்கப்பட்டது). இது கடுமையான தோஷம் அல்ல; செவ்வாய்க்கிழமை அங்காரக வழிபாடு போன்ற எளிய பரிகாரங்கள் போதுமானவை."
                        : "{$fullSideTa} செயலில் உள்ள செவ்வாய் தோஷம் உள்ளது; மற்றவருக்கு இல்லை. தொடர முன் செவ்வாய் தோஷ பரிகாரங்கள் (அங்காரக/சுப்பிரமணிய வழிபாடு, குஜ சாந்தி) பரிந்துரைக்கப்படுகின்றன.")),
            'recommendationHi' => $samyamStatus === null ? $doshaUnavailableHi
                : ($samyamStatus === 'BALANCED'
                    ? ($bothDosha
                        ? 'दोनों कुंडलियों में मंगल दोष होने से दोष साम्य बनता है; मंगल दोष की दृष्टि से यह संबंध शुभ है।'
                        : ($bothClean && ($groomKuja['status'] === 'DOSHA_CANCELLED' || $brideKuja['status'] === 'DOSHA_CANCELLED')
                            ? 'मंगल दोष भाव में होते हुए भी शास्त्रीय अपवाद से दोष निवृत्ति होती है। कोई सक्रिय मंगल दोष नहीं; यह संबंध शुभ है।'
                            : 'मंगल दोष की दृष्टि से यह संबंध शुभ है।'))
                    : ($samyamStatus === 'MINOR_IMBALANCE'
                        ? "केवल {$mildSideHi} पक्ष में अल्प मंगल दोष है (शास्त्रीय नियमों से न्यून)। यह गंभीर दोष नहीं है; मंगलवार को अंगारक पूजा जैसे सरल उपाय पर्याप्त हैं।"
                        : "{$fullSideHi} पक्ष में सक्रिय मंगल दोष है और दूसरे पक्ष में नहीं। आगे बढ़ने से पूर्व मंगल दोष के पारंपरिक उपाय (अंगारक/सुब्रह्मण्य पूजा, कुज शांति) करने की सलाह दी जाती है।"))
        ];

        $verdictStatus = $anyCrucialFailed ? 'PORUNDHADHU' : ($scorePercent >= 70 ? 'UTTHAMAM' : ($scorePercent >= 50 ? 'MADHYAMAM' : 'PORUNDHADHU'));
        $rajjuOk = (bool) ($realResults['rajju']['pass'] ?? false);
        $vedhaOk = (bool) ($realResults['vedha']['pass'] ?? false);
        $failedEn = implode(' and ', array_filter([$rajjuOk ? null : 'Rajju', $vedhaOk ? null : 'Vedha']));
        $failedTa = implode(' மற்றும் ', array_filter([$rajjuOk ? null : 'ரஜ்ஜு', $vedhaOk ? null : 'வேதை']));
        $failedHi = implode(' और ', array_filter([$rajjuOk ? null : 'रज्जु', $vedhaOk ? null : 'वेध']));
        $verdictLabel = $anyCrucialFailed ? "Not Recommended - {$failedEn} mismatch" : ($scorePercent >= 70 ? 'Highly Recommended (உத்தம பொருத்தம்)' : ($scorePercent >= 50 ? 'Acceptable with Remedies (மத்திம பொருத்தம்)' : 'Not Recommended (பொருந்தாது)'));

        // Kuja remedies concern Kuja alone; they do not remove a failed
        // Rajju/Vedha check or amount to approval of the overall marriage.
        // The failed hard stop itself is stated ONCE, by the overall verdict
        // below: the Kuja box printed that same Rajju/Vedha sentence on top of
        // the score-banner verdict and the final verdict banner, so one failure
        // was repeated three times on the same page.
        $sevvayDosham['recommendationEn'] .= ' This guidance concerns Kuja Dosha alone, not the overall marriage recommendation.';
        $sevvayDosham['recommendationTa'] .= ' இது செவ்வாய் தோஷம் குறித்த வழிகாட்டல் மட்டுமே; முழுத் திருமணப் பொருத்தத்தின் பரிந்துரை அல்ல.';
        $sevvayDosham['recommendationHi'] .= ' यह केवल मंगल दोष का मार्गदर्शन है, समग्र विवाह अनुशंसा नहीं।';

        if ($anyCrucialFailed) {
            $overallVerdictEn = "Not Recommended - {$failedEn} mismatch. Requires detailed astrological assessment.";
            $overallVerdictTa = "{$failedTa} பொருத்தமின்மை உள்ளது. விரிவான ஜாதக ஆய்வின்றி திருமணம் பரிந்துரைக்கப்படவில்லை.";
            $overallVerdictHi = "{$failedHi} की बाधा है। विस्तृत ज्योतिषीय समीक्षा के बिना विवाह अनुशंसित नहीं है।";
        } elseif ($verdictStatus === 'UTTHAMAM') {
            $overallVerdictEn = 'Highly Recommended - Utthama Porutham';
            $overallVerdictTa = 'மிகவும் பரிந்துரைக்கப்படுகிறது - உத்தம பொருத்தம்';
            $overallVerdictHi = 'अत्यधिक अनुशंसित - उत्तम संबंध';
        } elseif ($verdictStatus === 'MADHYAMAM') {
            $overallVerdictEn = 'Acceptable with Remedies - Madhyama Porutham';
            $overallVerdictTa = 'மத்திமப் பொருத்தம் - பரிகாரங்களுடன் ஏற்றது';
            $overallVerdictHi = 'मध्यम मिलान - उपायों के साथ विचारणीय';
        } else {
            $overallVerdictEn = 'Not Recommended - Porutham does not meet the recommended standard';
            $overallVerdictTa = 'திருமணத்திற்கு பரிந்துரைக்கப்படவில்லை';
            $overallVerdictHi = 'विवाह हेतु अनुशंसित नहीं';
        }

        $formatBirthPlaceLabel = static function ($place, $country): string {
            $place = trim((string) $place);
            $country = trim((string) $country);
            if ($place === '') {
                return $country;
            }
            if ($country === '') {
                return $place;
            }
            $parts = array_map('trim', explode(',', $place));
            $tail = $parts ? (string) end($parts) : '';
            return stripos($tail, $country) === false ? $place . ', ' . $country : $place;
        };
        $brideBirthPlaceLabel = $formatBirthPlaceLabel($girlH['birthPlace'] ?? '', $girlH['country'] ?? '');
        $groomBirthPlaceLabel = $formatBirthPlaceLabel($boyH['birthPlace'] ?? '', $boyH['country'] ?? '');

        return [
            'groom' => $boyH,
            'bride' => $girlH,
            'nodeType' => $boyH['nodeType'] ?? self::nodeType(),
            'poruthams' => $poruthams,
            'score' => $totalScore,
            'maxScore' => $maxScore,
            'percentage' => $scorePercent,
            'verdict' => $verdictLabel,
            'doshaSummary' => $sevvayDosham['recommendationEn'],

            'brideName' => $girlH['devoteeName'],
            'brideDob' => $girlH['dob'],
            'brideTob' => $girlH['tob'],
            'bridePlace' => $brideBirthPlaceLabel,
            'brideRasi' => $girlH['chandraRasi'],
            'brideRasiNameEn' => $girlH['rasi']['name'],
            'brideRasiNameTa' => $girlH['rasi']['nameTa'],
            'brideRasiNameHi' => $girlH['rasi']['name'],
            'brideNakshatraNameEn' => $girlH['janmaNakshatraEn'],
            'brideNakshatraNameTa' => $girlH['janmaNakshatraTa'],
            'brideNakshatraNameHi' => $girlH['janmaNakshatraEn'],
            'bridePada' => $girlH['janmaPada'],
            'brideLagnaNameEn' => $girlH['lagna']['rasi'],
            'brideLagnaNameTa' => $girlH['lagna']['rasiTa'],
            'brideLagnaNameHi' => $girlH['lagna']['rasi'],
            'brideMarsHouse' => $brideMarsHouse,

            'groomName' => $boyH['devoteeName'],
            'groomDob' => $boyH['dob'],
            'groomTob' => $boyH['tob'],
            'groomPlace' => $groomBirthPlaceLabel,
            'groomRasi' => $boyH['chandraRasi'],
            'groomRasiNameEn' => $boyH['rasi']['name'],
            'groomRasiNameTa' => $boyH['rasi']['nameTa'],
            'groomRasiNameHi' => $boyH['rasi']['name'],
            'groomNakshatraNameEn' => $boyH['janmaNakshatraEn'],
            'groomNakshatraNameTa' => $boyH['janmaNakshatraTa'],
            'groomNakshatraNameHi' => $boyH['janmaNakshatraEn'],
            'groomPada' => $boyH['janmaPada'],
            'groomLagnaNameEn' => $boyH['lagna']['rasi'],
            'groomLagnaNameTa' => $boyH['lagna']['rasiTa'],
            'groomLagnaNameHi' => $boyH['lagna']['rasi'],
            'groomMarsHouse' => $groomMarsHouse,

            'totalPoruthamsMatched' => $totalPoruthamsMatched,
            'overallVerdictEn' => $overallVerdictEn,
            'overallVerdictTa' => $overallVerdictTa,
            'overallVerdictHi' => $overallVerdictHi,
            'verdictStatus' => $verdictStatus,
            'rajjuMatch' => $rajjuOk,
            'vedhaMatch' => $vedhaOk,
            'sevvayDosham' => $sevvayDosham,

            'generatedAt' => date('Y-m-d H:i:s'),
            'generatedAtTimeZoneId' => date_default_timezone_get(),
            'certifiedBy' => 'ASTRO SIVAM Marriage Compatibility Board'
        ];
    }
    
    
    
    /**
     * The report uses the 108 traditional Namakshara sounds: one sound for
     * each of the four padas in all 27 Nakshatras. Keep this data separate
     * from the calculation code so every PHP report path resolves the same
     * complete table rather than falling back to Ashwini syllables.
     */
    private static function getBabyNakshatraLetterTable() {
        static $letterTable = null;

        if ($letterTable !== null) {
            return $letterTable;
        }

        $dataPath = __DIR__ . '/baby_nakshatra_letters.json';
        $decoded = is_file($dataPath) ? json_decode((string) file_get_contents($dataPath), true) : null;
        if (!is_array($decoded) || count($decoded) !== 27) {
            throw new RuntimeException('The complete 27-Nakshatra baby naming syllable table is unavailable.');
        }

        // Index the table by the one-based Janma Nakshatra number. This makes
        // a missing/out-of-order entry fail safely instead of silently using
        // the first (Ashwini) row for every child.
        $letterTable = [];
        foreach ($decoded as $entry) {
            $index = intval($entry['nakshatraIndex'] ?? 0);
            if ($index < 1 || $index > 27 || !is_array($entry['padas'] ?? null) || count($entry['padas']) !== 4) {
                throw new RuntimeException('The baby naming syllable table contains an invalid Nakshatra entry.');
            }
            $group = self::rajjuTable()['groups'][$index - 1];
            foreach (['En' => 'en', 'Ta' => 'ta', 'Hi' => 'hi'] as $suffix => $language) {
                $entry['rajju' . $suffix] = self::rajjuTable()[$language][$group];
            }
            $letterTable[$index] = $entry;
        }

        if (count($letterTable) !== 27) {
            throw new RuntimeException('The baby naming syllable table is incomplete.');
        }

        return $letterTable;
    }

    /** Localize a page-2 meaning for the language of the ordered report. */
    public static function localizeNamakaranMeaning($meaning, $language = 'en'): string {
        $language = strtolower(trim((string) $language));
        if (!in_array($language, ['en', 'ta', 'hi'], true)) {
            $language = 'en';
        }
        return astro_localize_namakaran_meaning($meaning, $language);
    }

    /**
     * The curated 1366-name Namakaran bank (page 2 of the report), generated
     * from data/namakaran_name_bank.tsv by scripts/build_namakaran_bank.mjs.
     * The TypeScript twin of this file is src/lib/astrology/namakaranNameBank.ts
     * and both carry the same content hash, so the live preview and the mPDF
     * report can never drift apart.
     */
    private static function getNamakaranNameBank() {
        static $bank = null;

        if ($bank !== null) {
            return $bank;
        }

        $path = __DIR__ . '/namakaran_name_bank.php';
        $loaded = is_file($path) ? require $path : null;
        if (!is_array($loaded) || !is_array($loaded['bank'] ?? null)) {
            $loaded = ['bank' => [], 'maxPerSide' => 8];
        }
        $bank = $loaded;
        return $bank;
    }

    /**
     * Collect names from one exact akshara only. Bank entries whose
     * transliterated first sound does not match the displayed pada sound are
     * omitted; short lists are intentionally not topped up with alternatives.
     */
    private static function collectNamakaranNames($akshara, $style, $gender, &$used, $limit, $bank) {
        $names = [];
        $entries = $bank[$akshara][$gender][$style] ?? [];
        if (!is_array($entries)) {
            return $names;
        }

        foreach ($entries as $entry) {
            if (count($names) >= $limit) {
                break;
            }
            $name = (string) ($entry[0] ?? '');
            if ($name === '' || !AstroReportViews::nameMatchesPada($name, $akshara)) {
                continue;
            }
            $fingerprint = AstroReportViews::transliterateToTamil($name);
            if (isset($used[$fingerprint])) {
                continue;
            }
            $used[$fingerprint] = true;
            $meaning = (string) ($entry[1] ?? '');
            $names[] = [
                'name' => $name,
                'meaning' => $meaning,
                'meaningEn' => $meaning,
                'meaningTa' => self::localizeNamakaranMeaning($meaning, 'ta'),
                'meaningHi' => self::localizeNamakaranMeaning($meaning, 'hi'),
                'sourceAksharaTa' => $akshara
            ];
        }
        return $names;
    }

    /**
     * Builds the South + North Indian name columns for every pada of the birth
     * star, for the baby's own gender. Each column contains exact sound matches
     * from its own akshara only and may contain fewer than the requested limit.
     */
    public static function getBabyNameSuggestionsByPada($padas, $gender, $maxPerSide = 15) {
        $data = self::getNamakaranNameBank();
        $bank = $data['bank'];
        $maxPerSide = max(1, min(8, intval($maxPerSide)));
        $gender = strtoupper((string) $gender) === 'F' ? 'F' : 'M';
        $used = [];
        $columns = [];

        foreach ((array) $padas as $pada) {
            $akshara = (string) ($pada['letterTa'] ?? '');
            $columns[] = [
                'padaNumber' => intval($pada['padaNumber'] ?? 0),
                'soundTa' => $akshara,
                'soundEn' => (string) ($pada['letterEn'] ?? ''),
                'soundHi' => (string) ($pada['letterHi'] ?? ''),
                'rasiTa' => (string) ($pada['rasiTa'] ?? ''),
                'rasiEn' => (string) ($pada['rasiEn'] ?? ''),
                'rasiHi' => (string) ($pada['rasiHi'] ?? ''),
                'south' => self::collectNamakaranNames($akshara, 'south', $gender, $used, $maxPerSide, $bank),
                'north' => self::collectNamakaranNames($akshara, 'north', $gender, $used, $maxPerSide, $bank)
            ];
        }
        return $columns;
    }

    /**
     * Only return name examples that actually begin with the birth-pada
     * phonetic sound. The older implementation supplied the same L/A names
     * to every report, which made a correct sound such as "Ve" look wrong.
     */
    private static function getBabyNameExamples($primarySyllable, $gender) {
        $prefix = trim(explode('/', (string) $primarySyllable)[0]);
        $key = strtolower(preg_replace('/[^a-z]/i', '', $prefix));
        $gender = strtoupper((string) $gender) === 'F' ? 'F' : 'M';

        $examples = [
            've' => [
                'M' => [['Vedant', 'Ultimate wisdom; the conclusion of the Vedas'], ['Venkatesh', 'Lord of Venkata, an aspect of Vishnu']],
                'F' => [['Vedika', 'Sacred knowledge; altar of the Vedas'], ['Veena', 'A sacred musical instrument; melody']],
            ],
            'vo' => [
                'M' => [['Vohit', 'One who brings light and awakening']],
                'F' => [['Voshini', 'One who brings joy and contentment']],
            ],
            'kaa' => [
                'M' => [['Karthik', 'Karthikeyan (Murugan); one born in Karthikai']],
                'F' => [['Kavya', 'Poetry; a graceful literary creation']],
            ],
            'kee' => [
                'M' => [['Kiran', 'Ray of light']],
                'F' => [['Keerthi', 'Fame, honour and good reputation']],
            ],
            'chu' => [
                'M' => [['Chudamani', 'Crest jewel; one of great brilliance']],
                'F' => [['Chudamani', 'A precious crown jewel']],
            ],
            'che' => [
                'M' => [['Chetan', 'Conscious, intelligent spirit']],
                'F' => [['Chetana', 'Consciousness; living spirit']],
            ],
            'cho' => [
                'M' => [['Chola', 'A name associated with the ancient Tamil dynasty']],
                'F' => [['Cholai', 'A flourishing grove']],
            ],
            'la' => [
                'M' => [['Lakshman', 'One with auspicious signs']],
                'F' => [['Lalitha', 'Graceful, charming and playful']],
            ],
        ];

        $selected = $examples[$key][$gender] ?? [];
        return array_map(function ($example) use ($primarySyllable, $gender) {
            // The meaning of these example names is printed by the Tamil and
            // Hindi sheets too; it used to be the English string copied into
            // `meaningTa` / `meaningHi`. The curated glossary localizes it.
            return [
                'nameEn' => $example[0],
                'nameTa' => $example[0],
                'nameHi' => $example[0],
                'gender' => $gender,
                'meaningEn' => $example[1],
                'meaningTa' => self::localizeNamakaranMeaning($example[1], 'ta'),
                'meaningHi' => self::localizeNamakaranMeaning($example[1], 'hi'),
                'startingLetter' => $primarySyllable,
            ];
        }, $selected);
    }

    public static function isCurrentBabyNamingResult($result) {
        return is_array($result)
            && intval($result['babyNamingAlgorithmVersion'] ?? 0) === 2
            && intval($result['janmaNakshatraIndex'] ?? 0) >= 1
            && intval($result['janmaNakshatraIndex'] ?? 0) <= 27
            && intval($result['janmaPada'] ?? 0) >= 1
            && intval($result['janmaPada'] ?? 0) <= 4
            && is_array($result['nakshatraLetters']['padas'] ?? null)
            && count($result['nakshatraLetters']['padas']) === 4
            && !empty($result['primaryPadaInfo']['letterEn']);
    }

    /** A stored Muhurtham result is reusable only with the current location-aware shape and a non-empty calendar. */
    public static function isCurrentMuhurthamResult($result) {
        return is_array($result)
            && intval($result['muhurthamAlgorithmVersion'] ?? 0) === self::MUHURTHAM_ALGORITHM_VERSION
            && is_array($result['months'] ?? null)
            && count($result['months']) > 0
            && !empty($result['muhurthamPlace'])
            && is_numeric($result['muhurthamLatitude'] ?? null) && (float) $result['muhurthamLatitude'] >= -90 && (float) $result['muhurthamLatitude'] <= 90
            && is_numeric($result['muhurthamLongitude'] ?? null) && (float) $result['muhurthamLongitude'] >= -180 && (float) $result['muhurthamLongitude'] <= 180
            && is_numeric($result['muhurthamTimezoneOffsetHours'] ?? null) && (float) $result['muhurthamTimezoneOffsetHours'] >= -14 && (float) $result['muhurthamTimezoneOffsetHours'] <= 14;
    }

    /** A user-provided label is not a certified birth-pada-compatible name. */
    public static function getBabyNameProvenance($name): array {
        $suppliedName = trim((string) $name);
        return [
            'suppliedName' => $suppliedName !== '' ? $suppliedName : null,
            'status' => $suppliedName !== '' ? 'SUPPLIED_NOT_CERTIFIED' : 'NOT_SUPPLIED',
            'noteEn' => $suppliedName !== ''
                ? 'The supplied name has not been certified as matching the birth-pada sound. Use the primary sound when choosing a compatible name; related-sound alternatives require separate consideration.'
                : 'No name was supplied. Use the primary birth-pada sound when choosing a name; related-sound alternatives require separate consideration.',
            'noteTa' => $suppliedName !== ''
                ? 'வழங்கப்பட்ட பெயர் பிறந்த பாத ஒலிக்குப் பொருந்துவதாகச் சான்றளிக்கப்படவில்லை. பொருத்தமான பெயரைத் தேர்ந்தெடுக்க முதன்மை ஒலியைப் பயன்படுத்தவும்; தொடர்புடைய மாற்று ஒலிப் பெயர்களைத் தனியாகப் பரிசீலிக்க வேண்டும்.'
                : 'பெயர் வழங்கப்படவில்லை. பெயரைத் தேர்ந்தெடுக்க பிறந்த பாதத்தின் முதன்மை ஒலியைப் பயன்படுத்தவும்; தொடர்புடைய மாற்று ஒலிப் பெயர்களைத் தனியாகப் பரிசீலிக்க வேண்டும்.',
            'noteHi' => $suppliedName !== ''
                ? 'दिए गए नाम को जन्म-पाद की ध्वनि से मेल खाने वाला प्रमाणित नहीं किया गया है। अनुकूल नाम चुनते समय प्राथमिक ध्वनि का प्रयोग करें; संबंधित ध्वनि वाले विकल्पों पर अलग से विचार आवश्यक है।'
                : 'कोई नाम नहीं दिया गया है। नाम चुनते समय जन्म-पाद की प्राथमिक ध्वनि का प्रयोग करें; संबंधित ध्वनि वाले विकल्पों पर अलग से विचार आवश्यक है।'
        ];
    }

    public static function calculateBabyNaming($payload) {
        $horoscope = self::calculateHoroscope($payload);
        $gender = strtoupper((string) ($payload['gender'] ?? 'M')) === 'F' ? 'F' : 'M';
        $starIndex = intval($horoscope['janmaNakshatraIndex'] ?? -1) + 1;
        $rawPada = $horoscope['janmaPada'] ?? null;
        if (!is_numeric($rawPada) || (float) $rawPada !== (float) (int) $rawPada || (int) $rawPada < 1 || (int) $rawPada > 4) {
            throw new RuntimeException('Unable to resolve the birth Pada for baby naming.');
        }
        $pada = (int) $rawPada;

        $letterTable = self::getBabyNakshatraLetterTable();
        if (!isset($letterTable[$starIndex])) {
            throw new RuntimeException('Unable to resolve the birth Nakshatra for baby naming.');
        }

        // The padas (and their Rasis) come from the selected Nakshatra table,
        // not a generic first-four-syllables list. For example, Mrigashirsha
        // Pada 1 resolves to Ve / Way, never Chu / Che / Cho / La.
        $nakshatraLetters = $letterTable[$starIndex];
        $padas = $nakshatraLetters['padas'];
        $primaryPadaInfo = null;
        foreach ($padas as $padaInfo) {
            if (intval($padaInfo['padaNumber'] ?? 0) === $pada) {
                $primaryPadaInfo = $padaInfo;
                break;
            }
        }
        if (!$primaryPadaInfo) {
            throw new RuntimeException('Unable to resolve the birth Pada for baby naming.');
        }

        $nakshatraLetters['pada'] = $pada; // Legacy PDF compatibility.
        $syllables = array_values(array_map(function ($padaInfo) {
            return $padaInfo['letterEn'];
        }, $padas));
        $suggestedNames = self::getBabyNameExamples($primaryPadaInfo['letterEn'], $gender);

        // Page 2 of the report: up to 15 South Indian style names (left) and
        // 15 North Indian style names (right) for every pada of the birth star,
        // for the baby's own gender.
        $nameSuggestions = self::getBabyNameSuggestionsByPada($padas, $gender);

        return [
            // Increment this whenever the persisted result shape/rules change.
            // It permits old, incorrect Ashwini-default reports to be safely
            // recalculated from the original birth payload on delivery.
            'babyNamingAlgorithmVersion' => 2,
            'babyHoroscope' => $horoscope,
            'nodeType' => $horoscope['nodeType'] ?? self::nodeType(),
            'gender' => $gender,
            'genderLabelEn' => $gender === 'F' ? 'Female (Girl)' : 'Male (Boy)',
            'startingSyllables' => $syllables,
            'suggestedSyllables' => $syllables,
            'primaryStartingSyllable' => $primaryPadaInfo['letterEn'],
            'recommendedNames' => array_values(array_map(function ($n) { return $n['nameEn']; }, $suggestedNames)),
            'numerologySuggestion' => 'Lucky Compound Numbers: 1, 3, 5, 9',
            'blessing' => 'May the divine light of Lord Shiva and Parvati bless the newborn with longevity, wisdom, and boundless prosperity.',

            'babyName' => $payload['babyName'] ?? ($gender === 'F' ? 'Baby Girl' : 'Baby Boy'),
            'nameProvenance' => self::getBabyNameProvenance($payload['babyName'] ?? $payload['name'] ?? ''),
            'dob' => $horoscope['dob'],
            'tob' => $horoscope['tob'],
            'birthPlace' => $horoscope['birthPlace'],
            'country' => $horoscope['country'],
            'janmaNakshatraIndex' => $starIndex,
            'janmaNakshatraEn' => $horoscope['janmaNakshatraEn'],
            'janmaNakshatraTa' => $horoscope['janmaNakshatraTa'],
            'nakshatraLetters' => $nakshatraLetters,
            'janmaPada' => $pada,
            'primaryPadaInfo' => $primaryPadaInfo,
            'chandraRasi' => $horoscope['chandraRasi'],
            'chandraRasiNameEn' => $horoscope['rasi']['name'],
            'chandraRasiNameTa' => $horoscope['rasi']['nameTa'],
            'chandraRasiNameHi' => $horoscope['rasi']['name'],
            'lagnaRasi' => $horoscope['lagnaRasi'],
            'lagnaRasiNameEn' => $horoscope['lagna']['rasi'],
            'lagnaRasiNameTa' => $horoscope['lagna']['rasiTa'],
            'lagnaRasiNameHi' => $horoscope['lagna']['rasi'],
            'suggestedNames' => $suggestedNames,
            'nameSuggestions' => $nameSuggestions,

            'generatedAt' => date('Y-m-d H:i:s'),
            'certifiedBy' => 'ASTRO SIVAM Sanskrit Naming Board'
        ];
    }

    /**
     * MUHURTHAM (Subha Muhurtham) — six-month auspicious date calendar.
     *
     * The panchangam scan itself is produced by the tested client engine
     * (`src/lib/muhurtham/scanner.ts`, ~1700 lines of Lahiri-ayanamsa astronomy)
     * and travels inside the order payload as `muhurthamScan`. The payload must
     * also carry a separate Muhurtham location: birthplace is for the Janma
     * Nakshatra, while the selected location determines local calendar dates
     * and times. PHP never re-implements that astronomy; it validates,
     * normalises and stamps the payload so a stored `calculatedResult` is
     * complete, and incomplete/legacy location data fails loudly rather than
     * silently treating the birthplace as the event location.
     */
    public static function calculateMuhurtham($payload) {
        $payload = is_array($payload) ? $payload : [];
        $muhurthamLatitude = $payload['muhurthamLatitude'] ?? null;
        $muhurthamLongitude = $payload['muhurthamLongitude'] ?? null;
        $muhurthamOffset = $payload['muhurthamTimezoneOffsetHours'] ?? null;
        if (trim((string) ($payload['muhurthamPlace'] ?? '')) === ''
            || !is_numeric($muhurthamLatitude) || (float) $muhurthamLatitude < -90 || (float) $muhurthamLatitude > 90
            || !is_numeric($muhurthamLongitude) || (float) $muhurthamLongitude < -180 || (float) $muhurthamLongitude > 180
            || !is_numeric($muhurthamOffset) || (float) $muhurthamOffset < -14 || (float) $muhurthamOffset > 14) {
            throw new RuntimeException('A separate Muhurtham location with valid coordinates and time zone is required to calculate local dates and times.');
        }
        $scan = $payload['muhurthamScan'] ?? null;
        if (!is_array($scan)) {
            throw new RuntimeException('Muhurtham scan data is missing from the request.');
        }
        $scanVersion = intval($scan['muhurthamAlgorithmVersion'] ?? $payload['muhurthamAlgorithmVersion'] ?? 0);
        if ($scanVersion !== self::MUHURTHAM_ALGORITHM_VERSION) {
            throw new RuntimeException('Muhurtham scan is outdated. Refresh the date calendar before placing this order.');
        }

        // Version alone cannot prove a cached browser scan belongs to the
        // saved birth/event inputs. Require the full context stamp and fail
        // closed for older v5 scans that did not record their source inputs.
        $context = $scan['inputContext'] ?? null;
        if (!is_array($context)) {
            throw new RuntimeException('Muhurtham scan is outdated or missing its verified input context. Refresh the date calendar before placing this order.');
        }
        // Second person (bride/groom) fields live in the nested person object,
        // while the scan stamp carries them flat. Build one flat view so the
        // comparison below is a plain key-by-key match.
        $secondPerson = null;
        foreach (['bride', 'groom'] as $secondRole) {
            if (is_array($payload[$secondRole] ?? null)) { $secondPerson = $payload[$secondRole]; break; }
        }
        $secondPersonTextKeys = [
            'brideName' => 'name', 'brideDob' => 'dob', 'brideTob' => 'tob',
            'brideBirthPlace' => 'birthPlace', 'brideCountry' => 'country', 'brideTimeZoneId' => 'timeZoneId'
        ];
        $secondPersonNumberKeys = [
            'brideLatitude' => 'latitude', 'brideLongitude' => 'longitude',
            'brideTimezoneOffsetHours' => 'timezoneOffsetHours'
        ];
        $flatPayload = $payload;
        if (is_array($secondPerson)) {
            foreach ($secondPersonTextKeys as $flatKey => $personKey) {
                if (!array_key_exists($flatKey, $flatPayload)) { $flatPayload[$flatKey] = (string) ($secondPerson[$personKey] ?? ''); }
            }
            foreach ($secondPersonNumberKeys as $flatKey => $personKey) {
                if (!array_key_exists($flatKey, $flatPayload)) { $flatPayload[$flatKey] = $secondPerson[$personKey] ?? null; }
            }
        }
        $contextTextKeys = [
            'dob', 'tob', 'birthPlace', 'country', 'timeZoneId',
            'muhurthamPlace', 'muhurthamCountry', 'muhurthamTimeZoneId', 'eventKey', 'selectedMonth',
            // Second person (bride/groom). Absent on a single-person order: the
            // comparison below treats missing-on-both-sides as unchanged.
            'brideName', 'brideDob', 'brideTob', 'brideBirthPlace', 'brideCountry', 'brideTimeZoneId'
        ];
        foreach ($contextTextKeys as $key) {
            if (trim((string) ($context[$key] ?? '')) !== trim((string) ($flatPayload[$key] ?? ''))) {
                throw new RuntimeException('Muhurtham scan is outdated or does not match the selected birth/event details. Refresh the date calendar before placing this order.');
            }
        }
        $contextNumberKeys = [
            'latitude', 'longitude', 'timezoneOffsetHours',
            'muhurthamLatitude', 'muhurthamLongitude', 'muhurthamTimezoneOffsetHours',
            'brideLatitude', 'brideLongitude', 'brideTimezoneOffsetHours'
        ];
        foreach ($contextNumberKeys as $key) {
            $contextRaw = $context[$key] ?? null;
            $payloadRaw = $flatPayload[$key] ?? null;
            $contextAbsent = $contextRaw === null || $contextRaw === '';
            $payloadAbsent = $payloadRaw === null || $payloadRaw === '';
            // The second person is optional: when neither side carries the key
            // the scan still matches, so a single-person order is not rejected.
            if ($contextAbsent || $payloadAbsent) {
                if ($contextAbsent && $payloadAbsent) { continue; }
                throw new RuntimeException('Muhurtham scan is outdated or does not match the selected birth/event location. Refresh the date calendar before placing this order.');
            }
            if (!is_numeric($contextRaw) || !is_numeric($payloadRaw)
                || abs((float) $contextRaw - (float) $payloadRaw) > 0.000001) {
                throw new RuntimeException('Muhurtham scan is outdated or does not match the selected birth/event location. Refresh the date calendar before placing this order.');
            }
        }

        $months = $scan['months'] ?? null;
        if (!is_array($months) || count($months) === 0) {
            throw new RuntimeException('Muhurtham scan contains no months.');
        }

        $eventKey = (string) ($payload['eventKey'] ?? $scan['eventKey'] ?? 'wedding');
        $rules = self::getMuhurthamRules();
        $event = $rules[$eventKey] ?? null;
        if (!$event) {
            throw new RuntimeException('Unknown muhurtham event: ' . $eventKey);
        }

        $normalizedMonths = [];
        foreach ($months as $month) {
            if (!is_array($month)) {
                continue;
            }
            $days = [];
            foreach (($month['days'] ?? []) as $day) {
                if (!is_array($day)) {
                    continue;
                }
                $date = substr((string) ($day['date'] ?? ''), 0, 10);
                if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                    continue;
                }
                $padaRaw = $day['pada'] ?? null;
                if (!is_numeric($padaRaw) || (float) $padaRaw !== (float) (int) $padaRaw || (int) $padaRaw < 1 || (int) $padaRaw > 4) {
                    throw new RuntimeException('Muhurtham scan contains a missing or invalid Nakshatra Pada. Refresh the date calendar.');
                }
                $days[] = [
                    'date' => $date,
                    'dayOfWeekNameEn' => (string) ($day['dayOfWeekNameEn'] ?? ''),
                    'dayOfWeekNameTa' => (string) ($day['dayOfWeekNameTa'] ?? $day['dayOfWeekNameEn'] ?? ''),
                    'dayOfWeekNameHi' => (string) ($day['dayOfWeekNameHi'] ?? $day['dayOfWeekNameEn'] ?? ''),
                    'sunrise' => (string) ($day['sunrise'] ?? ''),
                    'sunset' => (string) ($day['sunset'] ?? ''),

                    'tithiNameEn' => (string) ($day['tithiNameEn'] ?? ''),
                    'tithiNameTa' => (string) ($day['tithiNameTa'] ?? $day['tithiNameEn'] ?? ''),
                    'tithiNameHi' => (string) ($day['tithiNameHi'] ?? $day['tithiNameEn'] ?? ''),
                    'nakshatraNameEn' => (string) ($day['nakshatraNameEn'] ?? ''),
                    'nakshatraNameTa' => (string) ($day['nakshatraNameTa'] ?? $day['nakshatraNameEn'] ?? ''),
                    'nakshatraNameHi' => (string) ($day['nakshatraNameHi'] ?? $day['nakshatraNameEn'] ?? ''),
                    'pada' => (int) $padaRaw,
                    'yogaNameEn' => (string) ($day['yogaNameEn'] ?? ''),
                    'karanaNameEn' => (string) ($day['karanaNameEn'] ?? ''),
                    'rahuKalam' => self::muhurthamWindowLabel($day['rahuKalam'] ?? null),
                    'yamagandam' => self::muhurthamWindowLabel($day['yamagandam'] ?? null),
                    'gulikai' => self::muhurthamWindowLabel($day['gulikai'] ?? null),
                    'nallaNeram' => array_values(array_map(
                        [self::class, 'muhurthamWindowLabel'],
                        array_values(array_filter((array) ($day['nallaNeram'] ?? []), 'is_array'))
                    )),
                    'grade' => self::muhurthamGrade($day['grade'] ?? ''),
                    'score' => intval($day['score'] ?? 0),
                    'isRecommended' => !empty($day['isRecommended']),
                    'isAdhikaMasa' => !empty($day['isAdhikaMasa']),
                    'isPitruPaksha' => !empty($day['isPitruPaksha']),
                    'reasonsEn' => self::muhurthamStringList($day['reasonsEn'] ?? []),
                    'reasonsTa' => self::muhurthamStringList($day['reasonsTa'] ?? $day['reasonsEn'] ?? []),
                    'reasonsHi' => self::muhurthamStringList($day['reasonsHi'] ?? $day['reasonsEn'] ?? []),
                    'doshasEn' => self::muhurthamStringList($day['doshasEn'] ?? []),
                    'doshasTa' => self::muhurthamStringList($day['doshasTa'] ?? $day['doshasEn'] ?? []),
                    'doshasHi' => self::muhurthamStringList($day['doshasHi'] ?? $day['doshasEn'] ?? []),
                    'personalChecks' => is_array($day['personalChecks'] ?? null) ? $day['personalChecks'] : [],
                    // Per-date Chandrashtama / Tara Bala summary line. Both
                    // engines carry it, so the browser and PHP reports
                    // print the same note under the same star.
                    'personalNoteEn' => (string) ($day['personalNoteEn'] ?? ''),
                    'personalNoteTa' => (string) ($day['personalNoteTa'] ?? $day['personalNoteEn'] ?? ''),
                    'personalNoteHi' => (string) ($day['personalNoteHi'] ?? $day['personalNoteEn'] ?? ''),
                    // Asta / retrograde flags travel with every date so both
                    // engines can prove no recommended day is inside the
                    // Sukra (Venus) asta window.
                    'planetaryHighlights' => is_array($day['planetaryHighlights'] ?? null)
                        ? [
                            'guruRetrograde' => !empty($day['planetaryHighlights']['guruRetrograde']),
                            'guruCombust' => !empty($day['planetaryHighlights']['guruCombust']),
                            'sukraRetrograde' => !empty($day['planetaryHighlights']['sukraRetrograde']),
                            'sukraCombust' => !empty($day['planetaryHighlights']['sukraCombust']),
                            'budhaRetrograde' => !empty($day['planetaryHighlights']['budhaRetrograde']),
                            'eclipseNearby' => !empty($day['planetaryHighlights']['eclipseNearby'])
                        ]
                        : null
                ];
            }
            if (count($days) === 0) {
                continue;
            }
            $best = 0; $good = 0; $fair = 0; $avoid = 0;
            foreach ($days as $d) {
                if ($d['grade'] === 'BEST') { $best++; }
                elseif ($d['grade'] === 'GOOD') { $good++; }
                elseif ($d['grade'] === 'FAIR') { $fair++; }
                else { $avoid++; }
            }
            $normalizedMonths[] = [
                'monthKey' => substr((string) ($month['monthKey'] ?? ''), 0, 7),
                'month' => intval($month['month'] ?? 0),
                'year' => intval($month['year'] ?? 0),
                'monthNameEn' => (string) ($month['monthNameEn'] ?? ''),
                'monthNameTa' => (string) ($month['monthNameTa'] ?? $month['monthNameEn'] ?? ''),
                'monthNameHi' => (string) ($month['monthNameHi'] ?? $month['monthNameEn'] ?? ''),
                'days' => $days,
                'bestCount' => $best,
                'goodCount' => $good,
                'fairCount' => $fair,
                'avoidCount' => $avoid
            ];
        }

        if (count($normalizedMonths) === 0) {
            throw new RuntimeException('Muhurtham scan contains no valid dates.');
        }

        // Bride + groom are checked together for the ceremonies that join two
        // people (wedding, engagement). Every other ceremony is a one-person
        // report, so a second chart that arrives with such a payload (stale
        // couple order, family-member edit or a hand-built API call) is stripped
        // instead of quietly changing that person's dates.
        // Mirrors eventUsesBothCharts() in muhurthamScan.ts.
        $MUHURTHAM_TWO_CHART_EVENTS = ['wedding', 'engagement'];
        $bothCharts = in_array((string) ($payload['eventKey'] ?? $scan['eventKey'] ?? ''), $MUHURTHAM_TWO_CHART_EVENTS, true);
        if (!$bothCharts) {
            foreach ($normalizedMonths as $monthIndex => $month) {
                foreach (($month['days'] ?? []) as $dayIndex => $day) {
                    $checks = is_array($day['personalChecks'] ?? null) ? $day['personalChecks'] : [];
                    $kept = array_values(array_filter($checks, function ($check) {
                        return !in_array((string) (($check['role'] ?? '')), ['bride', 'groom'], true);
                    }));
                    if (count($kept) !== count($checks)) {
                        $normalizedMonths[$monthIndex]['days'][$dayIndex]['personalChecks'] = $kept;
                        // A note that names the removed chart must not survive.
                        $noteEn = (string) ($day['personalNoteEn'] ?? '');
                        $noteTa = (string) ($day['personalNoteTa'] ?? $noteEn);
                        $noteHi = (string) ($day['personalNoteHi'] ?? $noteEn);
                        $mentionsSecondChart = function ($note) {
                            $lower = function_exists('mb_strtolower') ? mb_strtolower((string) $note) : strtolower((string) $note);
                            foreach (['bride', 'groom', 'மணமகள்', 'மணமகன்', 'वधू', 'वर'] as $token) {
                                $needle = function_exists('mb_strtolower') ? mb_strtolower($token) : $token;
                                if ($needle !== '' && strpos($lower, $needle) !== false) { return true; }
                            }
                            return false;
                        };
                        if ($mentionsSecondChart($noteEn) || $mentionsSecondChart($noteTa) || $mentionsSecondChart($noteHi)) {
                            $normalizedMonths[$monthIndex]['days'][$dayIndex]['personalNoteEn'] = '';
                            $normalizedMonths[$monthIndex]['days'][$dayIndex]['personalNoteTa'] = '';
                            $normalizedMonths[$monthIndex]['days'][$dayIndex]['personalNoteHi'] = '';
                        }
                    }
                }
            }
        }

        $persons = [];
        $primaryPersonAlreadyKept = false;
        foreach ((array) ($payload['persons'] ?? $scan['persons'] ?? []) as $person) {
            if (!is_array($person)) { continue; }
            $role = (string) ($person['role'] ?? 'self');
            if (!in_array($role, ['bride', 'groom', 'child', 'mother', 'self'], true)) { $role = 'self'; }
            if (!$bothCharts) {
                if (in_array($role, ['bride', 'groom'], true)) {
                    // Only the couple travelled in the payload: the first of
                    // them is the native this ceremony belongs to.
                    if ($primaryPersonAlreadyKept || count($persons) > 0) { continue; }
                    $role = 'self';
                    $primaryPersonAlreadyKept = true;
                } elseif ($primaryPersonAlreadyKept) {
                    continue;
                } else {
                    $primaryPersonAlreadyKept = true;
                }
            }
            $nakshatraIndex = intval($person['nakshatraIndex'] ?? 0);
            if ($nakshatraIndex < 0 || $nakshatraIndex > 26) { continue; }
            $rasiNumber = intval($person['rasiNumber'] ?? 0);
            if ($rasiNumber < 1 || $rasiNumber > 12) { $rasiNumber = intdiv($nakshatraIndex * 4, 9) + 1; }
            $lagnaRasiNumber = intval($person['lagnaRasiNumber'] ?? 0);
            if ($lagnaRasiNumber < 1 || $lagnaRasiNumber > 12) { $lagnaRasiNumber = 0; }
            $persons[] = [
                'role' => $role,
                'name' => (string) ($person['name'] ?? ''),
                'dob' => (string) ($person['dob'] ?? ''),
                'tob' => (string) ($person['tob'] ?? ''),
                'birthPlace' => (string) ($person['birthPlace'] ?? ''),
                'nakshatraIndex' => $nakshatraIndex,
                'nakshatraNameEn' => (string) ($person['nakshatraNameEn'] ?? ''),
                'nakshatraNameTa' => (string) ($person['nakshatraNameTa'] ?? $person['nakshatraNameEn'] ?? ''),
                'nakshatraNameHi' => (string) ($person['nakshatraNameHi'] ?? $person['nakshatraNameEn'] ?? ''),
                'rasiNumber' => $rasiNumber,
                'rasiNameEn' => (string) ($person['rasiNameEn'] ?? ''),
                'rasiNameTa' => (string) ($person['rasiNameTa'] ?? $person['rasiNameEn'] ?? ''),
                'rasiNameHi' => (string) ($person['rasiNameHi'] ?? $person['rasiNameEn'] ?? ''),
                'lagnaRasiNumber' => $lagnaRasiNumber,
                'lagnaNameEn' => (string) ($person['lagnaNameEn'] ?? ''),
                'lagnaNameTa' => (string) ($person['lagnaNameTa'] ?? $person['lagnaNameEn'] ?? ''),
                'lagnaNameHi' => (string) ($person['lagnaNameHi'] ?? $person['lagnaNameEn'] ?? ''),
                'taraNameEn' => (string) ($person['taraNameEn'] ?? ''),
                'taraNameTa' => (string) ($person['taraNameTa'] ?? ''),
                'taraNameHi' => (string) ($person['taraNameHi'] ?? ''),
                'isTaraAuspicious' => !isset($person['isTaraAuspicious']) || !empty($person['isTaraAuspicious'])
            ];
        }

        $windowRange = self::muhurthamWindowRange($normalizedMonths);
        return [
            // Bump whenever the normalised result shape changes so older stored
            // results are transparently recalculated on delivery.
            'muhurthamAlgorithmVersion' => self::MUHURTHAM_ALGORITHM_VERSION,
            'devoteeName' => (string) ($payload['name'] ?? $payload['devoteeName'] ?? 'User'),
            'dob' => (string) ($payload['dob'] ?? ''),
            'tob' => (string) ($payload['tob'] ?? ''),
            'birthPlace' => (string) ($payload['birthPlace'] ?? ''),
            'country' => (string) ($payload['country'] ?? ''),
            'latitude' => isset($payload['latitude']) && is_numeric($payload['latitude']) ? (float) $payload['latitude'] : null,
            'longitude' => isset($payload['longitude']) && is_numeric($payload['longitude']) ? (float) $payload['longitude'] : null,
            'timezoneOffsetHours' => isset($payload['timezoneOffsetHours']) && is_numeric($payload['timezoneOffsetHours']) ? (float) $payload['timezoneOffsetHours'] : null,
            'timeZoneId' => (string) ($payload['timeZoneId'] ?? ''),
            'muhurthamPlace' => trim((string) ($payload['muhurthamPlace'] ?? '')),
            'muhurthamCountry' => (string) ($payload['muhurthamCountry'] ?? ''),
            'muhurthamLatitude' => (float) $payload['muhurthamLatitude'],
            'muhurthamLongitude' => (float) $payload['muhurthamLongitude'],
            'muhurthamTimezoneOffsetHours' => (float) $payload['muhurthamTimezoneOffsetHours'],
            'muhurthamTimeZoneId' => (string) ($payload['muhurthamTimeZoneId'] ?? ''),
            'eventKey' => $eventKey,
            'eventTitleEn' => (string) ($event['titleEn'] ?? 'Subha Muhurtham'),
            'eventTitleTa' => (string) ($event['titleTa'] ?? ''),
            'eventTitleHi' => (string) ($event['titleHi'] ?? ''),
            'eventDescriptionEn' => (string) ($event['descriptionEn'] ?? ''),
            'eventDescriptionTa' => (string) ($event['descriptionTa'] ?? ''),
            'eventDescriptionHi' => (string) ($event['descriptionHi'] ?? ''),
            'selectedMonth' => (string) ($payload['selectedMonth'] ?? $scan['selectedMonth'] ?? ''),
            'windowLabelEn' => $windowRange !== '' ? $windowRange : count($normalizedMonths) . '-Month Muhurtham Calendar',
            'windowLabelTa' => $windowRange !== '' ? $windowRange : count($normalizedMonths) . ' மாத சுப முகூர்த்த காலண்டர்',
            'windowLabelHi' => $windowRange !== '' ? $windowRange : count($normalizedMonths) . ' माह का शुभ मुहूर्त कैलेंडर',
            'months' => $normalizedMonths,
            'persons' => $persons,
            'personalCheckMode' => count($persons) >= 2 ? 'both' : 'single',
            'orderNumber' => (string) ($payload['orderNumber'] ?? $payload['order_number'] ?? ''),
            'generatedAt' => date('Y-m-d H:i:s')
        ];
    }

    /** Muhurtham scan contract version — mirrors MUHURTHAM_ALGORITHM_VERSION in scanner.ts. */
    public const MUHURTHAM_ALGORITHM_VERSION = 6;

    /**
     * The real date range the scan covers, e.g. "07 Oct 2026 – 31 Mar 2027".
     * Mirrors windowRangeLabel() in src/services/muhurthamHtmlBuilder.ts and
     * windowRangeFromMonths() in src/lib/astrology/muhurthamScan.ts.
     */
    public static function muhurthamWindowRange(array $months): string {
        $dates = [];
        foreach ($months as $month) {
            foreach ((array) ($month['days'] ?? []) as $day) {
                $date = substr((string) ($day['date'] ?? ''), 0, 10);
                if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) { $dates[] = $date; }
            }
        }
        if (count($dates) === 0) { return ''; }
        sort($dates);
        $format = function ($iso) {
            $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return substr($iso, 8, 2) . ' ' . $months[intval(substr($iso, 5, 2)) - 1] . ' ' . substr($iso, 0, 4);
        };
        return $format($dates[0]) . ' – ' . $format($dates[count($dates) - 1]);
    }

    /** Muhurtham event catalogue from the shared rules.json knowledge base. */
    public static function getMuhurthamRules(): array {
        static $cache = null;
        if ($cache !== null) {
            return $cache;
        }
        $paths = [
            __DIR__ . '/../../src/lib/muhurtham/rules.json',
            __DIR__ . '/../../public_html/src/lib/muhurtham/rules.json'
        ];
        foreach ($paths as $path) {
            if (!is_file($path)) { continue; }
            $decoded = json_decode((string) file_get_contents($path), true);
            if (is_array($decoded) && is_array($decoded['events'] ?? null)) {
                $cache = $decoded['events'];
                return $cache;
            }
        }
        // Minimal inline fallback so a deployment without rules.json still
        // renders a valid report instead of throwing.
        $cache = [
            'wedding' => [
                'titleEn' => 'Wedding (Vivaha Muhurtham)',
                'titleTa' => 'திருமண சுப முகூர்த்தம்',
                'titleHi' => 'विवाह शुभ मुहूर्त',
                'descriptionEn' => 'Auspicious wedding dates conforming to Vedic Vivaha Shastras.',
                'descriptionTa' => 'ஆடி, புரட்டாசி, மார்கழி தவிர்த்து குரு-சுக்கிர அஸ்தமனம் இல்லாத திருமண சுப முகூர்த்த தினங்கள்.',
                'descriptionHi' => 'शास्त्रसम्मत विवाह मुहूर्त, जिसमें शुभ मास, नक्षत्र और गुरु-शुक्र बल का पूर्ण ध्यान रखा जाता है।'
            ]
        ];
        return $cache;
    }

    private static function muhurthamGrade($grade): string {
        $grade = strtoupper(trim((string) $grade));
        return in_array($grade, ['BEST', 'GOOD', 'FAIR', 'AVOID'], true) ? $grade : 'FAIR';
    }

    private static function muhurthamWindowLabel($window): string {
        if (is_array($window)) {
            $start = (string) ($window['start'] ?? '');
            $end = (string) ($window['end'] ?? '');
            return trim($start . ' - ' . $end, ' -');
        }
        return trim((string) $window);
    }

    private static function muhurthamStringList($list): array {
        if (!is_array($list)) {
            return trim((string) $list) === '' ? [] : [(string) $list];
        }
        $out = [];
        foreach ($list as $item) {
            if (is_scalar($item) && trim((string) $item) !== '') {
                $out[] = (string) $item;
            }
        }
        return $out;
    }

    /** Reject incomplete output instead of returning a questionable server PDF. */
    private static function assertMpdfPdf($pdf, string $documentLabel): string {
        if (!is_string($pdf)
            || strlen($pdf) <= 512
            || strpos(substr($pdf, 0, 1024), '%PDF-') === false
            || strpos(substr($pdf, -2048), '%%EOF') === false) {
            throw new \RuntimeException("mPDF returned an incomplete {$documentLabel} PDF.");
        }
        return $pdf;
    }

    /** Rebuild one official result from an order's saved service input payload. */
    public static function rebuildReportResultFromSavedInputs($order) {
        if (!is_array($order)) {
            throw new \RuntimeException('The saved order is unavailable; the report was not generated.');
        }
        $serviceType = (string) ($order['service_type'] ?? '');
        $rawInput = $order['input_payload'] ?? null;
        $input = is_array($rawInput) ? $rawInput : (is_string($rawInput) ? json_decode($rawInput, true) : null);
        if (!is_array($input) || count($input) === 0) {
            throw new \RuntimeException('Original report inputs are unavailable; refusing to generate a report from a stale cached result.');
        }

        if ($serviceType === 'BIRTH_JATHAGAM') {
            return self::calculateHoroscope($input);
        }
        if ($serviceType === 'MARRIAGE_COMPATIBILITY') {
            return self::calculateMatchmaking($input);
        }
        if ($serviceType === 'BABY_NAMING') {
            return self::calculateBabyNaming($input);
        }
        if ($serviceType === 'MUHURTHAM') {
            return self::calculateMuhurtham($input);
        }
        throw new \RuntimeException('Unsupported report service type; no report was generated.');
    }

    /**
     * Generate the full astrological report PDF.
     *  - BIRTH_JATHAGAM: Exactly 3 full pages with South Indian chart, planetary positions,
     *    doshas, life predictions across 6 domains, and certified remedies.
     *  - MARRIAGE_COMPATIBILITY: Exactly 1 full page with 10-Poruthams table and verdict.
     *  - BABY_NAMING: Exactly 1 full page with star syllables and recommended names.
     */
    public static function generateReportPdf($order, $result = null) {
        $serviceType = $order['service_type'] ?? 'BIRTH_JATHAGAM';
        $explicitResultProvided = $result !== null;

        // Official order downloads are rebuilt from the saved service inputs;
        // a cached calculated_result is never authoritative. Explicit preview
        // results remain supported only when they are complete and current.
        $needsRebuild = !$explicitResultProvided || !$result
            || ($serviceType === 'BABY_NAMING' && !self::isCurrentBabyNamingResult($result))
            || ($serviceType === 'MUHURTHAM' && !self::isCurrentMuhurthamResult($result));
        if ($needsRebuild) {
            $result = self::rebuildReportResultFromSavedInputs($order);
        }

        // Single-Source HTML Architecture:
        // 1. Generate the exact full HTML preview string matching admin preview & email
        require_once __DIR__ . '/mpdf_fontconfig.php';
        require_once __DIR__ . '/pdf_mpdf_reports.php';

        if (function_exists('astroEnsureMpdfAutoload')) {
            astroEnsureMpdfAutoload();
        }

        $htmlPreview = AstroReportViews::renderFullReportHtml($order, $result);

        // 2. Convert that exact HTML string to high-definition PDF using mPDF.
        // The plain-PHP writer was retired: never return a degraded substitute.
        if (!AstroMpdfReports::isAvailable()) {
            throw new \RuntimeException('mPDF is required for server report PDFs; no lower-quality fallback is enabled.');
        }
        try {
            $lang = astro_report_normalize_language($order['language'] ?? 'ta');
            return self::assertMpdfPdf(
                AstroMpdfReports::convertHtmlToPdf($htmlPreview, $lang),
                'report'
            );
        } catch (\Throwable $e) {
            error_log('mPDF report generation failed; no fallback PDF was produced: ' . $e->getMessage());
            throw new \RuntimeException('High-quality report PDF generation failed; no fallback PDF was produced.', 0, $e);
        }
    }

    public static function generateInvoicePdf($order) {
        require_once __DIR__ . '/mpdf_fontconfig.php';
        require_once __DIR__ . '/pdf_mpdf_invoice.php';

        if (function_exists('astroEnsureMpdfAutoload')) {
            astroEnsureMpdfAutoload();
        }

        if (!AstroMpdfInvoice::isAvailable()) {
            throw new \RuntimeException('mPDF is required for server invoices; no lower-quality fallback is enabled.');
        }
        try {
            return self::assertMpdfPdf(AstroMpdfInvoice::generateInvoicePdf($order), 'invoice');
        } catch (\Throwable $e) {
            error_log('mPDF invoice generation failed; no fallback PDF was produced: ' . $e->getMessage());
            throw new \RuntimeException('High-quality invoice PDF generation failed; no fallback PDF was produced.', 0, $e);
        }
    }

    /**
     * Generates the single consolidated invoice PDF for a whole family order
     * group (multiple charts, one payment, one delivery). Requires mPDF and
     * fails closed if the library is unavailable or returns invalid output.
     * $orders must be a non-empty array of order rows sharing the same group_id.
     */
    public static function generateFamilyInvoicePdf(array $orders, string $groupId) {
        if (empty($orders)) {
            throw new \InvalidArgumentException('generateFamilyInvoicePdf requires at least one order.');
        }

        require_once __DIR__ . '/mpdf_fontconfig.php';
        require_once __DIR__ . '/pdf_mpdf_invoice.php';

        if (function_exists('astroEnsureMpdfAutoload')) {
            astroEnsureMpdfAutoload();
        }

        if (!AstroMpdfInvoice::isAvailable()) {
            throw new \RuntimeException('mPDF is not available on this server, so a consolidated family invoice cannot be generated.');
        }

        return self::assertMpdfPdf(AstroMpdfInvoice::generateFamilyInvoicePdf($orders, $groupId), 'family invoice');
    }
}
