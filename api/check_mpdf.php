<?php
/**
 * ASTRO SIVAM - mPDF & Font Diagnostic & Self-Test Script
 *
 * Debugging aid only - DISABLED unless ASTROSIVAM_DIAGNOSTICS=1 is set in the
 * API environment (or with `SetEnv ASTROSIVAM_DIAGNOSTICS 1` in .htaccess).
 * This page prints filesystem paths and the font inventory, so it must not be
 * publicly readable on a production host.
 *
 * When enabled it checks if mPDF is loaded, tests font availability, and
 * generates a sample test PDF.
 */
if (trim((string)getenv('ASTROSIVAM_DIAGNOSTICS')) !== '1') {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'Not found. Set ASTROSIVAM_DIAGNOSTICS=1 to run the mPDF self-test.',
    ]);
    exit;
}

header('Content-Type: text/html; charset=UTF-8');

ini_set('display_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/astrology/mpdf_fontconfig.php';
require_once __DIR__ . '/astrology/pdf_mpdf_reports.php';
require_once __DIR__ . '/astrology/engine.php';

$mpdfLoaded = AstroMpdfReports::isAvailable();
$fontDir = function_exists('astroMpdfFontDir') ? astroMpdfFontDir() : __DIR__ . '/astrology/fonts';

$requiredFonts = [
    'NotoSansTamil-Regular.ttf' => 'Tamil Regular',
    'NotoSansTamil-Bold.ttf' => 'Tamil Bold',
    'NotoSansDevanagari-Regular.ttf' => 'Hindi/Devanagari Regular',
    'NotoSansDevanagari-Bold.ttf' => 'Hindi/Devanagari Bold',
    'NotoSans-Regular.ttf' => 'Latin Regular',
    'NotoSans-Bold.ttf' => 'Latin Bold',
    'BalooThambi2-Bold.ttf' => 'Baloo Thambi Bold',
    'Cinzel-Bold.ttf' => 'Cinzel Gold Bold',
    'YatraOne-Regular.ttf' => 'Yatra One Devanagari'
];

$fontStatus = [];
foreach ($requiredFonts as $file => $label) {
    $path = $fontDir . '/' . $file;
    $fontStatus[$file] = [
        'label' => $label,
        'exists' => file_exists($path),
        'size' => file_exists($path) ? round(filesize($path) / 1024, 1) . ' KB' : 'Missing'
    ];
}

$action = $_GET['action'] ?? '';
if ($action === 'test_pdf' && $mpdfLoaded) {
    try {
        $sampleOrder = [
            'service_type' => 'BIRTH_JATHAGAM',
            'order_number' => 'TEST-' . rand(1000, 9999),
            'language' => 'ta',
            'user_name' => 'பயனர் / User'
        ];
        $sampleResult = [
            'nativeName' => 'சுரேஷ் குமார் (Suresh Kumar)',
            'gender' => 'M',
            'dateOfBirth' => '1995-05-15',
            'timeOfBirth' => '07:30:00',
            'placeOfBirth' => 'Suva, Fiji',
            'latitude' => '-18.1416',
            'longitude' => '178.4419',
            'chandraRasiNameTa' => 'மேஷம் (Mesham)',
            'janmaNakshatraTa' => 'அசுவினி (Ashwini)',
            'janmaPada' => 2,
            'lagnaRasiNameTa' => 'ரிஷபம் (Vrishabham)',
            'dashaBalanceLord' => 'கேது (Ketu)',
            'dashaBalance' => ['lord' => 'Ketu', 'years' => 3, 'months' => 4, 'days' => 18],
            'planets' => [
                ['nameTa' => 'சூரியன் (Sun)', 'rasiNameTa' => 'ரிஷபம்', 'formattedLongitude' => '00° 31\'', 'nakshatraNameTa' => 'கிருத்திகை', 'pada' => 2, 'nakshatraLord' => 'சூரியன்'],
                ['nameTa' => 'சந்திரன் (Moon)', 'rasiNameTa' => 'மேஷம்', 'formattedLongitude' => '05° 40\'', 'nakshatraNameTa' => 'அசுவினி', 'pada' => 2, 'nakshatraLord' => 'கேது'],
                ['nameTa' => 'செவ்வாய் (Mars)', 'rasiNameTa' => 'சிம்மம்', 'formattedLongitude' => '18° 12\'', 'nakshatraNameTa' => 'பூரம்', 'pada' => 2, 'nakshatraLord' => 'சுக்கிரன்']
            ]
        ];

        $pdf = AstroEngine::generateReportPdf($sampleOrder, $sampleResult);
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="ASTRO_SIVAM_Diagnostic_Test.pdf"');
        echo $pdf;
        exit;
    } catch (\Throwable $e) {
        $pdfError = $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ASTRO SIVAM - mPDF & Font Diagnostic Status</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fdfaf6; color: #333; margin: 40px auto; max-width: 800px; padding: 20px; line-height: 1.6; }
        .card { background: #fff; border: 1.5px solid #e8d9b8; border-radius: 8px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px; }
        h1 { color: #7a1f1f; margin-top: 0; font-size: 22px; border-bottom: 2px solid #c9962c; padding-bottom: 8px; }
        h2 { color: #7a1f1f; font-size: 16px; margin-top: 20px; }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 13px; }
        .status-ok { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
        .status-err { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px 12px; border: 1px solid #eee; text-align: left; font-size: 13px; }
        th { background: #faf4e6; color: #7a1f1f; }
        .btn { display: inline-block; background: #7a1f1f; color: #fff; padding: 10px 18px; border-radius: 4px; text-decoration: none; font-weight: bold; margin-top: 15px; }
        .btn:hover { background: #922626; }
        .instruction-box { background: #fcf8e3; border: 1px solid #faebcc; border-radius: 4px; padding: 15px; font-size: 13.5px; color: #8a6d3b; margin-top: 15px; }
        code { background: #eee; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
    </style>
</head>
<body>

<div class="card">
    <h1>ASTRO SIVAM &bull; Server Diagnostic Check</h1>

    <h2>1. mPDF Engine Status</h2>
    <p>
        <?php if ($mpdfLoaded): ?>
            <span class="status-badge status-ok">&#10004; mPDF is INSTALLED and READY!</span>
            <br><small style="color:#666;">Class <code>\Mpdf\Mpdf</code> loaded successfully.</small>
        <?php else: ?>
            <span class="status-badge status-err">&#10008; mPDF library not detected</span>
            <br><small style="color:#666;">Server-side PDF generation is disabled until mPDF is installed; no lower-quality PDF fallback is generated or emailed.</small>
        <?php endif; ?>
    </p>

    <h2>2. Font Directory & TrueType Files</h2>
    <p>Active Font Path: <code><?= htmlspecialchars($fontDir) ?></code></p>
    <table>
        <thead>
            <tr><th>Font Name</th><th>File</th><th>Status</th><th>File Size</th></tr>
        </thead>
        <tbody>
            <?php foreach ($fontStatus as $f => $info): ?>
            <tr>
                <td><strong><?= htmlspecialchars($info['label']) ?></strong></td>
                <td><code><?= htmlspecialchars($f) ?></code></td>
                <td>
                    <?php if ($info['exists']): ?>
                        <span style="color:#2e7d32; font-weight:bold;">&#10004; Ready</span>
                    <?php else: ?>
                        <span style="color:#c62828; font-weight:bold;">&#10008; Missing</span>
                    <?php endif; ?>
                </td>
                <td><?= htmlspecialchars($info['size']) ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>

    <h2>3. Generate Sample PDF Test</h2>
    <?php if ($mpdfLoaded): ?>
        <p>Click below to test full 3-page Birth Jathagam PDF generation with Tamil/Hindi fonts:</p>
        <a href="?action=test_pdf" target="_blank" class="btn">&#128196; Download Test Vedic PDF Report</a>
        <?php if (!empty($pdfError)): ?>
            <p style="color:red; font-size:13px; margin-top:10px;">Error: <?= htmlspecialchars($pdfError) ?></p>
        <?php endif; ?>
    <?php else: ?>
        <p style="color:#8a6d3b;">Upload or install mPDF (see instructions below) to unlock high-definition TrueType Indic PDF rendering.</p>
    <?php endif; ?>
</div>

<?php if (!$mpdfLoaded): ?>
<div class="card">
    <h2>How to easily upload / install mPDF on cPanel / Shared Hosting:</h2>
    
    <div class="instruction-box">
        <strong>Option A: One-Command Terminal in cPanel (Easiest)</strong><br>
        1. Log into your cPanel &rarr; Click <strong>Terminal</strong>.<br>
        2. Type: <code>cd public_html && composer require mpdf/mpdf</code> and press Enter.<br>
        3. Refresh this page!
    </div>

    <div class="instruction-box" style="margin-top:10px;">
        <strong>Option B: Upload via cPanel File Manager</strong><br>
        1. If you have a <code>vendor.zip</code> containing mPDF, upload it to <code>public_html/</code> in cPanel File Manager.<br>
        2. Right-click and <strong>Extract</strong> so that <code>public_html/vendor/autoload.php</code> exists.<br>
        3. Refresh this page!
    </div>
</div>
<?php endif; ?>

</body>
</html>
