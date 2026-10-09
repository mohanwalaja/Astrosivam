<?php
require_once __DIR__ . '/../api/admin/family_docs.php';

function checkPreviewPdfQuality(bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "[PASS] {$message}\n";
}

/** Small structural fixture shaped like the browser jsPDF output. */
function previewPdfFixture(array $images, ?int $pageCount = null, bool $includeEof = true): string {
    $pageCount = $pageCount ?? count($images);
    $pageIds = [];
    for ($i = 0; $i < $pageCount; $i++) {
        $pageIds[] = 3 + ($i * 2);
    }

    $pdf = "%PDF-1.7\n";
    $pdf .= "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n";
    $pdf .= "2 0 obj << /Type /Pages /Kids [" . implode(' ', array_map(fn($id) => $id . ' 0 R', $pageIds)) . "] /Count {$pageCount} >> endobj\n";

    for ($i = 0; $i < $pageCount; $i++) {
        $pageId = $pageIds[$i];
        $imageId = $pageId + 1;
        $image = $images[$i] ?? null;
        $resources = $image
            ? "/Resources << /XObject << /Im{$i} {$imageId} 0 R >> >>"
            : '';
        $pdf .= "{$pageId} 0 obj << /Type /Page /Parent 2 0 R {$resources} >> endobj\n";
        if ($image) {
            $stream = str_repeat('A', 1024);
            $pdf .= "{$imageId} 0 obj << /Type /XObject /Subtype /Image /Width {$image['width']} /Height {$image['height']} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " . strlen($stream) . " >>\n";
            $pdf .= "stream\n{$stream}\nendstream\nendobj\n";
        }
    }

    return $pdf . ($includeEof ? "%%EOF\n" : '');
}

$high = previewPdfFixture([
    ['width' => 1985, 'height' => 2808]
]);
checkPreviewPdfQuality(astroFamilyDocsIsPreviewQualityPdf($high), 'A high-resolution A4 browser capture passes the PDF quality gate');
checkPreviewPdfQuality(astroFamilyDocsDecodePdf(base64_encode($high)) === $high, 'The base64 decoder accepts the validated preview PDF');
checkPreviewPdfQuality(
    astroFamilyDocsDecodePdf('data:application/pdf;base64,' . base64_encode($high)) === $high,
    'The decoder accepts a PDF data URI without weakening the quality check'
);

$low = previewPdfFixture([
    ['width' => 1800, 'height' => 2700]
]);
checkPreviewPdfQuality(!astroFamilyDocsIsPreviewQualityPdf($low), 'A low-resolution PDF is rejected');
checkPreviewPdfQuality(astroFamilyDocsDecodePdf(base64_encode($low)) === null, 'A low-resolution PDF cannot be staged for customer email');

$noPageImage = previewPdfFixture([]);
checkPreviewPdfQuality(!astroFamilyDocsIsPreviewQualityPdf($noPageImage), 'A vector-only or image-missing PDF is rejected');

$partialBundle = previewPdfFixture([
    ['width' => 1985, 'height' => 2808]
], 2);
checkPreviewPdfQuality(!astroFamilyDocsIsPreviewQualityPdf($partialBundle), 'Every page in a multi-page PDF must have a high-resolution raster');

$twoPages = previewPdfFixture([
    ['width' => 2382, 'height' => 3369],
    ['width' => 1985, 'height' => 2808]
]);
checkPreviewPdfQuality(astroFamilyDocsIsPreviewQualityPdf($twoPages), 'A multi-page PDF passes when every page meets the minimum resolution');

$truncated = previewPdfFixture([
    ['width' => 1985, 'height' => 2808]
], 1, false);
checkPreviewPdfQuality(!astroFamilyDocsIsPreviewQualityPdf($truncated), 'A truncated PDF without an EOF marker fails closed');
checkPreviewPdfQuality(astroFamilyDocsDecodePdf('not base64') === null, 'Malformed base64 is rejected');

// Server preview exports must retain Unicode shaping without loading the
// unsupported OTL tables in the browser's modern Noto Indic font files.
require_once __DIR__ . '/../api/astrology/engine.php';
foreach (['ta', 'hi'] as $language) {
    checkPreviewPdfQuality(
        AstroMpdfReports::pdfFontStack($language) === 'freeserif',
        "{$language} mPDF uses its compatible embedded Indic font"
    );
}
checkPreviewPdfQuality(
    AstroMpdfReports::pdfFontStack('en') === 'notosans, cinzel, sans-serif',
    'English mPDF keeps its existing font stack'
);
checkPreviewPdfQuality(
    strpos(AstroReportViews::sharedCss('ta'), 'notosanstamil') !== false
        && strpos(AstroReportViews::sharedCss('hi'), 'notosansdevanagari') !== false,
    'Browser HTML retains its original Noto Indic fonts'
);

