-- Part 4: per-customer chat history for the ASTRO SIVAM AI Astrologer.
--
-- WHY THESE TABLES EXIST
--   The brief requires every message to be stored with a timestamp, the agent
--   to remember earlier messages in the same conversation, and a daily question
--   limit per customer. History is also what makes the agent honest: if it
--   cannot reload a conversation it must not pretend to remember it.
--
-- WHAT IS DELIBERATELY NOT HERE
--   No daily-counter table. api/rate_limit.php already owns sliding-window
--   counting (api_rate_limits, keyed by bucket + identifier), so the daily
--   question limit reuses astro_rate_limit_enforce() with a 24h window keyed on
--   the user id. A second counter would be a second source of truth.
--
-- COLUMN TYPES
--   users.id, orders.id and orders.order_number are the types used here
--   (VARCHAR(64) / VARCHAR(64) / VARCHAR(32)) because orders.id and user_id are
--   VARCHAR(64) in api/schema.sql. Do not "tidy" these to INT - the join would
--   silently stop matching.
--
-- APPLY: mysql -u<user> -p <database> < api/migrations/007_ai_astrologer_chat.sql
--        Safe to re-run: every statement is idempotent.

-- 1. One row per conversation. A customer may have several.
CREATE TABLE IF NOT EXISTS `ai_chat_sessions` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(191) NOT NULL DEFAULT 'Chat with ASTRO SIVAM AI Astrologer',
  `language` VARCHAR(8) NOT NULL DEFAULT 'en',
  -- The order whose chart this conversation is about, once one is attached.
  -- NULL until the customer picks or uploads a report.
  `order_id` VARCHAR(64) NULL,
  `order_number` VARCHAR(32) NULL,
  `service_type` VARCHAR(64) NULL,
  `message_count` INT UNSIGNED NOT NULL DEFAULT 0,
  -- Soft close. Closed sessions are still readable and still exportable; they
  -- just stop accepting new questions, which is what the daily limit needs.
  `status` ENUM('ACTIVE', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
  `last_message_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_ai_chat_sessions_user` (`user_id`, `status`),
  INDEX `idx_ai_chat_sessions_order` (`order_id`),
  INDEX `idx_ai_chat_sessions_last` (`last_message_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Every message. Nothing is ever UPDATEd in place and nothing is deleted by
--    the application: a failed send and its retry are separate rows, because
--    "the message did not go through" is a fact worth keeping.
CREATE TABLE IF NOT EXISTS `ai_chat_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `session_id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  -- customer = what the customer typed
  -- assistant = what the AI Astrologer replied
  -- system    = the disclaimer and the status notices
  -- handoff   = the "Talk to our astrologer" request
  `role` ENUM('customer', 'assistant', 'system', 'handoff') NOT NULL,
  `language` VARCHAR(8) NOT NULL DEFAULT 'en',
  `content` MEDIUMTEXT NOT NULL,
  -- Which report section or life-area card this reply was built from, so a
  -- later audit can show why the agent said what it said.
  `area_id` VARCHAR(64) NULL,
  `section_id` VARCHAR(64) NULL,
  -- The short source reference shown to the customer, stored so a past answer
  -- can always be re-justified.
  `sources` VARCHAR(255) NULL,
  -- SAVED     = written before the customer saw anything
  -- SENT      = delivered to the chat
  -- FAILED    = the model call failed; content holds the customer-facing text
  -- RETRIED   = a retry of an earlier FAILED row
  `status` ENUM('SAVED', 'SENT', 'FAILED', 'RETRIED') NOT NULL DEFAULT 'SAVED',
  `attempt` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `latency_ms` INT UNSIGNED NULL,
  `error_message` VARCHAR(500) NULL,
  -- Attached report, if this message carried one. The file itself is NOT kept;
  -- only the verified order reference and the extraction outcome.
  `attachment_kind` VARCHAR(32) NULL,
  `attachment_filename` VARCHAR(255) NULL,
  `attachment_bytes` INT UNSIGNED NULL,
  `attachment_order_number` VARCHAR(32) NULL,
  `attachment_rejection` VARCHAR(32) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_ai_chat_messages_session` (`session_id`, `id`),
  INDEX `idx_ai_chat_messages_user_time` (`user_id`, `created_at`),
  INDEX `idx_ai_chat_messages_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. "Talk to our astrologer" handoffs. Separate from messages because an admin
--    works this queue; it needs its own status lifecycle and must not be buried
--    in chat history.
CREATE TABLE IF NOT EXISTS `ai_chat_handoffs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `session_id` VARCHAR(64) NULL,
  `message_id` BIGINT UNSIGNED NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `user_name` VARCHAR(191) NOT NULL,
  `user_email` VARCHAR(191) NULL,
  `user_mobile` VARCHAR(64) NULL,
  `language` VARCHAR(8) NOT NULL DEFAULT 'en',
  `question` TEXT NOT NULL,
  -- Why the AI escalated: health, repeated_worry, complaint, declined, requested
  `reason` VARCHAR(32) NOT NULL DEFAULT 'requested',
  `order_number` VARCHAR(32) NULL,
  `status` ENUM('NEW', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'NEW',
  `admin_notes` TEXT NULL,
  `resolved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_ai_chat_handoffs_status` (`status`, `created_at`),
  INDEX `idx_ai_chat_handoffs_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
