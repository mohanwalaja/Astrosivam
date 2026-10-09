<?php
/**
 * ASTRO SIVAM — PHP rate limiting & client-IP resolution regressions.
 *
 * Runs with plain `php tests/rate-limit.test.php` (no database, no network) and
 * is executed by CI (`npm run test:php`). The database layer of the limiter is
 * exercised in production code paths; everything security-relevant that can be
 * decided without a database is asserted here.
 */

putenv('APP_SECRET_KEY=test-only-app-secret-key-0123456789abcdef');

require_once __DIR__ . '/../api/rate_limit.php';

function checkLimit($condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "[PASS] " . $message . "\n";
}

// ---------------------------------------------------------------------------
// 1. Fixed-window decisions
// ---------------------------------------------------------------------------
$window = 900;

checkLimit(
    astro_rate_limit_decision(1, 5, 1000, 1000, $window)['allowed'] === true,
    'The first request in a window is allowed'
);
checkLimit(
    astro_rate_limit_decision(5, 5, 1000, 1000, $window)['allowed'] === true,
    'The last request inside the allowance is allowed'
);
$blocked = astro_rate_limit_decision(6, 5, 1000, 1000, $window);
checkLimit($blocked['allowed'] === false, 'The request after the allowance is refused');
checkLimit($blocked['retryAfterSeconds'] === 900, 'The refusal reports the time left in the window');
checkLimit(
    astro_rate_limit_decision(6, 5, 1000, 1500, $window)['retryAfterSeconds'] === 400,
    'The retry hint shrinks as the window elapses'
);
checkLimit(
    astro_rate_limit_decision(0, 5, 0, 2000, $window)['allowed'] === true,
    'A missing/cleared counter never blocks a request'
);
checkLimit(
    astro_rate_limit_decision(9, 5, 1000, 100000, $window)['allowed'] === false,
    'A counter above the allowance stays blocked until the window is reset'
);

// Defensive: a zero/negative limit must not silently disable protection.
// The limit is clamped to 1, so the second request in the window is refused.
checkLimit(
    astro_rate_limit_decision(1, 0, 1000, 1000, $window)['allowed'] === true,
    'A nonsensical zero limit still permits exactly one request'
);
checkLimit(
    astro_rate_limit_decision(2, 0, 1000, 1000, $window)['allowed'] === false,
    'A nonsensical zero limit does not become an unlimited allowance'
);

// ---------------------------------------------------------------------------
// 2. Counter keys: namespaced, hashed, and never the raw identifier
// ---------------------------------------------------------------------------
$ipKey = astro_rate_limit_key('login-ip', '203.0.113.9');
checkLimit(strpos($ipKey, '203.0.113.9') === false, 'The stored key never contains the raw IP address');
checkLimit(strpos($ipKey, 'login-ip:') === 0, 'The stored key carries its bucket namespace');
checkLimit(strlen($ipKey) <= 128, 'The stored key fits the VARCHAR(128) column');
checkLimit(
    astro_rate_limit_key('login-ip', '203.0.113.9') === $ipKey,
    'The same bucket and identifier always map to the same key'
);
checkLimit(
    astro_rate_limit_key('login-pair', '203.0.113.9') !== $ipKey,
    'Different buckets are isolated from each other'
);
checkLimit(
    astro_rate_limit_key('login-ip', '203.0.113.10') !== $ipKey,
    'Different identifiers do not share a counter'
);
checkLimit(
    astro_rate_limit_key('login-ip', "203.0.113.9\r\n") !== $ipKey,
    'Whitespace/CRLF variants do not collide with the plain identifier'
);
checkLimit(
    strlen(astro_rate_limit_key('weird bucket name with spaces!', 'x')) > 0 &&
    strpos(astro_rate_limit_key('weird bucket name with spaces!', 'x'), ' ') === false,
    'Bucket names are sanitised before use'
);
$pairA = astro_rate_limit_key('login-pair', '203.0.113.9|victim@example.com');
$pairB = astro_rate_limit_key('login-pair', '198.51.100.7|victim@example.com');
checkLimit($pairA !== $pairB, 'The same account attacked from two networks uses two counters');
checkLimit(
    astro_rate_limit_key('login-pair', "203.0.113.9|victim@example.com\r\n") !== $pairA,
    'A trailing CRLF cannot alias an existing account counter'
);

// ---------------------------------------------------------------------------
// 3. Spoof-resistant client IP resolution (guards every IP-based limit)
// ---------------------------------------------------------------------------
$_SERVER['REMOTE_ADDR'] = '203.0.113.50';
$_SERVER['HTTP_X_FORWARDED_FOR'] = '1.2.3.4';
$_SERVER['HTTP_CF_CONNECTING_IP'] = '5.6.7.8';
checkLimit(
    getClientIpAddress() === '203.0.113.50',
    'A public peer cannot spoof its identity with forwarding headers'
);

