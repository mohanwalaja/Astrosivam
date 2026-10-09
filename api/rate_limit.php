<?php
/**
 * ASTRO SIVAM - shared fixed-window rate limiting for the PHP API.
 *
 * WHY THIS EXISTS: api/auth/index.php accepted unlimited password guesses
 * (a customer *and* an admin could be brute-forced), and registration, payment
 * session creation and the report generator were unlimited too. This
 * database-backed limiter protects the PHP API deployed on shared hosting.
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
 *
 * CREDENTIAL-STUFFING BUCKETS (added 2026-10 after the "H1" pentest finding)
 *   The per-account counters above only slow an attacker who stays on ONE
 *   target email: walking thousands of different accounts from a single IP
 *   never tripped them. Three FAILED-credential budgets now close that gap:
 *     - auth-fail-ip-endpoint : N failed attempts per IP per auth endpoint
 *     - auth-fail-ip          : N failed attempts per IP across all endpoints
 *     - auth-fail-global      : N failed attempts site-wide (distributed
 *                               credential-stuffing trips a single global cap)
 *   Only real failures advance these counters (a valid sign-in never counts),
 *   and each is enforced BEFORE the next credential check via
 *   astro_auth_failure_enforce(). See astro_auth_failure_limits() for the
 *   default budgets (env-overridable).
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

/**
 * Pure decision for FAILED-credential budgets ("20 fails/IP/15 min").
 *
 * Unlike astro_rate_limit_decision() the counter only counts failures, so the
 * gate closes the moment the recorded failures reach the allowance: the 21st
 * attempt after 20 failures is refused before any password is even checked.
 *
 * @param int $failures     failed attempts recorded in the current window
 * @param int $maxFailures  allowed failures per window
 * @param int $windowStartedAt unix time the window opened
 * @param int $now             unix time now
 * @param int $windowSeconds   window length
 * @return array{allowed:bool,retryAfterSeconds:int}
 */
