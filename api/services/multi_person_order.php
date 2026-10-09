<?php
/**
 * ASTRO SIVAM - Multi-Person Order Creation (one order, up to 6 people)
 * -------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * --------------------
 * A customer can order for the whole family in ONE checkout: up to 6 PEOPLE,
 * each with birth details and ONE OR MORE services, paid with ONE total.
 *
 * This file owns the write path for that checkout:
 *
 *   orders          -> ONE header row for the whole order (total + payment)
 *   order_persons   -> one row per person (seq 1..6, birth details)
 *   order_items     -> one row per person+service (price, report_status,
 *                      language, per-item input payload and cached result)
 *
 * The request is the `people[]` shape (see astro_multi_person_normalize_people):
 *
 *   { "people": [ { "name": "...", "gender": "F", "dob": "...", "tob": "...",
 *                   "place": "...", "country": "...", "latitude": ...,
 *                   "longitude": ..., "timezoneOffsetHours": ...,
 *                   "services": ["BIRTH_JATHAGAM", "BABY_NAMING"],
 *                   "partner": { ... },          // Marriage Compatibility
 *                   "muhurtham": { ... }         // Subha Muhurtham
 *                 }, ... ],
 *     "paymentMethod": "MPAISA", "currency": "FJD", ... }
 *
 * SECURITY / MONEY RULES (identical to the legacy multi-order endpoint)
 * --------------------------------------------------------------------
 *  * The client total is NEVER trusted. Every unit price is recomputed here
 *    from the server-side price list (system_settings.pricing, then the
 *    built-in fallback prices) in the currency the payment method settles in.
 *  * 1..6 people, 1..4 services per person, only the 4 known service codes.
 *  * Banned IP, the max-3-open-unpaid-checkouts-per-IP guard, fake/duplicate
 *    payment reference detection and captured-payment-intent binding all run
 *    exactly like the single/multi order endpoints.
 *  * The Free Beta rule is unchanged: ONE free report per IP address, applied
 *    to the FIRST item of this order.
 *  * ALL rows are written inside ONE InnoDB transaction: header, people, items,
 *    the free-beta claim, the beta history row and the consumed payment intent.
 *    A failure anywhere rolls the whole order back - never a half order.
 *
 * The tables are created by api/migrations/003_multi_person_orders.sql. The
 * runtime guard below (astro_ensure_multi_person_tables) creates the same two
 * tables when the migration has not been run yet, which is the existing
 * self-healing-DDL convention of this project.
 */

if (!defined('ASTRO_MULTI_PERSON_MAX_PEOPLE')) {
    define('ASTRO_MULTI_PERSON_MAX_PEOPLE', 6);
}
if (!defined('ASTRO_MULTI_PERSON_MAX_ITEMS')) {
    // 6 people x 4 services. A hard ceiling so one request can never create an
    // unbounded number of report rows.
    define('ASTRO_MULTI_PERSON_MAX_ITEMS', 24);
}

/** The only service codes this API accepts, with their fallback prices. */
function astro_multi_person_service_catalog(): array
{
    return [
        'BIRTH_JATHAGAM' => ['FJD' => 35, 'INR' => 499, 'USD' => 18],
        'MARRIAGE_COMPATIBILITY' => ['FJD' => 45, 'INR' => 699, 'USD' => 22],
        'BABY_NAMING' => ['FJD' => 30, 'INR' => 399, 'USD' => 15],
        'MUHURTHAM' => ['FJD' => 40, 'INR' => 599, 'USD' => 20],
    ];
}

/** True when `$code` is one of the four services the site sells. */
function astro_multi_person_is_service($code): bool
{
    return is_string($code) && array_key_exists(strtoupper(trim($code)), astro_multi_person_service_catalog());
}

/**
 * SERVER-SIDE PRICE for one service in one currency.
 * Admin overrides in system_settings.pricing always win, then the currency's
 * built-in fallback price. Nothing here reads the client's submitted amount.
 */
function astro_multi_person_unit_price($serviceCode, $pricing, $currency): float
{
    $serviceCode = strtoupper(trim((string)$serviceCode));
    $currency = strtoupper(trim((string)$currency));
    $catalog = astro_multi_person_service_catalog();
    if (!isset($catalog[$serviceCode])) {
        return 0.0;
    }

    if (is_array($pricing) && isset($pricing[$serviceCode]) && is_array($pricing[$serviceCode])) {
        $row = $pricing[$serviceCode];
        $override = $row[strtolower($currency)] ?? ($row[$currency] ?? null);
        if (is_numeric($override)) {
            return round((float)$override, 2);
        }
    }

    return round((float)($catalog[$serviceCode][$currency] ?? 0), 2);
}

/** 'F' | 'M' | 'O' - accepts the human spellings the checklists send. */
function astro_multi_person_gender($value): string
{
    $g = strtoupper(trim((string)$value));
    if ($g === 'F' || $g === 'FEMALE' || $g === 'WOMAN' || $g === 'GIRL') return 'F';
    if ($g === 'O' || $g === 'OTHER' || $g === 'OTHER ') return 'O';
    return 'M';
}

/** Coordinates + time zone must be real numbers inside the valid ranges. */
function astro_multi_person_valid_coordinates($latitude, $longitude, $offset): bool
{
    return is_numeric($latitude) && (float)$latitude >= -90 && (float)$latitude <= 90
        && is_numeric($longitude) && (float)$longitude >= -180 && (float)$longitude <= 180
        && is_numeric($offset) && (float)$offset >= -14 && (float)$offset <= 14;
}

