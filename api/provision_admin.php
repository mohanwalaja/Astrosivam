<?php
/**
 * One-time CLI-only administrator provisioning for the PHP/MySQL deployment.
 * Never invoke this through a web request: the guard intentionally returns 404.
 * Required environment: ASTROSIVAM_ADMIN_EMAIL, ASTROSIVAM_ADMIN_NAME,
 * ASTROSIVAM_ADMIN_PASSWORD, plus DB_* and APP_SECRET_KEY as configured by the host.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$_SERVER['REQUEST_METHOD'] = 'GET';
require_once __DIR__ . '/db.php';

$email = strtolower(trim((string)getenv('ASTROSIVAM_ADMIN_EMAIL')));
$name = trim((string)getenv('ASTROSIVAM_ADMIN_NAME'));
$password = (string)getenv('ASTROSIVAM_ADMIN_PASSWORD');
$promoteExisting = in_array('--promote-existing', $argv ?? [], true);

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $name === '' || strlen($password) < 12 || strlen($password) > 72) {
    fwrite(STDERR, "Set valid ASTROSIVAM_ADMIN_EMAIL, ASTROSIVAM_ADMIN_NAME, and a 12–72 byte ASTROSIVAM_ADMIN_PASSWORD.\n");
    exit(2);
}

try {
    $pdo = getDbConnection();
    $pdo->beginTransaction();
    $find = $pdo->prepare('SELECT id, role FROM users WHERE email = ? LIMIT 1');
    $find->execute([$email]);
    $existing = $find->fetch();
    if ($existing && !$promoteExisting) {
        throw new RuntimeException('An account with this email already exists. Re-run with --promote-existing only after verifying ownership.');
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    if (!$passwordHash) {
        throw new RuntimeException('Could not hash the administrator password.');
    }

    if ($existing) {
        $update = $pdo->prepare("UPDATE users SET name = ?, password_hash = ?, role = 'admin', email_verified = 1, otp_hash = NULL, otp_expires_at = NULL, updated_at = NOW() WHERE id = ?");
        $update->execute([$name, $passwordHash, $existing['id']]);
        $userId = $existing['id'];
    } else {
        $userId = 'usr_admin_' . bin2hex(random_bytes(12));
        $insert = $pdo->prepare("INSERT INTO users (id, name, email, mobile, password_hash, role, email_verified, country, created_at, updated_at) VALUES (?, ?, ?, '', ?, 'admin', 1, 'Fiji', NOW(), NOW())");
        $insert->execute([$userId, $name, $email, $passwordHash]);
    }
    $pdo->commit();

    logAudit($pdo, $userId, $name, 'admin', 'ADMIN_ACCOUNT_PROVISIONED', 'Administrator access explicitly provisioned from the server CLI.');
    fwrite(STDOUT, "Administrator account provisioned for {$email}. The password was not displayed.\n");
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, ($error->getMessage() ?: 'Administrator provisioning failed.') . "\n");
    exit(1);
}
