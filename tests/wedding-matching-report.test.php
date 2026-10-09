<?php
require_once __DIR__ . '/../api/astrology/engine.php';

function checkWeddingVerdict(bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "[PASS] {$message}\n";
}

$validBirth = [
    'name' => 'Birth Validation Test',
    'dob' => '1990-08-15',
    'tob' => '09:30',
    'birthPlace' => 'Suva, Fiji',
    'country' => 'Fiji',
    'latitude' => -18.1416,
    'longitude' => 178.4419,
    'timezoneOffsetHours' => 12,
    'timeZoneId' => 'Pacific/Fiji'
];
checkWeddingVerdict(AstroEngine::hasValidBirthDetails($validBirth), 'PHP accepts a complete, real birth profile');
checkWeddingVerdict(!AstroEngine::hasValidBirthDetails(array_merge($validBirth, ['dob' => '2099-01-01'])), 'PHP rejects a future birth instant');
checkWeddingVerdict(!AstroEngine::hasValidBirthDetails(array_merge($validBirth, ['tob' => '25:70'])), 'PHP rejects an impossible birth time');
$nonexistentDstBirth = array_merge($validBirth, [
    'dob' => '2024-03-10', 'tob' => '02:30', 'latitude' => 40.7128,
    'longitude' => -74.006, 'timezoneOffsetHours' => -5, 'timeZoneId' => 'America/New_York'
]);
checkWeddingVerdict(!AstroEngine::hasValidBirthDetails($nonexistentDstBirth), 'PHP rejects a nonexistent local time in a daylight-saving spring gap');
$ambiguousDstBirth = array_merge($nonexistentDstBirth, ['dob' => '2024-11-03', 'tob' => '01:30']);
checkWeddingVerdict(!AstroEngine::hasValidBirthDetails($ambiguousDstBirth), 'PHP rejects a repeated local time in a daylight-saving autumn fold');
checkWeddingVerdict(!AstroEngine::hasValidBirthDetails(array_merge($validBirth, ['latitude' => null])), 'PHP rejects missing coordinates instead of using Nadi defaults');

// Historical DST without an IANA id: the zone is derived from the coordinates
// and the region's real transition history overrides the submitted offset.
checkWeddingVerdict(AstroEngine::timeZoneIdForCoordinates(-18.1416, 178.4419) === 'Pacific/Fiji', 'PHP coordinate lookup resolves Suva to Pacific/Fiji');
checkWeddingVerdict(AstroEngine::timeZoneIdForCoordinates(13.0827, 80.2707) === 'Asia/Kolkata', 'PHP coordinate lookup resolves Chennai to Asia/Kolkata');
checkWeddingVerdict(AstroEngine::timeZoneIdForCoordinates(40.7128, -74.006) === 'America/New_York', 'PHP coordinate lookup resolves New York to America/New_York');
checkWeddingVerdict(AstroEngine::timeZoneIdForCoordinates(0, -180) === 'Etc/GMT+12', 'PHP coordinate lookup falls back to nautical Etc/GMT zones at sea');
$fijiSummer1999 = array_merge($validBirth, ['dob' => '1999-12-15', 'tob' => '06:00', 'timezoneOffsetHours' => 12, 'timeZoneId' => '']);
$fijiResolved = AstroEngine::resolveBirthInstant($fijiSummer1999);
checkWeddingVerdict($fijiResolved['ok'] && $fijiResolved['timeZoneId'] === 'Pacific/Fiji' && $fijiResolved['timeZoneSource'] === 'coordinates',
    'PHP derives Pacific/Fiji from coordinates when timeZoneId is omitted');
checkWeddingVerdict(abs($fijiResolved['offsetHours'] - 13.0) < 1e-9 && $fijiResolved['offsetAdjusted'] === true && $fijiResolved['dst'] === true
    && gmdate('Y-m-d H:i', $fijiResolved['timestamp']) === '1999-12-14 17:00',
    'PHP applies the historical Fiji 1999/2000 DST offset (+13) instead of the submitted +12');
$fijiWithId = AstroEngine::resolveBirthInstant(array_merge($fijiSummer1999, ['timeZoneId' => 'Pacific/Fiji']));
checkWeddingVerdict($fijiWithId['timestamp'] === $fijiResolved['timestamp'] && $fijiWithId['timeZoneSource'] === 'payload',
    'PHP resolves the same instant with or without an explicit Pacific/Fiji id');
$fijiHoroscopeNoId = AstroEngine::calculateHoroscope($fijiSummer1999);
$fijiHoroscopeWithId = AstroEngine::calculateHoroscope(array_merge($fijiSummer1999, ['timeZoneId' => 'Pacific/Fiji']));
checkWeddingVerdict($fijiHoroscopeNoId['lagna'] === $fijiHoroscopeWithId['lagna'] && $fijiHoroscopeNoId['timezoneOffsetHours'] === 13.0
    && $fijiHoroscopeNoId['timeZoneId'] === 'Pacific/Fiji' && $fijiHoroscopeNoId['timezoneOffsetAdjusted'] === true,
    'PHP horoscope Lagna is identical with or without timeZoneId for a Fiji DST-era birth');