/** A strict, real ISO birth date; the complete block check also rejects future instants. */
function astro_multi_person_valid_dob($dob): bool
{
    return AstroEngine::isValidBirthDate($dob);
}

/** A birth time the engine can normalize without guessing. */
function astro_multi_person_valid_tob($tob): bool
{
    return AstroEngine::normalizeBirthTime($tob) !== null;
}

/**
 * Normalises one birth-details block (a person, or the partner of a marriage
 * chart) into the exact keys the astrology engine expects. Accepts both the
 * checkout's camelCase and the legacy tray's snake/mixed spellings.
 */
function astro_multi_person_birth_block($raw, $fallbackName = ''): array
{
    $raw = is_array($raw) ? $raw : [];
    $name = trim((string)($raw['name'] ?? ($raw['fullName'] ?? ($raw['full_name'] ?? $fallbackName))));
    return [
        'name' => $name,
        'gender' => astro_multi_person_gender($raw['gender'] ?? 'M'),
        'dob' => trim((string)($raw['dob'] ?? ($raw['dateOfBirth'] ?? ''))),
        'tob' => trim((string)($raw['tob'] ?? ($raw['timeOfBirth'] ?? ''))),
        'birthPlace' => trim((string)($raw['birthPlace'] ?? ($raw['place'] ?? ($raw['birth_place'] ?? '')))),
        'country' => trim((string)($raw['country'] ?? ($raw['birthCountry'] ?? ''))),
        'latitude' => $raw['latitude'] ?? ($raw['lat'] ?? null),
        'longitude' => $raw['longitude'] ?? ($raw['lon'] ?? ($raw['lng'] ?? null)),
        'timezoneOffsetHours' => $raw['timezoneOffsetHours'] ?? ($raw['tz'] ?? null),
        'timeZoneId' => trim((string)($raw['timeZoneId'] ?? ($raw['timezoneId'] ?? ''))),
    ];
}

/** Human-readable validation problems for one birth-details block. */
function astro_multi_person_birth_errors(array $block, string $label): array
{
    $errors = [];
    if ($block['name'] === '') {
        $errors[] = $label . ': full name is required.';
    }
    if (!astro_multi_person_valid_dob($block['dob'])) {
        $errors[] = $label . ': a valid date of birth that is not in the future is required.';
    }
    if (!astro_multi_person_valid_tob($block['tob'])) {
        $errors[] = $label . ': a valid time of birth (with minutes) is required.';
    }
    if ($block['birthPlace'] === '') {
        $errors[] = $label . ': birth place is required.';
    }
    if (!astro_multi_person_valid_coordinates($block['latitude'], $block['longitude'], $block['timezoneOffsetHours'])) {
        $errors[] = $label . ': birth place needs valid coordinates and time zone (select it from search, map or GPS).';
    }
    if (count($errors) === 0) {
        $birthProblem = AstroEngine::describeBirthDetailsProblem($block);
        if ($birthProblem !== null) {
            $errors[] = $label . ': ' . $birthProblem;
        }
    }
    return $errors;
}

/**
 * Builds the exact payload each astrology engine call expects for one item.
 * `$person` and `$partner` are normalised birth blocks.
 */
