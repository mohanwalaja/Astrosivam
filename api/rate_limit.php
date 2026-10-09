<?php
/**
 * ASTRO SIVAM - shared fixed-window rate limiting for the PHP API.
 *
 * WHY THIS EXISTS: api/auth/index.php accepted unlimited password guesses
 * (a customer *and* an admin could be brute-forced), and registration, payment
 * session creation and the report generator were unlimited too. The Node
 * backend has had a shared limiter for a while; this is the cPanel/PHP
 * equivalent, so both deployments enforce the same policy.
 *
 * DESIGN
 *   - Fixed window counters in MySQL, keyed by an HMAC of the identifier, so no
 *     raw IP address or email is ever stored (and the table cannot be used to
 *     enumerate visitors).
 *   - The table is created on demand (shared hosting often cannot run
 *     migrations) and stale rows are pruned opportunistically.
 *   - Decisions live in astro_rate_limit_decision(), a pure function, so the
 *     security-relevant maths is unit-testable without a database.
 *   - A database failure is fail-CLOSED for the caller (503), matching
 *     astro_enforce_contact_rate_limit(): better to ask the client to retry than
 *     to leave a brute-force window open.
 */

require_once __DIR__ . '/config.php';

/**
 * Namespaced storage key. The identifier is hashed, never stored verbatim.
 *
 * @param string $bucket     e.g. 'login-ip', 'login-pair', 'register-ip'
 * @param string $identifier client IP, email, or "<ip>|<email>"
 */
function astro_rate_limit_key($bucket, $identifier) {
    $bucket = preg_replace('/[^a-z0-9:_-]/i', '', (string)$bucket);
    return substr($bucket, 0, 48) . ':' . hash_hmac('sha256', (string)$identifier, APP_SECRET_KEY);
}

/**
 * Pure fixed-window decision.
 *
 * @param int $hits            requests counted in the current window (including this one)
 * @param int $maxHits         allowed requests per window
 * @param int $windowStartedAt unix time the window opened
 * @param int $now             unix time now
 * @param int $windowSeconds   window length
 * @return array{allowed:bool,retryAfterSeconds:int}
 */
function astro_rate_limit_decision($hits, $maxHits, $windowStartedAt, $now, $windowSeconds) {
    $hits = (int)$hits;
    $maxHits = max(1, (int)$maxHits);
    $windowSeconds = max(1, (int)$windowSeconds);

    if ($hits <= 0) {
        // No counter row (cleared or never written): the request is allowed.
        return array('allowed' => true, 'retryAfterSeconds' => 0);
    }
    if ($hits <= $maxHits) {
        return array('allowed' => true, 'retryAfterSeconds' => 0);
    }
    $remaining = ((int)$windowStartedAt + $windowSeconds) - (int)$now;
    return array('allowed' => false, 'retryAfterSeconds' => max(1, $remaining));
}

/** Creates the counter table once per request. */
function astro_rate_limit_ensure_table($pdo) {
    static $ready = false;
    if ($ready) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS api_rate_limits (
        rate_key VARCHAR(128) NOT NULL PRIMARY KEY,
        window_started_at BIGINT UNSIGNED NOT NULL,
        hits INT UNSIGNED NOT NULL DEFAULT 0,
        INDEX idx_api_rate_window (window_started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $ready = true;
}

/**
 * Count one request against a bucket key and report whether it is still allowed.
 *
 * @return array{allowed:bool,retryAfterSeconds:int,hits:int}
 */
function astro_rate_limit_hit($pdo, $bucket, $identifier, $maxHits, $windowSeconds) {
    $now = time();
    $windowSeconds = max(1, (int)$windowSeconds);
    $rateKey = astro_rate_limit_key($bucket, $identifier);

    astro_rate_limit_ensure_table($pdo);

    // Expired windows restart at 1; live windows increment.
    $upsert = $pdo->prepare("INSERT INTO api_rate_limits (rate_key, window_started_at, hits) VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE
            hits = IF(window_started_at <= ? - ?, 1, hits + 1),
            window_started_at = IF(window_started_at <= ? - ?, ?, window_started_at)");
    $upsert->execute(array($rateKey, $now, $now, $windowSeconds, $now, $windowSeconds, $now));

    // Opportunistic cleanup of long-expired rows (once per request is enough).
    static $lastCleanup = 0;
    if ($lastCleanup < $now - 600) {
        $lastCleanup = $now;
        $cleanup = $pdo->prepare('DELETE FROM api_rate_limits WHERE window_started_at < ?');
        $cleanup->execute(array($now - 86400));
    }

    $read = $pdo->prepare('SELECT hits, window_started_at FROM api_rate_limits WHERE rate_key = ? LIMIT 1');
    $read->execute(array($rateKey));
    $record = $read->fetch(PDO::FETCH_ASSOC);
    if (!$record) {
        throw new RuntimeException('Rate-limit record could not be read.');
    }

    $decision = astro_rate_limit_decision(
        (int)$record['hits'],
        $maxHits,
        (int)$record['window_started_at'],
        $now,
        $windowSeconds
    );
    $decision['hits'] = (int)$record['hits'];
    return $decision;
}

/** Drops a counter (used when a login succeeds, so a good password clears the lockout). */
function astro_rate_limit_clear($pdo, $bucket, $identifier) {
    try {
        astro_rate_limit_ensure_table($pdo);
        $delete = $pdo->prepare('DELETE FROM api_rate_limits WHERE rate_key = ?');
        $delete->execute(array(astro_rate_limit_key($bucket, $identifier)));
    } catch (Throwable $e) {
        error_log('ASTRO SIVAM: could not clear a rate-limit counter - ' . $e->getMessage());
    }
}

/**
 * Enforce a bucket and answer 429 when the client has used up its window.
 * Returns (does not exit) when the request may proceed.
 */
function astro_rate_limit_enforce($pdo, $bucket, $identifier, $maxHits, $windowSeconds, $message) {
    try {
        $result = astro_rate_limit_hit($pdo, $bucket, $identifier, $maxHits, $windowSeconds);
    } catch (Throwable $e) {
        error_log('ASTRO SIVAM: rate limit could not be enforced (' . $bucket . ') - ' . $e->getMessage());
        jsonResponse(array(
            'success' => false,
            'message' => 'Service temporarily unavailable. Please retry shortly.'
        ), 503);
    }

    if (empty($result['allowed'])) {
        $retryAfter = max(1, (int)$result['retryAfterSeconds']);
        header('Retry-After: ' . $retryAfter);
        jsonResponse(array(
            'success' => false,
            'message' => $message,
            'retryAfterSeconds' => $retryAfter
        ), 429);
    }
}
