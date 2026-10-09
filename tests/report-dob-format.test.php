<?php
// Every server-side (mPDF) report prints the date of birth as DD/MM/YYYY, e.g. 27/07/1990.
require_once __DIR__ . '/../api/astrology/engine.php';
require_once __DIR__ . '/../api/astrology/pdf_mpdf_reports.php';
$birth = ['birthPlace' => 'Chennai', 'country' => 'India', 'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5, 'timeZoneId' => 'Asia/Kolkata'];
$fail = 0;
$chk = function ($label, $html, $want, $bad) use (&$fail) {
  $ok = strpos($html, $want) !== false && strpos($html, $bad) === false;
  if (!$ok) { $fail++; }
  echo ($ok ? '[PASS] ' : '[FAIL] ') . "$label: $want\n";
};
$h = AstroEngine::calculateHoroscope(array_merge($birth, ['name' => 'Priya', 'dob' => '1990-07-27', 'tob' => '06:30', 'gender' => 'F']));
foreach (['en','ta','hi'] as $l) $chk("Jathagam $l", AstroReportViews::generateBirthJathagamHtml(['language' => $l], $h), '27/07/1990', '1990-07-27 at');
$m = AstroEngine::calculateMatchmaking(['bride' => array_merge($birth, ['name' => 'Priya', 'dob' => '1990-07-27', 'tob' => '06:30', 'gender' => 'F']), 'groom' => array_merge($birth, ['name' => 'Karthik', 'dob' => '1988-01-03', 'tob' => '02:00', 'gender' => 'M'])]);
foreach (['en','ta','hi'] as $l) { $html = AstroReportViews::generateWeddingMatchingHtml(['language' => $l], $m); $chk("Wedding bride $l", $html, 'DOB: 27/07/1990', 'DOB: 1990'); $chk("Wedding groom $l", $html, 'DOB: 03/01/1988', 'DOB: 1988'); }
$b = AstroEngine::calculateBabyNaming(array_merge($birth, ['babyName' => 'Aarav', 'gender' => 'M', 'dob' => '2024-03-09', 'tob' => '02:00']));
foreach (['en','ta','hi'] as $l) $chk("Baby $l", AstroReportViews::generateBabyNamingHtml(['language' => $l], $b), '09/03/2024', '>2024-03-09<');
$mu = ['devoteeName' => 'Priya', 'dob' => '1990-07-27', 'tob' => '06:30', 'birthPlace' => 'Chennai', 'eventKey' => 'wedding', 'months' => [],
  'persons' => [
    ['role' => 'groom', 'name' => 'Karthik', 'dob' => '1988-01-03', 'tob' => '02:00', 'nakshatraIndex' => 14, 'nakshatraNameEn' => 'Swati', 'rasiNumber' => 7, 'rasiNameEn' => 'Thulam'],
    ['role' => 'bride', 'name' => 'Priya', 'dob' => '1990-07-27', 'tob' => '06:30', 'nakshatraIndex' => 22, 'nakshatraNameEn' => 'Dhanishta', 'rasiNumber' => 10, 'rasiNameEn' => 'Magaram'],
  ], 'personalCheckMode' => 'both'];
foreach (['en','ta','hi'] as $l) { $html = AstroReportViews::generateMuhurthamHtml(['language' => $l], $mu); $chk("Muhurtham bride $l", $html, '27/07/1990', '27 Jul 1990'); $chk("Muhurtham groom $l", $html, '03/01/1988', '03 Jan 1988'); }
if ($fail) { fwrite(STDERR, "FAILURES: $fail\n"); exit(1); }
echo "All PHP report DOB format checks passed.\n";
