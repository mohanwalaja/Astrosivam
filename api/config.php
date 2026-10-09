<?php
/**
 * ASTRO SIVAM - PHP & MySQL Backend Configuration
 * Compatible with standard Apache / cPanel Hosting (BigRock, GoDaddy, Hostinger, cPanel)
 *
 * SECURITY UPDATES (2026-09-24):
 *  - Unsigned bearer tokens are NO LONGER accepted (HMAC signature required).
 *  - Google JWT payload is NO LONGER trusted without server-side verification.
 *  - CORS restricted to astrosivam.com origins (was "*").
 *  - APP_SECRET_KEY: set via env var, or a strong key is auto-generated and
 *    persisted to api/astrology/tmp/app_secret_key.txt. NEVER use a guessable fallback.
 */

// 0. Spoof-resistant client IP resolution (used by rate limits, bans, beta limits).
require_once __DIR__ . '/client_ip.php';

// 1. Session Configuration (PHP Sessions for Login/Auth)
if (session_status() === PHP_SESSION_NONE) {
    @ini_set('session.cookie_httponly', '1');
    @ini_set('session.use_only_cookies', '1');
    @ini_set('session.cookie_samesite', 'Lax');
    @ini_set('session.gc_maxlifetime', (string)(86400 * 7)); // 7 days
    if (PHP_VERSION_ID >= 70300) {
        @session_set_cookie_params([
            'lifetime' => 86400 * 7,
            'path' => '/',
            'domain' => '',
            'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
    } else {
        @session_set_cookie_params(86400 * 7, '/', '', isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on', true);
    }
    @session_start();
}

// 2. CORS & JSON Response Headers
// SECURITY: CORS is restricted to the site's own origins. With credentials
// enabled, a wildcard "*" origin is invalid and overly permissive.
header('Content-Type: application/json; charset=utf-8');
$allowedOrigins = [
    'https://astrosivam.com',
    'https://www.astrosivam.com',
];
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($requestOrigin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 3. MySQL Database Credentials (Configure for your BigRock cPanel MySQL Database)
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'astro287_Astro_db');
define('DB_USER', getenv('DB_USER') ?: 'astro287_Astro_admin');
// SECURITY: the real password exists ONLY in the config.php on the cPanel
// server. Keep the placeholder in any source-control / AI Studio copy.
define('DB_PASS', getenv('DB_PASS') ?: 'PASTE_NEW_DB_PASSWORD_HERE');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_CHARSET', 'utf8mb4');

// 3b. Secret key used to sign login tokens and OTP hashes (HMAC).
// Priority:
//   1) APP_SECRET_KEY environment variable (set in the AI Studio Secrets panel
//      or your hosting panel) - a long random string, at least 32 characters.
//   2) Otherwise: a random 64-hex-char key is auto-generated ONCE and persisted
//      to api/astrology/tmp/app_secret_key.txt (outside source control).
//   3) Last resort (should not happen): a predictably-derived key with a loud
//      error-log warning. Set APP_SECRET_KEY to avoid ever reaching this.
// Rotating the key invalidates all existing bearer tokens (users re-login).
function getOrCreateAppSecretKey(): string {
    $envKey = getenv('APP_SECRET_KEY');
    if (is_string($envKey) && trim($envKey) !== '') {
        if (strlen(trim($envKey)) < 32) {
            throw new RuntimeException('APP_SECRET_KEY must contain at least 32 characters.');
        }
        return trim($envKey);
    }

    $keyDir = __DIR__ . '/astrology/tmp';
    $keyFile = $keyDir . '/app_secret_key.txt';

    if (is_readable($keyFile)) {
        $stored = trim((string)file_get_contents($keyFile));
        if (strlen($stored) >= 32) {
            return $stored;
        }
    }

    $generated = bin2hex(random_bytes(32));
    if (!is_dir($keyDir) && !@mkdir($keyDir, 0700, true) && !is_dir($keyDir)) {
        throw new RuntimeException('Could not create the private signing-key directory. Set APP_SECRET_KEY in the server environment.');
    }

    $temporaryFile = $keyFile . '.' . bin2hex(random_bytes(8)) . '.tmp';
    $written = @file_put_contents($temporaryFile, $generated, LOCK_EX);
    if ($written !== false && @rename($temporaryFile, $keyFile)) {
        @chmod($keyFile, 0600);
        return $generated;
    }
    @unlink($temporaryFile);
    throw new RuntimeException('Could not persist a private signing key. Set APP_SECRET_KEY in the server environment; authentication is disabled until then.');
}
define('APP_SECRET_KEY', getOrCreateAppSecretKey());

// 3c. OAuth client IDs used to verify social logins server-side.
define('GOOGLE_CLIENT_ID', trim((string)(getenv('GOOGLE_CLIENT_ID') ?: '')));

// 4. Default Admin & Email Configuration
define('APP_NAME', 'ASTRO SIVAM');
define('ADMIN_EMAIL', 'admin@astrosivam.com');
define('SUPPORT_EMAIL', 'admin@astrosivam.com');
define('DEFAULT_CURRENCY', 'FJD');

// 4b. Astrology engine options.
//
// ASTRO_RAHU_NODE_TYPE selects how Rahu (and therefore Ketu, always exactly
// 180° opposite) is computed by AstroEngine:
//     'MEAN' - mean lunar node (Meeus 47.7: uniformly regressing mean orbit).
//              The classical convention — the nodes are always retrograde,
//              most printed panchang tables and older horoscopes assume it,
//              and B. V. Raman's "Hindu Predictive Astrology" recommends it
//              "for all practical purposes of horoscopy". DEFAULT.
//     'TRUE' - osculating ("true") lunar node from the lunar state vector.
//              Matches Swiss Ephemeris SE_TRUE_NODE / Jagannatha Hora.
// The two conventions can differ by up to ~1°45′, so every calculated result
// and the /api/services/calculate-preview payload carry a `nodeType` field
// declaring which one produced the chart, and the birth report prints it
// beside the ayanamsa. An ASTRO_RAHU_NODE_TYPE environment variable overrides
// the value below; anything other than TRUE/MEAN is rejected by the engine,
// which then falls back to MEAN and logs a warning.
// NOTE: deployments preserve the live config.php, so add this line to the
// server copy by hand (or set the environment variable) when changing it.
if (!defined('ASTRO_RAHU_NODE_TYPE')) {
    define('ASTRO_RAHU_NODE_TYPE', strtoupper(trim((string)(getenv('ASTRO_RAHU_NODE_TYPE') ?: 'MEAN'))));
}

// 5. Helper function for consistent JSON output
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// 5b. MONEY RULE — which currency an order is charged in.
//
// The customer decides how to pay at checkout, and THAT decides the currency:
//     Vodafone M-PAiSA / MyCash -> FJD (Fiji)
//     Google Pay / UPI          -> INR (India)
//     PayPal / Card             -> USD (International)
//
// The birth place of a family member NEVER changes the currency, so a family
// bundle with members born in India, Fiji and the USA is still priced and
// charged in the single currency the customer pays with.
// A country is only consulted as a fallback when there is no real payment
// method (FREE_BETA / NONE), and then it is the BILLING country of the account.
function astro_currency_for_payment($paymentMethod, $billingCountry = null, $requestedCurrency = null) {
    $map = [
        'GPAY' => 'INR',
        'UPI' => 'INR',
        'MPAISA' => 'FJD',
        'MYCASH' => 'FJD',
        'PAYPAL' => 'USD',
        'CARD' => 'USD'
    ];
    $pm = strtoupper(trim((string)$paymentMethod));
    if (isset($map[$pm])) {
        return $map[$pm];
    }

    // No real payment method (FREE_BETA): honour an explicit valid currency...
    $req = strtoupper(trim((string)$requestedCurrency));
    if (in_array($req, ['INR', 'FJD', 'USD'], true)) {
        return $req;
    }

    // ...otherwise fall back to the account billing country.
    $country = strtolower(trim((string)$billingCountry));
    if ($country === '') {
        return DEFAULT_CURRENCY;
    }
    if (strpos($country, 'india') !== false || $country === 'in') {
        return 'INR';
    }
    if (strpos($country, 'fiji') !== false || $country === 'fj') {
        return 'FJD';
    }
    return 'USD';
}

// Currency symbol helper shared by invoices / emails.
function astro_currency_symbol($currency) {
    $c = strtoupper((string)$currency);
    if ($c === 'INR') return '₹';
    if ($c === 'USD') return 'US$';
    return 'FJ$';
}

// 6. Helper function to read incoming JSON body
function getJsonBody() {
    $input = file_get_contents('php://input');
    if (empty($input)) {
        return [];
    }
    $decoded = json_decode($input, true);
    return is_array($decoded) ? $decoded : [];
}

/** Never allow request or legacy database values to select arbitrary report language strings. */
function astro_normalize_report_language($value) {
    if (!is_string($value)) return 'en';
    $language = strtolower(trim($value));
    return in_array($language, ['en', 'ta', 'hi'], true) ? $language : 'en';
}

// 7. Authentication Helper (PHP Session or signed bearer token in headers only)
function extractBearerToken() {
    // 1. Check $_SERVER HTTP Authorization variables
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_X_AUTHORIZATION'] ?? $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';

    // 2. Fallback to apache_request_headers() if available (crucial for FastCGI / cPanel environments)
    if (empty($authHeader) && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (!empty($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
        } elseif (!empty($headers['authorization'])) {
            $authHeader = $headers['authorization'];
        } elseif (!empty($headers['X-Auth-Token'])) {
            $authHeader = $headers['X-Auth-Token'];
        } elseif (!empty($headers['x-auth-token'])) {
            $authHeader = $headers['x-auth-token'];
        }
    }

    if (!empty($authHeader)) {
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            return trim($matches[1]);
        }
        // Direct raw token without Bearer prefix
        if (strpos($authHeader, ' ') === false) {
            return trim($authHeader);
        }
    }

    return null;
}

function getAuthUser($pdo) {
    $user = null;

    // 1. Check PHP Session first
    if (!empty($_SESSION['user_id'])) {
        $stmt = $pdo->prepare("SELECT id, name, email, mobile, role, country FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
    }

    // 2. Check signed Authorization token from request headers
    if (!$user) {
        $token = extractBearerToken();
        if (!empty($token)) {
            $decoded = verifyBearerToken($token);
            if ($decoded && !empty($decoded['id'])) {
                // The immutable account ID is the only token subject. Never
                // fall back to e-mail: after account deletion/reuse, an old
                // signed token must not authenticate the new owner.
                $stmt = $pdo->prepare("SELECT id, name, email, mobile, role, country FROM users WHERE id = ? LIMIT 1");
                $stmt->execute([$decoded['id']]);
                $user = $stmt->fetch();
            }
        }
    }

    if ($user) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_role'] = $user['role'];
        return $user;
    }

    return null;
}

function requireAuth($pdo) {
    $user = getAuthUser($pdo);
    if (!$user) {
        jsonResponse([
            'success' => false,
            'message' => 'Authentication required. Please sign in.'
        ], 401);
    }
    return $user;
}

function requireAdmin($pdo) {
    $user = getAuthUser($pdo);
    if (!$user) {
        jsonResponse([
            'success' => false,
            'message' => 'Authentication required. Please sign in.'
        ], 401);
    }
    if (strtolower(trim((string)($user['role'] ?? ''))) === 'admin') {
        return $user;
    }
    jsonResponse([
        'success' => false,
        'message' => 'Admin privileges required.'
    ], 403);
}

/**
 * Creates a signed, expiring bearer token: base64(payload) + '.' + HMAC-SHA256(payload).
 */
function createBearerToken($user, $ttlSeconds = 2592000) { // 30 days
    $payload = [
        'id' => $user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'iat' => time(),
        'exp' => time() + $ttlSeconds,
    ];
    $payloadB64 = base64_encode(json_encode($payload));
    $signature = hash_hmac('sha256', $payloadB64, APP_SECRET_KEY);
    return $payloadB64 . '.' . $signature;
}

/**
 * Verifies a bearer token's signature and expiry. Returns the decoded
 * payload array on success, or null if invalid.
 */
function verifyBearerToken($token) {
    if (empty($token)) {
        return null;
    }

    // Signed format: base64.signature
    if (strpos($token, '.') !== false) {
        $lastDot = strrpos($token, '.');
        $payloadB64 = substr($token, 0, $lastDot);
        $signature = substr($token, $lastDot + 1);

        $expectedSignature = hash_hmac('sha256', $payloadB64, APP_SECRET_KEY);
        if (hash_equals($expectedSignature, $signature)) {
            $payload = json_decode(base64_decode($payloadB64), true);
            if (
                is_array($payload) &&
                isset($payload['id'], $payload['email'], $payload['role'], $payload['iat'], $payload['exp']) &&
                is_string($payload['id']) && $payload['id'] !== '' &&
                is_string($payload['email']) && $payload['email'] !== '' &&
                is_string($payload['role']) && $payload['role'] !== '' &&
                is_numeric($payload['iat']) && is_numeric($payload['exp']) &&
                (int)$payload['exp'] > time() &&
                (int)$payload['iat'] <= time() + 60
            ) {
                return $payload;
            }
        }
    }

    // SECURITY: unsigned tokens are never accepted. Every token MUST carry a
    // valid HMAC-SHA256 signature. (The previous base64 fallback accepted any
    // unsigned payload, which allowed full account takeover by anyone who
    // knew a user id or email.)
    return null;
}

/**
 * Generates a 6-digit numeric OTP for email verification during
 * registration, plus a signed hash of it (never store the raw OTP).
 */
function generateOtp() {
    return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function hashOtp($otp, $email) {
    return hash_hmac('sha256', $otp . '|' . strtolower($email), APP_SECRET_KEY);
}

function verifyOtpHash($otp, $email, $storedHash) {
    if (empty($storedHash)) {
        return false;
    }
    return hash_equals($storedHash, hashOtp($otp, $email));
}

/**
 * server-side against Google/Facebook. Tries cURL first, falls back to
 * file_get_contents (allow_url_fopen) since some shared hosts disable one
 * or the other.
 */
function httpGetJson($url, $timeoutSeconds = 8) {
    if (function_exists('curl_init')) {
        // First try with strict SSL
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_FOLLOWLOCATION => true
        ]);
        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($body !== false && $httpCode >= 200 && $httpCode < 300) {
            $decoded = json_decode($body, true);
            if (is_array($decoded)) return $decoded;
        }

    }

    if (ini_get('allow_url_fopen')) {
        $context = stream_context_create([
            'http' => ['timeout' => $timeoutSeconds, 'ignore_errors' => true],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]
        ]);
        $body = @file_get_contents($url, false, $context);
        if ($body !== false) {
            $decoded = json_decode($body, true);
            if (is_array($decoded)) return $decoded;
        }
    }

    return null;
}

/**
 * Strips legacy provider tags from a person's name so the site always shows
 * the plain, actual name — e.g. "Ramesh Chand (Google)" -> "Ramesh Chand".
 * The devotee must never see "(Google)", "(FB)", "via Google", etc. next to
 * their name.
 */
function cleanDisplayName($name) {
    $value = trim((string)$name);
    if ($value === '') return '';
    // "(Google)", "[FB]", "(Facebook account)" style suffixes
    $value = preg_replace('/\s*[([{]\s*(google|facebook|fb)(\s+(account|user|login))?\s*[)\]}]\s*$/i', '', $value);
    // "- Google", "— Facebook", "| fb" style suffixes
    $value = preg_replace('/\s*[-\x{2013}\x{2014}|·]\s*(google|facebook|fb)\s*$/iu', '', $value);
    // "via Google" style suffixes
    $value = preg_replace('/\s+via\s+(google|facebook|fb)\s*$/i', '', $value);
    // Any leftover trailing separators from the strips above
    $value = preg_replace('/[\s\-\x{2013}\x{2014}|·.,]+$/u', '', $value);
    return trim($value);
}

/** True when a stored name is empty or just a provider placeholder ("Google User"). */
function isPlaceholderDisplayName($name) {
    $value = cleanDisplayName($name);
    return $value === '' || preg_match('/^(google|facebook|fb)(\s*(user|customer|member|account))?$/', $value, $m) === 1;
}

/**
 * Builds a human fallback name from the e-mail (mohanwalaja@gmail.com ->
 * "Mohanwalaja") so a missing provider name never renders as "Google User".
 */
function providerFallbackName($email) {
    $local = trim(strstr((string)$email, '@', true));
    $local = preg_replace('/[._\-+0-9]+/', ' ', $local);
    $words = preg_split('/\s+/', trim($local));
    $parts = [];
    foreach ($words as $w) {
        if ($w !== '') $parts[] = ucfirst(strtolower($w));
    }
    return count($parts) ? implode(' ', $parts) : 'User';
}

/**
 * Resolves the one true display name for a customer: the name the devotee
 * saved in their website profile is authoritative, then the account name,
 * then a friendly fallback. Never falls back to the Google/Facebook account
 * name for an existing account — that name must never overwrite the one the
 * devotee set on the website.
 *
 * Also heals legacy rows so users.name and birth_profiles.name converge on
 * the same display name everywhere (welcome message, navbar, dashboard).
 */
function resolveCustomerDisplayName($pdo, $user, $birthProfile) {
    $bpName = cleanDisplayName($birthProfile['name'] ?? '');
    $bpPlaceholder = isPlaceholderDisplayName($birthProfile['name'] ?? '');
    $accName = cleanDisplayName($user['name'] ?? '');
    $accPlaceholder = isPlaceholderDisplayName($user['name'] ?? '');

    if (!$bpPlaceholder && $bpName !== '') {
        $displayName = $bpName;
    } elseif (!$accPlaceholder && $accName !== '') {
        $displayName = $accName;
    } else {
        $displayName = providerFallbackName($user['email'] ?? '');
    }

    try {
        if ($accName !== $displayName || $accPlaceholder) {
            $pdo->prepare("UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?")->execute([$displayName, $user['id']]);
        }
        if ($birthProfile && ($bpName !== $displayName || $bpPlaceholder)) {
            $pdo->prepare("UPDATE birth_profiles SET name = ?, updated_at = NOW() WHERE user_id = ?")->execute([$displayName, $user['id']]);
        }
    } catch (Exception $e) {
        // Name healing is best-effort; never block a login on it.
    }

    return $displayName;
}

/**
 * Verifies a Google login server-side. Accepts either a GSI ID token
 * ("credential", a signed JWT) or an OAuth2 access token. The identity
 * ALWAYS comes from Google's own endpoints.
 */
function googleTokenAudienceMatches($info, $expectedClientId) {
    $expectedClientId = trim((string)$expectedClientId);
    if ($expectedClientId === '' || !is_array($info)) return false;
    $audience = $info['aud'] ?? $info['issued_to'] ?? $info['audience'] ?? null;
    $matches = is_array($audience)
        ? in_array($expectedClientId, $audience, true)
        : (string)$audience === $expectedClientId;
    $authorizedParty = $info['azp'] ?? '';
    return $matches && ($authorizedParty === '' || (string)$authorizedParty === $expectedClientId);
}

function googleEmailIsVerified($value) {
    return $value === true || $value === 1 || strtolower((string)$value) === 'true';
}

function verifyGoogleLogin($credential, $accessToken, $expectedClientId = '') {
    $expectedClientId = trim((string)$expectedClientId);
    if ($expectedClientId === '') return null;

    if (!empty($credential)) {
        $info = httpGetJson('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential));
        if ($info && !empty($info['email']) && googleTokenAudienceMatches($info, $expectedClientId) && googleEmailIsVerified($info['email_verified'] ?? null)) {
            return [
                'sub' => $info['sub'] ?? null,
                'email' => strtolower($info['email']),
                'name' => cleanDisplayName($info['name'] ?? ''),
            ];
        }

        // No local JWT decode fallback: failed remote verification is a hard
        // authentication failure, not a reason to trust request-body identity.
    }

    if (!empty($accessToken)) {
        $tokenInfo = httpGetJson('https://oauth2.googleapis.com/tokeninfo?access_token=' . urlencode($accessToken));
        if (!$tokenInfo || !googleTokenAudienceMatches($tokenInfo, $expectedClientId)) return null;
        $info = httpGetJson('https://www.googleapis.com/oauth2/v3/userinfo?access_token=' . urlencode($accessToken));
        if ($info && !empty($info['email']) && googleEmailIsVerified($info['email_verified'] ?? null)) {
            return [
                'sub' => $info['sub'] ?? null,
                'email' => strtolower($info['email']),
                'name' => cleanDisplayName($info['name'] ?? ''),
            ];
        }
    }

    return null;
}

/**
 * Verifies a Facebook login server-side by calling the Graph API with the
 * user's access token. Returns the AUTHORITATIVE id/email/name from
 * Facebook - never trusts client-submitted values. Returns null on failure.
 */
function verifyFacebookLogin($accessToken, $expectedAppId = '', $appSecret = '') {
    $accessToken = trim((string)$accessToken);
    $expectedAppId = trim((string)$expectedAppId);
    $appSecret = trim((string)$appSecret);
    if ($accessToken === '' || $expectedAppId === '' || $appSecret === '' || strpos($appSecret, '•') !== false) {
        return null;
    }

    // Facebook tokens are app-scoped. Validate the token's app ID and user ID
    // before trusting /me, preventing tokens issued for unrelated applications.
    $debug = httpGetJson('https://graph.facebook.com/debug_token?input_token=' . urlencode($accessToken) .
        '&access_token=' . urlencode($expectedAppId . '|' . $appSecret));
    $tokenData = $debug['data'] ?? null;
    if (!is_array($tokenData) || ($tokenData['is_valid'] ?? false) !== true ||
        (string)($tokenData['app_id'] ?? '') !== $expectedAppId || empty($tokenData['user_id'])) {
        return null;
    }
    $expiresAt = (int)($tokenData['expires_at'] ?? 0);
    if ($expiresAt > 0 && $expiresAt <= time()) return null;

    $appSecretProof = hash_hmac('sha256', $accessToken, $appSecret);
    $info = httpGetJson('https://graph.facebook.com/me?fields=id,name,email&access_token=' . urlencode($accessToken) .
        '&appsecret_proof=' . urlencode($appSecretProof));
    if (!$info || empty($info['id']) || (string)$info['id'] !== (string)$tokenData['user_id']) {
        return null;
    }
    return [
        'id' => (string)$info['id'],
        'email' => isset($info['email']) ? strtolower(trim($info['email'])) : null,
        'name' => cleanDisplayName($info['name'] ?? ''),
    ];
}

// 8. Compatibility aliases for the JSON emitters used by the older endpoint
//    files (api/admin/orders.php uses sendJson(), api/admin/approve_order.php
//    uses sendResponse()). Neither function was ever defined anywhere in the
//    project, so those two endpoints died with a PHP fatal error
//    ("Call to undefined function sendResponse()") - which silently broke
//    family-order approval and produced HTTP 500 responses. Declaring them
//    here, next to jsonResponse(), keeps every endpoint working.
if (!function_exists('sendResponse')) {
    function sendResponse($data, $statusCode = 200) {
        jsonResponse($data, $statusCode);
    }
}

if (!function_exists('sendJson')) {
    function sendJson($data, $statusCode = 200) {
        jsonResponse($data, $statusCode);
    }
}
