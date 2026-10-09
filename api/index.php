<?php
/**
 * ASTRO SIVAM - API root banner.
 *
 * Returns a small JSON response so GET /api/ (and any accidental direct hit) is
 * harmless. The mPDF / Tamil font self-test that used to live here is
 * api/check_mpdf.php, and unmatched API routes now answer with api/404.php.
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

echo json_encode([
    'success' => true,
    'service' => 'ASTRO SIVAM API',
    'message' => 'ASTRO SIVAM API root. Endpoints live under /api/auth, /api/services, /api/admin and /api/payment.',
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
