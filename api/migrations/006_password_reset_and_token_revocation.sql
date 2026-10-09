-- Password reset (emailed code) and session revocation.
-- token_version: bumped on password reset, "sign out everywhere", or admin
--                revocation. Every bearer token and session embeds the value
--                it was issued with and is rejected once it no longer matches.
-- password_reset_*: a hashed, short-lived, attempt-limited reset code.
-- api/db.php also applies these automatically on first connection.
ALTER TABLE `users`
  ADD COLUMN `token_version` INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `password_reset_hash` VARCHAR(255) NULL,
  ADD COLUMN `password_reset_expires_at` DATETIME NULL,
  ADD COLUMN `password_reset_attempts` INT UNSIGNED NOT NULL DEFAULT 0;
