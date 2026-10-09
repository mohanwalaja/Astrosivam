-- ============================================================================
-- ASTRO SIVAM - Migration 003: Multi-Person Orders
-- ============================================================================
--
-- WHY
-- ---
-- One order can now contain up to 6 PEOPLE (birth details) and each person can
-- contain one or more SERVICES. The customer pays ONE total for the order.
--
-- The `orders` row becomes the ORDER HEADER (one row per order); the people and
-- the services they bought live in the two new child tables:
--
--   order_persons  1 person  per row  -> birth details (name, gender, dob, tob,
--                                       place, lat, lon, tz)
--   order_items    1 service per row  -> service_code, unit_price, report_status
--
-- Both tables cascade from `orders` (ON DELETE CASCADE) and from each other, so
-- deleting an order removes its people and their items.
--
-- Legacy orders (one row = one chart) are BACKFILLED: every existing order gets
-- exactly ONE person (seq = 1) and exactly ONE item, so the admin portal and the
-- report pipeline can treat old and new orders the same way.
--
-- HOW TO RUN (phpMyAdmin)
-- -----------------------
--   1. Select the `astrosivam_db` database in phpMyAdmin.
--   2. "Import" -> choose this file -> Go.  (Or "SQL" -> paste -> Go.)
--   3. Re-running it is safe: CREATE TABLE IF NOT EXISTS + INSERT ... WHERE
--      NOT EXISTS leave an already-migrated database untouched.
--
-- NOTE FOR DEVELOPERS
-- -------------------
-- api/services/multi_person_order.php contains an idempotent runtime guard
-- (`astro_ensure_multi_person_tables`) that creates the same two tables when
-- they are missing, matching the existing self-healing DDL convention of this
-- project. Keep both definitions in sync.
--
-- Pure DDL + backfill, no data is destroyed and no column of `orders` changes.
-- ============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1. order_persons - one row per person in the order (max 6 enforced in app)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_persons` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(64) NOT NULL,
  `seq` INT NOT NULL DEFAULT 1,
  `full_name` VARCHAR(191) NOT NULL,
  `gender` ENUM('M', 'F', 'O') NOT NULL DEFAULT 'M',
  `dob` VARCHAR(32) NOT NULL,
  `tob` VARCHAR(32) NOT NULL,
  `place` VARCHAR(191) NOT NULL,
  `country` VARCHAR(100) NOT NULL,
  `lat` DECIMAL(10, 6) NULL,
  `lon` DECIMAL(10, 6) NULL,
  `tz` DECIMAL(4, 2) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_order_persons_seq` (`order_id`, `seq`),
  INDEX `idx_order_persons_order` (`order_id`),
  CONSTRAINT `fk_order_persons_order`
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. order_items - one row per service bought for one person
--    `language`, `input_payload` and `calculated_result` are the per-item
--    report cache: the admin Preview and Send both read this one result, so
--    what the admin previews is exactly what the customer receives.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(64) NOT NULL,
  `person_id` INT NOT NULL,
  `service_code` VARCHAR(64) NOT NULL,
  `unit_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `report_status` ENUM('PENDING', 'CALCULATED', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `language` VARCHAR(16) NOT NULL DEFAULT 'en',
  `input_payload` LONGTEXT NULL,
  `calculated_result` LONGTEXT NULL,
  `sent_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_order_items_order` (`order_id`),
  INDEX `idx_order_items_person` (`person_id`),
  INDEX `idx_order_items_status` (`report_status`),
  CONSTRAINT `fk_order_items_order`
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_person`
    FOREIGN KEY (`person_id`) REFERENCES `order_persons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. Backfill - every legacy order becomes one person + one item
--    (idempotent: skips orders that already have a person / items)
-- ---------------------------------------------------------------------------
-- MySQL 5.7+/MariaDB 10.2+ JSON functions are used with JSON_VALID guards so a
-- legacy row with a non-JSON payload can never abort the migration.
INSERT INTO `order_persons`
  (`order_id`, `seq`, `full_name`, `gender`, `dob`, `tob`, `place`, `country`, `lat`, `lon`, `tz`, `created_at`)
SELECT
  o.`id`,
  1,
  COALESCE(
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.name')) END, ''),
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.bride.name')) END, ''),
    NULLIF(o.`user_name`, ''),
    'Unknown'
  ),
  CASE UPPER(COALESCE(
    CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.gender')) END,
    CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.bride.gender')) END,
    'M'
  ))
    WHEN 'F' THEN 'F'
    WHEN 'FEMALE' THEN 'F'
    WHEN 'O' THEN 'O'
    WHEN 'OTHER' THEN 'O'
    ELSE 'M'
  END,
  COALESCE(
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.dob')) END, ''),
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.bride.dob')) END, ''),
    ''
  ),
  COALESCE(
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.tob')) END, ''),
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.bride.tob')) END, ''),
    ''
  ),
  COALESCE(
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.birthPlace')) END, ''),
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.bride.birthPlace')) END, ''),
    ''
  ),
  COALESCE(
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.country')) END, ''),
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.birthCountry')) END, ''),
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.bride.country')) END, ''),
    NULLIF(CASE WHEN JSON_VALID(o.`input_payload`) THEN JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.bride.birthCountry')) END, ''),
    ''
  ),
  CASE WHEN JSON_VALID(o.`input_payload`) THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.latitude')) AS DECIMAL(10, 6)) END,
  CASE WHEN JSON_VALID(o.`input_payload`) THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.longitude')) AS DECIMAL(10, 6)) END,
  CASE WHEN JSON_VALID(o.`input_payload`) THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(o.`input_payload`, '$.timezoneOffsetHours')) AS DECIMAL(4, 2)) END,
  COALESCE(o.`created_at`, NOW())
FROM `orders` o
WHERE NOT EXISTS (SELECT 1 FROM `order_persons` p WHERE p.`order_id` = o.`id`);

INSERT INTO `order_items`
  (`order_id`, `person_id`, `service_code`, `unit_price`, `report_status`, `language`, `input_payload`, `calculated_result`, `sent_at`, `created_at`)
SELECT
  o.`id`,
  p.`id`,
  COALESCE(NULLIF(o.`service_type`, ''), 'BIRTH_JATHAGAM'),
  COALESCE(o.`amount`, 0),
  CASE
    WHEN UPPER(COALESCE(o.`email_status`, '')) = 'SENT' THEN 'SENT'
    WHEN COALESCE(o.`calculated_result`, '') <> '' THEN 'CALCULATED'
    ELSE 'PENDING'
  END,
  COALESCE(NULLIF(o.`language`, ''), 'en'),
  o.`input_payload`,
  o.`calculated_result`,
  CASE WHEN UPPER(COALESCE(o.`email_status`, '')) = 'SENT' THEN o.`email_sent_at` ELSE NULL END,
  COALESCE(o.`created_at`, NOW())
FROM `orders` o
JOIN `order_persons` p ON p.`order_id` = o.`id` AND p.`seq` = 1
WHERE NOT EXISTS (SELECT 1 FROM `order_items` i WHERE i.`order_id` = o.`id`);

-- ---------------------------------------------------------------------------
-- 4. Verification (optional): both counts must match after the backfill
-- ---------------------------------------------------------------------------
-- SELECT (SELECT COUNT(*) FROM orders)          AS orders,
--        (SELECT COUNT(*) FROM order_persons)   AS persons,
--        (SELECT COUNT(*) FROM order_items)     AS items;