function astro_rate_limit_failure_gate($failures, $maxFailures, $windowStartedAt, $now, $windowSeconds) {
    $failures = (int)$failures;
    $maxFailures = max(1, (int)$maxFailures);
    $windowSeconds = max(1, (int)$windowSeconds);

    if ($failures < $maxFailures) {
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
 * Shared window-aware counter increment. Expired windows restart at 1; live
 * windows increment. Used by both attempt-counting and failure-counting
 * buckets.
 */
function astro_rate_limit_upsert($pdo, $rateKey, $now, $windowSeconds) {
    $upsert = $pdo->prepare("INSERT INTO api_rate_limits (rate_key, window_started_at, hits) VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE
            hits = IF(window_started_at <= ? - ?, 1, hits + 1),
            window_started_at = IF(window_started_at <= ? - ?, ?, window_started_at)");
    $upsert->execute(array($rateKey, $now, $now, $windowSeconds, $now, $windowSeconds, $now));
}

/** Opportunistic cleanup of long-expired rows (at most once per 10 minutes). */
function astro_rate_limit_prune($pdo, $now) {
    static $lastCleanup = 0;
    if ($lastCleanup < $now - 600) {
        $lastCleanup = $now;
        $cleanup = $pdo->prepare('DELETE FROM api_rate_limits WHERE window_started_at < ?');
        $cleanup->execute(array($now - 86400));
    }
}

/** Reads one counter row. Returns null when the counter was never written. */
function astro_rate_limit_fetch($pdo, $rateKey) {
    $read = $pdo->prepare('SELECT hits, window_started_at FROM api_rate_limits WHERE rate_key = ? LIMIT 1');
    $read->execute(array($rateKey));
    $record = $read->fetch(PDO::FETCH_ASSOC);
    return $record ? array('hits' => (int)$record['hits'], 'windowStartedAt' => (int)$record['window_started_at']) : null;
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
    astro_rate_limit_upsert($pdo, $rateKey, $now, $windowSeconds);
    astro_rate_limit_prune($pdo, $now);

    $record = astro_rate_limit_fetch($pdo, $rateKey);
    if (!$record) {
        throw new RuntimeException('Rate-limit record could not be read.');
    }

    $decision = astro_rate_limit_decision(
        $record['hits'],
        $maxHits,
        $record['windowStartedAt'],
        $now,
        $windowSeconds
    );
    $decision['hits'] = $record['hits'];
    return $decision;
}

/**
 * Increment a counter WITHOUT deciding anything. Used to RECORD an outcome
 * that already happened (e.g. one failed password guess): enforcement for
 * future requests happens at the gate, not at the moment of recording.
 */
function astro_rate_limit_bump($pdo, $bucket, $identifier, $windowSeconds) {
    $now = time();
    $windowSeconds = max(1, (int)$windowSeconds);
    $rateKey = astro_rate_limit_key($bucket, $identifier);

    astro_rate_limit_ensure_table($pdo);
    astro_rate_limit_upsert($pdo, $rateKey, $now, $windowSeconds);
    astro_rate_limit_prune($pdo, $now);
}

/**
 * Evaluate a FAILED-credential counter WITHOUT counting this request.
 *
 * @return array{allowed:bool,retryAfterSeconds:int,hits:int}
 */
function astro_rate_limit_failure_status($pdo, $bucket, $identifier, $maxFailures, $windowSeconds) {
    $now = time();
    $windowSeconds = max(1, (int)$windowSeconds);
    $rateKey = astro_rate_limit_key($bucket, $identifier);

    astro_rate_limit_ensure_table($pdo);
    astro_rate_limit_prune($pdo, $now);

    $record = astro_rate_limit_fetch($pdo, $rateKey);
    $failures = $record ? $record['hits'] : 0;
    $windowStartedAt = $record ? $record['windowStartedAt'] : $now;

    $decision = astro_rate_limit_failure_gate($failures, $maxFailures, $windowStartedAt, $now, $windowSeconds);
    $decision['hits'] = $failures;
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

// ---------------------------------------------------------------------------
// Failed-credential budgets (H1): per-IP, per-IP-per-endpoint and global.
// ---------------------------------------------------------------------------

/** Validated integer environment override (invalid values fall back). */
function astro_env_int($name, $default, $min = 1, $max = 1000000) {
    $raw = getenv($name);
    if ($raw === false || $raw === '' || !is_numeric($raw)) return (int)$default;
    $value = (int)$raw;
    if ($value < $min || $value > $max) return (int)$default;
    return $value;
}

/**
 * Budgets for the failed-credential buckets. Defaults implement the pentest
 * recommendation: 20 failures per IP per 15 minutes across auth endpoints,
 * a stricter per-endpoint budget, and a site-wide global cap so distributed
 * credential stuffing cannot run unbounded either.
 *
 * Override via env: AUTH_FAIL_LIMIT_ENDPOINT / AUTH_FAIL_LIMIT_IP /
 * AUTH_FAIL_LIMIT_GLOBAL / AUTH_FAIL_WINDOW_SECONDS.
 */
function astro_auth_failure_limits() {
    return array(
        'perEndpointMax' => astro_env_int('AUTH_FAIL_LIMIT_ENDPOINT', 10),
        'perIpMax' => astro_env_int('AUTH_FAIL_LIMIT_IP', 20),
        'globalMax' => astro_env_int('AUTH_FAIL_LIMIT_GLOBAL', 300),
        'windowSeconds' => astro_env_int('AUTH_FAIL_WINDOW_SECONDS', 900, 60),
    );
}

/**
 * The three counters one failed credential attempt advances. Ordered from the
 * most specific to the most global so a refusal can name the binding budget.
 *
 * @return array<int, array{bucket:string,identifier:string,maxFailures:int}>
 */
function astro_auth_failure_buckets($clientIp, $endpoint) {
    $limits = astro_auth_failure_limits();
    $endpoint = preg_replace('/[^a-z0-9:_-]/i', '', (string)$endpoint);
    return array(
        array('bucket' => 'auth-fail-ip-endpoint', 'identifier' => $clientIp . '|' . $endpoint, 'maxFailures' => $limits['perEndpointMax']),
        array('bucket' => 'auth-fail-ip', 'identifier' => $clientIp, 'maxFailures' => $limits['perIpMax']),
        array('bucket' => 'auth-fail-global', 'identifier' => 'all', 'maxFailures' => $limits['globalMax']),
    );
}

/**
 * May this network attempt another credential check on this endpoint?
 * Reads the failure counters WITHOUT advancing them - only real failures
 * count against these budgets.
 *
 * @return array{allowed:bool,retryAfterSeconds:int,bucket:string}
 */
function astro_auth_failure_status($pdo, $clientIp, $endpoint) {
    $limits = astro_auth_failure_limits();
    foreach (astro_auth_failure_buckets($clientIp, $endpoint) as $entry) {
        $decision = astro_rate_limit_failure_status(
            $pdo,
            $entry['bucket'],
            $entry['identifier'],
            $entry['maxFailures'],
            $limits['windowSeconds']
        );
        if (empty($decision['allowed'])) {
            $decision['bucket'] = $entry['bucket'];
            return $decision;
        }
    }
    return array('allowed' => true, 'retryAfterSeconds' => 0, 'bucket' => '');
}

/**
 * Gate a credential attempt and answer 429 when the network has exhausted its
 * failed-credential budget (per endpoint, per IP, or site-wide). Returns
 * (does not exit) when the attempt may proceed. Fail-CLOSED on DB errors.
 */
function astro_auth_failure_enforce($pdo, $clientIp, $endpoint) {
    try {
        $status = astro_auth_failure_status($pdo, $clientIp, $endpoint);
    } catch (Throwable $e) {
        error_log('ASTRO SIVAM: credential-failure gate could not run (' . $endpoint . ') - ' . $e->getMessage());
        jsonResponse(array(
            'success' => false,
            'message' => 'Service temporarily unavailable. Please retry shortly.'
        ), 503);
    }

    if (empty($status['allowed'])) {
        $retryAfter = max(1, (int)$status['retryAfterSeconds']);
        $message = $status['bucket'] === 'auth-fail-global'
            ? 'Too many failed sign-in attempts across the site right now. Please wait a few minutes and try again.'
            : 'Too many failed sign-in attempts from this network. Please wait a few minutes and try again.';
        header('Retry-After: ' . $retryAfter);
        jsonResponse(array(
            'success' => false,
            'message' => $message,
            'retryAfterSeconds' => $retryAfter
        ), 429);
    }
}

/**
 * Record ONE failed credential attempt (wrong password, unknown account,
 * invalid OTP, rejected social token). Never throws: the attempt has already
 * failed and must stay a 401/404, not become a 503.
 */
function astro_auth_failure_record($pdo, $clientIp, $endpoint) {
    try {
        $limits = astro_auth_failure_limits();
        foreach (astro_auth_failure_buckets($clientIp, $endpoint) as $entry) {
            astro_rate_limit_bump($pdo, $entry['bucket'], $entry['identifier'], $limits['windowSeconds']);
        }
    } catch (Throwable $e) {
        error_log('ASTRO SIVAM: credential failure could not be recorded (' . $endpoint . ') - ' . $e->getMessage());
    }
}