$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
checkLimit(
    getClientIpAddress() === '5.6.7.8',
    'Behind a trusted proxy the Cloudflare header is authoritative'
);

unset($_SERVER['HTTP_CF_CONNECTING_IP']);
$_SERVER['HTTP_X_FORWARDED_FOR'] = '1.2.3.4, 198.51.100.20';
checkLimit(
    getClientIpAddress() === '198.51.100.20',
    'The last hop appended by our own proxy wins over client-supplied hops'
);

$_SERVER['REMOTE_ADDR'] = '10.0.0.5';
$_SERVER['HTTP_X_FORWARDED_FOR'] = 'not-an-ip, 198.51.100.21';
checkLimit(
    getClientIpAddress() === '198.51.100.21',
    'Invalid hops are skipped instead of being trusted'
);

unset($_SERVER['HTTP_X_FORWARDED_FOR']);
$_SERVER['HTTP_X_REAL_IP'] = '198.51.100.22';
checkLimit(getClientIpAddress() === '198.51.100.22', 'X-Real-IP is used as the last fallback behind a proxy');

unset($_SERVER['HTTP_X_REAL_IP']);
checkLimit(getClientIpAddress() === '10.0.0.5', 'With no forwarding headers the direct peer is used');

checkLimit(astro_is_trusted_proxy_ip('192.168.1.10') === true, 'RFC1918 peers are trusted proxies');
checkLimit(astro_is_trusted_proxy_ip('104.16.0.1') === true, 'Cloudflare edge ranges are trusted');
checkLimit(astro_is_trusted_proxy_ip('8.8.8.8') === false, 'A public resolver address is not a trusted proxy');
checkLimit(astro_is_trusted_proxy_ip('') === false, 'An empty peer is never trusted');
checkLimit(astro_ip_in_cidr('172.16.5.5', '172.16.0.0/12') === true, 'IPv4 CIDR membership works');
checkLimit(astro_ip_in_cidr('172.32.5.5', '172.16.0.0/12') === false, 'IPv4 CIDR membership rejects outside addresses');
checkLimit(astro_ip_in_cidr('2606:4700::1111', '2606:4700::/32') === true, 'IPv6 CIDR membership works');
checkLimit(astro_ip_in_cidr('2607:4700::1111', '2606:4700::/32') === false, 'IPv6 CIDR membership rejects outside addresses');

unset($_SERVER['REMOTE_ADDR']);
unset($_SERVER['HTTP_X_FORWARDED_FOR']);

// ---------------------------------------------------------------------------
// 4. Failed-credential budgets (H1): per-IP, per-IP-per-endpoint, global
// ---------------------------------------------------------------------------
checkLimit(
    astro_rate_limit_failure_gate(0, 20, 1000, 1000, $window)['allowed'] === true,
    'A network with no recorded failures may attempt a credential'
);
checkLimit(
    astro_rate_limit_failure_gate(19, 20, 1000, 1000, $window)['allowed'] === true,
    'The last failure slot is still allowed'
);
$locked = astro_rate_limit_failure_gate(20, 20, 1000, 1000, $window);
checkLimit($locked['allowed'] === false, 'The request after the failure budget is refused');
checkLimit(
    $locked['retryAfterSeconds'] === 900,
    'The refusal reports the time left in the failure window'
);
checkLimit(
    astro_rate_limit_failure_gate(20, 20, 1000, 1500, $window)['retryAfterSeconds'] === 400,
    'The failure-window retry hint shrinks as the window elapses'
);
checkLimit(
    astro_rate_limit_failure_gate(25, 20, 1000, 1000, $window)['allowed'] === false,
    'A failure counter above the budget stays blocked until the window resets'
);
checkLimit(
    astro_rate_limit_failure_gate(0, 0, 1000, 1000, $window)['allowed'] === true,
    'A nonsensical zero failure budget still permits exactly one attempt'
);
checkLimit(
    astro_rate_limit_failure_gate(1, 0, 1000, 1000, $window)['allowed'] === false,
    'A nonsensical zero failure budget does not become unlimited'
);

$limits = astro_auth_failure_limits();
checkLimit($limits['perEndpointMax'] >= 1, 'The per-endpoint failure budget is a positive integer');
checkLimit($limits['perIpMax'] >= 1, 'The per-IP failure budget is a positive integer');
checkLimit($limits['globalMax'] >= 1, 'The global failure budget is a positive integer');
checkLimit($limits['windowSeconds'] >= 60, 'The failure window is at least one minute');
checkLimit(
    $limits['perEndpointMax'] <= $limits['perIpMax'] && $limits['perIpMax'] <= $limits['globalMax'],
    'Budgets tighten from global to per-endpoint (endpoint <= IP <= global)'
);

