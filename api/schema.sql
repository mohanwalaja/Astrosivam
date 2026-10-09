-- ASTRO SIVAM Single MySQL Database Schema (astrosivam_db)
-- Ready for phpMyAdmin / BigRock cPanel MySQL Database Wizard

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `mobile` VARCHAR(64) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'customer') NOT NULL DEFAULT 'customer',
  `auth_provider` VARCHAR(32) NOT NULL DEFAULT 'local',
  `provider_subject` VARCHAR(191) NULL,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 1,
  `otp_hash` VARCHAR(255) NULL,
  `otp_expires_at` DATETIME NULL,
  `country` VARCHAR(100) NOT NULL DEFAULT 'Fiji',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` DATETIME NULL,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_email` (`email`),
  UNIQUE KEY `uq_users_provider_subject` (`auth_provider`, `provider_subject`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Customer Birth Profiles Table
CREATE TABLE IF NOT EXISTS `birth_profiles` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `dob` VARCHAR(32) NOT NULL,
  `tob` VARCHAR(32) NOT NULL,
  `birth_place` VARCHAR(191) NOT NULL,
  `country` VARCHAR(100) NOT NULL,
  `latitude` DECIMAL(10, 6) NOT NULL,
  `longitude` DECIMAL(10, 6) NOT NULL,
  `timezone_offset_hours` DECIMAL(4, 2) NOT NULL,
  `gender` ENUM('M', 'F', 'O') NOT NULL DEFAULT 'M',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_birth_profiles_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `order_number` VARCHAR(32) NOT NULL UNIQUE,
  `group_id` VARCHAR(64) NULL,
  `group_order_index` INT NOT NULL DEFAULT 0,
  `user_id` VARCHAR(64) NOT NULL,
  `user_name` VARCHAR(191) NOT NULL,
  `user_email` VARCHAR(191) NOT NULL,
  `user_mobile` VARCHAR(64) NOT NULL,
  `country` VARCHAR(100) NOT NULL DEFAULT 'Fiji',
  `service_type` VARCHAR(64) NOT NULL,
  `language` VARCHAR(16) NOT NULL DEFAULT 'en',
  `amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'FJD',
  `service_mode` ENUM('FREE_BETA', 'PAID') NOT NULL DEFAULT 'PAID',
  `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `payment_method` VARCHAR(32) NULL,
  `payment_reference` VARCHAR(191) NULL,
  `payment_intent_id` VARCHAR(80) NULL,
  `payment_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING_ADMIN',
  `payment_confirmed` TINYINT(1) NOT NULL DEFAULT 0,
  `email_status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `email_sent_at` DATETIME NULL,
  `email_last_status_message` TEXT NULL,
  `input_payload` LONGTEXT NOT NULL,
  `calculated_result` LONGTEXT NULL,
  `has_pdf` TINYINT(1) NOT NULL DEFAULT 0,
  `has_invoice` TINYINT(1) NOT NULL DEFAULT 0,
  `admin_notes` TEXT NULL,
  `refund_status` ENUM('NONE', 'REQUESTED', 'REFUNDED', 'REJECTED') NOT NULL DEFAULT 'NONE',
  `refund_reason` TEXT NULL,
  `ip_address` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_orders_user_id` (`user_id`),
  INDEX `idx_orders_group_id` (`group_id`),
  INDEX `idx_orders_status` (`status`),
  INDEX `idx_orders_service_type` (`service_type`),
  INDEX `idx_orders_ip` (`ip_address`),
  INDEX `idx_orders_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Beta IP Limit Tracking Table (Free Beta: exactly 1 FREE REPORT per IP
--    address — the first chart of the first order only. A family order
--    records ONE row: the free first member; the rest of the family pays.)
-- 3b. Durable online payment intents. A provider reference is not
-- accepted as payment until its intent is captured and then bound to one
-- server-priced order by the authenticated owner.
CREATE TABLE IF NOT EXISTS `payment_intents` (
  `id` VARCHAR(80) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `provider` VARCHAR(32) NOT NULL,
  `payment_method` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'CREATED',
  `amount` DECIMAL(10, 2) NOT NULL,
  `currency` VARCHAR(8) NOT NULL,
  `gateway_order_id` VARCHAR(191) NOT NULL,
  `gateway_payment_id` VARCHAR(191) NULL,
  `gateway_signature` VARCHAR(512) NULL,
  `payment_reference` VARCHAR(191) NULL,
  `payer_account` VARCHAR(191) NULL,
  `order_id` VARCHAR(64) NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_payment_intents_user_status` (`user_id`, `status`),
  INDEX `idx_payment_intents_reference` (`payment_reference`),
  INDEX `idx_payment_intents_gateway_order` (`gateway_order_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3c. Payment provider callbacks (webhook audit trail + idempotency). The
--     (provider, external_event_id) pair makes a provider retry a no-op.
CREATE TABLE IF NOT EXISTS `payment_webhook_events` (
  `id` VARCHAR(80) NOT NULL PRIMARY KEY,
  `provider` VARCHAR(32) NOT NULL,
  `external_event_id` VARCHAR(191) NOT NULL,
  `event_type` VARCHAR(64) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `intent_id` VARCHAR(80) NULL,
  `gateway_order_id` VARCHAR(191) NULL,
  `gateway_payment_id` VARCHAR(191) NULL,
  `detail` VARCHAR(500) NULL,
  `payload_digest` CHAR(32) NULL,
  `ip_address` VARCHAR(64) NULL,
  `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_payment_webhook_provider_event` (`provider`, `external_event_id`),
  INDEX `idx_payment_webhook_received` (`received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `beta_ip_orders` (
  `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  `ip_address` VARCHAR(64) NOT NULL,
  `order_id` VARCHAR(64) NOT NULL,
  `order_number` VARCHAR(32) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `user_email` VARCHAR(191) NOT NULL,
  `service_type` VARCHAR(64) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_beta_ip_address` (`ip_address`),
  INDEX `idx_beta_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The unique claim ledger makes the one-free-order-per-IP check atomic even
-- when multiple PHP workers receive requests concurrently. Legacy claims are
-- backfilled by api/services/index.php.
CREATE TABLE IF NOT EXISTS `beta_ip_claims` (
  `ip_address` VARCHAR(64) NOT NULL PRIMARY KEY,
  `claimed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4b. Banned IP Blacklist Table (Anti-Fraud & Anti-Spam Protection)
CREATE TABLE IF NOT EXISTS `banned_ips` (
  `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  `ip_address` VARCHAR(64) NOT NULL UNIQUE,
  `reason` VARCHAR(255) NOT NULL DEFAULT 'Repeated fake orders / policy violation',
  `banned_by` VARCHAR(191) NULL DEFAULT 'Admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_banned_ip` (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Astrology Team Members Table
CREATE TABLE IF NOT EXISTS `team_members` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `title_ta` VARCHAR(191) NULL,
  `title_hi` VARCHAR(191) NULL,
  `bio` TEXT NOT NULL,
  `location` VARCHAR(191) NOT NULL,
  `experience_years` INT NOT NULL DEFAULT 15,
  `specializations` TEXT NOT NULL,
  `photo_url` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `contact_phone` VARCHAR(64) NULL,
  `contact_email` VARCHAR(191) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. System Settings Table
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
  `service_mode` ENUM('FREE_BETA', 'PAID') NOT NULL DEFAULT 'PAID',
  `free_beta_active` TINYINT(1) NOT NULL DEFAULT 0,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'FJD',
  `pricing` LONGTEXT NOT NULL,
  `payment_methods` LONGTEXT NOT NULL,
  `email_settings` LONGTEXT NOT NULL,
  `general_settings` LONGTEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Audit Logs Table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NULL,
  `user_name` VARCHAR(191) NULL,
  `user_role` VARCHAR(32) NULL,
  `action` VARCHAR(64) NOT NULL,
  `details` TEXT NULL,
  `ip_address` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_logs_action` (`action`),
  INDEX `idx_audit_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Contact Inquiries Table
CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `mobile` VARCHAR(64) NULL,
  `subject` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('UNREAD', 'READ', 'REPLIED') NOT NULL DEFAULT 'UNREAD',
  `email_status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  `email_recipient` VARCHAR(191) NULL,
  `email_dispatched_at` DATETIME NULL,
  `email_last_status_message` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_contact_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User accounts are never seeded with shared/default credentials.
-- Create the first administrator with the trusted CLI provisioning tool.

-- SEED DATA: Default Settings
INSERT INTO `system_settings` (`id`, `service_mode`, `free_beta_active`, `currency`, `pricing`, `payment_methods`, `email_settings`, `general_settings`, `updated_at`)
VALUES (
  1,
  'PAID',
  0,
  'FJD',
  '{"BIRTH_JATHAGAM":{"fjd":35,"usd":18},"MARRIAGE_COMPATIBILITY":{"fjd":45,"usd":22},"BABY_NAMING":{"fjd":30,"usd":15}}',
  '{"mpaisa":{"enabled":true,"accountName":"ASTRO SIVAM CONSULTING","mobileNumber":"9998888","qrCodeUrl":"","instructions":"Send money via Vodafone M-PAiSA app to 9998888 and enter the 8-digit reference ID."},"mycash":{"enabled":true,"accountName":"ASTRO SIVAM","mobileNumber":"7776666","qrCodeUrl":"","instructions":"Transfer via Digicel MyCash app to 7776666 and paste the Transaction Ref ID."},"paypal":{"enabled":true,"merchantEmail":"admin@astrosivam.com","instructions":"Pay securely using PayPal or international Debit/Credit card."}}',
  '{"smtpHost":"mail.astrosivam.com","smtpPort":465,"smtpUser":"admin@astrosivam.com","smtpPass":"","smtpSecure":"ssl","fromName":"ASTRO SIVAM","fromEmail":"admin@astrosivam.com","adminNotificationEmail":"admin@astrosivam.com","replyToEmail":"admin@astrosivam.com"}',
  '{"siteName":"ASTRO SIVAM","tagline":"Authentic Vedic Astrology & Matchmaking","turnaroundHours":12,"contactPhone":"+679 999 8888","contactEmail":"admin@astrosivam.com"}',
  NOW()
)
ON DUPLICATE KEY UPDATE `currency` = VALUES(`currency`);

-- SEED DATA: Team Members
INSERT INTO `team_members` (`id`, `name`, `title`, `title_ta`, `bio`, `location`, `experience_years`, `specializations`, `photo_url`, `is_active`, `display_order`, `contact_phone`, `contact_email`)
VALUES 
('tm_01', 'Dr. S. K. Narayana Sastrigal', 'Head Sanskrit Scholar & Jyotisha Acharya', 'முதன்மை சமஸ்கிருத ஜோதிட ஆச்சார்யர்', 'Over 32 years of Vedic astrology scholarship, specialized in Jaimini Sutras, Prashna Sastra, and Dasha calculations from Thanjavur, Tamil Nadu.', 'Thanjavur, Tamil Nadu, India', 32, '["Birth Jathagam", "Dasha Bhukti", "Prashna", "Remedial Puja"]', 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&h=200&fit=crop', 1, 1, '+91 94441 23456', 'narayana@astrosivam.com'),
('tm_02', 'Brahmasri V. Ganesa Sivachariyar', 'Senior Temple Sivachariyar & Muhurtha Vidwan', 'முதுநிலை சிவாச்சாரியார் & முகூர்த்த வித்வான்', 'Heritage Shaiva Sivachariyar with deep expertise in 10-Poruthams marriage matching, dosha nivrutti, and temple consecration rituals.', 'Madurai, Tamil Nadu, India', 28, '["Marriage Poruthams", "Dosha Nivrutti", "Muhurtham", "Temple Puja"]', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop', 1, 2, '+91 98410 78901', 'ganesan@astrosivam.com'),
('tm_03', 'Jyothida Rathna K. Ramachandran', 'Vedic Ephemeris & Astronomical Systems Specialist', 'பஞ்சாங்க கணித ஜோதிட ரத்னா', 'Expert in Nirayana Surya Siddhanta ephemeris models, planetary latitudes, and precise Nakshatra Pada computations for global diaspora coordinates.', 'Chennai, Tamil Nadu, India', 24, '["Ephemeris Calculations", "Kundali Generation", "Baby Naming Syllables", "Panchangam"]', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop', 1, 3, '+91 98840 54321', 'ramachandran@astrosivam.com')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

SET FOREIGN_KEY_CHECKS = 1;