// Synthetic inputs only; exercise the same engine/rendering path as the POST
// endpoint without a database or customer data. The required mode prevents a
// deployment check from silently passing without the real mPDF dependency:
// ASTRO_REQUIRE_MPDF_TESTS=1 php tests/preview-pdf-quality.test.php
if (AstroMpdfReports::isAvailable()) {
    $birthInput = [
        'name' => 'PDF Regression', 'dob' => '1990-01-05', 'tob' => '12:00',
        'birthPlace' => 'Chennai', 'country' => 'India',
        'latitude' => 13.0827, 'longitude' => 80.2707,
        'timezoneOffsetHours' => 5.5, 'timeZoneId' => 'Asia/Kolkata'
    ];
    $brideInput = array_merge($birthInput, ['name' => 'PDF Bride', 'dob' => '1992-05-12', 'tob' => '08:30']);
    $babyInput = array_merge($birthInput, ['name' => 'PDF Baby', 'dob' => '2024-03-10', 'tob' => '08:45', 'gender' => 'M']);
    $services = [
        'BIRTH_JATHAGAM' => [$birthInput, AstroEngine::calculateHoroscope($birthInput)],
        'MARRIAGE_COMPATIBILITY' => [
            ['groom' => $birthInput, 'bride' => $brideInput],
            AstroEngine::calculateMatchmaking(['groom' => $birthInput, 'bride' => $brideInput])
        ],
        'BABY_NAMING' => [$babyInput, AstroEngine::calculateBabyNaming($babyInput)]
    ];
    foreach (['en', 'ta', 'hi'] as $language) {
        foreach ($services as $serviceType => [$input, $result]) {
            $order = [
                'service_type' => $serviceType, 'language' => $language,
                'order_number' => 'PREVIEW-PDF-TEST', 'user_name' => 'PDF Regression',
                'input_payload' => $input
            ];
            if ($serviceType === 'BABY_NAMING') {
                $note = [
                    'en' => 'not a certified birth-pada name match',
                    'ta' => 'பொருந்துவதாகச் சான்றளிக்கப்படவில்லை',
                    'hi' => 'मेल प्रमाणित नहीं है'
                ][$language];
                checkPreviewPdfQuality(
                    strpos(AstroReportViews::generateBabyNamingHtml($order, $result), $note) !== false,
                    "{$language} certificate does not certify the supplied name as matching the birth pada"
                );
            }
            $pdf = AstroEngine::generateReportPdf($order, $result);
            checkPreviewPdfQuality(
                strpos($pdf, '%PDF-') === 0 && strpos(substr($pdf, -2048), '%%EOF') !== false,
                "{$language} {$serviceType} preview export produces a complete mPDF document"
            );
            if ($language !== 'en') {
                checkPreviewPdfQuality(
                    preg_match('/\/BaseFont\s*\/[A-Za-z0-9+_-]*FreeSerif/', $pdf) === 1,
                    "{$language} {$serviceType} PDF actually embeds the compatible Indic font"
                );
            }
            if ($serviceType === 'BIRTH_JATHAGAM') {
                $physicalPages = preg_match_all('/\/Type\s*\/Page\b/', $pdf);
                checkPreviewPdfQuality(
                    $physicalPages === 3,
                    "{$language} birth report has exactly three physical pages, not a footer-only fourth (actual: {$physicalPages})"
                );
            }
        }
    }
    // Check the actual public fixed sample as well: its remedy-card density is
    // different from the synthetic chart and originally produced page four.
    $publicBirth = array_merge($birthInput, ['name' => 'Karthik Raman', 'dob' => '2000-01-01', 'tob' => '02:00']);
    $publicChart = AstroEngine::calculateHoroscope($publicBirth);
    foreach (['en', 'ta', 'hi'] as $language) {
        $order = [
            'service_type' => 'BIRTH_JATHAGAM', 'language' => $language,
            'order_number' => 'PUBLIC-SAMPLE-TEST', 'input_payload' => $publicBirth
        ];
        $pdf = AstroEngine::generateReportPdf($order, $publicChart);
        checkPreviewPdfQuality(
            preg_match_all('/\/Type\s*\/Page\b/', $pdf) === 3,
            "{$language} public Chennai birth sample has three physical pages"
        );
    }
} elseif (getenv('ASTRO_REQUIRE_MPDF_TESTS') === '1') {
    throw new RuntimeException('mPDF is required to verify three-language server preview exports.');
} else {
    echo "[SKIP] Three-language server rendering and physical page counts require mPDF.\n";
}

echo "\nPreview PDF quality tests passed.\n";