function astro_multi_person_item_payload(array $person, string $serviceCode, array $partner = [], array $muhurtham = []): array
{
    $base = [
        'name' => $person['name'],
        'devoteeName' => $person['name'],
        'dob' => $person['dob'],
        'tob' => $person['tob'],
        'birthPlace' => $person['birthPlace'],
        'country' => $person['country'],
        'latitude' => $person['latitude'],
        'longitude' => $person['longitude'],
        'timezoneOffsetHours' => $person['timezoneOffsetHours'],
        'timeZoneId' => $person['timeZoneId'],
        'gender' => $person['gender'],
    ];

    if ($serviceCode === 'BABY_NAMING') {
        $base['babyName'] = $person['name'];
        $base['childName'] = $person['name'];
        return $base;
    }

    if ($serviceCode === 'MARRIAGE_COMPATIBILITY') {
        // The bride/groom side of the card is the person; the partner block is
        // the other chart. Both nested objects and the flat bride*/groom* keys
        // are provided because the report builder and the engine read both.
        $partnerBlock = $partner !== [] ? $partner : $person;
        $personIsBride = ($person['gender'] === 'F');
        $bride = $personIsBride ? $person : $partnerBlock;
        $groom = $personIsBride ? $partnerBlock : $person;
        $brideOut = [
            'name' => $bride['name'], 'gender' => $bride['gender'],
            'dob' => $bride['dob'], 'tob' => $bride['tob'],
            'birthPlace' => $bride['birthPlace'], 'country' => $bride['country'],
            'latitude' => $bride['latitude'], 'longitude' => $bride['longitude'],
            'timezoneOffsetHours' => $bride['timezoneOffsetHours'], 'timeZoneId' => $bride['timeZoneId'],
        ];
        $groomOut = [
            'name' => $groom['name'], 'gender' => $groom['gender'],
            'dob' => $groom['dob'], 'tob' => $groom['tob'],
            'birthPlace' => $groom['birthPlace'], 'country' => $groom['country'],
            'latitude' => $groom['latitude'], 'longitude' => $groom['longitude'],
            'timezoneOffsetHours' => $groom['timezoneOffsetHours'], 'timeZoneId' => $groom['timeZoneId'],
        ];
        return array_merge($base, [
            'bride' => $brideOut,
            'groom' => $groomOut,
            'brideName' => $brideOut['name'],
            'brideDob' => $brideOut['dob'],
            'brideTob' => $brideOut['tob'],
            'brideBirthPlace' => $brideOut['birthPlace'],
            'brideCountry' => $brideOut['country'],
            'brideLatitude' => $brideOut['latitude'],
            'brideLongitude' => $brideOut['longitude'],
            'brideTimezoneOffsetHours' => $brideOut['timezoneOffsetHours'],
            'brideTimeZoneId' => $brideOut['timeZoneId'],
            'groomName' => $groomOut['name'],
            'groomDob' => $groomOut['dob'],
            'groomTob' => $groomOut['tob'],
            'groomBirthPlace' => $groomOut['birthPlace'],
            'groomCountry' => $groomOut['country'],
            'groomLatitude' => $groomOut['latitude'],
            'groomLongitude' => $groomOut['longitude'],
            'groomTimezoneOffsetHours' => $groomOut['timezoneOffsetHours'],
            'groomTimeZoneId' => $groomOut['timeZoneId'],
        ]);
    }

    if ($serviceCode === 'MUHURTHAM') {
        $scan = $muhurtham['muhurthamScan'] ?? ($muhurtham['scan'] ?? null);
        return array_merge($base, [
            'muhurthamPlace' => trim((string)($muhurtham['muhurthamPlace'] ?? ($muhurtham['place'] ?? ''))),
            'muhurthamCountry' => trim((string)($muhurtham['muhurthamCountry'] ?? ($muhurtham['country'] ?? ''))),
            'muhurthamLatitude' => $muhurtham['muhurthamLatitude'] ?? ($muhurtham['latitude'] ?? null),
            'muhurthamLongitude' => $muhurtham['muhurthamLongitude'] ?? ($muhurtham['longitude'] ?? null),
            'muhurthamTimezoneOffsetHours' => $muhurtham['muhurthamTimezoneOffsetHours'] ?? ($muhurtham['timezoneOffsetHours'] ?? null),
            'muhurthamTimeZoneId' => trim((string)($muhurtham['muhurthamTimeZoneId'] ?? ($muhurtham['timeZoneId'] ?? ''))),
            'eventKey' => trim((string)($muhurtham['eventKey'] ?? 'wedding')),
            'selectedMonth' => trim((string)($muhurtham['selectedMonth'] ?? '')),
            'muhurthamScan' => is_array($scan) ? $scan : null,
        ]);
    }

    return $base;
}

/** Validation problems for a MUHURTHAM item (separate event location + scan). */
function astro_multi_person_muhurtham_errors(array $muhurtham, string $label): array
{
    $errors = [];
    $place = trim((string)($muhurtham['muhurthamPlace'] ?? ($muhurtham['place'] ?? '')));
    if ($place === '') {
        $errors[] = $label . ': the Muhurtham (function) location is required.';
    }
    if (!astro_multi_person_valid_coordinates(
        $muhurtham['muhurthamLatitude'] ?? ($muhurtham['latitude'] ?? null),
        $muhurtham['muhurthamLongitude'] ?? ($muhurtham['longitude'] ?? null),
        $muhurtham['muhurthamTimezoneOffsetHours'] ?? ($muhurtham['timezoneOffsetHours'] ?? null)
    )) {
        $errors[] = $label . ': the Muhurtham location needs valid coordinates and time zone.';
    }
    $scan = $muhurtham['muhurthamScan'] ?? ($muhurtham['scan'] ?? null);
    if (!is_array($scan) || empty($scan['months']) || !is_array($scan['months'])) {
        $errors[] = $label . ': the six-month Muhurtham calendar is missing. Re-open the person card and let it calculate.';
    }
    return $errors;
}

/** Thrown away: helper only used for readability of the router in index.php. */
function astro_multi_person_payload_has_people($body): bool
{
    return is_array($body) && isset($body['people']) && is_array($body['people']) && count($body['people']) > 0;
}

/**
 * Idempotent runtime guard - matches api/migrations/003_multi_person_orders.sql.
 * Keep both definitions in sync.
 */
function astro_ensure_multi_person_tables($pdo): void
{
    static $ready = false;
    if ($ready) return;

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `order_persons` (
            `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `seq` INT NOT NULL DEFAULT 1,
            `full_name` VARCHAR(191) NOT NULL,
            `gender` ENUM('M','F','O') NOT NULL DEFAULT 'M',
            `dob` VARCHAR(32) NOT NULL,
            `tob` VARCHAR(32) NOT NULL,
            `place` VARCHAR(191) NOT NULL,
            `country` VARCHAR(100) NOT NULL,
            `lat` DECIMAL(10,6) NULL,
            `lon` DECIMAL(10,6) NULL,
            `tz` DECIMAL(4,2) NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_order_persons_seq` (`order_id`,`seq`),
            INDEX `idx_order_persons_order` (`order_id`),
            CONSTRAINT `fk_order_persons_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } catch (Throwable $e) {
        error_log('ASTRO SIVAM: order_persons could not be ensured: ' . $e->getMessage());
    }

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `order_items` (
            `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `order_id` VARCHAR(64) NOT NULL,
            `person_id` INT NOT NULL,
            `service_code` VARCHAR(64) NOT NULL,
            `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            `report_status` ENUM('PENDING','CALCULATED','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
            `language` VARCHAR(16) NOT NULL DEFAULT 'en',
            `input_payload` LONGTEXT NULL,
            `calculated_result` LONGTEXT NULL,
            `sent_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_order_items_order` (`order_id`),
            INDEX `idx_order_items_person` (`person_id`),
            INDEX `idx_order_items_status` (`report_status`),
            CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_order_items_person` FOREIGN KEY (`person_id`) REFERENCES `order_persons`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } catch (Throwable $e) {
        error_log('ASTRO SIVAM: order_items could not be ensured: ' . $e->getMessage());
    }

    $ready = true;
}

