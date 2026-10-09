<?php
/**
 * ASTRO SIVAM - Auth API Router (PHP Sessions + Bearer Tokens)
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../astrology/engine.php';
require_once __DIR__ . '/../mailer.php';
require_once __DIR__ . '/../rate_limit.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$body = getJsonBody();
$action = strtolower(trim($_GET['action'] ?? $body['action'] ?? ''));

// Match sub-routes: admin-login, login, register, me, logout
$isAdminLoginRoute = strpos($path, 'admin-login') !== false 
    || strpos($path, 'admin/login') !== false 
    || $action === 'admin-login'
    || (isset($body['isAdmin']) && $body['isAdmin'] === true);

$isFacebookRoute = strpos($path, 'facebook') !== false || $action === 'facebook' || $action === 'facebook-login';
$isGoogleRoute = strpos($path, 'google') !== false || $action === 'google' || $action === 'google-login';
$isRegisterRoute = ($strposRegister = strpos($path, 'register')) !== false && strpos($path, 'verify') === false && strpos($path, 'resend') === false
    || $action === 'register';
$isVerifyOtpRoute = strpos($path, 'verify-register-otp') !== false || strpos($path, 'verify-otp') !== false
    || $action === 'verify-register-otp' || $action === 'verify-otp';
$isResendOtpRoute = strpos($path, 'resend-register-otp') !== false || strpos($path, 'resend-otp') !== false
    || $action === 'resend-register-otp' || $action === 'resend-otp';
$isMeRoute = strpos($path, 'me') !== false || $action === 'me';
$isLogoutRoute = strpos($path, 'logout') !== false || $action === 'logout';

/** Fetches saved SMTP/email settings for use with AstroMailer. */
function getEmailSettingsForAuth($pdo) {
    try {
        $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
        $sRow = $sStmt->fetch();
        return $sRow ? json_decode($sRow['email_settings'], true) : [];
    } catch (Exception $e) {
        return [];
    }
}