putenv('AUTH_FAIL_LIMIT_IP=5');
checkLimit(astro_auth_failure_limits()['perIpMax'] === 5, 'The per-IP budget honours a valid env override');
putenv('AUTH_FAIL_LIMIT_IP=not-a-number');
checkLimit(astro_auth_failure_limits()['perIpMax'] === 20, 'A non-numeric env override falls back to the default');
putenv('AUTH_FAIL_LIMIT_IP=-3');
checkLimit(astro_auth_failure_limits()['perIpMax'] === 20, 'An out-of-range env override falls back to the default');
putenv('AUTH_FAIL_LIMIT_IP');

checkLimit(astro_env_int('AUTH_FAIL_LIMIT_GLOBAL', 300) === 300, 'astro_env_int returns the default when unset');
putenv('AUTH_FAIL_LIMIT_GLOBAL=1234');
checkLimit(astro_env_int('AUTH_FAIL_LIMIT_GLOBAL', 300) === 1234, 'astro_env_int reads a valid override');
putenv('AUTH_FAIL_LIMIT_GLOBAL');

// The three failure counters one failed guess advances: most specific first.
$failBuckets = astro_auth_failure_buckets('203.0.113.9', 'login');
checkLimit(count($failBuckets) === 3, 'One failed guess feeds exactly three counters');
checkLimit($failBuckets[0]['bucket'] === 'auth-fail-ip-endpoint', 'First checked: the per-IP-per-endpoint counter');
checkLimit($failBuckets[0]['identifier'] === '203.0.113.9|login', 'The endpoint counter combines IP and endpoint');
checkLimit($failBuckets[1]['bucket'] === 'auth-fail-ip', 'Second checked: the per-IP counter');
checkLimit($failBuckets[2]['bucket'] === 'auth-fail-global', 'Last checked: the site-wide global counter');
checkLimit(
    strpos(astro_rate_limit_key($failBuckets[0]['bucket'], $failBuckets[0]['identifier']), 'auth-fail-ip-endpoint:') === 0,
    'Failure counters are namespaced like every other bucket'
);
checkLimit(
    astro_rate_limit_key('auth-fail-ip', '203.0.113.9') !== astro_rate_limit_key('auth-fail-ip-endpoint', '203.0.113.9|login'),
    'The per-IP and per-endpoint failure counters never collide'
);

// ---------------------------------------------------------------------------
// 5. httpOnly auth cookie (H3): attributes and header/cookie precedence
// ---------------------------------------------------------------------------
$cookieOptions = astro_auth_cookie_options(2592000, 1000, true);
checkLimit($cookieOptions['httponly'] === true, 'The auth cookie is always httpOnly (unreadable to JavaScript)');
checkLimit($cookieOptions['samesite'] === 'Lax', 'The auth cookie is always SameSite=Lax (no cross-site POSTs)');
checkLimit($cookieOptions['path'] === '/', 'The auth cookie is scoped to the whole site');
checkLimit($cookieOptions['secure'] === true, 'The auth cookie is Secure on HTTPS');
checkLimit($cookieOptions['expires'] === 1000 + 2592000, 'The auth cookie expires with the token TTL');
checkLimit(
    astro_auth_cookie_options(2592000, 1000, false)['secure'] === false,
    'The auth cookie relaxes Secure on plain-HTTP development hosts'
);
checkLimit(
    astro_auth_cookie_options(10, 1000, true)['expires'] === 1060,
    'A nonsensical tiny TTL is clamped to at least one minute'
);

// Header token wins over the cookie; the cookie is the fallback.
unset($_SERVER['HTTP_AUTHORIZATION'], $_SERVER['REDIRECT_HTTP_AUTHORIZATION'], $_SERVER['HTTP_X_AUTHORIZATION'], $_SERVER['HTTP_X_AUTH_TOKEN']);
$_COOKIE[AUTH_COOKIE_NAME] = 'cookie-token-value';
checkLimit(extractBearerToken() === 'cookie-token-value', 'With no Authorization header the httpOnly cookie authenticates');
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer header-token-value';
checkLimit(extractBearerToken() === 'header-token-value', 'An explicit Authorization header wins over the cookie');
unset($_SERVER['HTTP_AUTHORIZATION']);
$_COOKIE[AUTH_COOKIE_NAME] = '';
checkLimit(extractBearerToken() === null, 'An empty auth cookie authenticates nothing');
unset($_COOKIE[AUTH_COOKIE_NAME]);

echo "\nPHP rate limiting & client IP tests passed.\n";
