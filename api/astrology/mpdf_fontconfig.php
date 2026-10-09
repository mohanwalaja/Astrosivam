<?php
/**
 * ASTRO SIVAM - mPDF Autoload Discovery & Custom Font Registration
 *
 * Automatically discovers mPDF wherever installed in cPanel / public_html
 * and registers temple-theme fonts plus Unicode Noto Sans / Indic scripts.
 */

function astroEnsureMpdfAutoload(): bool {
    if (class_exists('\Mpdf\Mpdf')) {
        return true;
    }

    $docRoot = !empty($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/') : '';
    $homeDir = !empty($docRoot) ? dirname($docRoot) : '';

    $candidates = [
        // Exact public_html/vendor/autoload.php relative to api/astrology/
        __DIR__ . '/../../vendor/autoload.php',
        
        // Standard cPanel public_html / vendor locations
        $docRoot ? $docRoot . '/vendor/autoload.php' : '',
        $docRoot ? $docRoot . '/mpdf/vendor/autoload.php' : '',
        $docRoot ? $docRoot . '/mpdf/autoload.php' : '',
        $docRoot ? $docRoot . '/api/vendor/autoload.php' : '',
        $docRoot ? $docRoot . '/api/astrology/vendor/autoload.php' : '',
        
        // Above public_html (common composer installs in cPanel /home/username/vendor)
        $homeDir ? $homeDir . '/vendor/autoload.php' : '',
        $homeDir ? $homeDir . '/mpdf/vendor/autoload.php' : '',
        
        // Relative paths from api/astrology/
        __DIR__ . '/../vendor/autoload.php',
        __DIR__ . '/vendor/autoload.php',
        __DIR__ . '/../../../vendor/autoload.php',
        __DIR__ . '/../../../../vendor/autoload.php',
        __DIR__ . '/../vendor/mpdf/mpdf/src/Mpdf.php',
        
        // Parent folder searches
        dirname(__DIR__, 1) . '/vendor/autoload.php',
        dirname(__DIR__, 2) . '/vendor/autoload.php',
        dirname(__DIR__, 2) . '/mpdf/vendor/autoload.php',
        dirname(__DIR__, 3) . '/vendor/autoload.php',
        dirname(__DIR__, 3) . '/mpdf/vendor/autoload.php',
        dirname(__DIR__, 4) . '/vendor/autoload.php',
    ];

    if (!empty($_ENV['MPDF_AUTOLOAD_PATH'])) {
        array_unshift($candidates, $_ENV['MPDF_AUTOLOAD_PATH']);
    }

    foreach ($candidates as $p) {
        if (!empty($p) && is_file($p)) {
            require_once $p;
            if (class_exists('\Mpdf\Mpdf')) {
                return true;
            }
        }
    }

    return class_exists('\Mpdf\Mpdf');
}

// Automatically ensure autoload on file load
astroEnsureMpdfAutoload();

function astroMpdfTempDir(): string {
    $dir = __DIR__ . '/tmp';
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    if (is_dir($dir) && is_writable($dir)) {
        return $dir;
    }
    $sysTemp = sys_get_temp_dir() . '/mpdf_astrosivam';
    if (!is_dir($sysTemp)) {
        @mkdir($sysTemp, 0777, true);
    }
    return is_dir($sysTemp) && is_writable($sysTemp) ? $sysTemp : sys_get_temp_dir();
}

function astroMpdfFontDir(): string {
    $candidates = [
        __DIR__ . '/fonts',
        realpath(__DIR__ . '/../../public_html/api/astrology/fonts'),
        realpath(__DIR__ . '/../../public/fonts'),
        realpath(__DIR__ . '/../../dist/api/astrology/fonts'),
        (!empty($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] . '/api/astrology/fonts' : ''),
        (!empty($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] . '/fonts' : '')
    ];

    foreach ($candidates as $c) {
        if (!empty($c) && is_dir($c) && is_file($c . '/NotoSansTamil-Regular.ttf')) {
            return $c;
        }
    }

    return __DIR__ . '/fonts';
}

/**
 * Returns the fontdata array to merge into mPDF's default font config.
 * Missing files are skipped automatically (with a fallback to core fonts)
 * so the app doesn't fatal-error if a font hasn't been uploaded yet.
 */
function astroMpdfFontData(): array {
    $dir = astroMpdfFontDir();

    $wanted = [
        'cinzel' => [
            'R' => 'Cinzel-SemiBold.ttf',
            'B' => 'Cinzel-Bold.ttf',
        ],
        'cinzelextrabold' => [
            'R' => 'Cinzel-ExtraBold.ttf',
        ],
        'balootamil' => [
            'R' => 'BalooThambi2-SemiBold.ttf',
            'B' => 'BalooThambi2-Bold.ttf',
            'useOTL' => 0xFF,
            'useKashida' => 75,
        ],
        'yatraone' => [
            'R' => 'YatraOne-Regular.ttf',
            'useOTL' => 0xFF,
            'useKashida' => 75,
        ],
        'notosans' => [
            'R' => 'NotoSans-Regular.ttf',
            'M' => 'NotoSans-Medium.ttf',
            'SB' => 'NotoSans-SemiBold.ttf',
            'B' => 'NotoSans-Bold.ttf',
        ],
        'notosanstamil' => [
            'R' => 'NotoSansTamil-Regular.ttf',
            'M' => 'NotoSansTamil-Medium.ttf',
            'SB' => 'NotoSansTamil-SemiBold.ttf',
            'B' => 'NotoSansTamil-Bold.ttf',
            'useOTL' => 0xFF,
            'useKashida' => 75,
        ],
        'nototamil' => [
            'R' => 'NotoSansTamil-Regular.ttf',
            'M' => 'NotoSansTamil-Medium.ttf',
            'SB' => 'NotoSansTamil-SemiBold.ttf',
            'B' => 'NotoSansTamil-Bold.ttf',
            'useOTL' => 0xFF,
            'useKashida' => 75,
        ],
        'notosansdevanagari' => [
            'R' => 'NotoSansDevanagari-Regular.ttf',
            'M' => 'NotoSansDevanagari-Medium.ttf',
            'SB' => 'NotoSansDevanagari-SemiBold.ttf',
            'B' => 'NotoSansDevanagari-Bold.ttf',
            'useOTL' => 0xFF,
            'useKashida' => 75,
        ],
        'notodevanagari' => [
            'R' => 'NotoSansDevanagari-Regular.ttf',
            'M' => 'NotoSansDevanagari-Medium.ttf',
            'SB' => 'NotoSansDevanagari-SemiBold.ttf',
            'B' => 'NotoSansDevanagari-Bold.ttf',
            'useOTL' => 0xFF,
            'useKashida' => 75,
        ],
    ];

    $fontData = [];
    foreach ($wanted as $family => $variants) {
        $entry = [];
        foreach ($variants as $style => $val) {
            if ($style === 'useOTL' || $style === 'useKashida') {
                $entry[$style] = $val;
            } elseif (is_string($val) && is_file($dir . '/' . $val)) {
                $entry[$style] = $val;
            }
        }
        if (!empty($entry) && isset($entry['R'])) {
            $fontData[$family] = $entry;
        }
    }
    return $fontData;
}

/** True once every font file listed in the README has been uploaded. */
function astroMpdfFontsComplete(): bool {
    $data = astroMpdfFontData();
    return isset(
        $data['cinzel'], $data['balootamil'], $data['yatraone'],
        $data['notosans'], $data['notosanstamil'], $data['notosansdevanagari']
    );
}
