-- ============================================================================
-- ASTRO SIVAM - Migration 004: Remove fabricated birth-profile defaults
-- ============================================================================
--
-- Existing profile inserts must provide the birth location and time-zone
-- coordinates explicitly. This removes legacy MySQL defaults that could turn
-- an omitted value into Nadi, Fiji. Existing rows are preserved unchanged.
--
-- HOW TO RUN (phpMyAdmin)
-- -----------------------
--   1. Select the `astrosivam_db` database.
--   2. Import this file, or paste its ALTER TABLE statement into the SQL tab.
--
-- ============================================================================

ALTER TABLE `birth_profiles`
  MODIFY COLUMN `country` VARCHAR(100) NOT NULL,
  MODIFY COLUMN `latitude` DECIMAL(10, 6) NOT NULL,
  MODIFY COLUMN `longitude` DECIMAL(10, 6) NOT NULL,
  MODIFY COLUMN `timezone_offset_hours` DECIMAL(4, 2) NOT NULL;
