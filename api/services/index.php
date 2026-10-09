<?php
/**
 * ASTRO SIVAM - Customer Services API Router
 */
require_once __DIR__ . '/../config.php';
// Client IP helpers live in api/client_ip.php (required by config.php); shared
// fixed-window rate limiting lives in api/rate_limit.php.
require_once __DIR__ . '/../rate_limit.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../astrology/engine.php';
require_once __DIR__ . '/../mailer.php';
require_once __DIR__ . '/../chat_alerts.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '';
$fullUri = $_SERVER['REQUEST_URI'] ?? '';
$jsonBody = getJsonBody();
$action = $_GET['action'] ?? $jsonBody['action'] ?? $_POST['action'] ?? '';

function astro_is_valid_marriage_payload($payload): bool {
    return is_array($payload)
        && AstroEngine::hasValidBirthDetails($payload['bride'] ?? null)
        && AstroEngine::hasValidBirthDetails($payload['groom'] ?? null);
}

function astro_is_valid_muhurtham_payload($payload): bool {
    if (!is_array($payload) || empty($payload['muhurthamPlace']) || !AstroEngine::hasValidBirthDetails($payload)) {
        return false;
    }
    $validCoordinates = function ($latitude, $longitude, $offset) {
        return is_numeric($latitude) && (float)$latitude >= -90 && (float)$latitude <= 90
            && is_numeric($longitude) && (float)$longitude >= -180 && (float)$longitude <= 180
            && is_numeric($offset) && (float)$offset >= -14 && (float)$offset <= 14;
    };
    return $validCoordinates($payload['muhurthamLatitude'] ?? null, $payload['muhurthamLongitude'] ?? null, $payload['muhurthamTimezoneOffsetHours'] ?? null);
}

/**
 * Online payment intents are deliberately kept in SQL rather than in a
 * browser/session token. The order endpoint later binds one captured intent
 * to the server-calculated amount and the authenticated owner.
 */