/**
 * Best-effort creation-time calculation for one item. Mirrors the single-order
 * endpoint: the result is cached on the item so the admin Preview and Send use
 * the SAME numbers. A failure is not fatal - the item stays PENDING and the
 * admin preview recalculates (and caches) it on first open.
 */
function astro_multi_person_precalculate_item(string $serviceCode, array $payload): array
{
    try {
        if ($serviceCode === 'MARRIAGE_COMPATIBILITY') {
            $result = AstroEngine::calculateMatchmaking($payload);
        } elseif ($serviceCode === 'BABY_NAMING') {
            $result = AstroEngine::calculateBabyNaming($payload);
        } elseif ($serviceCode === 'MUHURTHAM') {
            $result = AstroEngine::calculateMuhurtham($payload);
        } else {
            $result = AstroEngine::calculateHoroscope($payload);
        }
        return [is_array($result) ? $result : null, null];
    } catch (Throwable $e) {
        return [null, $e->getMessage()];
    }
}

/**
 * POST /api/services/order | /multi-order with a `people` array.
 * Emits the JSON response directly (jsonResponse() exits).
 */
function astro_create_multi_person_order($pdo, array $user, array $body): void
{
    $isAdmin = strtolower((string)($user['role'] ?? 'customer')) === 'admin';
    $peopleInput = $body['people'];

    // ---- 1. Structure: 1..6 people, each with 1..4 known services ----------
    if (count($peopleInput) < 1) {
        jsonResponse(['success' => false, 'message' => 'At least one person is required in a multi-person order.'], 400);
    }
    if (count($peopleInput) > ASTRO_MULTI_PERSON_MAX_PEOPLE) {
        jsonResponse(['success' => false, 'message' => 'A single order can contain at most ' . ASTRO_MULTI_PERSON_MAX_PEOPLE . ' people.'], 400);
    }

    $people = [];
    $items = [];
    $errors = [];
    $warnings = [];

    foreach (array_values($peopleInput) as $index => $rawPerson) {
        if (!is_array($rawPerson)) {
            $errors[] = 'Person #' . ($index + 1) . ' has invalid details.';
            continue;
        }

        $block = astro_multi_person_birth_block($rawPerson);
        $label = 'Person #' . ($index + 1) . ($block['name'] !== '' ? ' (' . $block['name'] . ')' : '');
        $errors = array_merge($errors, astro_multi_person_birth_errors($block, $label));

        $servicesInput = $rawPerson['services'] ?? null;
        if (!is_array($servicesInput) || empty($servicesInput)) {
            $single = $rawPerson['serviceCode'] ?? ($rawPerson['service'] ?? null);
            $servicesInput = $single ? [$single] : [];
        }
        $services = [];
        foreach ($servicesInput as $code) {
            $code = strtoupper(trim((string)$code));
            if ($code === '') continue;
            if (!astro_multi_person_is_service($code)) {
                $errors[] = $label . ': "' . htmlspecialchars($code) . '" is not a service we offer.';
                continue;
            }
            if (!in_array($code, $services, true)) {
                $services[] = $code;
            }
        }
        if (empty($services)) {
            $errors[] = $label . ': choose at least one service.';
        }
        if (count($services) > count(astro_multi_person_service_catalog())) {
            $errors[] = $label . ': too many services.';
        }

        $language = astro_normalize_report_language($rawPerson['language'] ?? ($body['language'] ?? 'en'));

        foreach ($services as $code) {
            $itemExtra = [];
            if ($code === 'MARRIAGE_COMPATIBILITY') {
                if (!isset($rawPerson['partner']) || !is_array($rawPerson['partner'])) {
                    $errors[] = $label . ': Marriage Compatibility needs the partner\'s birth details.';
                    continue;
                }
                $partner = astro_multi_person_birth_block($rawPerson['partner']);
                $errors = array_merge($errors, astro_multi_person_birth_errors($partner, $label . ' partner'));
                $itemExtra['partner'] = $partner;
            }
            if ($code === 'MUHURTHAM') {
                $muhurtham = is_array($rawPerson['muhurtham'] ?? null) ? $rawPerson['muhurtham'] : [];
                $errors = array_merge($errors, astro_multi_person_muhurtham_errors($muhurtham, $label));
                $itemExtra['muhurtham'] = $muhurtham;
            }
            $items[] = [
                'personIndex' => $index,
                'serviceCode' => $code,
                'language' => $language,
                'extra' => $itemExtra,
            ];
        }

        $people[] = [
            'index' => $index,
            'seq' => $index + 1,
            'block' => $block,
            'services' => $services,
            'language' => $language,
        ];
    }

    if (!empty($errors)) {
        jsonResponse(['success' => false, 'message' => $errors[0], 'errors' => array_values(array_unique($errors))], 400);
    }
    if (count($items) > ASTRO_MULTI_PERSON_MAX_ITEMS) {
        jsonResponse(['success' => false, 'message' => 'This order contains too many reports (max ' . ASTRO_MULTI_PERSON_MAX_ITEMS . ').'], 400);
    }
    if (empty($people) || empty($items)) {
        jsonResponse(['success' => false, 'message' => 'At least one person with one service is required.'], 400);
    }

    // ---- 2. Payment method, currency and billing country -------------------
    $country = trim((string)($body['country'] ?? ($user['country'] ?? 'Fiji')));
    $billingCountry = trim((string)($body['billingCountry'] ?? ($user['country'] ?? $country)));
    $paymentMethod = strtoupper(trim((string)($isAdmin ? 'NONE' : ($body['paymentMethod'] ?? 'MPAISA'))));
    if (!in_array($paymentMethod, ['NONE', 'MPAISA', 'MYCASH', 'GPAY', 'UPI', 'PAYPAL', 'CARD'], true)) {
        jsonResponse(['success' => false, 'message' => 'Unsupported payment method.'], 400);
    }

    $requestedCurrency = isset($body['currency']) ? strtoupper(trim((string)$body['currency'])) : '';
    $currency = astro_currency_for_payment($paymentMethod, $billingCountry, $requestedCurrency);
    if (!$isAdmin && $requestedCurrency !== '' && $requestedCurrency !== $currency) {
        jsonResponse(['success' => false, 'message' => 'Payment currency does not match the selected payment method.'], 400);
    }

    $paymentReference = !$isAdmin && is_string($body['paymentReference'] ?? null) ? trim($body['paymentReference']) : '';
    $paymentIntentId = !$isAdmin && is_string($body['paymentIntentId'] ?? null) ? trim($body['paymentIntentId']) : '';

    // ---- 3. System settings, pricing, free beta ---------------------------
    $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
    $sRow = $sStmt ? $sStmt->fetch() : null;
    $pricing = ($sRow && !empty($sRow['pricing'])) ? json_decode($sRow['pricing'], true) : [];
    if (!is_array($pricing)) $pricing = [];

    $isFreeBetaMode = $sRow
        ? ((bool)$sRow['free_beta_active'] || $sRow['service_mode'] === 'FREE_BETA')
        : false;

    foreach ($items as $i => $item) {
        $items[$i]['unitPrice'] = astro_multi_person_unit_price($item['serviceCode'], $pricing, $currency);
    }

    $clientIp = getClientIpAddress();

    // ---- 4. Guards: banned IP + too many open unpaid checkouts ------------
    if (!$isAdmin) {
        try {
            $bannedCheck = $pdo->prepare("SELECT * FROM banned_ips WHERE ip_address = ? LIMIT 1");
            $bannedCheck->execute([$clientIp]);
            $bannedRow = $bannedCheck->fetch();
            if ($bannedRow) {
                jsonResponse([
                    'success' => false,
                    'message' => 'ACCESS RESTRICTED: Your IP address (' . htmlspecialchars($clientIp) . ') has been blocked due to policy violations. Reason: ' . ($bannedRow['reason'] ?? 'Fraud prevention') . '. Please contact admin@astrosivam.com if you believe this is an error.'
                ], 403);
            }
        } catch (Throwable $e) {
            // A missing blacklist table must never block a legitimate order.
        }

        if (function_exists('astro_count_pending_order_groups_by_ip')) {
            $pendingCount = astro_count_pending_order_groups_by_ip($pdo, $clientIp);
            if ($pendingCount >= 3) {
                jsonResponse([
                    'success' => false,
                    'message' => 'PENDING ORDERS LIMIT: You currently have ' . $pendingCount . ' unpaid checkout groups awaiting payment verification. Please wait for them to be verified or contact admin before creating additional orders.',
                    'pendingCount' => $pendingCount
                ], 429);
            }
        }
    }

    // Free Beta: exactly ONE free report per IP address. The free report is the
    // FIRST item of this order; every other item is charged normally.
    if (function_exists('astro_ensure_beta_ip_claims_table')) {
        astro_ensure_beta_ip_claims_table($pdo);
    }
    $freeChartAvailable = false;
    if (!$isAdmin && $isFreeBetaMode) {
        try {
            $claimCheck = $pdo->prepare("SELECT COUNT(*) FROM beta_ip_claims WHERE ip_address = ?");
            $claimCheck->execute([$clientIp]);
            $freeChartAvailable = ((int)($claimCheck->fetchColumn() ?: 0)) < 1;
        } catch (Throwable $e) {
            $freeChartAvailable = false;
        }
    }

    $totalAmount = 0.0;
    $paidItemCount = 0;
    $freeItemIndex = -1;
    foreach ($items as $i => $item) {
        $isFree = $isAdmin || ($freeChartAvailable && $i === 0);
        if ($isFree) {
            $items[$i]['unitPrice'] = 0.0;
            if (!$isAdmin && $freeChartAvailable && $freeItemIndex < 0) {
                $freeItemIndex = $i;
            }
        } else {
            $paidItemCount++;
        }
        $totalAmount += (float)$items[$i]['unitPrice'];
    }
    $totalAmount = round($totalAmount, 2);
    $chargeableTotal = $isAdmin ? 0.0 : $totalAmount;
    $requiresPayment = $chargeableTotal > 0;

    // ---- 5. Payment intent / manual reference (paid charts only) ----------
    $capturedIntent = null;
    $paymentStatus = $requiresPayment ? 'PENDING_ADMIN' : 'NOT_REQUIRED';

    if (!$requiresPayment && $paymentIntentId !== '') {
        jsonResponse(['success' => false, 'message' => 'A no-charge order cannot be bound to a paid payment intent.'], 400);
    }

    if ($requiresPayment) {
        try {
            if ($paymentIntentId !== '') {
                $intentStmt = $pdo->prepare("SELECT * FROM payment_intents WHERE id = ? AND user_id = ? LIMIT 1");
                $intentStmt->execute([$paymentIntentId, $user['id']]);
                $capturedIntent = $intentStmt->fetch();
            } elseif ($paymentReference !== '') {
                $intentStmt = $pdo->prepare("SELECT * FROM payment_intents WHERE payment_reference = ? AND user_id = ? LIMIT 1");
                $intentStmt->execute([$paymentReference, $user['id']]);
                $capturedIntent = $intentStmt->fetch();
            }
        } catch (Throwable $e) {
            jsonResponse(['success' => false, 'message' => 'The payment could not be validated. Please retry.'], 503);
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
            if (!$methodMatches
                || $capturedIntent['status'] !== 'CAPTURED'
                || round((float)$capturedIntent['amount'], 2) !== round($totalAmount, 2)
                || strtoupper((string)$capturedIntent['currency']) !== $currency) {
                jsonResponse(['success' => false, 'message' => 'The captured payment does not match this order method, amount, or currency.'], 400);
            }
            $paymentReference = (string)$capturedIntent['payment_reference'];
            $paymentStatus = 'CAPTURED';
        }

        if ($paymentMethod === 'NONE') {
            jsonResponse([
                'success' => false,
                'message' => 'PAYMENT REQUIRED: ' . $paidItemCount . ' of ' . count($items) . ' reports in this order are chargeable. Please select a payment method to place the order.'
            ], 400);
        }
        if ($paymentReference === '') {
            jsonResponse(['success' => false, 'message' => 'Payment reference number / transaction ID is required to place a paid order.'], 400);
        }

        // Fake / duplicate receipt detection - identical to the legacy paths.
        $lowerRef = strtolower($paymentReference);
        $isRepeated = (bool)preg_match('/^(.)\1+$/', $paymentReference);
        $isBogus = in_array($lowerRef, [
            '123456', '12345678', '1234567890', '000000', '111111', '999999',
            'test', 'tester', 'fake', 'none', 'nil', 'asdf', 'sample', 'payment',
            'reference', 'upi', 'gpay', 'mpaisa', 'mycash', '000000000000', '111111111111'
        ], true);
        if (strlen($paymentReference) < 6 || $isRepeated || $isBogus) {
            jsonResponse([
                'success' => false,
                'message' => 'INVALID TRANSACTION ID: Please enter a genuine, unique bank/UPI/M-PAiSA transaction reference number. Random or placeholder numbers are strictly prohibited.'
            ], 400);
        }
        $dupCheck = $pdo->prepare("SELECT id, order_number FROM orders WHERE payment_reference = ? AND status NOT IN ('CANCELLED', 'REJECTED') LIMIT 1");
        $dupCheck->execute([$paymentReference]);
        $dupOrder = $dupCheck->fetch();
        if ($dupOrder) {
            jsonResponse([
                'success' => false,
                'message' => 'DUPLICATE TRANSACTION ID: The payment reference "' . htmlspecialchars($paymentReference) . '" has already been used for order #' . $dupOrder['order_number'] . '. Each payment receipt must be unique.'
            ], 400);
        }
    }

    // ---- 6. ONE transaction: header + people + items + claim + intent -----
    astro_ensure_multi_person_tables($pdo);

    $orderId = 'ord_' . uniqid('', true);
    $orderNumber = 'ORD-' . strtoupper(substr(uniqid(), -6));
    $singleItem = count($items) === 1;
    $headerServiceType = $singleItem ? $items[0]['serviceCode'] : 'MULTI_PERSON';
    $orderServiceMode = $requiresPayment ? 'PAID' : 'FREE_BETA';

    try {
        $pdo->beginTransaction();

        // Reserve the one-free-report slot inside the same transaction.
        if (!$isAdmin && $freeChartAvailable) {
            $betaClaim = $pdo->prepare("INSERT IGNORE INTO beta_ip_claims (ip_address, claimed_at) VALUES (?, NOW())");
            $betaClaim->execute([$clientIp]);
            if ($betaClaim->rowCount() !== 1) {
                $pdo->rollBack();
                jsonResponse(['success' => false, 'message' => 'The Free Beta report was claimed by another request. Refresh checkout and submit again.'], 409);
            }
        }

        // 6a. Order header. For a single-item order the header doubles as the
        //     legacy chart row, so every existing single-order tool keeps working.
        $headerPayload = $singleItem
            ? astro_multi_person_item_payload(
                $people[$items[0]['personIndex']]['block'],
                $items[0]['serviceCode'],
                $items[0]['extra']['partner'] ?? [],
                $items[0]['extra']['muhurtham'] ?? []
            )
            : ['people' => array_map(function ($p) {
                return array_merge($p['block'], ['seq' => $p['seq'], 'services' => $p['services']]);
            }, $people), 'groupId' => null];

        [$headerResult, $calcWarning] = $singleItem
            ? astro_multi_person_precalculate_item($items[0]['serviceCode'], $headerPayload)
            : [null, null];
        if ($calcWarning) {
            $warnings[] = 'Report will be calculated by the astrologer before delivery.';
        }

        $insertHeader = $pdo->prepare(
            "INSERT INTO orders (id, order_number, group_id, group_order_index, user_id, user_name, user_email, user_mobile, country, service_type, language, amount, currency, service_mode, status, payment_method, payment_reference, payment_intent_id, payment_status, payment_confirmed, email_status, input_payload, calculated_result, has_pdf, has_invoice, ip_address, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, 'PENDING', ?, ?, 0, 0, ?, NOW(), NOW())"
        );
        $insertHeader->execute([
            $orderId,
            $orderNumber,
            // Multi-person orders deliberately have NO group_id: the order IS
            // one row (a header), and its people/items live in the child
            // tables. Legacy bundle grouping (group_id) stays for old orders.
            null,
            1,
            $user['id'],
            $user['name'],
            $user['email'],
            $user['mobile'] ?? '',
            $country,
            $headerServiceType,
            $singleItem ? $items[0]['language'] : astro_normalize_report_language($body['language'] ?? 'en'),
            $totalAmount,
            $currency,
            $orderServiceMode,
            $paymentMethod,
            $paymentReference !== '' ? $paymentReference : null,
            $capturedIntent['id'] ?? null,
            $paymentStatus,
            $capturedIntent ? 1 : 0,
            json_encode($headerPayload, JSON_UNESCAPED_UNICODE),
            $headerResult ? json_encode($headerResult, JSON_UNESCAPED_UNICODE) : null,
            $clientIp
        ]);

        // 6b. People.
        $insertPerson = $pdo->prepare(
            "INSERT INTO order_persons (order_id, seq, full_name, gender, dob, tob, place, country, lat, lon, tz, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
        );
        $personIds = [];
        foreach ($people as $person) {
            $b = $person['block'];
            $insertPerson->execute([
                $orderId,
                $person['seq'],
                $b['name'],
                $b['gender'],
                $b['dob'],
                $b['tob'],
                $b['birthPlace'],
                $b['country'],
                is_numeric($b['latitude']) ? $b['latitude'] : null,
                is_numeric($b['longitude']) ? $b['longitude'] : null,
                is_numeric($b['timezoneOffsetHours']) ? $b['timezoneOffsetHours'] : null,
            ]);
            $personIds[$person['index']] = (int)$pdo->lastInsertId();
        }

        // 6c. Items (one row per person+service) with their cached result.
        $insertItem = $pdo->prepare(
            "INSERT INTO order_items (order_id, person_id, service_code, unit_price, report_status, language, input_payload, calculated_result, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())"
        );
        $createdItems = [];
        foreach ($items as $i => $item) {
            $person = $people[$item['personIndex']];
            $payload = astro_multi_person_item_payload(
                $person['block'],
                $item['serviceCode'],
                $item['extra']['partner'] ?? [],
                $item['extra']['muhurtham'] ?? []
            );
            [$result, $calcError] = astro_multi_person_precalculate_item($item['serviceCode'], $payload);
            if ($calcError) {
                $warnings[] = $item['serviceCode'] . ' for ' . $person['block']['name'] . ' will be calculated before delivery.';
            }

            $insertItem->execute([
                $orderId,
                $personIds[$item['personIndex']],
                $item['serviceCode'],
                $item['unitPrice'],
                $result ? 'CALCULATED' : 'PENDING',
                $item['language'],
                json_encode($payload, JSON_UNESCAPED_UNICODE),
                $result ? json_encode($result, JSON_UNESCAPED_UNICODE) : null,
            ]);
            $itemId = (int)$pdo->lastInsertId();

            $createdItems[] = [
                'id' => $itemId,
                'orderId' => $orderId,
                'personSeq' => $person['seq'],
                'personName' => $person['block']['name'],
                'serviceCode' => $item['serviceCode'],
                'unitPrice' => (float)$item['unitPrice'],
                'reportStatus' => $result ? 'CALCULATED' : 'PENDING',
                'language' => $item['language'],
            ];
        }

        // 6d. Free-beta history row (ONE per order: the free item).
        if ($freeItemIndex >= 0 && !$isAdmin) {
            try {
                $freeItem = $items[$freeItemIndex];
                $insBeta = $pdo->prepare("INSERT INTO beta_ip_orders (ip_address, order_id, order_number, user_id, user_email, service_type, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
                $insBeta->execute([$clientIp, $orderId, $orderNumber, $user['id'], $user['email'], $freeItem['serviceCode']]);
            } catch (Throwable $e) {
                // History table is best-effort; the claim ledger is authoritative.
            }
        }

        // 6e. Consume the captured payment intent with the server total.
        if ($capturedIntent) {
            $consume = $pdo->prepare("UPDATE payment_intents SET status = 'CONSUMED', order_id = ?, updated_at = NOW() WHERE id = ? AND user_id = ? AND status = 'CAPTURED' AND amount = ? AND currency = ? AND order_id IS NULL");
            $consume->execute([$orderId, $capturedIntent['id'], $user['id'], $totalAmount, $currency]);
            if ($consume->rowCount() !== 1) {
                $pdo->rollBack();
                jsonResponse(['success' => false, 'message' => 'Payment could not be bound to this order. No report will be delivered.'], 409);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('ASTRO SIVAM: multi-person order failed - ' . $e->getMessage());
        jsonResponse(['success' => false, 'message' => 'The order could not be created. Nothing was charged - please try again.'], 500);
    }

    // ---- 7. Audit + alerts + response ------------------------------------
    $freeItemCount = $isAdmin ? count($items) : ($freeItemIndex >= 0 ? 1 : 0);
    logAudit(
        $pdo,
        $user['id'],
        $user['name'],
        $user['role'] ?? 'user',
        'MULTI_PERSON_ORDER_PLACED',
        "Order {$orderNumber} placed with " . count($people) . ' people / ' . count($items) . ' reports ('
            . ($isAdmin ? 'admin - no charge' : ($freeItemCount === 1 ? '1 free beta report + ' . $paidItemCount . ' paid' : 'all paid'))
            . '), charged ' . number_format($totalAmount, 2) . " {$currency} via {$paymentMethod}, from IP: {$clientIp}"
    );

    try {
        AstroChatAlerts::sendOrderAlerts($pdo, 'order_confirmed', [[
            'id' => $orderId,
            'orderNumber' => $orderNumber,
            'userId' => $user['id'],
            'userName' => $user['name'],
            'userEmail' => $user['email'],
            'userMobile' => $user['mobile'] ?? '',
            'country' => $country,
            'serviceType' => $headerServiceType,
            'language' => astro_normalize_report_language($body['language'] ?? 'en'),
            'amount' => $totalAmount,
            'currency' => $currency,
            'serviceMode' => $orderServiceMode,
            'status' => 'PENDING',
            'paymentMethod' => $paymentMethod,
            'paymentReference' => $paymentReference !== '' ? $paymentReference : null,
            'paymentStatus' => $paymentStatus,
            'inputPayload' => $headerPayload,
            'createdAt' => date('Y-m-d H:i:s'),
        ]]);
    } catch (Throwable $e) {
        // Alerts never block an order.
    }

    if ($isAdmin) {
        $message = 'Admin order placed successfully (' . count($people) . ' people / ' . count($items) . ' reports) at no charge. Awaiting Admin verification.';
    } elseif ($totalAmount <= 0) {
        $message = 'Order placed successfully in FREE BETA! Your first report is free (1 free report per customer during the Free Beta). Awaiting Admin verification.';
    } elseif ($freeItemCount === 1) {
        $message = 'Order submitted! ' . count($people) . ' people / ' . count($items) . ' reports - the first report is FREE (Free Beta), the remaining ' . $paidItemCount . ' total ' . number_format($totalAmount, 2) . ' ' . $currency . '. Payment will be verified by Admin.';
    } else {
        $message = 'Order submitted! ' . count($people) . ' people / ' . count($items) . ' reports totalling ' . number_format($totalAmount, 2) . ' ' . $currency . '. Payment will be verified by Admin.';
    }

    $orderForClient = [
        'id' => $orderId,
        'orderNumber' => $orderNumber,
        'userId' => $user['id'],
        'userName' => $user['name'],
        'userEmail' => $user['email'],
        'userMobile' => $user['mobile'] ?? '',
        'country' => $country,
        'serviceType' => $headerServiceType,
        'amount' => $totalAmount,
        'currency' => $currency,
        'serviceMode' => $orderServiceMode,
        'status' => 'PENDING',
        'paymentMethod' => $paymentMethod,
        'paymentReference' => $paymentReference !== '' ? $paymentReference : null,
        'paymentIntentId' => $capturedIntent['id'] ?? null,
        'paymentStatus' => $paymentStatus,
        'paymentConfirmed' => (bool)$capturedIntent,
        'emailStatus' => 'PENDING',
        'inputPayload' => $headerPayload,
        'createdAt' => date('Y-m-d H:i:s'),
    ];

    jsonResponse([
        'success' => true,
        'message' => $message,
        // `orders` keeps older clients working (they treat it as a list).
        'orders' => [$orderForClient],
        'order' => $orderForClient,
        'people' => array_map(function ($p) {
            return [
                'seq' => $p['seq'],
                'fullName' => $p['block']['name'],
                'gender' => $p['block']['gender'],
                'dob' => $p['block']['dob'],
                'tob' => $p['block']['tob'],
                'place' => $p['block']['birthPlace'],
                'services' => $p['services'],
            ];
        }, $people),
        'items' => $createdItems,
        // Authoritative money, recomputed on the server.
        'currency' => $currency,
        'totalAmount' => $totalAmount,
        'clientTotalAmount' => isset($body['totalAmount']) && is_numeric($body['totalAmount']) ? (float)$body['totalAmount'] : null,
        'freeCharts' => $freeItemCount,
        'paidCharts' => $isAdmin ? 0 : $paidItemCount,
        'paymentMethod' => $paymentMethod,
        'warnings' => array_values(array_unique($warnings)),
    ], 201);
}