$usSummer = array_merge($nonexistentDstBirth, ['dob' => '2024-07-04', 'tob' => '12:00', 'timeZoneId' => '']);
$usResolved = AstroEngine::resolveBirthInstant($usSummer);
checkWeddingVerdict($usResolved['ok'] && $usResolved['timeZoneId'] === 'America/New_York' && abs($usResolved['offsetHours'] + 4.0) < 1e-9 && $usResolved['offsetAdjusted'],
    'PHP corrects a US summer birth submitted with the EST offset to EDT via coordinates');
checkWeddingVerdict(!AstroEngine::hasValidBirthDetails(array_merge($nonexistentDstBirth, ['timeZoneId' => ''])),
    'PHP still rejects a DST spring-gap time when the zone comes from coordinates');
checkWeddingVerdict(!AstroEngine::hasValidBirthDetails(array_merge($ambiguousDstBirth, ['timeZoneId' => ''])),
    'PHP still rejects a DST autumn-fold time when the zone comes from coordinates');
checkWeddingVerdict(strpos((string) AstroEngine::describeBirthDetailsProblem($ambiguousDstBirth), 'occurred twice') !== false,
    'PHP explains a DST fold rejection in plain language');
checkWeddingVerdict(!AstroEngine::hasValidBirthDetails(array_merge($validBirth, ['timeZoneId' => 'EST'])), 'PHP rejects fixed abbreviations such as EST as time zone ids');
checkWeddingVerdict(!AstroEngine::hasValidBirthDetails(array_merge($validBirth, ['timeZoneId' => 'Mars/Olympus'])), 'PHP rejects unknown IANA ids instead of falling back to the offset');
$kolkata = AstroEngine::resolveBirthInstant(array_merge($validBirth, ['dob' => '1990-01-05', 'tob' => '12:00', 'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5, 'timeZoneId' => 'Asia/Kolkata']));
checkWeddingVerdict($kolkata['ok'] && abs($kolkata['offsetHours'] - 5.5) < 1e-9 && !$kolkata['offsetAdjusted'] && gmdate('Y-m-d H:i', $kolkata['timestamp']) === '1990-01-05 06:30',
    'PHP keeps IST +05:30 for an Asia/Kolkata birth');
checkWeddingVerdict(AstroEngine::normalizeBirthTime('7:30 PM') === '19:30', 'PHP normalizes an explicit 12-hour birth time without guessing');
checkWeddingVerdict(AstroEngine::normalizeBirthTime('24:00') === null, 'PHP rejects an out-of-range 24-hour birth time');
$missingBirthFailedClosed = false;
try {
    AstroEngine::calculateHoroscope([]);
} catch (RuntimeException $error) {
    $missingBirthFailedClosed = strpos($error->getMessage(), 'valid past birth date') !== false;
}
checkWeddingVerdict($missingBirthFailedClosed, 'PHP never calculates a paid chart from the former 1990/Nadi defaults');

// Exercise the PHP rule table directly as well as the final report payload.
// `$boy` is the groom and `$girl` is the bride, matching calculateMatchmaking.
$poruthamMethod = new ReflectionMethod(AstroEngine::class, 'calculatePoruthams');
$poruthamMethod->setAccessible(true);
$poruthamsForStars = static function (int $groomStar, int $brideStar) use ($poruthamMethod): array {
    return $poruthamMethod->invoke(null, $groomStar, 0, $brideStar, 0, 'sun', 'sun');
};

$sameStarRules = $poruthamsForStars(0, 0);
checkWeddingVerdict(
    $sameStarRules['mahendra']['pass'] === false,
    'Mahendra Porutham does not count the same Nakshatra as a favorable distance'
);
checkWeddingVerdict(
    $sameStarRules['rajju']['pass'] === false,
    'The same Nakshatra pair correctly fails Rajju Porutham'
);

foreach ([4, 7, 10, 13, 16, 19, 22, 25] as $favorableCount) {
    $rules = $poruthamsForStars(($favorableCount - 1) % 27, 0);
    checkWeddingVerdict(
        $rules['mahendra']['pass'] === true,
        "Mahendra Porutham recognizes favorable bride-to-groom count {$favorableCount}"
    );
}

$samePadaRajju = $poruthamsForStars(9, 0); // Magha and Ashwini: Pada Rajju.
checkWeddingVerdict(
    $samePadaRajju['rajju']['pass'] === false,
    'Different Nakshatras in the same Rajju group still fail Rajju Porutham'
);
// Ashlesha (8) and Ashwini (0) are BOTH Pada Rajju in the classical grouping,
// so the two stars here are Ardra (5, Kanda) and Ashwini (0, Pada).
$differentRajju = $poruthamsForStars(5, 0);
checkWeddingVerdict(
    $differentRajju['rajju']['pass'] === true,
    'PHP Rajju groups match the TypeScript Nakshatra mapping'
);

// ---------------------------------------------------------------------------
// CASE 1 (reported bug): bride Avittam/Dhanishta (22, Siro Rajju) + groom
// Swathi (14, Kanda Rajju) are in DIFFERENT Rajju groups, so Rajju must be a
// full 5/5 Uttamam pass. The old table rotated 4,3,2,1,0 every five stars and
// put both stars in group 0, which failed the crucial gate and produced
// 19/35 with 6/10 instead of the correct 24/35 with 7/10.
// ---------------------------------------------------------------------------
$avittamSwati = $poruthamsForStars(14, 22); // groom Swathi 14, bride Avittam 22
checkWeddingVerdict(
    $avittamSwati['rajju']['pass'] === true && $avittamSwati['rajju']['pts'] === 5 && $avittamSwati['rajju']['max'] === 5,
    'CASE 1: bride Avittam (Siro) + groom Swathi (Kanda) earn Rajju Uttamam 5/5'
);
$rohiniSwati = $poruthamsForStars(14, 3); // both Kanda Rajju
checkWeddingVerdict(
    $rohiniSwati['rajju']['pass'] === false,
    'CASE 1 control: two stars of the SAME Rajju group still fail Rajju'
);

// The invariant the reported bug broke: the five classical groups each own SIX
// specific Nakshatras and repeat every nine stars. The old table was rotated
// 4,3,2,1,0 five stars at a time and then hand-patched at Revati, so members of
// one classical group carried different indexes. This walks the whole table.
$rajjuProperty = new ReflectionMethod(AstroEngine::class, 'rajjuTable');
$rajjuProperty->setAccessible(true);
$rajjuTable = $rajjuProperty->invoke(null)['groups'];
$classicalRajjuGroups = [
    'Siro (head)'    => [4, 13, 22],             // Mrigashirsha, Chitra, Dhanishta (Avittam)
    'Kanda (neck)'   => [3, 5, 12, 14, 21, 23],  // Rohini, Ardra, Hasta, Swati, Shravana, Shatabhisha
    'Udhara (navel)' => [2, 6, 11, 15, 20, 24],  // Krittika, Punarvasu, Uttara Phalguni, Vishakha, Uttara Ashadha, Purva Bhadrapada
    'Uru (thigh)'    => [1, 7, 10, 16, 19, 25],  // Bharani, Pushya, Purva Phalguni, Anuradha, Purva Ashadha, Uttara Bhadrapada
    'Pada (foot)'    => [0, 8, 9, 17, 18, 26],   // Ashwini, Ashlesha, Magha, Jyeshtha, Mula, Revati
];
checkWeddingVerdict(count($rajjuTable) === 27, 'The Rajju table covers all 27 Nakshatras');
$expectedIndex = 0;
foreach ($classicalRajjuGroups as $groupName => $memberStars) {
    $indexes = array_unique(array_map(static fn($star) => $rajjuTable[$star], $memberStars));
    checkWeddingVerdict(
        $indexes === [$expectedIndex],
        "Every classical {$groupName} Rajju Nakshatra shares group index {$expectedIndex}"
    );
    $expectedIndex++;
}

$sameBirth = [
    'name' => 'Same Star Test',
    'dob' => '1990-01-01',
    'tob' => '12:00',
    'birthPlace' => 'Chennai, India',
    'country' => 'India',
    'latitude' => 13.0827,
    'longitude' => 80.2707,
    'timezoneOffsetHours' => 5.5,
    'timeZoneId' => 'Asia/Kolkata'
];
$sameBirthMatch = AstroEngine::calculateMatchmaking([
    'bride' => array_merge($sameBirth, ['gender' => 'F']),
    'groom' => array_merge($sameBirth, ['gender' => 'M'])
]);
checkWeddingVerdict(
    $sameBirthMatch['rajjuMatch'] === false,
    'The PHP marriage result exposes the calculated Rajju failure instead of always returning true'
);
checkWeddingVerdict(
    $sameBirthMatch['bridePlace'] === 'Chennai, India' && $sameBirthMatch['groomPlace'] === 'Chennai, India',
    'The PHP matchmaking report appends each birth country once and never duplicates it'
);

// The fixed public sample couple IS the reported case: groom born 01 Jan 2000,
// 02:00, Chennai (Swati) and bride born 15 Jun 1998, 06:30, Chennai (Avittam).
$sampleCouple = AstroEngine::calculateMatchmaking([
    'bride' => array_merge($sameBirth, ['name' => 'Priya Devi', 'dob' => '1998-06-15', 'tob' => '06:30', 'gender' => 'F']),
    'groom' => array_merge($sameBirth, ['name' => 'Karthik Raman', 'dob' => '2000-01-01', 'tob' => '02:00', 'gender' => 'M'])
]);
$sampleRajju = array_values(array_filter($sampleCouple['poruthams'], static fn($p) => ($p['id'] ?? '') === 'rajju'))[0] ?? [];
$sampleYoni = array_values(array_filter($sampleCouple['poruthams'], static fn($p) => ($p['id'] ?? '') === 'yoni'))[0] ?? [];
checkWeddingVerdict(
    $sampleCouple['groomNakshatraNameEn'] === 'Swati' && $sampleCouple['brideNakshatraNameEn'] === 'Dhanishta',
    'CASE 1: the sample couple really is groom Swati + bride Avittam (Dhanishta)'
);
checkWeddingVerdict(
    $sampleCouple['rajjuMatch'] === true && ($sampleRajju['status'] ?? '') === 'UTTHAMAM' &&
    ($sampleRajju['pointsEarned'] ?? null) == 5 && ($sampleRajju['maxPoints'] ?? null) == 5,
    'CASE 1: the sample couple is reported as Rajju Uttamam 5/5, not a Rajju failure'
);
checkWeddingVerdict(
    (float) $sampleCouple['score'] === 24.0 && $sampleCouple['maxScore'] === 35,
    'CASE 1: the sample couple scores 24/35 (not 19/35)'
);
checkWeddingVerdict(
    $sampleCouple['totalPoruthamsMatched'] === 7,
    'CASE 1: the sample couple matches 7/10 Poruthams (not 6/10)'
);
checkWeddingVerdict(
    $sampleCouple['verdictStatus'] === 'MADHYAMAM',
    'CASE 1: the final verdict is recalculated from the corrected result (Madhyamam), not carried over as Not Recommended'
);
checkWeddingVerdict(
    ($sampleCouple['sevvayDosham']['groomMarsHouses']['lagna'] ?? null) === 5 &&
    in_array(($sampleCouple['sevvayDosham']['groomDoshaStatus'] ?? ''), ['DOSHA_NONE', 'DOSHA_CANCELLED'], true) &&
    strpos($sampleCouple['sevvayDosham']['groomDoshamSeverityTa'] ?? '', 'தோஷம் இல்லை') === 0 &&
    ($sampleCouple['sevvayDosham']['isGroomHasDosham'] ?? true) === false,
    'CASE 1: the groom fifth-house Mars placement is reported as no active Kuja Dosha'
);
checkWeddingVerdict(
    in_array('venus', $sampleCouple['sevvayDosham']['brideAfflictedFrom'] ?? [], true) &&
    is_numeric($sampleCouple['sevvayDosham']['brideMarsHouses']['venus'] ?? null),
    'CASE 1: the bride Kuja assessment identifies the computed Venus-based house reference'
);
checkWeddingVerdict(
    ($sampleYoni['yoniBrideAnimalTa'] ?? '') !== '' && ($sampleYoni['yoniGroomAnimalTa'] ?? '') !== '' &&
    ($sampleYoni['yoniRelationshipTa'] ?? '') === 'நடுநிலை' &&
    strpos($sampleYoni['explanationTa'] ?? '', $sampleYoni['yoniBrideAnimalTa']) !== false &&
    strpos($sampleYoni['explanationTa'] ?? '', $sampleYoni['yoniGroomAnimalTa']) !== false,
    'CASE 1: Yoni explanation names both computed animals and the actual neutral relationship'
);
$sampleTaHtml = AstroReportViews::generateWeddingMatchingHtml(['language' => 'ta', 'order_number' => 'ORD-CASE1'], $sampleCouple);
checkWeddingVerdict(
    strpos($sampleTaHtml, 'final-verdict-moderate') !== false &&
    strpos($sampleTaHtml, 'இறுதிப் பரிந்துரை') !== false &&
    substr_count($sampleTaHtml, 'ஏற்றுக்கொள்ளத்தக்க பொருத்தம்; பரிகாரங்களைப் பரிசீலிக்கலாம்.') === 1 &&
    strpos($sampleTaHtml, 'இந்த மதிப்பீட்டின்படி நல்ல பொருத்தம்') === false,
    'CASE 1: the report shows one concise Madhyamam recommendation, not repeated verdict copy'
);
$overviewGridPosition = strpos($sampleTaHtml, 'class="wedding-overview-grid"');
$visualMeterPosition = strpos($sampleTaHtml, 'பொருத்த ஒத்திசைவு அளவுகோல்', $overviewGridPosition === false ? 0 : $overviewGridPosition);
$kujaSummaryPosition = strpos($sampleTaHtml, 'செவ்வாய் தோஷச் சுருக்கம்', $overviewGridPosition === false ? 0 : $overviewGridPosition);
$poruthamTablePosition = strpos($sampleTaHtml, 'class="data-table"', $overviewGridPosition === false ? 0 : $overviewGridPosition);
checkWeddingVerdict(
    $overviewGridPosition !== false && $visualMeterPosition !== false && $kujaSummaryPosition !== false &&
    $poruthamTablePosition !== false && $visualMeterPosition < $kujaSummaryPosition && $kujaSummaryPosition < $poruthamTablePosition &&
    strpos($sampleTaHtml, 'role="meter"') !== false && strpos($sampleTaHtml, 'aria-valuenow="68.6"') !== false &&
    strpos($sampleTaHtml, 'Mars: <b>House 5 (தோஷம் இல்லை') !== false &&
    strpos($sampleTaHtml, 'தோஷ சமநிலை') !== false &&
    strpos($sampleTaHtml, 'செவ்வாய் வழிகாட்டல்') !== false &&
    strpos($sampleTaHtml, 'சுக்கிரனிலிருந்து ') === false &&
    strpos($sampleTaHtml, 'லக்னத்திலிருந்து 5-ஆம் இடம்') === false,
    'CASE 1: page 1 pairs the visual compatibility meter on the left and simple Kuja status/guidance on the right'
);
$sampleFailedRow = array_values(array_filter($sampleCouple['poruthams'], static fn($p) => is_numeric($p['pointsEarned'] ?? null) && (float) $p['pointsEarned'] === 0.0))[0] ?? [];
$sampleFailedPoints = isset($sampleFailedRow['maxPoints']) ? '0 / ' . (string) $sampleFailedRow['maxPoints'] : '';
checkWeddingVerdict(
    $sampleFailedPoints !== '' && strpos($sampleTaHtml, $sampleFailedPoints) !== false,
    'CASE 1: failed Poruthams print an explicit zero score such as 0 / maximum'
);
checkWeddingVerdict(
    strpos($sampleTaHtml, 'text-align: left') !== false &&
    preg_match('/[0-9]{2} [A-Za-z]{3} [0-9]{4}, [0-9]{2}:[0-9]{2} [A-Z]{2,5}/', $sampleTaHtml) === 1,
    'CASE 1: page-2 disclaimer is left-aligned and issue time includes its timezone'
);
$earnedPointSum = array_sum(array_column($sameBirthMatch['poruthams'], 'pointsEarned'));
$maximumPointSum = array_sum(array_column($sameBirthMatch['poruthams'], 'maxPoints'));
checkWeddingVerdict(
    count($sameBirthMatch['poruthams']) === 10 && $maximumPointSum === $sameBirthMatch['maxScore'] && $maximumPointSum === 35,
    'PHP reports ten weighted Poruthams with a denominator equal to the sum of their actual maxima (35)'
);
checkWeddingVerdict(
    abs((float) $sameBirthMatch['score'] - $earnedPointSum) < 0.0001 &&
    abs((float) $sameBirthMatch['percentage'] - round(($earnedPointSum / $maximumPointSum) * 100, 1)) < 0.0001,
    'PHP compatibility score and percentage are derived from the displayed Porutham point rows'
);
$phpRajju = array_values(array_filter($sameBirthMatch['poruthams'], static fn($p) => ($p['id'] ?? '') === 'rajju'))[0] ?? [];
$phpVedha = array_values(array_filter($sameBirthMatch['poruthams'], static fn($p) => ($p['id'] ?? '') === 'vedha'))[0] ?? [];
checkWeddingVerdict(
    !empty($phpRajju['isCrucial']) && !empty($phpVedha['isCrucial']) &&
    $sameBirthMatch['verdictStatus'] === 'PORUNDHADHU',
    'Both Rajju and Vedha are hard-stop Poruthams in the PHP final verdict'
);

// Sevvay / Kuja Dosha: 2, 4, 7, 8, 12 (South Indian rule) from Lagna, Moon and
// Venus, with the classical exceptions. Rasi numbers are 1-based (Mesham = 1).
$kujaEval = new ReflectionMethod('AstroEngine', 'evaluateKujaDosha');
$kujaEval->setAccessible(true);
$kuja = static fn(array $chart): array => $kujaEval->invoke(null, $chart);
$kujaCases = [
    ['DOSHA_NONE', ['mars' => 3, 'lagna' => 1, 'moon' => 1, 'venus' => 1, 'jupiter' => 6], null, 'Mars outside the Kuja houses from all three references is clean'],
    ['DOSHA_NONE', ['mars' => 2, 'lagna' => 2, 'moon' => 12, 'venus' => 12, 'jupiter' => 12], null, 'Mars in the 1st house from the Lagna alone is NOT a Kuja house (South Indian rule: 2, 4, 7, 8, 12)'],
    ['DOSHA_PRESENT', ['mars' => 3, 'lagna' => 9, 'moon' => 9, 'venus' => 12, 'jupiter' => 6], null, 'Mars in Mithunam in the 7th from Lagna and Moon without any exception is an active dosha'],
    ['DOSHA_CANCELLED', ['mars' => 1, 'lagna' => 7, 'moon' => 7, 'venus' => 7, 'jupiter' => 6], 'OWN_SIGN', 'Mars in its own sign Mesham cancels the dosha'],
    ['DOSHA_CANCELLED', ['mars' => 8, 'lagna' => 2, 'moon' => 2, 'venus' => 2, 'jupiter' => 6], 'OWN_SIGN', 'Mars in its own sign Viruchigam cancels the dosha'],
    ['DOSHA_CANCELLED', ['mars' => 10, 'lagna' => 3, 'moon' => 3, 'venus' => 3, 'jupiter' => 2], 'EXALTED', 'Exalted Mars in Magaram cancels the dosha'],
    ['DOSHA_CANCELLED', ['mars' => 5, 'lagna' => 2, 'moon' => 2, 'venus' => 2, 'jupiter' => 12], 'LEO_AQUARIUS', 'Mars in Simham is exempt in every dosha house'],
    ['DOSHA_CANCELLED', ['mars' => 3, 'lagna' => 2, 'moon' => 2, 'venus' => 2, 'jupiter' => 8], 'HOUSE_SIGN', 'Mars in Mithunam in the 2nd house is a classical house-sign exception (Tamil list)'],
    ['DOSHA_PRESENT', ['mars' => 4, 'lagna' => 3, 'moon' => 3, 'venus' => 3, 'jupiter' => 2], null, 'Mars in Kadagam in the 2nd house is NOT exempt under the Tamil Sevvai lists (Mithunam/Kanni only)'],
    ['DOSHA_CANCELLED', ['mars' => 9, 'lagna' => 2, 'moon' => 2, 'venus' => 2, 'jupiter' => 4], 'HOUSE_SIGN', 'Mars in Dhanusu in the 8th house is a classical house-sign exception'],
    ['DOSHA_CANCELLED', ['mars' => 3, 'lagna' => 9, 'moon' => 9, 'venus' => 9, 'jupiter' => 3], 'GURU_MANGALA', 'Jupiter conjunct Mars (Guru-Mangala Yoga) cancels the dosha'],
    ['DOSHA_CANCELLED', ['mars' => 3, 'lagna' => 9, 'moon' => 3, 'venus' => 9, 'jupiter' => 6], 'CHANDRA_MANGALA', 'Moon conjunct Mars (Chandra-Mangala Yoga) cancels the dosha'],
    ['DOSHA_CANCELLED', ['mars' => 3, 'lagna' => 9, 'moon' => 9, 'venus' => 9, 'jupiter' => 7], 'GURU_DRISHTI', 'Jupiter aspecting Mars (9th aspect) cancels the dosha'],
    ['DOSHA_CANCELLED', ['mars' => 12, 'lagna' => 5, 'moon' => 1, 'venus' => 1, 'jupiter' => 2], 'YOGAKARAKA_LAGNA', 'Mars as Yogakaraka for a Simha Lagna does not create the dosha'],
    ['DOSHA_MILD', ['mars' => 3, 'lagna' => 1, 'moon' => 1, 'venus' => 9, 'jupiter' => 6], 'NOT_FROM_LAGNA', 'Dosha only from Venus is reported as mild'],
    ['DOSHA_MILD', ['mars' => 3, 'lagna' => 9, 'moon' => 9, 'venus' => 12, 'jupiter' => 6, 'saturn' => 10], 'SATURN_NODE_BALANCE', 'Saturn in a Kuja house reduces the dosha to mild'],
    ['DOSHA_MILD', ['mars' => 4, 'lagna' => 10, 'moon' => 9, 'venus' => 8, 'jupiter' => 1], 'NOT_FROM_LAGNA', 'A house-sign exception from the Lagna leaves only the Moon count, which is mild'],
    ['NOT_ASSESSED', ['mars' => 3, 'lagna' => 9, 'moon' => 9, 'jupiter' => 6], null, 'Missing Venus keeps the Kuja assessment N/A instead of a false clean result'],
];
foreach ($kujaCases as [$expectedStatus, $chart, $expectedCode, $label]) {
    $evaluation = $kuja($chart);
    $codes = array_merge(array_column($evaluation['exceptions'], 'code'), array_column($evaluation['mitigations'], 'code'));
    checkWeddingVerdict(
        $evaluation['status'] === $expectedStatus && ($expectedCode === null || in_array($expectedCode, $codes, true)),
        "PHP Kuja Dosha: {$label} [{$evaluation['status']}" . ($codes ? ': ' . implode(',', $codes) : '') . ']'
    );
}
$engineConstants = (new ReflectionClass('AstroEngine'))->getConstants();
checkWeddingVerdict(
    ($engineConstants['KUJA_DOSHA_HOUSES'] ?? null) === [2, 4, 7, 8, 12],
    'PHP Kuja Dosha default house set is the South Indian rule (2, 4, 7, 8, 12)'
);
putenv('ASTRO_KUJA_HOUSES=1,2,4,7,8,12');
$overrideEval = $kuja(['mars' => 2, 'lagna' => 2, 'moon' => 12, 'venus' => 12, 'jupiter' => 12]);
putenv('ASTRO_KUJA_HOUSES');
checkWeddingVerdict(
    $overrideEval['status'] !== 'DOSHA_NONE' && in_array(1, (array) ($overrideEval['houses'] ?? []), true),
    'ASTRO_KUJA_HOUSES=1,2,4,7,8,12 restores the North Indian reading (1st house screened again)'
);
$cancelledEval = $kuja(['mars' => 1, 'lagna' => 7, 'moon' => 7, 'venus' => 7, 'jupiter' => 6]);
checkWeddingVerdict($cancelledEval['isPresent'] === false && strpos($cancelledEval['explanationEn'], 'own sign') !== false,
    'PHP Kuja Dosha: a cancelled dosha is not flagged as present and the explanation names the exception');
$mildEval = $kuja(['mars' => 3, 'lagna' => 1, 'moon' => 1, 'venus' => 9, 'jupiter' => 6]);
checkWeddingVerdict($mildEval['isPresent'] === true && stripos($mildEval['severityEn'], 'mild') !== false,
    'PHP Kuja Dosha: a mild dosha stays present but is labelled mild');
$kujaHoroscope = AstroEngine::calculateHoroscope($validBirth);
checkWeddingVerdict(isset($kujaHoroscope['kujaDosha']['status'], $kujaHoroscope['sevvaiDosha']['status'], $kujaHoroscope['sevvaiDosha']['recommendation'])
    && $kujaHoroscope['kujaDosha']['status'] === $kujaHoroscope['sevvaiDosha']['status'],
    'PHP horoscope exposes the Kuja Dosha status and recommendation text');

$baseResult = [
    'groomName' => 'Groom Test',
    'brideName' => 'Bride Test',
    'score' => 24,
    'maxScore' => 36,
    'percentage' => 66.7,
    'totalPoruthamsMatched' => 7,
    'poruthams' => [],
    'sevvayDosham' => [
        'doshaSamyamStatusEn' => 'Balanced (Dosha Samyam)',
        'recommendationEn' => 'Dosha alignment is balanced.'
    ],
    'rajjuMatch' => true
];

$goodResult = $baseResult;
$goodResult['verdictStatus'] = 'MADHYAMAM';
$goodResult['overallVerdictEn'] = 'Acceptable with Remedies - Madhyama Porutham';
$goodHtml = AstroReportViews::generateWeddingMatchingHtml(['language' => 'en'], $goodResult);
checkWeddingVerdict(
    strpos($goodHtml, 'class="panel final-verdict-moderate"') !== false &&
    strpos($goodHtml, 'Acceptable match; remedies may be considered.') !== false &&
    strpos($goodHtml, 'FINAL RECOMMENDATION') !== false &&
    strpos($goodHtml, 'The matching is good.') === false,
    'A Madhyamam report ends with a concise amber recommendation rather than a green Uttamam recommendation'
);
$uttamamResult = $baseResult;
$uttamamResult['verdictStatus'] = 'UTTHAMAM';
$uttamamResult['overallVerdictEn'] = 'Highly Recommended - Utthama Porutham';
$uttamamHtml = AstroReportViews::generateWeddingMatchingHtml(['language' => 'ta'], $uttamamResult);
checkWeddingVerdict(
    strpos($uttamamHtml, 'class="panel final-verdict-good"') !== false &&
    substr_count($uttamamHtml, 'இந்த மதிப்பீட்டின்படி நல்ல பொருத்தம்.') === 1 &&
    strpos($uttamamHtml, 'ஏற்றுக்கொள்ளத்தக்க பொருத்தம்') === false,
    'An Uttamam report presents one concise Tamil recommendation, not Madhyamam copy'
);

// ---------------------------------------------------------------------------
// CASE 2: a partial score must be labelled Mathimam (MADHYAMAM), never
// "Uttamam". Yoni 2/4 (a neutral animal pair) used to be promoted to
// UTTHAMAM because the label followed the pass/fail flag instead of the marks.
// ---------------------------------------------------------------------------
$yoniPartialResult = $baseResult;
$yoniPartialResult['verdictStatus'] = 'MADHYAMAM';
$yoniPartialResult['poruthams'] = [[
    'id' => 'yoni', 'nameEn' => 'Yoni Porutham', 'nameTa' => 'யோனிப் பொருத்தம்', 'nameHi' => 'योनि पोरुथम',
    'pointsEarned' => 2, 'maxPoints' => 4, 'status' => 'MADHYAMAM',
    'explanationEn' => 'Only a partial Yoni match.', 'explanationTa' => 'ஆंशिक யோனி மேல்.', 'explanationHi' => 'आंशिक योनि मेल।',
]];
$yoniPartialHtml = AstroReportViews::generateWeddingMatchingHtml(['language' => 'en'], $yoniPartialResult);
checkWeddingVerdict(
    strpos($yoniPartialHtml, 'MADHYAMAM') !== false && strpos($yoniPartialHtml, '2 / 4') !== false,
    'CASE 2: a 2/4 Yoni row is labelled Mathimam (MADHYAMAM), not Uttamam'
);

// The label comes from the engine's own scoring rule, not from the row above:
// Swati + Dhanishta are a neutral (neither friendly nor inimical) animal pair
// worth 2 of 4 marks, and that row must be reported as MADHYAMAM.
$yoniTwoOfFour = $poruthamsForStars(14, 22); // groom Swati + bride Dhanishta
checkWeddingVerdict(
    $yoniTwoOfFour['yoni']['pts'] === 2 && $yoniTwoOfFour['yoni']['max'] === 4,
    'CASE 2: the engine reports the neutral Yoni pair as a genuine 2/4 partial score'
);
$sampleYoniRow = array_values(array_filter($sampleCouple['poruthams'], static fn($p) => ($p['id'] ?? '') === 'yoni'))[0] ?? [];
checkWeddingVerdict(
    ($sampleYoniRow['status'] ?? '') === 'MADHYAMAM' && ($sampleYoniRow['pointsEarned'] ?? null) == 2 && ($sampleYoniRow['maxPoints'] ?? null) == 4,
    'CASE 2: the live 2/4 Yoni row carries the Mathimam (MADHYAMAM) label, never Uttamam'
);

// ---------------------------------------------------------------------------
// CASE 3: a genuine zero must print "0 / 4", never a bare "/ 4".
// ---------------------------------------------------------------------------
$zeroRowResult = $baseResult;
$zeroRowResult['verdictStatus'] = 'PORUNDHADHU';
$zeroRowResult['poruthams'] = [[
    'id' => 'gana', 'nameEn' => 'Gana Porutham', 'nameTa' => 'கணப் பொருத்தம்', 'nameHi' => 'गण पोरुथम',
    'points' => 0, 'pointsEarned' => 0, 'maxPoints' => 4, 'status' => 'PORUNDHADHU',
    'explanationEn' => 'The two Ganas differ.', 'explanationTa' => 'கணங்கள் வேறுபடுகின்றன.', 'explanationHi' => 'दोनों गण भिन्न हैं।',
]];
$zeroRowHtml = AstroReportViews::generateWeddingMatchingHtml(['language' => 'en'], $zeroRowResult);
checkWeddingVerdict(
    strpos($zeroRowHtml, '0 / 4') !== false,
    'CASE 3: a zero point row renders 0 / 4 instead of a blank numerator'
);
checkWeddingVerdict(
    preg_match('/<td[^>]*>\s*\/\s*4\s*<\/td>/', $zeroRowHtml) !== 1,
    'CASE 3: the report never prints a bare "/ 4" with an empty numerator'
);

$badResult = $baseResult;
$badResult['verdictStatus'] = 'PORUNDHADHU';
$badResult['percentage'] = 35;
$badResult['overallVerdictEn'] = 'Not Recommended - Porutham does not meet the recommended standard';
$badHtml = AstroReportViews::generateWeddingMatchingHtml(['language' => 'en'], $badResult);
checkWeddingVerdict(
    strpos($badHtml, 'class="panel final-verdict-not-good"') !== false &&
    strpos($badHtml, 'Not recommended on this assessment; seek expert review.') !== false &&
    strpos($badHtml, 'FINAL RECOMMENDATION') !== false &&
    strpos($badHtml, 'color:#991b1b') !== false,
    'An incompatible matching report ends with a concise, cautious red recommendation'
);
checkWeddingVerdict(
    strpos($badHtml, 'astrological guidance only') !== false,
    'The negative final verdict agrees with the page-2 disclaimer that this is guidance only'
);
$badTaHtml = AstroReportViews::generateWeddingMatchingHtml(['language' => 'ta'], $badResult);
checkWeddingVerdict(
    strpos($badTaHtml, 'இந்த மதிப்பீட்டின்படி பரிந்துரைக்கப்படவில்லை') !== false &&
    strpos($badTaHtml, 'நிபுணர் ஆலோசனை பெறவும்') !== false,
    'An Adhamam Tamil recommendation stays cautious and concise'
);

$missingScoreHtml = AstroReportViews::generateWeddingMatchingHtml(['language' => 'en'], ['poruthams' => []]);
checkWeddingVerdict(
    strpos($missingScoreHtml, 'N/A / N/A') !== false && strpos($missingScoreHtml, '/ 36') === false,
    'The PHP report displays N/A instead of inventing zero points or a 36-point denominator'
);
checkWeddingVerdict(
    strpos($missingScoreHtml, 'final-verdict-unavailable') !== false && strpos($missingScoreHtml, 'Not Recommended') === false,
    'The PHP report does not turn a missing verdict and score into a fabricated incompatibility'
);

$pdfOrder = [
    'service_type' => 'MARRIAGE_COMPATIBILITY',
    'language' => 'en',
    'order_number' => 'WEDDING-PDF-TEST',
    'user_name' => 'Wedding Test'
];
if (AstroMpdfReports::isAvailable()) {
    $pdf = AstroEngine::generateReportPdf($pdfOrder, $badResult);
    checkWeddingVerdict(
        strpos($pdf, '%PDF-') === 0 && strpos(substr($pdf, -2048), '%%EOF') !== false,
        'mPDF returns a complete Marriage Compatibility PDF'
    );
} else {
    $failedClosed = false;
    try {
        AstroEngine::generateReportPdf($pdfOrder, $badResult);
    } catch (RuntimeException $error) {
        $failedClosed = strpos($error->getMessage(), 'no fallback PDF was produced') !== false
            || strpos($error->getMessage(), 'no lower-quality fallback is enabled') !== false;
    }
    checkWeddingVerdict($failedClosed, 'PHP report generation fails closed when mPDF is unavailable');
}

// ── Page 2: Marriage Matching disclaimer (all three order languages) ────────
$disclaimerHtml = [
    'en' => AstroReportViews::generateWeddingMatchingHtml(['language' => 'en', 'order_number' => 'ORD-DISC'], $baseResult),
    'ta' => AstroReportViews::generateWeddingMatchingHtml(['language' => 'ta', 'order_number' => 'ORD-DISC'], $baseResult),
    'hi' => AstroReportViews::generateWeddingMatchingHtml(['language' => 'hi', 'order_number' => 'ORD-DISC'], $baseResult),
];

$expectedHeadings = [
    'en' => 'Marriage Matching - Important Note',
    'ta' => 'திருமணப் பொருத்தம் - முக்கியக் குறிப்பு',
    'hi' => 'विवाह मिलान - महत्वपूर्ण सूचना',
];

foreach ($disclaimerHtml as $lang => $html) {
    checkWeddingVerdict(
        strpos($html, '<pagebreak />') !== false,
        "{$lang}: the mPDF report breaks to a second page"
    );
    checkWeddingVerdict(
        strpos($html, 'disclaimer-panel') !== false && strpos($html, 'disclaimer-para') !== false,
        "{$lang}: page 2 carries the Marriage Matching disclaimer panel"
    );
    checkWeddingVerdict(
        strpos($html, $expectedHeadings[$lang]) !== false,
        "{$lang}: the disclaimer is printed in the language the order was placed in"
    );
    checkWeddingVerdict(
        strpos($html, '**') === false,
        "{$lang}: no raw ** emphasis markers survive into the HTML"
    );
    $pageTag = $lang === 'ta' ? 'பக்கம் 1 / 2' : ($lang === 'hi' ? 'पृष्ठ 1 / 2' : 'Page 1 of 2');
    checkWeddingVerdict(
        substr_count($html, 'class="header-page-tag"') === 2 && strpos($html, $pageTag) !== false,
        "{$lang}: page 1 is now numbered 1 of 2 (a second page follows)"
    );
    checkWeddingVerdict(
        substr_count($html, 'class="header-lockup"') === 2 &&
        strpos($html, '.header-lockup { width: 100%; text-align: center;') !== false &&
        strpos($html, 'margin: 0 auto 1mm;') !== false &&
        strpos($html, 'class="header-order-ref">#ORD-DISC') !== false,
        "{$lang}: both pages use the centered emblem lockup and retain the order reference"
    );
}

echo "\nWedding disclaimer page checks passed.\n";