/** Sends the registration OTP email in the temple brand style. */
function sendRegistrationOtpEmail($pdo, $toEmail, $toName, $otp) {
    $logoTag = function_exists('astro_email_logo_tag') ? astro_email_logo_tag(52) : '';
    $safeToName = htmlspecialchars((string)$toName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeOtp = preg_replace('/\\D/', '', (string)$otp);
    $html = "<div style='font-family:Arial,sans-serif; max-width:520px; margin:0 auto;'>
      <div style='background:#7a1f1f; color:#fff; text-align:center; padding:20px;'>
        {$logoTag}
        <div style='font-size:18px; font-weight:bold;'>ASTRO SIVAM</div>
        <div style='font-size:12px; margin-top:4px;'>Verify Your Email Address</div>
      </div>
      <div style='background:#fdf6e7; padding:24px; text-align:center;'>
        <p style='color:#333; font-size:13px;'>Namaste {$safeToName},</p>
        <p style='color:#333; font-size:13px;'>Use the code below to complete your ASTRO SIVAM account registration:</p>
        <div style='font-size:32px; font-weight:bold; letter-spacing:8px; color:#7a1f1f; background:#fff; border:2px solid #d97706; border-radius:8px; padding:14px; margin:16px 0; display:inline-block;'>{$safeOtp}</div>
        <p style='color:#666; font-size:12px;'>This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
      <div style='background:#faf3e3; border-top:1px solid #e8d9b8; padding:14px; text-align:center;'>
        <div style='color:#7a1f1f; font-weight:700; font-size:12px;'>ASTRO SIVAM Team</div>
        <div style='color:#a67c1f; font-size:10.5px; margin-top:2px;'>astrosivam.com &bull; admin@astrosivam.com</div>
      </div>
    </div>";

    $emailSettings = getEmailSettingsForAuth($pdo);
    return AstroMailer::sendEmailWithAttachments(
        $toEmail,
        $toName,
        'ASTRO SIVAM: Your Email Verification Code',
        $html,
        [],
        $emailSettings
    );
}

/** Adds immutable provider subjects so social sign-in never links by email alone. */
function astro_ensure_social_identity_columns($pdo) {
    static $ready = false;
    if ($ready) return;
    foreach ([
        "ALTER TABLE users ADD COLUMN auth_provider VARCHAR(32) NOT NULL DEFAULT 'local' AFTER role",
        "ALTER TABLE users ADD COLUMN provider_subject VARCHAR(191) NULL AFTER auth_provider",
        "ALTER TABLE users ADD UNIQUE KEY uq_users_provider_subject (auth_provider, provider_subject)"
    ] as $migration) {
        try { $pdo->exec($migration); } catch (Exception $e) {}
    }
    $ready = true;
}

if ($isFacebookRoute) {
    if ($method !== 'POST') {
        jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
    }

    // H1: failed-credential budget (per endpoint, per IP, site-wide).
    $facebookClientIp = getClientIpAddress();
    astro_auth_failure_enforce($pdo, $facebookClientIp, 'facebook-login');

    $clientAccessToken = trim($body['accessToken'] ?? '');
    $facebookGeneral = [];
    try {
        $facebookSettingsRow = $pdo->query("SELECT general_settings FROM system_settings ORDER BY id ASC LIMIT 1")->fetch();
        $facebookGeneral = $facebookSettingsRow ? (json_decode($facebookSettingsRow['general_settings'] ?? '{}', true) ?: []) : [];
    } catch (Exception $e) {
        $facebookGeneral = [];
    }
    $facebookEnabled = $facebookGeneral['facebookLoginEnabled'] ?? true;
    if ($facebookEnabled === false || $facebookEnabled === 0 || $facebookEnabled === '0' || strtolower((string)$facebookEnabled) === 'false') {
        jsonResponse(['success' => false, 'message' => 'Facebook sign-in is currently disabled.'], 403);
    }
    $facebookAppId = trim((string)(getenv('FACEBOOK_APP_ID') ?: ($facebookGeneral['facebookAppId'] ?? '')));
    $facebookAppSecret = trim((string)(getenv('FACEBOOK_APP_SECRET') ?: ($facebookGeneral['facebookAppSecret'] ?? '')));
    if (strpos($facebookAppSecret, '•') !== false || stripos($facebookAppSecret, 'change-me') !== false) $facebookAppSecret = '';
    $fbVerified = verifyFacebookLogin($clientAccessToken, $facebookAppId, $facebookAppSecret);

    // SECURITY: no client-trust fallback. The identity MUST come from the
    // Facebook Graph API verification above. (The previous fallback accepted
    // client-supplied id/email, allowing login as any account.)
    if (!$fbVerified) {
        astro_auth_failure_record($pdo, $facebookClientIp, 'facebook-login');
        jsonResponse(['success' => false, 'message' => 'Could not verify Facebook login. Please try again.'], 401);
    }

    $fbId = trim((string)($fbVerified['id'] ?? ''));
    if ($fbId === '') {
        astro_auth_failure_record($pdo, $facebookClientIp, 'facebook-login');
        jsonResponse(['success' => false, 'message' => 'Facebook did not provide a stable verified account identifier.'], 401);
    }
    $email = strtolower(trim((string)($fbVerified['email'] ?? '')));
    if ($email === '') {
        $email = "fb_{$fbId}@astrosivam.user";
    }
    // Plain name only — provider tags like "(Facebook)" are stripped, and a
    // missing provider name falls back to the e-mail local part.
    $name = cleanDisplayName($fbVerified['name']);
    if ($name === '') {
        $name = providerFallbackName($email);
    }

    try {
        astro_ensure_social_identity_columns($pdo);
        $subjectStmt = $pdo->prepare("SELECT * FROM users WHERE auth_provider = 'facebook' AND provider_subject = ? LIMIT 1");
        $subjectStmt->execute([$fbId]);
        $user = $subjectStmt->fetch();

        $emailStmt = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
        $emailStmt->execute([$email]);
        $emailAccount = $emailStmt->fetch();

        if ($user && $emailAccount && $emailAccount['id'] !== $user['id']) {
            jsonResponse(['success' => false, 'message' => 'This Facebook identity conflicts with an existing account. Automatic account linking is disabled; sign in using the existing account.'], 409);
        }
        if (!$user && $emailAccount) {
            if (strtolower(trim($emailAccount['role'] ?? 'customer')) === 'admin') {
                jsonResponse(['success' => false, 'message' => 'Administrator accounts must use the dedicated admin sign-in.'], 403);
            }
            jsonResponse(['success' => false, 'message' => 'This email already belongs to an account. Automatic social account linking is disabled; sign in using the existing account.'], 409);
        }

        if (!$user) {
            $id = 'usr_' . uniqid('', true);
            $hash = password_hash(bin2hex(random_bytes(32)), PASSWORD_BCRYPT);
            $ins = $pdo->prepare("INSERT INTO users (id, name, email, mobile, password_hash, role, auth_provider, provider_subject, email_verified, country, created_at, updated_at) VALUES (?, ?, ?, '', ?, 'customer', 'facebook', ?, 1, 'Fiji', NOW(), NOW())");
            $ins->execute([$id, $name, $email, $hash, $fbId]);

            // Provider login does not supply DOB/time/place; leave profile empty.
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([$id]);
            $user = $stmt->fetch();
        }

        if (strtolower(trim($user['role'] ?? 'customer')) === 'admin') {
            jsonResponse(['success' => false, 'message' => 'Administrator accounts must use the dedicated admin sign-in.'], 403);
        }

        // Regenerate the session identifier after authentication to prevent fixation.
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_role'] = $user['role'];
        $token = astro_issue_auth_token($user);

        $bpStmt = $pdo->prepare("SELECT * FROM birth_profiles WHERE user_id = ? LIMIT 1");
        $bpStmt->execute([$user['id']]);
        $bp = $bpStmt->fetch();

        // The name the devotee saved on the website always wins; the Facebook
        // account name only seeds brand-new accounts (resolved above).
        $displayName = resolveCustomerDisplayName($pdo, $user, $bp);

        jsonResponse([
            'success' => true,
            'message' => "Welcome, {$displayName}!",
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'name' => $displayName,
                'email' => $user['email'],
                'mobile' => $user['mobile'] ?? '',
                'role' => $user['role'],
                'country' => $user['country'] ?? 'Fiji'
            ],
            'birthProfile' => $bp ? [
                'userId' => $bp['user_id'],
                'name' => $displayName,
                'dob' => $bp['dob'],
                'tob' => $bp['tob'],
                'birthPlace' => $bp['birth_place'],
                'country' => $bp['country'],
                'latitude' => (float)$bp['latitude'],
                'longitude' => (float)$bp['longitude'],
                'timezoneOffsetHours' => (float)$bp['timezone_offset_hours'],
                'gender' => $bp['gender'],
                'updatedAt' => $bp['updated_at']
            ] : null
        ]);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'message' => 'Service temporarily unavailable. Please try again shortly.'], 503);
    }
}

