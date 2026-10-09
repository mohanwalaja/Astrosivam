<?php
/**
 * ASTRO SIVAM - JSON 404 for unmatched /api routes.
 *
 * WHY THIS EXISTS: api/.htaccess ends with a catch-all rewrite. It used to point
 * at api/index.php, which was an mPDF font-test page - so a typo'd or stale API
 * path answered with a Tamil sample PDF (and could echo PHP warnings, because
 * that script enabled display_errors) instead of a machine-readable 404.
 *
 * It deliberately does NOT load config.php: an unknown route must stay cheap and
 * must never touch the database, sessions or credentials.
 */
http_response_code(404);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

echo json_encode([
    'success' => false,
    'message' => 'API endpoint not found.',
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
exit;
