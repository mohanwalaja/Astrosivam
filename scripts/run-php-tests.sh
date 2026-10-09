#!/usr/bin/env bash
set -euo pipefail

php_tests=(
  tests/astrology-accuracy-regression.test.php
  tests/preview-pdf-quality.test.php
  tests/muhurtham-reports.test.php
  tests/wedding-matching-report.test.php
  tests/sample-engine-meaning.test.php
  tests/namakaran-page2.test.php
  tests/payment-webhook.test.php
  tests/mailer-guards.test.php
  tests/rate-limit.test.php
  tests/node-php-parity.test.php
  tests/jathagam-summary-parity.test.php
  tests/jathagam-navamsa-page1.test.php
  tests/report-dob-format.test.php
)

for test_file in "${php_tests[@]}"; do
  printf '\n[PHP TEST] %s\n' "$test_file"
  php "$test_file"
done