if ($isGoogleRoute) {
    if ($method !== 'POST') {
        jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
    }

    // H1: failed-credential budget (per endpoint, per IP, site-wide).
    $googleClientIp = getClientIpAddress();
    astro_auth_failure_enforce($pdo, $googleClientIp, 'google-login');

    $credential = trim($body['credential'] ?? '');
    $clientAccessToken = trim($body['accessToken'] ?? '');
    $googleGeneral = [];
    try {
        $googleSettings = $pdo->query("SELECT general_settings FROM system_settings ORDER BY id ASC LIMIT 1")->fetch();
        $googleGeneral = $googleSettings ? (json_decode($googleSettings['general_settings'] ?? '{}', true) ?: []) : [];
    } catch (Exception $e) {
        $googleGeneral = [];
    }
    $googleEnabled = $googleGeneral['googleLoginEnabled'] ?? true;
    if ($googleEnabled === false || $googleEnabled === 0 || $googleEnabled === '0' || strtolower((string)$googleEnabled) === 'false') {
        jsonResponse(['success' => false, 'message' => 'Google sign-in is currently disabled.'], 403);
    }
    $expectedGoogleClientId = GOOGLE_CLIENT_ID !== ''
        ? GOOGLE_CLIENT_ID
        : trim((string)($googleGeneral['googleClientId'] ?? ''));
    $googleVerified = verifyGoogleLogin($credential, $clientAccessToken, $expectedGoogleClientId);

    // SECURITY: no client-trust fallback. The identity MUST come from Google's
    // tokeninfo/userinfo endpoints. (The previous fallback accepted
    // client-supplied sub/email, allowing login as any account.)
    if (!$googleVerified) {
        astro_auth_failure_record($pdo, $googleClientIp, 'google-login');
        jsonResponse(['success' => false, 'message' => 'Could not verify Google login. Please try again.'], 401);
    }

    $googleId = trim((string)($googleVerified['sub'] ?? ''));
    if ($googleId === '') {
        astro_auth_failure_record($pdo, $googleClientIp, 'google-login');
        jsonResponse(['success' => false, 'message' => 'Google did not provide a stable verified account identifier.'], 401);
    }
    $email = strtolower(trim((string)($googleVerified['email'] ?? '')));
    if ($email === '') {
        $email = "google_{$googleId}@astrosivam.user";
    }
    // Plain name only — provider tags like "(Google)" are stripped, and a
    // missing provider name falls back to the e-mail local part.
    $name = cleanDisplayName($googleVerified['name']);
    if ($name === '') {
        $name = providerFallbackName($email);
    }

    try {
        astro_ensure_social_identity_columns($pdo);
        $subjectStmt = $pdo->prepare("SELECT * FROM users WHERE auth_provider = 'google' AND provider_subject = ? LIMIT 1");
        $subjectStmt->execute([$googleId]);
        $user = $subjectStmt->fetch();

        $emailStmt = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
        $emailStmt->execute([$email]);
        $emailAccount = $emailStmt->fetch();

        if ($user && $emailAccount && $emailAccount['id'] !== $user['id']) {
            jsonResponse(['success' => false, 'message' => 'This Google identity conflicts with an existing account. Automatic account linking is disabled; sign in using the existing account.'], 409);
        }
        if (!$user && $emailAccount) {
            if (strtolower(trim($emailAccount['role'] ?? 'customer')) === 'admin') {
                jsonResponse(['success' => false, 'message' => 'Administrator accounts must use the dedicated admin sign-in.'], 403);
            }
            jsonResponse(['success' => false, 'message' => 'This email already belongs to an account. Automatic social account linking is disabled; sign in using the existing account.'], 409);
        }

        if (!$user) {
            $id = 'usr_' . uniqid('', true);
            $hash = password_hash(bin2hex(random_bytes(32)), PASSWORD_BCRYPT);
            $ins = $pdo->prepare("INSERT INTO users (id, name, email, mobile, password_hash, role, auth_provider, provider_subject, email_verified, country, created_at, updated_at) VALUES (?, ?, ?, '', ?, 'customer', 'google', ?, 1, 'Fiji', NOW(), NOW())");
            $ins->execute([$id, $name, $email, $hash, $googleId]);

            // Provider login does not supply DOB/time/place; leave profile empty.
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([$id]);
            $user = $stmt->fetch();
        }

        if (strtolower(trim($user['role'] ?? 'customer')) === 'admin') {
            jsonResponse(['success' => false, 'message' => 'Administrator accounts must use the dedicated admin sign-in.'], 403);
        }

        // Regenerate the session identifier after authentication to prevent fixation.
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_role'] = $user['role'];
        $token = astro_issue_auth_token($user);

        $bpStmt = $pdo->prepare("SELECT * FROM birth_profiles WHERE user_id = ? LIMIT 1");
        $bpStmt->execute([$user['id']]);
        $bp = $bpStmt->fetch();

        // The name the devotee saved on the website always wins; the Google
        // account name only seeds brand-new accounts (resolved above). It must
        // never overwrite the name the devotee chose in their website profile.
        $displayName = resolveCustomerDisplayName($pdo, $user, $bp);

        jsonResponse([
            'success' => true,
            'message' => "Welcome, {$displayName}!",
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'name' => $displayName,
                'email' => $user['email'],
                'mobile' => $user['mobile'] ?? '',
                'role' => $user['role'],
                'country' => $user['country'] ?? 'Fiji'
            ],
            'birthProfile' => $bp ? [
                'userId' => $bp['user_id'],
                'name' => $displayName,
                'dob' => $bp['dob'],
                'tob' => $bp['tob'],
                'birthPlace' => $bp['birth_place'],
                'country' => $bp['country'],
                'latitude' => (float)$bp['latitude'],
                'longitude' => (float)$bp['longitude'],
                'timezoneOffsetHours' => (float)$bp['timezone_offset_hours'],
                'gender' => $bp['gender'],
                'updatedAt' => $bp['updated_at']
            ] : null
        ]);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'message' => 'Service temporarily unavailable. Please try again shortly.'], 503);
    }
}