function astro_ensure_payment_intents_table($pdo) {
    static $ready = false;
    if ($ready) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS payment_intents (
        id VARCHAR(80) NOT NULL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        provider VARCHAR(32) NOT NULL,
        payment_method VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(8) NOT NULL,
        gateway_order_id VARCHAR(191) NOT NULL,
        gateway_payment_id VARCHAR(191) NULL,
        gateway_signature VARCHAR(512) NULL,
        payment_reference VARCHAR(191) NULL,
        payer_account VARCHAR(191) NULL,
        order_id VARCHAR(64) NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_payment_intents_user_status (user_id, status),
        INDEX idx_payment_intents_reference (payment_reference),
        INDEX idx_payment_intents_gateway_order (gateway_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $ready = true;
}

/**
 * Atomic one-free-report-per-IP ledger. The primary key serializes concurrent
 * claims; beta_ip_orders remains the human-readable audit/history table.
 */
function astro_ensure_beta_ip_claims_table($pdo) {
    static $ready = false;
    if ($ready) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS beta_ip_claims (
        ip_address VARCHAR(64) NOT NULL PRIMARY KEY,
        claimed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // One-time backfill for existing installations. INSERT IGNORE plus the
    // primary key safely collapses any legacy duplicate IP rows.
    $count = (int)$pdo->query("SELECT COUNT(*) FROM beta_ip_claims")->fetchColumn();
    if ($count === 0) {
        try {
            $pdo->exec("INSERT IGNORE INTO beta_ip_claims (ip_address, claimed_at)
                SELECT ip_address, MIN(created_at) FROM beta_ip_orders
                WHERE ip_address <> '' GROUP BY ip_address");
        } catch (Exception $e) {
            // A missing legacy history table is safe: new claims still use this ledger.
        }
    }
    $ready = true;
}

/**
 * Keep the repeat-order abuse guard compatible with older cPanel schemas.
 * The rate limit is on outstanding unpaid checkout groups, not individual
 * family chart rows; a captured online payment is already verified.
 */
function astro_ensure_order_limit_columns($pdo) {
    static $ready = false;
    if ($ready) return;

    foreach ([
        "ALTER TABLE orders ADD COLUMN group_id VARCHAR(64) NULL AFTER order_number",
        "ALTER TABLE orders ADD COLUMN payment_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_ADMIN'"
    ] as $migration) {
        try { $pdo->exec($migration); } catch (Throwable $e) {}
    }
    $ready = true;
}

/** Number of distinct open checkouts with payment still awaiting verification. */
function astro_count_pending_order_groups_by_ip($pdo, $ipAddress) {
    astro_ensure_order_limit_columns($pdo);
    $stmt = $pdo->prepare("SELECT COUNT(DISTINCT COALESCE(NULLIF(group_id, ''), id))
        FROM orders
        WHERE ip_address = ?
          AND status IN ('PENDING', 'PENDING_APPROVAL', 'PENDING_PAYMENT_VERIFICATION')
          AND COALESCE(payment_confirmed, 0) = 0
          AND UPPER(COALESCE(NULLIF(payment_status, ''), 'PENDING_ADMIN')) NOT IN ('CAPTURED', 'VERIFIED_MANUAL', 'NOT_REQUIRED')");
    $stmt->execute([$ipAddress]);
    return (int)($stmt->fetchColumn() ?: 0);
}

function astro_is_masked_secret($value) {
    $value = trim((string)$value);
    if ($value === '' || strpos($value, '•') !== false || preg_match('/^\\*+$/', $value)) return true;
    return (bool)preg_match('/^(?:change[-_ ]?me|replace[-_ ]?me|astro_sivam_|your[-_ ]?(?:secret|token|key)|placeholder)/i', $value);
}

function astro_http_json($url, $method = 'GET', $headers = [], $body = null, $basicUser = null, $basicPassword = null) {
    if (!function_exists('curl_init')) {
        throw new Exception('Server payment transport is unavailable.');
    }
    $ch = curl_init($url);
    $method = strtoupper($method);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2
    ];
    if ($basicUser !== null) $options[CURLOPT_USERPWD] = $basicUser . ':' . ($basicPassword ?? '');
    if ($body !== null) $options[CURLOPT_POSTFIELDS] = is_string($body) ? $body : json_encode($body, JSON_UNESCAPED_SLASHES);
    curl_setopt_array($ch, $options);
    $raw = curl_exec($ch);
    $error = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false || $error !== '') throw new Exception('Payment provider request failed.');
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) throw new Exception('Payment provider returned an invalid response.');
    return ['status' => $status, 'body' => $decoded];
}

function astro_setting_value($general, $keys, $envKeys = []) {
    foreach ($envKeys as $envKey) {
        $value = getenv($envKey);
        if ($value !== false && !astro_is_masked_secret($value)) return trim($value);
    }
    foreach ($keys as $key) {
        $value = $general[$key] ?? '';
        if (!astro_is_masked_secret($value)) return trim((string)$value);
    }
    return '';
}

function astro_new_payment_intent_id() {
    try { return 'pi_' . bin2hex(random_bytes(16)); }
    catch (Exception $e) { return 'pi_' . str_replace('.', '', uniqid('', true)); }
}

/**
 * Contact submissions: 4 per network per 10 minutes.
 *
 * Counters now live in the shared api_rate_limits table (see api/rate_limit.php)
 * keyed by an HMAC of the client IP, so the old contact_rate_limits table is no
 * longer written to.
 */
function astro_enforce_contact_rate_limit($pdo) {
    astro_rate_limit_enforce(
        $pdo,
        'contact-ip',
        getClientIpAddress(),
        4,
        600,
        'Too many contact submissions. Please retry after the rate limit expires.'
    );
}

// 1. GET /api/services/settings
if (($method === 'GET' || $method === 'HEAD') && (
    strpos($path, 'services/settings') !== false ||
    strpos($fullUri, 'settings') !== false ||
    $action === 'settings'
)) {
    $stmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
    $row = $stmt->fetch();
    if ($row) {
        $general = json_decode($row['general_settings'] ?? '{}', true) ?: [];
        $email = json_decode($row['email_settings'] ?? '{}', true) ?: [];
        $pricing = json_decode($row['pricing'] ?? '{}', true) ?: [];
        $paymentMethods = json_decode($row['payment_methods'] ?? '{}', true) ?: [];

        // Safe public email subset
        $safeEmail = [
            'senderName' => $email['senderName'] ?? $email['fromName'] ?? ($general['senderName'] ?? 'ASTRO SIVAM'),
            'senderEmail' => $email['senderEmail'] ?? $email['fromEmail'] ?? ($general['senderEmail'] ?? 'admin@astrosivam.com'),
            'replyTo' => $email['replyTo'] ?? $email['replyToEmail'] ?? ($general['replyTo'] ?? 'admin@astrosivam.com')
        ];

        // Merge all general settings into a unified full settings object (stripping sensitive secrets for public endpoint)
        $settings = array_merge($general, [
            'serviceMode' => $row['service_mode'] ?? $general['serviceMode'] ?? 'PAID',
            'freeBetaActive' => isset($row['free_beta_active']) ? (bool)$row['free_beta_active'] : ($general['freeBetaActive'] ?? false),
            'currency' => $row['currency'] ?? $general['currency'] ?? 'FJD',
            'pricing' => $pricing,
            'paymentMethods' => $paymentMethods,
            'emailSettings' => $safeEmail
        ]);

        // FREE BETA RULE — exactly ONE free report per IP address:
        // tell THIS client whether its free chart is still unused, so the
        // family tray can price the FIRST chart free and every additional
        // chart at full price (and collect payment for the rest of the family).
        $betaModeActive = (($settings['serviceMode'] ?? 'PAID') === 'FREE_BETA') || (bool)($settings['freeBetaActive'] ?? false);
        $settings['betaFreeChartAvailable'] = false;
        if ($betaModeActive) {
            try {
                astro_ensure_beta_ip_claims_table($pdo);
                $betaIp = getClientIpAddress();
                $betaStmt = $pdo->prepare("SELECT COUNT(*) FROM beta_ip_claims WHERE ip_address = ?");
                $betaStmt->execute([$betaIp]);
                $settings['betaFreeChartAvailable'] = ((int)($betaStmt->fetchColumn() ?: 0)) < 1;
            } catch (Exception $e) {
                // Fail closed if the atomic free-report ledger is unavailable.
                $settings['betaFreeChartAvailable'] = false;
            }
        }

        if (!isset($settings['fijiPriceFJD'])) $settings['fijiPriceFJD'] = $general['fijiPriceFJD'] ?? 10;
        if (!isset($settings['intlPriceUSD'])) $settings['intlPriceUSD'] = $general['intlPriceUSD'] ?? 5;
        if (!isset($settings['googleLoginEnabled'])) $settings['googleLoginEnabled'] = $general['googleLoginEnabled'] ?? true;
        if (!isset($settings['googleClientId'])) $settings['googleClientId'] = $general['googleClientId'] ?? '';
        if (!isset($settings['facebookLoginEnabled'])) $settings['facebookLoginEnabled'] = $general['facebookLoginEnabled'] ?? true;
        if (!isset($settings['facebookAppId'])) $settings['facebookAppId'] = $general['facebookAppId'] ?? '';
        if (!isset($settings['activeThemeTemplate'])) $settings['activeThemeTemplate'] = $general['activeThemeTemplate'] ?? 'classic-primary';
        if (!isset($settings['vodafoneMPaisaNumber'])) $settings['vodafoneMPaisaNumber'] = $general['vodafoneMPaisaNumber'] ?? '+679 999 1234';
        if (!isset($settings['vodafoneMPaisaPaymentMode'])) $settings['vodafoneMPaisaPaymentMode'] = $general['vodafoneMPaisaPaymentMode'] ?? 'offline';
        if (!isset($settings['indiaGpayPaymentMode'])) $settings['indiaGpayPaymentMode'] = $general['indiaGpayPaymentMode'] ?? 'offline';
        if (!isset($settings['paypalPaymentMode'])) $settings['paypalPaymentMode'] = $general['paypalPaymentMode'] ?? 'offline';
        if (!isset($settings['digicelMyCashNumber'])) $settings['digicelMyCashNumber'] = $general['digicelMyCashNumber'] ?? '+679 777 5678';
        if (!isset($settings['paypalEmail'])) $settings['paypalEmail'] = $general['paypalEmail'] ?? 'payments@astrosivam.com';
        if (!isset($settings['paypalClientId'])) $settings['paypalClientId'] = $general['paypalClientId'] ?? '';
        if (!isset($settings['paypalMode'])) $settings['paypalMode'] = $general['paypalMode'] ?? 'sandbox';

        // Never advertise an online provider unless the server has the
        // credentials required to create and verify provider orders.
        $razorpayProvider = strtolower((string)($general['indiaGpayOnlineProvider'] ?? 'razorpay'));
        $razorpayKeyId = astro_setting_value($general, ['indiaGpayKeyId', 'razorpayKeyId'], ['RAZORPAY_KEY_ID']);
        $razorpaySecret = astro_setting_value($general, ['indiaGpayKeySecret', 'razorpayKeySecret'], ['RAZORPAY_KEY_SECRET']);
        $paypalClientId = astro_setting_value($general, ['paypalClientId'], ['PAYPAL_CLIENT_ID']);
        $paypalClientSecret = astro_setting_value($general, ['paypalClientSecret', 'paypalSecret'], ['PAYPAL_CLIENT_SECRET', 'PAYPAL_SECRET']);
        $settings['indiaGpayPaymentMode'] = ($razorpayProvider === 'razorpay' && $razorpayKeyId !== '' && $razorpaySecret !== '' && strtolower((string)($settings['indiaGpayPaymentMode'] ?? 'offline')) === 'online') ? 'online' : 'offline';
        $settings['paypalPaymentMode'] = ($paypalClientId !== '' && $paypalClientSecret !== '' && strtolower((string)($settings['paypalPaymentMode'] ?? 'offline')) === 'online') ? 'online' : 'offline';
        $settings['vodafoneMPaisaPaymentMode'] = 'offline';
        $settings['indiaGpayOnlineConfigured'] = $razorpayProvider === 'razorpay' && $razorpayKeyId !== '' && $razorpaySecret !== '';
        $settings['paypalOnlineConfigured'] = $paypalClientId !== '' && $paypalClientSecret !== '';
        $settings['vodafoneMPaisaOnlineConfigured'] = false;
        $settings['onlineGatewayAvailability'] = [
            'razorpay' => $settings['indiaGpayPaymentMode'] === 'online',
            'paypal' => $settings['paypalPaymentMode'] === 'online',
            'mpaisa' => false
        ];

        // Remove secrets from public endpoint
        unset($settings['facebookAppSecret']);
        unset($settings['paypalSecret']);
        unset($settings['paypalClientSecret']);
        unset($settings['indiaGpayKeySecret']);
        unset($settings['indiaGpayWebhookSecret']);
        unset($settings['razorpayKeySecret']);
        unset($settings['razorpayWebhookSecret']);
        unset($settings['razorpaySecret']);
        unset($settings['vodafoneMPaisaApiSecret']);
        // Chat alert tokens must never be public - expose only the on/off flags.
        $chatPublic = is_array($settings['chatAlertSettings'] ?? null) ? $settings['chatAlertSettings'] : [];
        $settings['chatAlertSettings'] = [
            'enabled' => (bool)($chatPublic['enabled'] ?? true),
            'notifyOrderConfirmed' => (bool)($chatPublic['notifyOrderConfirmed'] ?? true),
            'notifyOrderCompleted' => (bool)($chatPublic['notifyOrderCompleted'] ?? true),
            'whatsapp' => ['enabled' => (bool)($chatPublic['whatsapp']['enabled'] ?? false)],
            'viber' => ['enabled' => (bool)($chatPublic['viber']['enabled'] ?? false)]
        ];
    } else {
        $settings = [
            'serviceMode' => 'PAID',
            'freeBetaActive' => false,
            'fijiPriceFJD' => 10,
            'intlPriceUSD' => 5,
            'currency' => 'FJD',
            'googleLoginEnabled' => true,
            'googleClientId' => '',
            'facebookLoginEnabled' => true,
            'facebookAppId' => '',
            'activeThemeTemplate' => 'classic-primary',
            'vodafoneMPaisaNumber' => '+679 999 1234',
            'vodafoneMPaisaPaymentMode' => 'offline',
            'indiaGpayPaymentMode' => 'offline',
            'paypalPaymentMode' => 'offline',
            'digicelMyCashNumber' => '+679 777 5678',
            'paypalEmail' => 'payments@astrosivam.com',
            'paypalClientId' => '',
            'paypalMode' => 'sandbox',
            'supportEmail' => 'admin@astrosivam.com',
            'supportPhone' => '+679 999 8888',
            'pricing' => ['BIRTH_JATHAGAM' => ['fjd' => 35, 'usd' => 18], 'MARRIAGE_COMPATIBILITY' => ['fjd' => 45, 'usd' => 22], 'BABY_NAMING' => ['fjd' => 30, 'usd' => 15], 'MUHURTHAM' => ['fjd' => 40, 'usd' => 20]],
            'paymentMethods' => ['mpaisa' => ['enabled' => true, 'accountName' => 'ASTRO SIVAM CONSULTING', 'mobileNumber' => '9998888']],
            'emailSettings' => ['fromEmail' => 'admin@astrosivam.com', 'fromName' => 'ASTRO SIVAM'],
            'generalSettings' => ['siteName' => 'ASTRO SIVAM', 'turnaroundHours' => 12],
            // No settings row = PAID mode: no free beta chart available.
            'betaFreeChartAvailable' => false,
            'indiaGpayOnlineConfigured' => false,
            'paypalOnlineConfigured' => false,
            'vodafoneMPaisaOnlineConfigured' => false,
            'onlineGatewayAvailability' => ['razorpay' => false, 'paypal' => false, 'mpaisa' => false]
        ];
    }
    jsonResponse(['success' => true, 'settings' => $settings]);
}

// 2. GET /api/services/team
if ((strpos($path, 'services/team') !== false || $action === 'team') && $method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM team_members WHERE is_active = 1 ORDER BY display_order ASC, created_at ASC");
    $rows = $stmt->fetchAll();
    $team = array_map(function($r) {
        return [
            'id' => $r['id'],
            'name' => $r['name'],
            'title' => $r['title'],
            'titleTa' => $r['title_ta'],
            'titleHi' => $r['title_hi'],
            'bio' => $r['bio'],
            'location' => $r['location'],
            'experienceYears' => intval($r['experience_years']),
            'specializations' => json_decode($r['specializations'], true) ?: [],
            'photoUrl' => $r['photo_url'],
            'isActive' => (bool)$r['is_active'],
            'displayOrder' => intval($r['display_order']),
            'contactPhone' => $r['contact_phone'],
            'contactEmail' => $r['contact_email']
        ];
    }, $rows);
    jsonResponse(['success' => true, 'count' => count($team), 'team' => $team]);
}

// 3. GET & POST /api/services/profile
if (strpos($path, 'services/profile') !== false || $action === 'profile' || $action === 'get-profile' || $action === 'save-profile') {
    $user = requireAuth($pdo);
    if ($method === 'GET' || $action === 'get-profile') {
        $stmt = $pdo->prepare("SELECT * FROM birth_profiles WHERE user_id = ? LIMIT 1");
        $stmt->execute([$user['id']]);
        $bp = $stmt->fetch();
        jsonResponse(['success' => true, 'profile' => $bp ?: null]);
    } elseif ($method === 'POST' || $action === 'save-profile') {
        $body = getJsonBody();
        $birthProblem = AstroEngine::describeBirthDetailsProblem($body);
        if ($birthProblem !== null) {
            jsonResponse(['success' => false, 'message' => 'A valid past birth date, birth time, birth place, coordinates and time zone are required to save a birth profile. ' . $birthProblem], 400);
        }
        $body['tob'] = AstroEngine::normalizeBirthTime($body['tob']);
        $stmt = $pdo->prepare("SELECT id FROM birth_profiles WHERE user_id = ? LIMIT 1");
        $stmt->execute([$user['id']]);
        $existing = $stmt->fetch();

        if ($existing) {
            $upd = $pdo->prepare("UPDATE birth_profiles SET name = ?, dob = ?, tob = ?, birth_place = ?, country = ?, latitude = ?, longitude = ?, timezone_offset_hours = ?, gender = ?, updated_at = NOW() WHERE user_id = ?");
            $upd->execute([
                $body['name'] ?? $user['name'],
                $body['dob'],
                $body['tob'],
                trim((string) $body['birthPlace']),
                trim((string) ($body['country'] ?? '')),
                (float) $body['latitude'],
                (float) $body['longitude'],
                (float) $body['timezoneOffsetHours'],
                $body['gender'] ?? 'M',
                $user['id']
            ]);
        } else {
            $bpId = 'bp_' . uniqid('', true);
            $ins = $pdo->prepare("INSERT INTO birth_profiles (id, user_id, name, dob, tob, birth_place, country, latitude, longitude, timezone_offset_hours, gender, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
            $ins->execute([
                $bpId,
                $user['id'],
                $body['name'] ?? $user['name'],
                $body['dob'],
                $body['tob'],
                trim((string) $body['birthPlace']),
                trim((string) ($body['country'] ?? '')),
                (float) $body['latitude'],
                (float) $body['longitude'],
                (float) $body['timezoneOffsetHours'],
                $body['gender'] ?? 'M'
            ]);
        }

        $stmt = $pdo->prepare("SELECT * FROM birth_profiles WHERE user_id = ? LIMIT 1");
        $stmt->execute([$user['id']]);
        $profile = $stmt->fetch();

        // The name saved in the website profile is the devotee's real name:
        // mirror it onto the account so the welcome message, navbar and
        // dashboard all show the edited name — and never a stale one.
        $savedName = cleanDisplayName($body['name'] ?? $user['name']);
        if ($savedName === '') $savedName = providerFallbackName($user['email']);
        try {
            $pdo->prepare("UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?")->execute([$savedName, $user['id']]);
            if ($profile) $profile['name'] = $savedName;
        } catch (Exception $e) {}

        jsonResponse(['success' => true, 'message' => 'Profile saved successfully', 'profile' => $profile]);
    }
}

// 4. POST /api/services/calculate-preview
if ((strpos($path, 'services/calculate-preview') !== false || $action === 'calculate-preview') && $method === 'POST') {
    // The calculator runs the full ephemeris; keep it to 20/minute per network.
    astro_rate_limit_enforce($pdo, 'calculate-preview-ip', getClientIpAddress(), 20, 60,
        'Too many calculation requests. Please wait a moment and try again.');

    $body = getJsonBody();
    $serviceType = $body['serviceType'] ?? 'BIRTH_JATHAGAM';
    $payload = $body['payload'] ?? [];
    if (!in_array($serviceType, ['BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY', 'BABY_NAMING', 'MUHURTHAM'], true)) {
        jsonResponse(['success' => false, 'message' => 'Unsupported astrology service type.'], 400);
    }

    if ($serviceType === 'BIRTH_JATHAGAM' || $serviceType === 'BABY_NAMING') {
        $birthProblem = AstroEngine::describeBirthDetailsProblem($payload);
        if ($birthProblem !== null) {
            jsonResponse(['success' => false, 'message' => 'A valid past birth date, 24-hour birth time, birth place, coordinates and time zone are required for an accurate preview. ' . $birthProblem], 400);
        }
    }
    if ($serviceType === 'MARRIAGE_COMPATIBILITY' && !astro_is_valid_marriage_payload($payload)) {
        $brideProblem = AstroEngine::describeBirthDetailsProblem(is_array($payload) ? ($payload['bride'] ?? null) : null);
        $groomProblem = AstroEngine::describeBirthDetailsProblem(is_array($payload) ? ($payload['groom'] ?? null) : null);
        $detail = trim(($brideProblem !== null ? ' Bride: ' . $brideProblem : '') . ($groomProblem !== null ? ' Groom: ' . $groomProblem : ''));
        jsonResponse(['success' => false, 'message' => trim('Both bride and groom need valid past birth dates, birth times, birth places, coordinates and time zones. ' . $detail)], 400);
    }

    if ($serviceType === 'MARRIAGE_COMPATIBILITY') {
        $result = AstroEngine::calculateMatchmaking($payload);
    } elseif ($serviceType === 'BABY_NAMING') {
        $result = AstroEngine::calculateBabyNaming($payload);
    } elseif ($serviceType === 'MUHURTHAM') {
        if (!astro_is_valid_muhurtham_payload($payload)) {
            jsonResponse(['success' => false, 'message' => 'Muhurtham preview needs valid birth details and a separate event location with coordinates and time zone.'], 400);
        }
        $result = AstroEngine::calculateMuhurtham($payload);
    } else {
        $result = AstroEngine::calculateHoroscope($payload);
    }

    // nodeType declares the Rahu/Ketu convention (ASTRO_RAHU_NODE_TYPE in
    // config.php): 'TRUE' = osculating node, 'MEAN' = mean node.
    jsonResponse(['success' => true, 'nodeType' => AstroEngine::nodeType(), 'result' => $result]);
}

// 4b. POST /api/services/payment/create-session (durable provider order)
if ((strpos($path, 'payment/create-session') !== false || $action === 'create-payment-session') && $method === 'POST') {
    $user = requireAuth($pdo);
    // 8 sessions/10 min per user and 20/10 min per network (Node parity).
    astro_rate_limit_enforce($pdo, 'payment-create-user', $user['id'], 8, 600,
        'Too many payment sessions were started. Please wait before trying again.');
    astro_rate_limit_enforce($pdo, 'payment-create-ip', getClientIpAddress(), 20, 600,
        'Too many payment sessions were started from this network. Please wait before trying again.');

    $body = getJsonBody();
    $pm = strtoupper(trim((string)($body['paymentMethod'] ?? '')));
    $amount = round((float)($body['amount'] ?? 0), 2);
    $desc = trim((string)($body['description'] ?? 'ASTRO SIVAM Vedic Astrology Consultation'));

    if ($amount <= 0 || !is_finite($amount)) {
        jsonResponse(['success' => false, 'message' => 'A positive payment amount is required to start an online payment session.'], 400);
    }
    if (!in_array($pm, ['GPAY', 'UPI', 'PAYPAL', 'CARD'], true)) {
        jsonResponse(['success' => false, 'message' => 'This payment method does not support a verified online checkout.'], 400);
    }

    $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
    $sRow = $sStmt->fetch();
    $general = $sRow ? (json_decode($sRow['general_settings'] ?? '{}', true) ?: []) : [];
    $intentId = astro_new_payment_intent_id();
    $expiresAt = date('Y-m-d H:i:s', time() + 1800);
    $gatewayOrderId = '';
    $provider = '';
    $currency = '';
    $session = [
        'sessionId' => $intentId,
        'paymentIntentId' => $intentId,
        'amount' => $amount,
        'description' => $desc
    ];

    try {
        if ($pm === 'GPAY' || $pm === 'UPI') {
            $provider = strtolower((string)($general['indiaGpayOnlineProvider'] ?? 'razorpay'));
            $keyId = astro_setting_value($general, ['indiaGpayKeyId', 'razorpayKeyId'], ['RAZORPAY_KEY_ID']);
            $keySecret = astro_setting_value($general, ['indiaGpayKeySecret', 'razorpayKeySecret'], ['RAZORPAY_KEY_SECRET']);
            $mode = strtolower((string)($general['indiaGpayPaymentMode'] ?? 'offline'));
            if ($mode !== 'online' || $provider !== 'razorpay' || $keyId === '' || $keySecret === '') {
                jsonResponse(['success' => false, 'message' => 'Razorpay online checkout is not configured.'], 503);
            }
            $receipt = 'ASTRO-' . strtoupper(substr(str_replace('.', '', uniqid('', true)), -18));
            $providerResponse = astro_http_json(
                'https://api.razorpay.com/v1/orders',
                'POST',
                ['Content-Type: application/json', 'Accept: application/json'],
                ['amount' => (int)round($amount * 100), 'currency' => 'INR', 'receipt' => $receipt, 'notes' => ['user_id' => $user['id']]],
                $keyId,
                $keySecret
            );
            $providerOrder = $providerResponse['body'] ?? [];
            if ($providerResponse['status'] < 200 || $providerResponse['status'] >= 300 || empty($providerOrder['id'])) {
                throw new Exception('Razorpay did not create a payment order.');
            }
            $gatewayOrderId = trim((string)$providerOrder['id']);
            $provider = 'razorpay';
            $currency = 'INR';
            $session += [
                'paymentMethod' => 'GPAY',
                'provider' => 'razorpay',
                'environment' => strtolower((string)($general['indiaGpayEnvironment'] ?? 'sandbox')) === 'live' ? 'live' : 'sandbox',
                'currency' => 'INR',
                'gatewayOrderId' => $gatewayOrderId,
                'keyId' => $keyId,
                'merchantName' => $general['indiaGpayName'] ?? 'ASTRO SIVAM'
            ];
        } else {
            $clientId = astro_setting_value($general, ['paypalClientId'], ['PAYPAL_CLIENT_ID']);
            $clientSecret = astro_setting_value($general, ['paypalClientSecret', 'paypalSecret'], ['PAYPAL_CLIENT_SECRET', 'PAYPAL_SECRET']);
            $mode = strtolower((string)($general['paypalPaymentMode'] ?? 'offline'));
            if ($mode !== 'online' || $clientId === '' || $clientSecret === '') {
                jsonResponse(['success' => false, 'message' => 'PayPal online checkout is not configured.'], 503);
            }
            $environment = strtolower((string)($general['paypalMode'] ?? 'sandbox')) === 'live' ? 'live' : 'sandbox';
            $base = $environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
            $tokenResponse = astro_http_json(
                $base . '/v1/oauth2/token',
                'POST',
                ['Accept: application/json', 'Accept-Language: en_US', 'Content-Type: application/x-www-form-urlencoded'],
                'grant_type=client_credentials',
                $clientId,
                $clientSecret
            );
            $accessToken = (string)($tokenResponse['body']['access_token'] ?? '');
            if ($tokenResponse['status'] < 200 || $tokenResponse['status'] >= 300 || $accessToken === '') {
                throw new Exception('PayPal authentication failed.');
            }
            $providerResponse = astro_http_json(
                $base . '/v2/checkout/orders',
                'POST',
                ['Content-Type: application/json', 'Accept: application/json', 'Authorization: Bearer ' . $accessToken],
                [
                    'intent' => 'CAPTURE',
                    'purchase_units' => [['reference_id' => $intentId, 'description' => substr($desc, 0, 127), 'amount' => ['currency_code' => 'USD', 'value' => number_format($amount, 2, '.', '')]]]
                ]
            );
            $providerOrder = $providerResponse['body'] ?? [];
            if ($providerResponse['status'] < 200 || $providerResponse['status'] >= 300 || empty($providerOrder['id'])) {
                throw new Exception('PayPal did not create a payment order.');
            }
            $gatewayOrderId = trim((string)$providerOrder['id']);
            $provider = 'paypal';
            $currency = 'USD';
            $approvalUrl = null;
            foreach (($providerOrder['links'] ?? []) as $link) {
                if (($link['rel'] ?? '') === 'approve') { $approvalUrl = $link['href'] ?? null; break; }
            }
            $session += [
                'paymentMethod' => 'PAYPAL',
                'provider' => 'paypal_rest',
                'environment' => $environment,
                'currency' => 'USD',
                'gatewayOrderId' => $gatewayOrderId,
                'clientId' => $clientId,
                'paypalEmail' => $general['paypalEmail'] ?? 'payments@astrosivam.com',
                'businessName' => $general['paypalBusinessName'] ?? 'ASTRO SIVAM',
                'approvalUrl' => $approvalUrl
            ];
        }

        $ins = $pdo->prepare("INSERT INTO payment_intents (id, user_id, provider, payment_method, status, amount, currency, gateway_order_id, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'CREATED', ?, ?, ?, ?, NOW(), NOW())");
        $ins->execute([$intentId, $user['id'], $provider, $session['paymentMethod'], $amount, $currency, $gatewayOrderId, $expiresAt]);
        jsonResponse(['success' => true, 'session' => $session]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'message' => $e->getMessage() ?: 'Unable to initialize verified online payment.'], 502);
    }
}

// 4c. POST /api/services/payment/verify-session (provider verification)
if ((strpos($path, 'payment/verify-session') !== false || $action === 'verify-payment-session') && $method === 'POST') {
    $user = requireAuth($pdo);
    // 20 verifications/10 min per user and 40/10 min per network (Node parity).
    astro_rate_limit_enforce($pdo, 'payment-verify-user', $user['id'], 20, 600,
        'Too many payment verification attempts. Please wait before trying again.');
    astro_rate_limit_enforce($pdo, 'payment-verify-ip', getClientIpAddress(), 40, 600,
        'Too many payment verification attempts from this network. Please wait before trying again.');

    $body = getJsonBody();
    $intentId = trim((string)($body['paymentIntentId'] ?? $body['sessionId'] ?? ''));
    $requestedMethod = strtoupper(trim((string)($body['paymentMethod'] ?? '')));
    $gatewayOrderId = trim((string)($body['gatewayOrderId'] ?? ''));
    $gatewayPaymentId = trim((string)($body['gatewayPaymentId'] ?? ''));
    $gatewaySignature = trim((string)($body['gatewaySignature'] ?? ''));
    $payerAccount = trim((string)($body['payerAccount'] ?? ''));

    if ($intentId === '') {
        jsonResponse(['success' => false, 'verified' => false, 'message' => 'A payment intent is required.'], 400);
    }
    $stmt = $pdo->prepare("SELECT * FROM payment_intents WHERE id = ? AND user_id = ? LIMIT 1");
    $stmt->execute([$intentId, $user['id']]);
    $intent = $stmt->fetch();
    if (!$intent) {
        jsonResponse(['success' => false, 'verified' => false, 'message' => 'Payment intent not found or not owned by this account.'], 404);
    }
    if ($intent['status'] !== 'CAPTURED' && strtotime((string)$intent['expires_at']) <= time()) {
        $pdo->prepare("UPDATE payment_intents SET status = 'EXPIRED', updated_at = NOW() WHERE id = ? AND status IN ('CREATED', 'PENDING_MANUAL')")->execute([$intentId]);
        jsonResponse(['success' => false, 'verified' => false, 'message' => 'Payment session has expired. Start a new checkout.'], 410);
    }
    if ($intent['status'] === 'CONSUMED') {
        jsonResponse(['success' => false, 'verified' => false, 'message' => 'Payment session has already been bound to an order.'], 409);
    }

    $pm = strtoupper((string)$intent['payment_method']);
    if ($requestedMethod !== '' && $requestedMethod !== $pm && !($pm === 'GPAY' && $requestedMethod === 'UPI')) {
        jsonResponse(['success' => false, 'verified' => false, 'message' => 'Payment method does not match the payment intent.'], 400);
    }
    if ($intent['status'] === 'CAPTURED') {
        if ($gatewayOrderId === '' || $gatewayOrderId !== $intent['gateway_order_id']) {
            jsonResponse(['success' => false, 'verified' => false, 'message' => 'Gateway order proof does not match the payment intent.'], 400);
        }
        jsonResponse([
            'success' => true,
            'verified' => true,
            'paymentIntentId' => $intent['id'],
            'paymentReference' => $intent['payment_reference'],
            'gatewayOrderId' => $intent['gateway_order_id'],
            'verifiedAt' => $intent['updated_at'],
            'message' => 'Payment was already captured and verified.'
        ]);
    }
    if ($gatewayOrderId === '' || $gatewayOrderId !== $intent['gateway_order_id']) {
        jsonResponse(['success' => false, 'verified' => false, 'message' => 'Gateway order proof does not match the payment intent.'], 400);
    }

    try {
        $verifiedGatewayPaymentId = $gatewayPaymentId;
        $provider = strtolower((string)$intent['provider']);
        if ($provider === 'razorpay' && $pm === 'GPAY') {
            if ($gatewayPaymentId === '' || $gatewaySignature === '') {
                jsonResponse(['success' => false, 'verified' => false, 'message' => 'Razorpay payment ID and signature are required.'], 400);
            }
            $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
            $sRow = $sStmt->fetch();
            $general = $sRow ? (json_decode($sRow['general_settings'] ?? '{}', true) ?: []) : [];
            $keyId = astro_setting_value($general, ['indiaGpayKeyId', 'razorpayKeyId'], ['RAZORPAY_KEY_ID']);
            $keySecret = astro_setting_value($general, ['indiaGpayKeySecret', 'razorpayKeySecret'], ['RAZORPAY_KEY_SECRET']);
            if ($keyId === '' || $keySecret === '') {
                jsonResponse(['success' => false, 'verified' => false, 'message' => 'Razorpay verification is not configured on the server.'], 503);
            }
            $expectedSignature = hash_hmac('sha256', $gatewayOrderId . '|' . $gatewayPaymentId, $keySecret);
            if (!hash_equals($expectedSignature, $gatewaySignature)) {
                jsonResponse(['success' => false, 'verified' => false, 'message' => 'Razorpay payment signature verification failed.'], 400);
            }
            $providerResponse = astro_http_json('https://api.razorpay.com/v1/payments/' . rawurlencode($gatewayPaymentId), 'GET', ['Accept: application/json'], null, $keyId, $keySecret);
            $payment = $providerResponse['body'] ?? [];
            $providerAmount = round(((float)($payment['amount'] ?? 0)) / 100, 2);
            if ($providerResponse['status'] < 200 || $providerResponse['status'] >= 300 || ($payment['order_id'] ?? '') !== $gatewayOrderId || ($payment['status'] ?? '') !== 'captured' || $providerAmount !== round((float)$intent['amount'], 2) || strtoupper((string)($payment['currency'] ?? '')) !== 'INR') {
                jsonResponse(['success' => false, 'verified' => false, 'message' => 'Razorpay payment is not captured for the expected amount and currency.'], 400);
            }
        } elseif ($provider === 'paypal' && $pm === 'PAYPAL') {
            $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
            $sRow = $sStmt->fetch();
            $general = $sRow ? (json_decode($sRow['general_settings'] ?? '{}', true) ?: []) : [];
            $clientId = astro_setting_value($general, ['paypalClientId'], ['PAYPAL_CLIENT_ID']);
            $clientSecret = astro_setting_value($general, ['paypalClientSecret', 'paypalSecret'], ['PAYPAL_CLIENT_SECRET', 'PAYPAL_SECRET']);
            if ($clientId === '' || $clientSecret === '') {
                jsonResponse(['success' => false, 'verified' => false, 'message' => 'PayPal verification is not configured on the server.'], 503);
            }
            $environment = strtolower((string)($general['paypalMode'] ?? 'sandbox')) === 'live' ? 'live' : 'sandbox';
            $base = $environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
            $tokenResponse = astro_http_json($base . '/v1/oauth2/token', 'POST', ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'], 'grant_type=client_credentials', $clientId, $clientSecret);
            $accessToken = (string)($tokenResponse['body']['access_token'] ?? '');
            if ($tokenResponse['status'] < 200 || $tokenResponse['status'] >= 300 || $accessToken === '') throw new Exception('PayPal authentication failed.');
            $detailsResponse = astro_http_json($base . '/v2/checkout/orders/' . rawurlencode($gatewayOrderId), 'GET', ['Accept: application/json', 'Authorization: Bearer ' . $accessToken]);
            $details = $detailsResponse['body'] ?? [];
            if (($details['status'] ?? '') === 'COMPLETED') {
                $captureResponse = $detailsResponse;
            } else {
                $captureResponse = astro_http_json($base . '/v2/checkout/orders/' . rawurlencode($gatewayOrderId) . '/capture', 'POST', ['Content-Type: application/json', 'Accept: application/json', 'Authorization: Bearer ' . $accessToken], new stdClass());
            }
            $captured = $captureResponse['body'] ?? [];
            $purchaseUnit = $captured['purchase_units'][0] ?? ($details['purchase_units'][0] ?? []);
            $capture = $purchaseUnit['payments']['captures'][0] ?? [];
            $providerAmount = (float)($capture['amount']['value'] ?? ($purchaseUnit['amount']['value'] ?? 0));
            $providerCurrency = strtoupper((string)($capture['amount']['currency_code'] ?? ($purchaseUnit['amount']['currency_code'] ?? '')));
            if ($captureResponse['status'] < 200 || $captureResponse['status'] >= 300 || ($captured['status'] ?? '') !== 'COMPLETED' || round($providerAmount, 2) !== round((float)$intent['amount'], 2) || $providerCurrency !== 'USD') {
                jsonResponse(['success' => false, 'verified' => false, 'message' => 'PayPal payment is not captured for the expected amount and currency.'], 400);
            }
            $verifiedGatewayPaymentId = (string)($capture['id'] ?? $gatewayPaymentId);
        } else {
            jsonResponse(['success' => false, 'verified' => false, 'message' => 'Unsupported online payment provider.'], 400);
        }

        $prefix = $pm === 'GPAY' ? 'GPAY' : 'PAYPAL';
        $cleanPayId = preg_replace('/[^a-zA-Z0-9_-]/', '', $verifiedGatewayPaymentId);
        if (strlen($cleanPayId) < 8) {
            jsonResponse(['success' => false, 'verified' => false, 'message' => 'Provider payment proof is malformed.'], 400);
        }
        $paymentReference = $prefix . '-ONL-' . $cleanPayId;
        $upd = $pdo->prepare("UPDATE payment_intents SET status = 'CAPTURED', gateway_payment_id = ?, gateway_signature = ?, payment_reference = ?, payer_account = ?, updated_at = NOW() WHERE id = ? AND user_id = ? AND status = 'CREATED'");
        $upd->execute([$verifiedGatewayPaymentId, $gatewaySignature !== '' ? $gatewaySignature : null, $paymentReference, $payerAccount !== '' ? substr($payerAccount, 0, 191) : null, $intentId, $user['id']]);
        if ($upd->rowCount() !== 1) {
            jsonResponse(['success' => false, 'verified' => false, 'message' => 'Payment intent changed while verification was in progress. Retry with a new session.'], 409);
        }
        jsonResponse([
            'success' => true,
            'verified' => true,
            'paymentIntentId' => $intentId,
            'paymentMethod' => $pm,
            'gatewayOrderId' => $gatewayOrderId,
            'paymentReference' => $paymentReference,
            'payerAccount' => $payerAccount !== '' ? $payerAccount : null,
            'verifiedAt' => date('c'),
            'message' => 'Online payment captured and verified by the provider.'
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'verified' => false, 'message' => $e->getMessage() ?: 'Online payment verification failed.'], 502);
    }
}

// 5a. POST /api/services/orders/:id/cancel (User or Admin cancels order)
if ((preg_match('/services\/orders\/([^\/]+)\/cancel/', $path, $matches) || $action === 'cancel-order') && $method === 'POST') {
    $body = getJsonBody();
    $orderId = !empty($matches[1]) ? $matches[1] : ($body['orderId'] ?? $_GET['id'] ?? '');
    $user = requireAuth($pdo);
    $reason = trim($body['reason'] ?? 'Cancelled by user');

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Order not found'], 404);
    }

    if ($order['user_id'] !== $user['id'] && ($user['role'] ?? '') !== 'admin') {
        jsonResponse(['success' => false, 'message' => 'Access denied'], 403);
    }

    $upd = $pdo->prepare("UPDATE orders SET status = 'CANCELLED', admin_notes = ?, refund_reason = ?, updated_at = NOW() WHERE id = ?");
    $upd->execute(["Cancelled: {$reason}", $reason, $orderId]);

    logAudit($pdo, $user['id'], $user['name'], $user['role'] ?? 'user', 'ORDER_CANCELLED', "Order #{$order['order_number']} cancelled: {$reason}");

    jsonResponse([
        'success' => true,
        'message' => "Order #{$order['order_number']} has been cancelled.",
        'order' => array_merge($order, ['status' => 'CANCELLED', 'admin_notes' => "Cancelled: {$reason}"])
    ]);
}

// 5b-1. POST /api/services/order | /multi-order with a `people` array.
//
// MULTI-PERSON CHECKOUT: one order = up to 6 people, each person with one or
// more services, one server-computed total. This is the write path behind the
// person-card checkout; it writes ONE `orders` header row plus `order_persons`
// and `order_items` in a single transaction. The legacy `items[]` shape below
// (one orders row per chart, grouped by group_id) is untouched for old clients
// and for carts saved before this change.
if ($method === 'POST' && (
    (strpos($path, 'services/order') !== false || strpos($fullUri, 'services/order') !== false
        || strpos($path, 'multi-order') !== false || strpos($fullUri, 'multi-order') !== false
        || in_array($action, ['order', 'orders', 'place-order', 'multi-order', 'multiOrder', 'multi-person-order'], true))
    && isset($jsonBody['people']) && is_array($jsonBody['people']) && count($jsonBody['people']) > 0
)) {
    require_once __DIR__ . '/multi_person_order.php';
    $orderUser = requireAuth($pdo);
    astro_create_multi_person_order($pdo, $orderUser, !empty($jsonBody) ? $jsonBody : getJsonBody());
}

// 5c. POST /api/services/multi-order or services.php?action=multi-order (Unified batch family checkout)
if ($method === 'POST' && (
    strpos($path, 'multi-order') !== false ||
    strpos($fullUri, 'multi-order') !== false ||
    strpos($path, 'multiOrder') !== false ||
    strpos($fullUri, 'multiOrder') !== false ||
    $action === 'multi-order' ||
    $action === 'multiOrder' ||
    (isset($jsonBody['items']) && is_array($jsonBody['items']) && count($jsonBody['items']) > 0)
)) {
    $user = requireAuth($pdo);
    $isAdmin = strtolower((string)($user['role'] ?? 'customer')) === 'admin';
    $body = !empty($jsonBody) ? $jsonBody : getJsonBody();

    $items = $body['items'] ?? [];
    if (!is_array($items) || empty($items)) {
        jsonResponse(['success' => false, 'message' => 'At least one service chart item is required in the family tray.'], 400);
    }
    if (count($items) > 6) {
        jsonResponse(['success' => false, 'message' => 'A family order can contain at most 6 reports.'], 400);
    }
    $supportedFamilyServices = ['BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY', 'BABY_NAMING', 'MUHURTHAM'];
    foreach ($items as $index => $item) {
        if (!is_array($item) || !in_array($item['serviceType'] ?? '', $supportedFamilyServices, true)
            || !is_array($item['inputPayload'] ?? null)) {
            jsonResponse(['success' => false, 'message' => 'Family item #' . ($index + 1) . ' has invalid or missing service details.'], 400);
        }
        $itemService = $item['serviceType'] ?? '';
        $itemPayload = $item['inputPayload'] ?? null;
        if (($itemService === 'BIRTH_JATHAGAM' || $itemService === 'BABY_NAMING')
            && !AstroEngine::hasValidBirthDetails($itemPayload)) {
            jsonResponse([
                'success' => false,
                'message' => 'Family item #' . ($index + 1) . ' needs a valid past birth date, birth time, birth place, coordinates and time zone.'
            ], 400);
        }
        if ($itemService === 'MARRIAGE_COMPATIBILITY' && !astro_is_valid_marriage_payload($itemPayload)) {
            jsonResponse([
                'success' => false,
                'message' => 'Family item #' . ($index + 1) . ' needs valid birth particulars for both bride and groom.'
            ], 400);
        }
        if ($itemService === 'MUHURTHAM' && !astro_is_valid_muhurtham_payload($itemPayload)) {
            jsonResponse([
                'success' => false,
                'message' => 'Family item #' . ($index + 1) . ' needs a valid birth profile and separate Muhurtham location, each with valid coordinates and time zone.'
            ], 400);
        }
    }

    $country = $body['country'] ?? ($user['country'] ?? 'Fiji');
    $paymentMethod = strtoupper(trim((string)($isAdmin ? 'NONE' : ($body['paymentMethod'] ?? 'MPAISA'))));
    if (!in_array($paymentMethod, ['NONE', 'MPAISA', 'MYCASH', 'GPAY', 'UPI', 'PAYPAL', 'CARD'], true)) {
        jsonResponse(['success' => false, 'message' => 'Unsupported payment method.'], 400);
    }
    // Admin reports are always no-charge. Discard saved/stale payment data
    // so no receipt or paid intent can be attached to an admin order.
    $paymentReference = !$isAdmin && is_string($body['paymentReference'] ?? null) ? trim($body['paymentReference']) : '';
    $paymentIntentId = !$isAdmin && is_string($body['paymentIntentId'] ?? null) ? trim($body['paymentIntentId']) : '';

    // Check system settings for mode & pricing
    $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
    $sRow = $sStmt->fetch();
    $isFreeBeta = $sRow ? ((bool)$sRow['free_beta_active'] || $sRow['service_mode'] === 'FREE_BETA') : false;
    $serviceMode = $isFreeBeta ? 'FREE_BETA' : 'PAID';

    // CURRENCY RULE: the payment method the customer picked at checkout decides
    // the currency of the WHOLE family order. Birth places (India / Fiji / USA)
    // never change it. The billing country of the account is only a fallback for
    // FREE_BETA orders where no payment method exists.
    $billingCountry = $body['billingCountry'] ?? ($user['country'] ?? $country);
    $requestedCurrency = $body['currency'] ?? null;
    $currency = astro_currency_for_payment($paymentMethod, $billingCountry, $requestedCurrency);
    if (!$isAdmin && is_string($requestedCurrency) && trim($requestedCurrency) !== '' && strtoupper(trim($requestedCurrency)) !== $currency) {
        jsonResponse(['success' => false, 'message' => 'Payment currency does not match the selected payment method.'], 400);
    }

    $clientIp = getClientIpAddress();

    // 1. IP BLACKLIST CHECK
    try {
        $bannedCheck = $pdo->prepare("SELECT * FROM banned_ips WHERE ip_address = ? LIMIT 1");
        $bannedCheck->execute([$clientIp]);
        $bannedRow = $bannedCheck->fetch();
        if ($bannedRow && !$isAdmin) {
            jsonResponse([
                'success' => false,
                'message' => 'ACCESS RESTRICTED: Your IP address (' . htmlspecialchars($clientIp) . ') has been blocked due to policy violations (repeated fake orders / spam). Reason: ' . ($bannedRow['reason'] ?? 'Fraud prevention') . '. Please contact admin@astrosivam.com if you believe this is an error.'
            ], 403);
        }
    } catch (Exception $e) {}

    // 2. UNVERIFIED CHECKOUT LIMIT: max 3 open manual/unverified checkout groups per IP.
    // A family bundle counts once; captured/no-charge orders do not block paid reorders.
    $pendingCount = astro_count_pending_order_groups_by_ip($pdo, $clientIp);
    if (!$isAdmin && $pendingCount >= 3) {
        jsonResponse([
            'success' => false,
            'message' => 'PENDING ORDERS LIMIT: You currently have ' . $pendingCount . ' unpaid checkout groups awaiting payment verification. Please wait for them to be verified or contact admin before creating additional orders.',
            'pendingCount' => $pendingCount
        ], 429);
    }

    // 3. PAYMENT & FREE BETA HANDLING
    // FREE BETA RULE — exactly ONE free report per IP address:
    //   * This IP still has its free chart  -> the FIRST chart of the family
    //     order is FREE, every additional family member pays the normal price.
    //   * The free chart was already used   -> the whole bundle is a paid order.
    // There is no rejection: later orders from the same IP simply become paid
    // orders (single or family), exactly like the single-order endpoint.
    astro_ensure_beta_ip_claims_table($pdo);
    $ipCheckStmt = $pdo->prepare("SELECT COUNT(*) FROM beta_ip_claims WHERE ip_address = ?");
    $ipCheckStmt->execute([$clientIp]);
    $ipOrderCount = (int)($ipCheckStmt->fetchColumn() ?: 0);

    $isFreeBetaMode = ($isFreeBeta || $serviceMode === 'FREE_BETA');
    // Admin-created family orders are always free. Customers retain the
    // existing one-free-chart-per-IP rule unchanged.
    $freeChartAvailable = $isFreeBetaMode && $ipOrderCount < 1;
    if ($isAdmin) {
        $freeChartAvailable = false;
    }
    $paidChartCount = max(0, count($items) - ($freeChartAvailable ? 1 : 0));
    $chargeableChartCount = $isAdmin ? 0 : $paidChartCount;
    $requiresGroupPayment = $paidChartCount > 0;
    if ($isAdmin) {
        $requiresGroupPayment = false;
    }

    $pricing = $sRow ? json_decode($sRow['pricing'] ?? '{}', true) : [];
    $priceMap = [
        'BIRTH_JATHAGAM' => ($currency === 'INR' ? 499 : ($currency === 'FJD' ? 35 : 18)),
        'MARRIAGE_COMPATIBILITY' => ($currency === 'INR' ? 699 : ($currency === 'FJD' ? 45 : 22)),
        'BABY_NAMING' => ($currency === 'INR' ? 399 : ($currency === 'FJD' ? 30 : 15)),
        'MUHURTHAM' => ($currency === 'INR' ? 599 : ($currency === 'FJD' ? 40 : 20))
    ];
    $currKey = strtolower($currency);
    $expectedAmount = 0.0;
    foreach ($items as $idx => $item) {
        $itemService = $item['serviceType'] ?? 'BIRTH_JATHAGAM';
        $itemFree = $isAdmin || ($freeChartAvailable && $idx === 0);
        $expectedAmount += $itemFree ? 0 : (float)($pricing[$itemService][$currKey] ?? $priceMap[$itemService] ?? 35);
    }
    $capturedIntent = null;
    $paymentStatus = $chargeableChartCount === 0 ? 'NOT_REQUIRED' : 'PENDING_ADMIN';
    if (!$requiresGroupPayment && $paymentIntentId !== '') {
        jsonResponse(['success' => false, 'message' => 'A no-charge family order cannot be bound to a paid payment intent.'], 400);
    }
    if ($requiresGroupPayment) {
        if ($paymentIntentId !== '') {
            $intentStmt = $pdo->prepare("SELECT * FROM payment_intents WHERE id = ? AND user_id = ? LIMIT 1");
            $intentStmt->execute([$paymentIntentId, $user['id']]);
            $capturedIntent = $intentStmt->fetch();
        } elseif ($paymentReference !== '') {
            $intentStmt = $pdo->prepare("SELECT * FROM payment_intents WHERE payment_reference = ? AND user_id = ? LIMIT 1");
            $intentStmt->execute([$paymentReference, $user['id']]);
            $capturedIntent = $intentStmt->fetch();
        }
        if ($paymentIntentId !== '' && (!$capturedIntent || $capturedIntent['status'] !== 'CAPTURED')) {
            jsonResponse(['success' => false, 'message' => 'The payment intent is invalid, expired, or has not been captured.'], 400);
        }
        if ($capturedIntent) {
            if ($paymentReference !== '' && !hash_equals((string)($capturedIntent['payment_reference'] ?? ''), $paymentReference)) {
                jsonResponse(['success' => false, 'message' => 'Payment intent and payment reference do not match.'], 400);
            }
            $intentMethod = strtoupper((string)($capturedIntent['payment_method'] ?? ''));
            $methodMatches = $intentMethod === $paymentMethod || ($intentMethod === 'GPAY' && $paymentMethod === 'UPI');
            if (!$methodMatches || $capturedIntent['status'] !== 'CAPTURED' || round((float)$capturedIntent['amount'], 2) !== round($expectedAmount, 2) || strtoupper((string)$capturedIntent['currency']) !== strtoupper((string)$currency)) {
                jsonResponse(['success' => false, 'message' => 'The captured payment does not match this order method, amount, or currency.'], 400);
            }
            $paymentReference = (string)$capturedIntent['payment_reference'];
            $paymentStatus = 'CAPTURED';
        }
    }

    // FAKE & DUPLICATE PAYMENT REFERENCE VALIDATION (paid charts only — under
    // FREE_BETA only the FIRST chart of the bundle is free, the rest of the
    // family pays for their reports).
    if ($requiresGroupPayment) {
        $cleanRef = $paymentReference;
        if (empty($paymentMethod) || strtoupper($paymentMethod) === 'NONE') {
            jsonResponse([
                'success' => false,
                'message' => 'PAYMENT REQUIRED: ' . $paidChartCount . ' of ' . count($items) . ' charts in this family order are chargeable (only the first report is free during the Free Beta). Please select a payment method to place the order.'
            ], 400);
        }

        if (empty($cleanRef)) {
            jsonResponse([
                'success' => false,
                'message' => 'Payment reference number / transaction ID is required to place a paid order.'
            ], 400);
        }

        $lowerRef = strtolower($cleanRef);
        $isRepeated = preg_match('/^(.)\1+$/', $cleanRef);
        $isBogus = in_array($lowerRef, [
            '123456', '12345678', '1234567890', '000000', '111111', '999999',
            'test', 'tester', 'fake', 'none', 'nil', 'asdf', 'sample', 'payment',
            'reference', 'upi', 'gpay', 'mpaisa', 'mycash', '000000000000', '111111111111'
        ]);

        if (strlen($cleanRef) < 6 || $isRepeated || $isBogus) {
            jsonResponse([
                'success' => false,
                'message' => 'INVALID TRANSACTION ID: Please enter a genuine, unique bank/UPI/M-PAiSA transaction reference number. Random or placeholder numbers are strictly prohibited.'
            ], 400);
        }

        $dupCheck = $pdo->prepare("SELECT id, order_number FROM orders WHERE payment_reference = ? AND status NOT IN ('CANCELLED', 'REJECTED') LIMIT 1");
        $dupCheck->execute([$cleanRef]);
        $dupOrder = $dupCheck->fetch();
        if ($dupOrder) {
            jsonResponse([
                'success' => false,
                'message' => 'DUPLICATE TRANSACTION ID: The payment reference "' . htmlspecialchars($cleanRef) . '" has already been used for order #' . $dupOrder['order_number'] . '. Each payment receipt must be unique.'
            ], 400);
        }
    }

    // Ensure group_id column exists
    try {
        $pdo->exec("ALTER TABLE `orders` ADD COLUMN `group_id` VARCHAR(64) NULL AFTER `order_number`");
    } catch (Exception $e) {}
    try {
        $pdo->exec("ALTER TABLE `orders` ADD COLUMN `group_order_index` INT NOT NULL DEFAULT 0 AFTER `group_id`");
    } catch (Exception $e) {}
    foreach ([
        "ALTER TABLE orders ADD COLUMN payment_intent_id VARCHAR(80) NULL",
        "ALTER TABLE orders ADD COLUMN payment_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_ADMIN'"
    ] as $migration) { try { $pdo->exec($migration); } catch (Exception $e) {} }

    $groupId = 'GRP-' . date('Y') . '-' . strtoupper(substr(uniqid(), -5));
    $createdOrders = [];

    // Reserve the Free Beta slot inside the same transaction as order creation.
    // The unique IP key serializes concurrent requests; a loser must retry as a
    // paid order instead of creating a second free chart.
    $betaClaimTransactionStarted = false;
    if (!$isAdmin && $freeChartAvailable) {
        try {
            $pdo->beginTransaction();
            $betaClaim = $pdo->prepare("INSERT IGNORE INTO beta_ip_claims (ip_address, claimed_at) VALUES (?, NOW())");
            $betaClaim->execute([$clientIp]);
            if ($betaClaim->rowCount() !== 1) {
                $pdo->rollBack();
                jsonResponse(['success' => false, 'message' => 'The Free Beta report was claimed by another request. Refresh checkout and submit again.'], 409);
            }
            $betaClaimTransactionStarted = true;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('ASTRO SIVAM: could not reserve Free Beta claim.');
            jsonResponse(['success' => false, 'message' => 'Free Beta availability could not be confirmed. Please retry shortly.'], 503);
        }
    }

    $pricing = $sRow ? json_decode($sRow['pricing'] ?? '{}', true) : [];
    $priceMap = [
        'BIRTH_JATHAGAM' => ($currency === 'INR' ? 499 : ($currency === 'FJD' ? 35 : 18)),
        'MARRIAGE_COMPATIBILITY' => ($currency === 'INR' ? 699 : ($currency === 'FJD' ? 45 : 22)),
        'BABY_NAMING' => ($currency === 'INR' ? 399 : ($currency === 'FJD' ? 30 : 15)),
        'MUHURTHAM' => ($currency === 'INR' ? 599 : ($currency === 'FJD' ? 40 : 20))
    ];
    $currKey = strtolower($currency);
    $groupTotal = 0;

    foreach ($items as $idx => $it) {
        $st = $it['serviceType'] ?? 'BIRTH_JATHAGAM';
        $lang = astro_normalize_report_language($it['language'] ?? 'en');
        $itemCountry = is_string($it['country'] ?? null) ? trim($it['country']) : '';
        $inputPayload = $it['inputPayload'] ?? [];

        // Customer-only baseline: $isThisItemFree = $freeChartAvailable && $idx === 0;
        // Admins override every family line to free.
        $isThisItemFree = $isAdmin || ($freeChartAvailable && $idx === 0);
        $itemAmount = $isThisItemFree ? 0 : ($pricing[$st][$currKey] ?? $priceMap[$st] ?? 35);
        $itemServiceMode = $isThisItemFree ? 'FREE_BETA' : 'PAID';
        // Every chart of the family is priced in the SAME currency, so these add up.
        $groupTotal += (float)$itemAmount;

        $orderId = 'ord_' . uniqid('', true) . '_' . ($idx + 1);
        $orderNumber = 'ORD-' . strtoupper(substr(uniqid(), -6));

        // Pre-calculate Vedic astrological result
        $calculatedResult = null;
        if ($st === 'MARRIAGE_COMPATIBILITY') {
            $calculatedResult = AstroEngine::calculateMatchmaking($inputPayload);
        } elseif ($st === 'BABY_NAMING') {
            $calculatedResult = AstroEngine::calculateBabyNaming($inputPayload);
        } elseif ($st === 'MUHURTHAM') {
            $calculatedResult = AstroEngine::calculateMuhurtham($inputPayload);
        } else {
            $calculatedResult = AstroEngine::calculateHoroscope($inputPayload);
        }

        $inputPayloadWithGroup = array_merge($inputPayload, ['groupId' => $groupId]);

        // Attempt insert with group_id, fallback if column missing
        try {
            $ins = $pdo->prepare("INSERT INTO orders (id, order_number, group_id, user_id, user_name, user_email, user_mobile, country, service_type, language, amount, currency, service_mode, status, payment_method, payment_reference, payment_intent_id, payment_status, payment_confirmed, email_status, input_payload, calculated_result, has_pdf, has_invoice, ip_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, 'PENDING', ?, ?, 1, 1, ?, NOW(), NOW())");
            $ins->execute([
                $orderId,
                $orderNumber,
                $groupId,
                $user['id'],
                $user['name'],
                $user['email'],
                $user['mobile'],
                $itemCountry,
                $st,
                $lang,
                $itemAmount,
                $currency,
                $itemServiceMode,
                $paymentMethod,
                $paymentReference !== '' ? $paymentReference : null,
                $capturedIntent['id'] ?? null,
                $paymentStatus,
                $capturedIntent ? 1 : 0,
                json_encode($inputPayloadWithGroup, JSON_UNESCAPED_UNICODE),
                json_encode($calculatedResult, JSON_UNESCAPED_UNICODE),
                $clientIp
            ]);
        } catch (Exception $exIns) {
            $ins = $pdo->prepare("INSERT INTO orders (id, order_number, user_id, user_name, user_email, user_mobile, country, service_type, language, amount, currency, service_mode, status, payment_method, payment_reference, payment_intent_id, payment_status, payment_confirmed, email_status, input_payload, calculated_result, has_pdf, has_invoice, ip_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, 'PENDING', ?, ?, 1, 1, ?, NOW(), NOW())");
            $ins->execute([
                $orderId,
                $orderNumber,
                $user['id'],
                $user['name'],
                $user['email'],
                $user['mobile'],
                $itemCountry,
                $st,
                $lang,
                $itemAmount,
                $currency,
                $itemServiceMode,
                $paymentMethod,
                $paymentReference !== '' ? $paymentReference : null,
                $capturedIntent['id'] ?? null,
                $paymentStatus,
                $capturedIntent ? 1 : 0,
                json_encode($inputPayloadWithGroup, JSON_UNESCAPED_UNICODE),
                json_encode($calculatedResult, JSON_UNESCAPED_UNICODE),
                $clientIp
            ]);
        }

        // Keep the family bundle ordered (chart 1, 2, 3...) for the admin panel
        try {
            $ordUpd = $pdo->prepare("UPDATE orders SET group_order_index = ? WHERE id = ?");
            $ordUpd->execute([$idx + 1, $orderId]);
        } catch (Exception $e) {}

        // Record in beta_ip_orders table — ONE row for the ONE free chart of
        // this IP (the first chart of the bundle). Paid charts never consume
        // the free beta slot.
        if ($isThisItemFree) {
            if (!$isAdmin) {
                try {
                    $insBeta = $pdo->prepare("INSERT INTO beta_ip_orders (ip_address, order_id, order_number, user_id, user_email, service_type, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
                    $insBeta->execute([
                        $clientIp,
                        $orderId,
                        $orderNumber,
                        $user['id'],
                        $user['email'],
                        $st
                    ]);
                } catch (Exception $e) {}
            }
        }

        $createdOrders[] = [
            'id' => $orderId,
            'orderNumber' => $orderNumber,
            'groupId' => $groupId,
            'groupOrderIndex' => $idx + 1,
            'userId' => $user['id'],
            'userName' => $user['name'],
            'userEmail' => $user['email'],
            'userMobile' => $user['mobile'],
            'country' => $itemCountry,
            'serviceType' => $st,
            'language' => $lang,
            'amount' => $itemAmount,
            'currency' => $currency,
            'serviceMode' => $itemServiceMode,
            'status' => 'PENDING',
            'paymentMethod' => $paymentMethod,
            'paymentReference' => $paymentReference !== '' ? $paymentReference : null,
            'paymentIntentId' => $capturedIntent['id'] ?? null,
            'paymentStatus' => $paymentStatus,
            'paymentConfirmed' => (bool)$capturedIntent,
            'emailStatus' => 'PENDING',
            'hasPdf' => false,
            'hasInvoice' => false,
            'inputPayload' => $inputPayloadWithGroup,
            'createdAt' => date('Y-m-d H:i:s')
        ];
    }

    if ($capturedIntent && !empty($createdOrders)) {
        $consume = $pdo->prepare("UPDATE payment_intents SET status = 'CONSUMED', order_id = ?, updated_at = NOW() WHERE id = ? AND user_id = ? AND status = 'CAPTURED' AND amount = ? AND currency = ? AND order_id IS NULL");
        $consume->execute([$createdOrders[0]['id'], $capturedIntent['id'], $user['id'], $expectedAmount, $currency]);
        if ($consume->rowCount() !== 1) {
            foreach ($createdOrders as $created) {
                $pdo->prepare("UPDATE orders SET status = 'REJECTED', admin_notes = ?, updated_at = NOW() WHERE id = ?")->execute(['Payment intent could not be consumed safely.', $created['id']]);
            }
            jsonResponse(['success' => false, 'message' => 'Payment could not be bound to this family order. No report will be delivered.'], 409);
        }
    }

    if ($betaClaimTransactionStarted && $pdo->inTransaction()) {
        $pdo->commit();
    }

    logAudit($pdo, $user['id'], $user['name'], $user['role'], 'MULTI_ORDER_PLACED', "Unified family order {$groupId} placed with " . count($createdOrders) . " charts (" . ($isAdmin ? "all free — admin" : ($freeChartAvailable ? "1 free beta chart + " . $paidChartCount . " paid" : "all paid")) . "), charged " . number_format($groupTotal, 2) . " {$currency} via {$paymentMethod}, from IP: {$clientIp}");

    // Best-effort WhatsApp/Viber order-confirmation alert for the family bundle.
    if (!empty($createdOrders)) {
        AstroChatAlerts::sendOrderAlerts($pdo, 'order_confirmed', $createdOrders);
    }

    if ($isAdmin) {
        $message = "Admin family order (" . count($createdOrders) . " charts) placed successfully at no charge. Awaiting Admin verification.";
    } elseif ($groupTotal <= 0) {
        $message = "Order placed successfully in FREE BETA! Your first report is free (1 free report per customer during the Free Beta). Awaiting Admin verification.";
    } elseif ($freeChartAvailable) {
        $message = "Family bundle (" . count($createdOrders) . " charts) submitted! Chart 1 is FREE (Free Beta — 1 free report per customer); the remaining " . $paidChartCount . " charts total " . number_format($groupTotal, 2) . " " . $currency . ". Payment will be verified by Admin.";
    } else {
        $message = "Family bundle (" . count($createdOrders) . " charts) submitted! The free beta report for this connection has already been used, so all charts are charged " . number_format($groupTotal, 2) . " " . $currency . ". Payment will be verified by Admin.";
    }

    jsonResponse([
        'success' => true,
        'message' => $message,
        'orders' => $createdOrders,
        'groupId' => $groupId,
        // Authoritative money: one currency for the whole family bundle.
        'currency' => $currency,
        // FREE_BETA: only the FIRST chart is free — the rest of the family pays.
        'totalAmount' => round($groupTotal, 2),
        'freeCharts' => $isAdmin ? count($items) : ($freeChartAvailable ? 1 : 0),
        'paidCharts' => $chargeableChartCount,
        'paymentMethod' => $paymentMethod
    ], 201);
}

// 5b. POST /api/services/order or /api/services/orders
if ($method === 'POST' && (
    preg_match('/services\/(order|orders)$/', rtrim($path, '/')) ||
    strpos($path, 'services/order') !== false ||
    strpos($fullUri, 'services/order') !== false ||
    $action === 'order' ||
    $action === 'orders' ||
    $action === 'place-order' ||
    (isset($jsonBody['serviceType']) && isset($jsonBody['inputPayload']))
)) {
    $user = requireAuth($pdo);
    $isAdmin = strtolower((string)($user['role'] ?? 'customer')) === 'admin';
    $body = !empty($jsonBody) ? $jsonBody : getJsonBody();

    $serviceType = $body['serviceType'] ?? 'BIRTH_JATHAGAM';
    if (!in_array($serviceType, ['BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY', 'BABY_NAMING', 'MUHURTHAM'], true)) {
        jsonResponse(['success' => false, 'message' => 'Unsupported astrology service type.'], 400);
    }
    $language = astro_normalize_report_language($body['language'] ?? 'en');
    $country = $body['country'] ?? ($user['country'] ?? 'Fiji');
    $paymentMethod = strtoupper(trim((string)($isAdmin ? 'NONE' : ($body['paymentMethod'] ?? 'MPAISA'))));
    if (!in_array($paymentMethod, ['NONE', 'MPAISA', 'MYCASH', 'GPAY', 'UPI', 'PAYPAL', 'CARD'], true)) {
        jsonResponse(['success' => false, 'message' => 'Unsupported payment method.'], 400);
    }
    // Admin reports are always no-charge. Discard saved/stale payment data
    // so no receipt or paid intent can be attached to an admin order.
    $paymentReference = !$isAdmin && is_string($body['paymentReference'] ?? null) ? trim($body['paymentReference']) : '';
    $paymentIntentId = !$isAdmin && is_string($body['paymentIntentId'] ?? null) ? trim($body['paymentIntentId']) : '';
    $inputPayload = $body['inputPayload'] ?? [];
    $saveAsProfile = !empty($body['saveAsProfile']);
    if (($serviceType === 'BIRTH_JATHAGAM' || $serviceType === 'BABY_NAMING')
        && !AstroEngine::hasValidBirthDetails($inputPayload)) {
        jsonResponse([
            'success' => false,
            'message' => 'A valid past birth date, 24-hour birth time, birth place, coordinates and time zone are required. Please verify the birth details before ordering.'
        ], 400);
    }
    if ($serviceType === 'MARRIAGE_COMPATIBILITY' && !astro_is_valid_marriage_payload($inputPayload)) {
        jsonResponse([
            'success' => false,
            'message' => 'Both bride and groom need valid past birth dates, birth times, birth places, coordinates and time zones. Please verify both sets of details before ordering.'
        ], 400);
    }
    if ($serviceType === 'MUHURTHAM' && !astro_is_valid_muhurtham_payload($inputPayload)) {
        jsonResponse([
            'success' => false,
            'message' => 'The Muhurtham report needs a valid birth date, birth time and birth place, plus a separate Muhurtham location, each with valid coordinates and time zone.'
        ], 400);
    }

    // Check system settings for mode & pricing
    $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
    $sRow = $sStmt->fetch();
    $isFreeBeta = $sRow ? ((bool)$sRow['free_beta_active'] || $sRow['service_mode'] === 'FREE_BETA') : false;
    $serviceMode = $isFreeBeta ? 'FREE_BETA' : 'PAID';
    
    // CURRENCY RULE: the payment method the customer picked at checkout decides
    // the currency of the WHOLE family order. Birth places (India / Fiji / USA)
    // never change it. The billing country of the account is only a fallback for
    // FREE_BETA orders where no payment method exists.
    $billingCountry = $body['billingCountry'] ?? ($user['country'] ?? $country);
    $requestedCurrency = $body['currency'] ?? null;
    $currency = astro_currency_for_payment($paymentMethod, $billingCountry, $requestedCurrency);
    if (!$isAdmin && is_string($requestedCurrency) && trim($requestedCurrency) !== '' && strtoupper(trim($requestedCurrency)) !== $currency) {
        jsonResponse(['success' => false, 'message' => 'Payment currency does not match the selected payment method.'], 400);
    }

    $clientIp = getClientIpAddress();

    // 1. IP BLACKLIST CHECK: Block banned IPs from placing any orders
    try {
        $bannedCheck = $pdo->prepare("SELECT * FROM banned_ips WHERE ip_address = ? LIMIT 1");
        $bannedCheck->execute([$clientIp]);
        $bannedRow = $bannedCheck->fetch();
        if ($bannedRow && !$isAdmin) {
            jsonResponse([
                'success' => false,
                'message' => 'ACCESS RESTRICTED: Your IP address (' . htmlspecialchars($clientIp) . ') has been blocked due to policy violations (repeated fake orders / spam). Reason: ' . ($bannedRow['reason'] ?? 'Fraud prevention') . '. Please contact admin@astrosivam.com if you believe this is an error.'
            ], 403);
        }
    } catch (Exception $e) {
        // Fallthrough if table doesn't exist yet
    }

    // 2. UNVERIFIED CHECKOUT LIMIT: max 3 open manual/unverified checkout groups per IP.
    // A family bundle counts once; captured/no-charge orders do not block paid reorders.
    $pendingCount = astro_count_pending_order_groups_by_ip($pdo, $clientIp);
    if (!$isAdmin && $pendingCount >= 3) {
        jsonResponse([
            'success' => false,
            'message' => 'PENDING ORDERS LIMIT: You currently have ' . $pendingCount . ' unpaid checkout groups awaiting payment verification. Please wait for them to be verified or contact admin before creating additional orders.',
            'pendingCount' => $pendingCount
        ], 429);
    }

    // 3. FREE BETA HANDLING — exactly ONE free report per IP address.
    // The FIRST single order from an IP is free; once that free chart has
    // been used, every following order (single or family) from the same IP is
    // a normal paid order. There is no rejection — the order simply becomes
    // a paid order that requires a payment method and transaction reference.
    astro_ensure_beta_ip_claims_table($pdo);
    $ipCheckStmt = $pdo->prepare("SELECT COUNT(*) FROM beta_ip_claims WHERE ip_address = ?");
    $ipCheckStmt->execute([$clientIp]);
    $ipOrderCount = (int)($ipCheckStmt->fetchColumn() ?: 0);
    // Customers keep the original one-free-report-per-IP behavior. Admins
    // get a separate no-charge path and never consume that customer slot.
    $isFreeOrder = ($isFreeBeta || $serviceMode === 'FREE_BETA') && $ipOrderCount < 1;
    if ($isAdmin) {
        $isFreeOrder = true;
    }
    $effectiveServiceMode = $isFreeOrder ? 'FREE_BETA' : 'PAID';

    // 4. PAYMENT & FAKE/DUPLICATE REFERENCE VALIDATION (paid orders only —
    // under FREE_BETA only the first report of this IP is free).
    if (!$isFreeOrder) {
        if (empty($paymentMethod) || strtoupper($paymentMethod) === 'NONE') {
            jsonResponse([
                'success' => false,
                'message' => 'PAYMENT REQUIRED: The 1 free beta report for this connection has already been used (1 free report per customer during the Free Beta). Please select a payment method and enter your transaction reference to place this paid order.'
            ], 400);
        }

        $cleanRef = $paymentReference;
        if (empty($cleanRef)) {
            jsonResponse([
                'success' => false,
                'message' => 'Payment reference number / transaction ID is required to place a paid order.'
            ], 400);
        }

        $lowerRef = strtolower($cleanRef);
        $isRepeated = preg_match('/^(.)\1+$/', $cleanRef);
        $isBogus = in_array($lowerRef, [
            '123456', '12345678', '1234567890', '000000', '111111', '999999',
            'test', 'tester', 'fake', 'none', 'nil', 'asdf', 'sample', 'payment',
            'reference', 'upi', 'gpay', 'mpaisa', 'mycash', '000000000000', '111111111111'
        ]);

        if (strlen($cleanRef) < 6 || $isRepeated || $isBogus) {
            jsonResponse([
                'success' => false,
                'message' => 'INVALID TRANSACTION ID: Please enter a genuine, unique bank/UPI/M-PAiSA transaction reference number. Random or placeholder numbers are strictly prohibited.'
            ], 400);
        }

        $dupCheck = $pdo->prepare("SELECT id, order_number FROM orders WHERE payment_reference = ? AND status NOT IN ('CANCELLED', 'REJECTED') LIMIT 1");
        $dupCheck->execute([$cleanRef]);
        $dupOrder = $dupCheck->fetch();
        if ($dupOrder) {
            jsonResponse([
                'success' => false,
                'message' => 'DUPLICATE TRANSACTION ID: The payment reference "' . htmlspecialchars($cleanRef) . '" has already been used for order #' . $dupOrder['order_number'] . '. Each order must have a distinct payment receipt reference.'
            ], 400);
        }
    }

    $pricing = $sRow ? json_decode($sRow['pricing'] ?? '{}', true) : [];
    $priceMap = [
        'BIRTH_JATHAGAM' => ($currency === 'INR' ? 499 : ($currency === 'FJD' ? 35 : 18)),
        'MARRIAGE_COMPATIBILITY' => ($currency === 'INR' ? 699 : ($currency === 'FJD' ? 45 : 22)),
        'BABY_NAMING' => ($currency === 'INR' ? 399 : ($currency === 'FJD' ? 30 : 15)),
        'MUHURTHAM' => ($currency === 'INR' ? 599 : ($currency === 'FJD' ? 40 : 20))
    ];
    $currKey = strtolower($currency);
    // FREE_BETA: the first report of this IP is free — later orders pay.
    $amount = $isFreeOrder ? 0 : ($pricing[$serviceType][$currKey] ?? $priceMap[$serviceType] ?? 35);
    if ($isFreeOrder && $paymentIntentId !== '') {
        jsonResponse(['success' => false, 'message' => 'A free order cannot be bound to a paid payment intent.'], 400);
    }
    $capturedIntent = null;
    $paymentStatus = $isFreeOrder ? 'NOT_REQUIRED' : 'PENDING_ADMIN';

    if (!$isFreeOrder) {
        if ($paymentIntentId !== '') {
            $intentStmt = $pdo->prepare("SELECT * FROM payment_intents WHERE id = ? AND user_id = ? LIMIT 1");
            $intentStmt->execute([$paymentIntentId, $user['id']]);
            $capturedIntent = $intentStmt->fetch();
        } elseif ($paymentReference !== '') {
            $intentStmt = $pdo->prepare("SELECT * FROM payment_intents WHERE payment_reference = ? AND user_id = ? LIMIT 1");
            $intentStmt->execute([$paymentReference, $user['id']]);
            $capturedIntent = $intentStmt->fetch();
        }

        if ($paymentIntentId !== '' && (!$capturedIntent || $capturedIntent['status'] !== 'CAPTURED')) {
            jsonResponse(['success' => false, 'message' => 'The payment intent is invalid, expired, or has not been captured.'], 400);
        }
        if ($capturedIntent) {
            if ($paymentReference !== '' && !hash_equals((string)($capturedIntent['payment_reference'] ?? ''), $paymentReference)) {
                jsonResponse(['success' => false, 'message' => 'Payment intent and payment reference do not match.'], 400);
            }
            $intentMethod = strtoupper((string)($capturedIntent['payment_method'] ?? ''));
            $methodMatches = $intentMethod === $paymentMethod || ($intentMethod === 'GPAY' && $paymentMethod === 'UPI');
            if (!$methodMatches || $capturedIntent['status'] !== 'CAPTURED' || round((float)$capturedIntent['amount'], 2) !== round((float)$amount, 2) || strtoupper((string)$capturedIntent['currency']) !== strtoupper((string)$currency)) {
                jsonResponse(['success' => false, 'message' => 'The captured payment does not match this order method, amount, or currency.'], 400);
            }
            $paymentReference = (string)$capturedIntent['payment_reference'];
            $paymentStatus = 'CAPTURED';
        }
    }

    // Save as birth profile if requested or if user has no birth profile yet
    $bpTarget = $inputPayload;
    if (!empty($inputPayload['bride']) && is_array($inputPayload['bride'])) {
        $bpTarget = ($user['gender'] ?? 'M') === 'F' ? $inputPayload['bride'] : ($inputPayload['groom'] ?? $inputPayload['bride']);
    }
    if (($saveAsProfile || true) && !empty($bpTarget['dob']) && !empty($bpTarget['birthPlace'])) {
        $bpCheck = $pdo->prepare("SELECT id FROM birth_profiles WHERE user_id = ? LIMIT 1");
        $bpCheck->execute([$user['id']]);
        $hasExistingBp = (bool)$bpCheck->fetch();

        if ($saveAsProfile || !$hasExistingBp) {
            if ($hasExistingBp) {
                $bpUpd = $pdo->prepare("UPDATE birth_profiles SET name=?, dob=?, tob=?, birth_place=?, country=?, latitude=?, longitude=?, timezone_offset_hours=?, gender=?, updated_at=NOW() WHERE user_id=?");
                $bpUpd->execute([
                    $bpTarget['name'] ?? $user['name'],
                    $bpTarget['dob'],
                    $bpTarget['tob'],
                    $bpTarget['birthPlace'],
                    $bpTarget['country'] ?? '',
                    (float) $bpTarget['latitude'],
                    (float) $bpTarget['longitude'],
                    (float) $bpTarget['timezoneOffsetHours'],
                    $bpTarget['gender'] ?? 'M',
                    $user['id']
                ]);
            } else {
                $bpIns = $pdo->prepare("INSERT INTO birth_profiles (id, user_id, name, dob, tob, birth_place, country, latitude, longitude, timezone_offset_hours, gender, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
                $bpIns->execute([
                    'bp_' . uniqid('', true),
                    $user['id'],
                    $bpTarget['name'] ?? $user['name'],
                    $bpTarget['dob'],
                    $bpTarget['tob'],
                    $bpTarget['birthPlace'],
                    $bpTarget['country'] ?? '',
                    (float) $bpTarget['latitude'],
                    (float) $bpTarget['longitude'],
                    (float) $bpTarget['timezoneOffsetHours'],
                    $bpTarget['gender'] ?? 'M'
                ]);
            }
        }
    }

    $orderId = 'ord_' . uniqid('', true);
    $orderNumber = 'ORD-' . strtoupper(substr(uniqid(), -6));

    // Pre-calculate Vedic astrological result
    $calculatedResult = null;
    if ($serviceType === 'MARRIAGE_COMPATIBILITY') {
        $calculatedResult = AstroEngine::calculateMatchmaking($inputPayload);
    } elseif ($serviceType === 'BABY_NAMING') {
        $calculatedResult = AstroEngine::calculateBabyNaming($inputPayload);
    } elseif ($serviceType === 'MUHURTHAM') {
        $calculatedResult = AstroEngine::calculateMuhurtham($inputPayload);
    } else {
        $calculatedResult = AstroEngine::calculateHoroscope($inputPayload);
    }

    // Existing shared-hosting installations may predate the payment columns.
    foreach ([
        "ALTER TABLE orders ADD COLUMN payment_intent_id VARCHAR(80) NULL",
        "ALTER TABLE orders ADD COLUMN payment_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_ADMIN'"
    ] as $migration) { try { $pdo->exec($migration); } catch (Exception $e) {} }

    // Reserve the free slot and create the order in one InnoDB transaction.
    $betaClaimTransactionStarted = false;
    if ($isFreeOrder && !$isAdmin) {
        try {
            $pdo->beginTransaction();
            $betaClaim = $pdo->prepare("INSERT IGNORE INTO beta_ip_claims (ip_address, claimed_at) VALUES (?, NOW())");
            $betaClaim->execute([$clientIp]);
            if ($betaClaim->rowCount() !== 1) {
                $pdo->rollBack();
                jsonResponse(['success' => false, 'message' => 'The Free Beta report was claimed by another request. Refresh checkout and submit again.'], 409);
            }
            $betaClaimTransactionStarted = true;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('ASTRO SIVAM: could not reserve Free Beta claim.');
            jsonResponse(['success' => false, 'message' => 'Free Beta availability could not be confirmed. Please retry shortly.'], 503);
        }
    }

    $ins = $pdo->prepare("INSERT INTO orders (id, order_number, user_id, user_name, user_email, user_mobile, country, service_type, language, amount, currency, service_mode, status, payment_method, payment_reference, payment_intent_id, payment_status, payment_confirmed, email_status, input_payload, calculated_result, has_pdf, has_invoice, ip_address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, 'PENDING', ?, ?, 1, 1, ?, NOW(), NOW())");
    $ins->execute([
        $orderId,
        $orderNumber,
        $user['id'],
        $user['name'],
        $user['email'],
        $user['mobile'],
        $country,
        $serviceType,
        $language,
        $amount,
        $currency,
        $effectiveServiceMode,
        $paymentMethod,
        $paymentReference !== '' ? $paymentReference : null,
        $capturedIntent['id'] ?? null,
        $paymentStatus,
        $capturedIntent ? 1 : 0,
        json_encode($inputPayload, JSON_UNESCAPED_UNICODE),
        json_encode($calculatedResult, JSON_UNESCAPED_UNICODE),
        $clientIp
    ]);

    if ($capturedIntent) {
        $consume = $pdo->prepare("UPDATE payment_intents SET status = 'CONSUMED', order_id = ?, updated_at = NOW() WHERE id = ? AND user_id = ? AND status = 'CAPTURED' AND amount = ? AND currency = ? AND order_id IS NULL");
        $consume->execute([$orderId, $capturedIntent['id'], $user['id'], $amount, $currency]);
        if ($consume->rowCount() !== 1) {
            $pdo->prepare("UPDATE orders SET status = 'REJECTED', admin_notes = ?, updated_at = NOW() WHERE id = ?")->execute(['Payment intent could not be consumed safely.', $orderId]);
            jsonResponse(['success' => false, 'message' => 'Payment could not be bound to this order. No report will be delivered.'], 409);
        }
    }

    // Record in beta_ip_orders table — ONLY for the one free report this IP
    // is entitled to during the Free Beta. Paid orders never consume it.
    if ($isFreeOrder) {
        if (!$isAdmin) {
            try {
                $insBeta = $pdo->prepare("INSERT INTO beta_ip_orders (ip_address, order_id, order_number, user_id, user_email, service_type, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
                $insBeta->execute([
                    $clientIp,
                    $orderId,
                    $orderNumber,
                    $user['id'],
                    $user['email'],
                    $serviceType
                ]);
            } catch (Exception $e) {
                // The unique claim ledger is authoritative; legacy history is best effort.
            }
        }
    }

    if ($betaClaimTransactionStarted && $pdo->inTransaction()) {
        $pdo->commit();
    }

    logAudit($pdo, $user['id'], $user['name'], $user['role'], 'ORDER_PLACED', "Order #{$orderNumber} placed ({$serviceType}, {$effectiveServiceMode}" . ($isAdmin ? " — admin no-charge report" : ($isFreeOrder ? " — free beta report of this IP" : "")) . ") from IP: {$clientIp}");

    $order = [
        'id' => $orderId,
        'orderNumber' => $orderNumber,
        'userId' => $user['id'],
        'userName' => $user['name'],
        'userEmail' => $user['email'],
        'userMobile' => $user['mobile'],
        'country' => $country,
        'serviceType' => $serviceType,
        'language' => $language,
        'amount' => $amount,
        'currency' => $currency,
        'serviceMode' => $effectiveServiceMode,
        'status' => 'PENDING',
        'paymentMethod' => $paymentMethod,
        'paymentReference' => $paymentReference !== '' ? $paymentReference : null,
        'paymentIntentId' => $capturedIntent['id'] ?? null,
        'paymentStatus' => $paymentStatus,
        'paymentConfirmed' => (bool)$capturedIntent,
        'emailStatus' => 'PENDING',
        'hasPdf' => false,
        'hasInvoice' => false,
        'createdAt' => date('Y-m-d H:i:s')
    ];

    // Best-effort WhatsApp/Viber order-confirmation alert (never blocks checkout).
    AstroChatAlerts::sendOrderAlerts($pdo, 'order_confirmed', [$order]);

    jsonResponse([
        'success' => true,
        'message' => $isAdmin
            ? 'Admin order placed at no charge. It is pending Admin verification and approval.'
            : ($isFreeOrder
                ? 'Order placed successfully in FREE BETA! Your first report is free (1 free report per customer during the Free Beta). It is pending Admin verification and approval.'
                : 'Paid order placed! Once payment is verified by Admin, your report and PDF certificate will be generated and emailed.'),
        'order' => $order
    ], 201);
}

// 6. GET /api/services/my-orders
if ((strpos($path, 'services/my-orders') !== false || $action === 'my-orders' || $action === 'myOrders') && $method === 'GET') {
    $user = requireAuth($pdo);
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC");
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();

    $orders = array_map(function($r) {
        return [
            'id' => $r['id'],
            'orderNumber' => $r['order_number'],
            'groupId' => $r['group_id'] ?? ($r['input_payload'] ? (json_decode($r['input_payload'], true)['groupId'] ?? null) : null),
            'userId' => $r['user_id'],
            'userName' => $r['user_name'],
            'userEmail' => $r['user_email'],
            'userMobile' => $r['user_mobile'],
            'country' => $r['country'],
            'serviceType' => $r['service_type'],
            'language' => astro_normalize_report_language($r['language'] ?? 'en'),
            'amount' => floatval($r['amount']),
            'currency' => $r['currency'],
            'serviceMode' => $r['service_mode'],
            'status' => $r['status'],
            'paymentMethod' => $r['payment_method'],
            'paymentReference' => $r['payment_reference'],
            'paymentConfirmed' => (bool)$r['payment_confirmed'],
            'emailStatus' => $r['email_status'],
            'emailSentAt' => $r['email_sent_at'],
            'inputPayload' => json_decode($r['input_payload'], true) ?: [],
            'calculatedResult' => json_decode($r['calculated_result'], true) ?: null,
            'hasPdf' => (bool)$r['has_pdf'],
            'hasInvoice' => (bool)$r['has_invoice'],
            'adminNotes' => $r['admin_notes'],
            'refundStatus' => $r['refund_status'],
            'createdAt' => $r['created_at'],
            'updated_at' => $r['updated_at']
        ];
    }, $rows);

    jsonResponse(['success' => true, 'orders' => $orders]);
}

// 7. (Removed) Customer-facing GET /api/services/orders/:id/pdf & invoice-pdf endpoint.
// Report/invoice PDFs are only generated server-side when emailing the customer
// (see the resend-email / order-approval flow) and are never served directly over HTTP
// to the customer-facing app. Do not re-add a public route that streams these PDFs.

// 7b. POST /api/services/export-preview-pdf (Direct instant export of calculated preview results to official PDF via mPDF)
if ((strpos($path, 'services/export-preview-pdf') !== false || $action === 'export-preview-pdf') && $method === 'POST') {
    $body = getJsonBody();
    $serviceType = $body['serviceType'] ?? 'BIRTH_JATHAGAM';
    $result = $body['result'] ?? [];
    $lang = astro_normalize_report_language($body['language'] ?? 'en');

    if (empty($result)) {
        jsonResponse(['success' => false, 'message' => 'Result payload is required.'], 400);
    }

    $dateStr = date('d M Y');
    $fakeOrder = [
        'service_type' => $serviceType,
        'language' => $lang,
        'order_number' => 'PREVIEW-' . strtoupper(substr(md5(uniqid()), 0, 6)),
        'user_name' => $result['nativeName'] ?? ($result['devoteeName'] ?? ($body['inputPayload']['name'] ?? 'Valued User')),
        'currency' => 'FJD',
        'amount' => 0,
        'input_payload' => $body['inputPayload'] ?? ($result['inputPayload'] ?? [])
    ];

    try {
        if ($serviceType === 'MARRIAGE_COMPATIBILITY') {
            $pdfContent = AstroEngine::generateReportPdf($fakeOrder, $result);
            $filename = "ASTRO_SIVAM_Matchmaking_Preview_{$lang}.pdf";
        } elseif ($serviceType === 'BABY_NAMING') {
            $pdfContent = AstroEngine::generateReportPdf($fakeOrder, $result);
            $filename = "ASTRO_SIVAM_BabyNaming_Preview_{$lang}.pdf";
        } elseif ($serviceType === 'MUHURTHAM') {
            $pdfContent = AstroEngine::generateReportPdf($fakeOrder, $result);
            $filename = "ASTRO_SIVAM_Muhurtham_Preview_{$lang}.pdf";
        } else {
            $pdfContent = AstroEngine::generateReportPdf($fakeOrder, $result);
            $filename = "ASTRO_SIVAM_Jathagam_3Page_Report_{$lang}.pdf";
        }
    } catch (\Throwable $e) {
        // AstroEngine wraps renderer exceptions; retain the actual font/layout
        // failure in server logs without exposing it or the result payload.
        $cause = $e;
        while ($cause->getPrevious() !== null) {
            $cause = $cause->getPrevious();
        }
        error_log('Preview PDF generation failed [' . $lang . ']; no fallback PDF was produced: ' . $cause->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'High-quality PDF generation is unavailable right now. No lower-quality PDF was produced; please retry later.'
        ], 503);
    }

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($pdfContent));
    echo $pdfContent;
    exit;
}

// 8. POST /api/services/contact
if ((strpos($path, 'services/contact') !== false || $action === 'contact') && $method === 'POST') {
    astro_enforce_contact_rate_limit($pdo);
    $body = getJsonBody();
    $name = is_string($body['name'] ?? null) ? trim($body['name']) : '';
    $email = is_string($body['email'] ?? null) ? trim($body['email']) : '';
    $mobile = is_string($body['mobile'] ?? null) ? trim($body['mobile']) : '';
    $subject = is_string($body['subject'] ?? null) ? trim($body['subject']) : 'Website Inquiry';
    $message = is_string($body['message'] ?? null) ? trim($body['message']) : '';

    if ($name === '' || $email === '' || $message === '') {
        jsonResponse(['success' => false, 'message' => 'Name, email, and message are required.'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'message' => 'Please provide a valid email address.'], 400);
    }
    if (strlen($name) > 160 || strlen($email) > 254 || strlen($mobile) > 64 || strlen($subject) > 200 || strlen($message) > 10000) {
        jsonResponse(['success' => false, 'message' => 'One or more fields exceed the supported length.'], 400);
    }

    $id = 'msg_' . uniqid('', true);
    $stmt = $pdo->prepare("INSERT INTO contact_messages (id, name, email, mobile, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'UNREAD', NOW())");
    $stmt->execute([$id, $name, $email, $mobile, $subject, $message]);

    // Deliver the inquiry to the administrator mailbox as well as storing it in
    // the Admin Inbox. The message is already persisted, so a transport failure
    // never loses the customer's enquiry; it is reported truthfully instead.
    $emailDispatched = false;
    $emailRecipient = '';
    $emailMessage = '';
    try {
        $settingsStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
        $settingsRow = $settingsStmt->fetch();
        $emailSettings = $settingsRow ? (json_decode($settingsRow['email_settings'] ?? '{}', true) ?: []) : [];
        $generalSettings = $settingsRow ? (json_decode($settingsRow['general_settings'] ?? '{}', true) ?: []) : [];

        $emailRecipient = astro_resolve_contact_recipient(
            getenv('CONTACT_INQUIRY_TO'),
            $emailSettings['adminNotificationEmail'] ?? '',
            $generalSettings['contactEmail'] ?? '',
            defined('ADMIN_EMAIL') ? ADMIN_EMAIL : ''
        );

        // Reply-To is the visitor so the admin can answer the inquiry directly.
        $inquiryMailConfig = array_merge($emailSettings, ['replyToEmail' => $email]);
        $inquiryHtml = "<div style='font-family:Georgia,serif;background:#f4ede1;padding:20px;'>"
            . "<div style='max-width:600px;margin:0 auto;background:#fffdf9;border:1px solid #e8d9b8;border-radius:10px;overflow:hidden;'>"
            . "<div style='background:#7a1f1f;padding:16px 22px;color:#ffffff;font-size:19px;font-weight:700;'>ASTRO SIVAM &mdash; Website Inquiry</div>"
            . "<div style='padding:20px 22px;color:#3d3222;font-size:13.5px;line-height:1.7;'>"
            . "<p style='margin:0 0 10px;'><strong>Name:</strong> " . htmlspecialchars($name) . "</p>"
            . "<p style='margin:0 0 10px;'><strong>Email:</strong> " . htmlspecialchars($email) . "</p>"
            . ($mobile !== '' ? "<p style='margin:0 0 10px;'><strong>Mobile:</strong> " . htmlspecialchars($mobile) . "</p>" : '')
            . "<p style='margin:0 0 10px;'><strong>Subject:</strong> " . htmlspecialchars($subject) . "</p>"
            . "<p style='margin:0 0 6px;'><strong>Message:</strong></p>"
            . "<div style='white-space:pre-wrap;background:#ffffff;border:1px solid #e8d9b8;border-radius:6px;padding:12px 14px;'>" . nl2br(htmlspecialchars($message)) . "</div>"
            . "<p style='margin:14px 0 0;color:#8a7a55;font-size:12px;'>Saved in the Admin Inbox as <code>" . htmlspecialchars($id) . "</code> at " . date('Y-m-d H:i:s') . ".</p>"
            . "</div></div></div>";

        if ($emailRecipient === '') {
            $emailMessage = 'No valid contact notification address is configured; the inquiry is stored in the Admin Inbox only.';
            error_log('ASTRO SIVAM contact inquiry email skipped: ' . $emailMessage);
        } else {
            $mailResult = AstroMailer::sendEmailWithAttachments(
                $emailRecipient,
                'ASTRO SIVAM Admin',
                '[ASTRO SIVAM Contact] ' . ($subject !== '' ? $subject : 'Website Inquiry'),
                $inquiryHtml,
                [],
                $inquiryMailConfig,
                astro_inline_logo_attachment()
            );
            $emailDispatched = !empty($mailResult['success']);
            $emailMessage = (string)($mailResult['message'] ?? '');
            if (!$emailDispatched) {
                error_log('ASTRO SIVAM contact inquiry email failed: ' . $emailMessage);
            }
        }

        // Record the delivery outcome for the Admin Inbox listing (best effort).
        try {
            static $contactEmailColumnsReady = false;
            if (!$contactEmailColumnsReady) {
                foreach ([
                    "ALTER TABLE contact_messages ADD COLUMN email_status VARCHAR(16) NOT NULL DEFAULT 'PENDING'",
                    "ALTER TABLE contact_messages ADD COLUMN email_recipient VARCHAR(191) NULL",
                    "ALTER TABLE contact_messages ADD COLUMN email_dispatched_at DATETIME NULL",
                    "ALTER TABLE contact_messages ADD COLUMN email_last_status_message VARCHAR(255) NULL"
                ] as $contactMigration) {
                    try { $pdo->exec($contactMigration); } catch (Exception $e) {}
                }
                $contactEmailColumnsReady = true;
            }
            $pdo->prepare("UPDATE contact_messages SET email_status = ?, email_recipient = ?, email_dispatched_at = ?, email_last_status_message = ? WHERE id = ?")
                ->execute([
                    $emailDispatched ? 'SENT' : 'FAILED',
                    $emailRecipient !== '' ? $emailRecipient : null,
                    $emailDispatched ? date('Y-m-d H:i:s') : null,
                    $emailMessage !== '' ? substr($emailMessage, 0, 255) : null,
                    $id
                ]);
        } catch (Throwable $persistError) {
            error_log('ASTRO SIVAM contact email status could not be stored: ' . $persistError->getMessage());
        }
    } catch (Throwable $mailError) {
        error_log('ASTRO SIVAM contact inquiry email could not be attempted: ' . $mailError->getMessage());
    }

    jsonResponse([
        'success' => true,
        'emailDispatched' => $emailDispatched,
        'message' => $emailDispatched
            ? 'Your message was saved and accepted by our administrator email system. Final inbox delivery is handled by the mail provider.'
            : 'Your message was safely saved in the ASTRO SIVAM admin inbox. Email notification is unavailable right now, but our team can review it in the portal.',
        'messageId' => $id
    ]);
}

jsonResponse(['success' => false, 'message' => 'Services endpoint not found'], 404);