if ($isRegisterRoute) {
    if ($method !== 'POST') {
        jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
    }
    $name = trim($body['name'] ?? '');
    // Never store provider tags like "(Google)" as part of a person's name.
    $name = cleanDisplayName($name);
    $email = strtolower(trim($body['email'] ?? ''));
    $mobile = trim($body['mobile'] ?? '');
    $passwordInput = $body['password'] ?? '';
    $password = is_string($passwordInput) ? $passwordInput : '';
    $country = trim($body['country'] ?? 'Fiji');
    $birthProfile = $body['birthProfile'] ?? $body['initialBirthProfile'] ?? null;

    if (empty($name) || empty($email) || empty($mobile) || trim($password) === '') {
        jsonResponse(['success' => false, 'message' => 'Name, email, mobile, and password are required.'], 400);
    }
    if (strlen($password) < 6 || strlen($password) > 72) {
        jsonResponse(['success' => false, 'message' => 'Password must be 6 to 72 UTF-8 bytes long.'], 400);
    }
    if ($birthProfile !== null && $birthProfile !== [] && !is_array($birthProfile)) {
        jsonResponse(['success' => false, 'message' => 'Birth profile must contain complete, valid birth details.'], 400);
    }
    if (is_array($birthProfile) && count($birthProfile) > 0) {
        if (!AstroEngine::hasValidBirthDetails($birthProfile)) {
            jsonResponse(['success' => false, 'message' => 'Birth profile requires a valid past birth date, time, birthplace, coordinates and time zone.'], 400);
        }
        $birthProfile['tob'] = AstroEngine::normalizeBirthTime($birthProfile['tob']);
    }

    // 5 sign-ups per network in each 10-minute window.
    astro_rate_limit_enforce(
        $pdo,
        'register-ip',
        getClientIpAddress(),
        5,
        600,
        'Too many sign-up attempts from this network. Please wait a few minutes and try again.'
    );
    astro_rate_limit_enforce(
        $pdo,
        'register-email',
        $email,
        3,
        900,
        'Too many verification requests for this email. Please wait before trying again.'
    );

    try {
        // Check existing
        $stmt = $pdo->prepare("SELECT id, email_verified FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $existing = $stmt->fetch();
        if ($existing && (int)($existing['email_verified'] ?? 1) === 1) {
            jsonResponse(['success' => false, 'message' => 'An account with this email already exists. Please log in.'], 409);
        }

        $otp = generateOtp();
        $otpHash = hashOtp($otp, $email);
        $otpExpiresAt = date('Y-m-d H:i:s', time() + 600); // 10 minutes

        if ($existing) {
            // A previous registration attempt never finished verifying -
            // update it with a fresh OTP instead of creating a duplicate.
            $id = $existing['id'];
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $upd = $pdo->prepare("UPDATE users SET name = ?, mobile = ?, password_hash = ?, country = ?, otp_hash = ?, otp_expires_at = ? WHERE id = ?");
            $upd->execute([$name, $mobile, $hash, $country, $otpHash, $otpExpiresAt, $id]);
        } else {
            $id = 'usr_' . uniqid('', true);
            $hash = password_hash($password, PASSWORD_BCRYPT);

            $ins = $pdo->prepare("INSERT INTO users (id, name, email, mobile, password_hash, role, email_verified, otp_hash, otp_expires_at, country, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'customer', 0, ?, ?, ?, NOW(), NOW())");
            $ins->execute([$id, $name, $email, $mobile, $hash, $otpHash, $otpExpiresAt, $country]);
        }

        // Save/refresh the pending birth profile (only actually usable once verified)
        $savedBp = null;
        if (is_array($birthProfile) && count($birthProfile) > 0) {
            $bpCheck = $pdo->prepare("SELECT id FROM birth_profiles WHERE user_id = ? LIMIT 1");
            $bpCheck->execute([$id]);
            $bpExisting = $bpCheck->fetch();
            if ($bpExisting) {
                $bpUpd = $pdo->prepare("UPDATE birth_profiles SET name=?, dob=?, tob=?, birth_place=?, country=?, latitude=?, longitude=?, timezone_offset_hours=?, gender=?, updated_at=NOW() WHERE user_id=?");
                $bpUpd->execute([
                    $birthProfile['name'] ?? $name, $birthProfile['dob'], $birthProfile['tob'],
                    $birthProfile['birthPlace'], $birthProfile['country'] ?? '',
                    (float) $birthProfile['latitude'], (float) $birthProfile['longitude'],
                    (float) $birthProfile['timezoneOffsetHours'], $birthProfile['gender'] ?? 'M', $id
                ]);
            } else {
                $bpId = 'bp_' . uniqid('', true);
                $bpIns = $pdo->prepare("INSERT INTO birth_profiles (id, user_id, name, dob, tob, birth_place, country, latitude, longitude, timezone_offset_hours, gender, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
                $bpIns->execute([
                    $bpId, $id, $birthProfile['name'] ?? $name, $birthProfile['dob'], $birthProfile['tob'],
                    $birthProfile['birthPlace'], $birthProfile['country'] ?? '',
                    (float) $birthProfile['latitude'], (float) $birthProfile['longitude'],
                    (float) $birthProfile['timezoneOffsetHours'], $birthProfile['gender'] ?? 'M'
                ]);
            }
            $savedBp = $birthProfile;
        }

        $mailResult = sendRegistrationOtpEmail($pdo, $email, $name, $otp);
        logAudit($pdo, $id, $name, 'customer', 'USER_REGISTER_PENDING_OTP', "Registration started, awaiting OTP: {$email}");

        jsonResponse([
            'success' => true,
            'status' => 'otp_required',
            'requiresOtp' => true,
            'email' => $email,
            'message' => $mailResult['success']
                ? "We've sent a 6-digit verification code to {$email}. Enter it to activate your account."
                : "Your account was created, but the verification email could not be sent. Please use 'Resend Code' or contact support."
        ], 201);
    } catch (PDOException $e) {
        error_log("Database error during registration: " . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Database error during registration. Please try again later.'
        ], 500);
    }
} elseif ($isVerifyOtpRoute) {
    if ($method !== 'POST') {
        jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
    }
    $email = strtolower(trim($body['email'] ?? ''));
    $otp = trim($body['otp'] ?? '');

    if (empty($email) || empty($otp)) {
        jsonResponse(['success' => false, 'message' => 'Email and verification code are required.'], 400);
    }
    $otpClientIp = getClientIpAddress();
    // H1: failed-credential budget (per endpoint, per IP, site-wide).
    astro_auth_failure_enforce($pdo, $otpClientIp, 'otp-verify');
    astro_rate_limit_enforce(
        $pdo,
        'otp-verify-ip',
        $otpClientIp,
        10,
        900,
        'Too many email verification attempts from this network. Please try again later.'
    );
    astro_rate_limit_enforce(
        $pdo,
        'otp-verify-email',
        $email,
        5,
        900,
        'Too many email verification attempts for this address. Request a fresh code later.'
    );

    try {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            jsonResponse(['success' => false, 'message' => 'No pending registration found for this email.'], 404);
        }
        if ((int)($user['email_verified'] ?? 1) === 1) {
            jsonResponse(['success' => false, 'message' => 'This account is already verified. Please log in.'], 409);
        }
        if (empty($user['otp_expires_at']) || strtotime($user['otp_expires_at']) < time()) {
            jsonResponse(['success' => false, 'message' => 'This code has expired. Please request a new one.'], 410);
        }
        if (!verifyOtpHash($otp, $email, $user['otp_hash'] ?? '')) {
            astro_auth_failure_record($pdo, $otpClientIp, 'otp-verify');
            jsonResponse(['success' => false, 'message' => 'Incorrect verification code. Please try again.'], 401);
        }

        $upd = $pdo->prepare("UPDATE users SET email_verified = 1, otp_hash = NULL, otp_expires_at = NULL WHERE id = ?");
        $upd->execute([$user['id']]);

        // Regenerate the session identifier after authentication to prevent fixation.
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_role'] = $user['role'];
        $_SESSION['user_email'] = $user['email'];

        $token = astro_issue_auth_token($user);
        logAudit($pdo, $user['id'], $user['name'], $user['role'], 'USER_EMAIL_VERIFIED', "Email verified via OTP: {$email}");

        $bpStmt = $pdo->prepare("SELECT * FROM birth_profiles WHERE user_id = ? LIMIT 1");
        $bpStmt->execute([$user['id']]);
        $bp = $bpStmt->fetch();

        jsonResponse([
            'success' => true,
            'status' => 'success',
            'message' => "Welcome, {$user['name']}! Your account is now active.",
            'token' => $token,
            'user' => [
                'id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'],
                'mobile' => $user['mobile'] ?? '', 'role' => $user['role'], 'country' => $user['country'] ?? 'Fiji'
            ],
            'birthProfile' => $bp ? [
                'userId' => $bp['user_id'], 'name' => $bp['name'], 'dob' => $bp['dob'], 'tob' => $bp['tob'],
                'birthPlace' => $bp['birth_place'], 'country' => $bp['country'],
                'latitude' => (float)$bp['latitude'], 'longitude' => (float)$bp['longitude'],
                'timezoneOffsetHours' => (float)$bp['timezone_offset_hours'], 'gender' => $bp['gender'],
                'updatedAt' => $bp['updated_at']
            ] : null
        ]);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'message' => 'Service temporarily unavailable. Please try again shortly.'], 503);
    }
} elseif ($isResendOtpRoute) {
    if ($method !== 'POST') {
        jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
    }
    $email = strtolower(trim($body['email'] ?? ''));
    if (empty($email)) {
        jsonResponse(['success' => false, 'message' => 'Email is required.'], 400);
    }
    $resendClientIp = getClientIpAddress();
    astro_rate_limit_enforce(
        $pdo,
        'otp-resend-ip',
        $resendClientIp,
        5,
        3600,
        'Too many verification-code requests from this network. Please try again later.'
    );
    astro_rate_limit_enforce(
        $pdo,
        'otp-resend-email',
        $email,
        3,
        3600,
        'Too many verification-code requests for this address. Please try again later.'
    );

    try {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            jsonResponse(['success' => false, 'message' => 'No pending registration found for this email.'], 404);
        }
        if ((int)($user['email_verified'] ?? 1) === 1) {
            jsonResponse(['success' => false, 'message' => 'This account is already verified. Please log in.'], 409);
        }

        $otp = generateOtp();
        $otpHash = hashOtp($otp, $email);
        $otpExpiresAt = date('Y-m-d H:i:s', time() + 600);
        $upd = $pdo->prepare("UPDATE users SET otp_hash = ?, otp_expires_at = ? WHERE id = ?");
        $upd->execute([$otpHash, $otpExpiresAt, $user['id']]);

        $mailResult = sendRegistrationOtpEmail($pdo, $email, $user['name'], $otp);

        jsonResponse([
            'success' => (bool)$mailResult['success'],
            'message' => $mailResult['success']
                ? "A new verification code has been sent to {$email}."
                : 'Could not send the verification email right now. Please try again shortly.'
        ], $mailResult['success'] ? 200 : 503);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'message' => 'Service temporarily unavailable. Please try again shortly.'], 503);
    }
} elseif ($isMeRoute) {
    $user = requireAuth($pdo);
    $bpStmt = $pdo->prepare("SELECT * FROM birth_profiles WHERE user_id = ? LIMIT 1");
    $bpStmt->execute([$user['id']]);
    $birthProfile = $bpStmt->fetch();

    // Keep the shown name equal to the name saved in the website profile.
    $user['name'] = resolveCustomerDisplayName($pdo, $user, $birthProfile);
    if ($birthProfile) {
        $birthProfile['name'] = $user['name'];
    }

    jsonResponse([
        'success' => true,
        'user' => $user,
        'birthProfile' => $birthProfile ?: null
    ]);
} elseif ($isLogoutRoute) {
    // H3: drop the httpOnly auth cookie alongside the PHP session.
    astro_clear_auth_cookie();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $cookie = session_get_cookie_params();
        $expires = time() - 42000;
        if (PHP_VERSION_ID >= 70300) {
            setcookie(session_name(), '', [
                'expires' => $expires,
                'path' => $cookie['path'] ?? '/',
                'domain' => $cookie['domain'] ?? '',
                'secure' => (bool)($cookie['secure'] ?? false),
                'httponly' => true,
                'samesite' => $cookie['samesite'] ?? 'Lax'
            ]);
        } else {
            setcookie(session_name(), '', $expires, $cookie['path'] ?? '/', $cookie['domain'] ?? '', (bool)($cookie['secure'] ?? false), true);
        }
    }
    session_destroy();
    jsonResponse(['success' => true, 'message' => 'Logged out successfully']);
} else {
    // Default route: LOGIN (covers /api/login.php, /api/auth/login, etc.)
    if ($method !== 'POST') {
        jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
    }
    $email = strtolower(trim($body['email'] ?? ''));
    $passwordInput = $body['password'] ?? '';
    $password = is_string($passwordInput) ? $passwordInput : '';

    $isExplicitAdminLogin = $isAdminLoginRoute;

    if (empty($email) || trim($password) === '') {
        jsonResponse(['success' => false, 'message' => 'Email and password are required.'], 400);
    }

    // BRUTE-FORCE PROTECTION (H1): layered counters.
    //   1. Failed-credential budget: 10 failures per IP per endpoint, 20
    //      failures per IP across all auth endpoints and a site-wide global
    //      cap per 15 minutes. Different emails from one IP share these
    //      counters, so credential stuffing cannot walk unlimited accounts.
    //   2. 5 attempts per account+network and 25 per network per 15 minutes.
    //      A successful login clears the pair counter, so a normal user is
    //      never locked out by their own valid sign-ins.
    $loginClientIp = getClientIpAddress();
    $loginEndpoint = $isExplicitAdminLogin ? 'admin-login' : 'login';
    astro_auth_failure_enforce($pdo, $loginClientIp, $loginEndpoint);
    astro_rate_limit_enforce(
        $pdo,
        'login-pair',
        $loginClientIp . '|' . $email,
        5,
        900,
        'Too many login attempts for this account. Please wait 15 minutes before trying again.'
    );
    astro_rate_limit_enforce(
        $pdo,
        'login-ip',
        $loginClientIp,
        25,
        900,
        'Too many login attempts from this network. Please wait 15 minutes before trying again.'
    );

    try {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            // Unknown account: a real failed guess - count it against the
            // per-IP / per-endpoint / global credential-stuffing budgets (H1).
            astro_auth_failure_record($pdo, $loginClientIp, $loginEndpoint);
            jsonResponse(['success' => false, 'message' => 'Invalid email or password.'], 401);
        }

        $provider = strtolower(trim($user['auth_provider'] ?? 'local'));
        if ($provider !== '' && $provider !== 'local') {
            $providerLabel = $provider === 'google' ? 'Google Sign-In' : ($provider === 'facebook' ? 'Facebook Login' : $provider);
            jsonResponse(['success' => false, 'message' => 'This account was created with ' . $providerLabel . '. Please use ' . $providerLabel . ' to sign in.'], 401);
        }

        // SECURITY: only the account's real password hash is accepted.
        // (A previous version also accepted a fixed list of "standard"
        // passwords as a universal override for any admin/customer account -
        // that meant changing your real password never actually locked
        // anyone out. Removed entirely.)
        $isMatch = password_verify($password, $user['password_hash']);
        $userRole = strtolower(trim($user['role'] ?? 'customer'));

        if (!$isMatch) {
            astro_auth_failure_record($pdo, $loginClientIp, $loginEndpoint);
            jsonResponse(['success' => false, 'message' => 'Invalid email or password.'], 401);
        }

        // Valid credentials: release this account's lockout counter.
        astro_rate_limit_clear($pdo, 'login-pair', $loginClientIp . '|' . $email);

        // Every password-based account, including administrators, must have
        // a verified email before it can authenticate. An admin account is
        // created or promoted only by the trusted provisioning procedure.
        if ((int)($user['email_verified'] ?? 1) === 0) {
            jsonResponse([
                'success' => false,
                'status' => 'otp_required',
                'requiresOtp' => true,
                'email' => $user['email'],
                'message' => 'Please verify your email before logging in. Check your inbox for the verification code, or request a new one.'
            ], 403);
        }

        // Step 2: Enforce the persisted database role. Email addresses,
        // settings, and client flags never grant administrator privileges.
        if ($isExplicitAdminLogin && $userRole !== 'admin') {
            jsonResponse([
                'success' => false,
                'message' => 'Access Denied: This portal is strictly restricted to provisioned ASTRO SIVAM administrators.'
            ], 403);
        }

        // Set PHP Session
        // Regenerate the session identifier after authentication to prevent fixation.
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_role'] = $userRole;
        $_SESSION['user_email'] = $user['email'];

        // Update last login
        $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?")->execute([$user['id']]);
        $actionType = $isExplicitAdminLogin ? 'ADMIN_LOGIN' : 'CUSTOMER_LOGIN';
        logAudit($pdo, $user['id'], $user['name'], $userRole, $actionType, 'Logged in via ' . ($isExplicitAdminLogin ? 'Admin Portal' : 'Main Login'));

        $token = astro_issue_auth_token($user);

        // Fetch birth profile if exists
        $bpStmt = $pdo->prepare("SELECT * FROM birth_profiles WHERE user_id = ? LIMIT 1");
        $bpStmt->execute([$user['id']]);
        $birthProfile = $bpStmt->fetch();

        // Show the name saved in the website profile (never a stale/Google one).
        $displayName = $userRole === 'admin'
            ? cleanDisplayName($user['name'])
            : resolveCustomerDisplayName($pdo, $user, $birthProfile);
        if ($displayName === '') $displayName = providerFallbackName($user['email']);
        if ($birthProfile) $birthProfile['name'] = $displayName;

        jsonResponse([
            'success' => true,
            'status' => 'success',
            'role' => $userRole,
            'message' => $isExplicitAdminLogin ? "Admin authorization granted. Welcome, {$displayName}!" : "Welcome back, {$displayName}!",
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'name' => $displayName,
                'email' => $user['email'],
                'mobile' => $user['mobile'],
                'role' => $userRole,
                'country' => $user['country']
            ],
            'birthProfile' => $birthProfile ?: null
        ]);
    } catch (PDOException $e) {
        // Never echo driver/schema details back to an unauthenticated caller.
        error_log('ASTRO SIVAM: database error during authentication - ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'Service temporarily unavailable. Please try again shortly.'
        ], 503);
    }
}
