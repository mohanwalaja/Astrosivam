#!/usr/bin/env bash
#
# Sync the repository's PHP backend into a cPanel-style public_html/ tree.
#
# WHY THIS EXISTS
# ---------------
# `deploy_cpanel.sh` deploys `api/*` to `/home/$USER/public_html/api/` on the live
# host. `public_html/` is git-ignored and is NOT part of this checkout, so the
# "synced copy" of `api/admin/index.php` cannot be edited here. This script
# performs the exact same copy locally (same exclusions, same config.php
# protection), so you can either:
#
#   1. run it against a local copy of the site root, or
#   2. run it against a mounted/rsynced public_html directory, or
#   3. use it as the checklist for uploading the changed files by hand.
#
# USAGE
#   scripts/sync_public_html_api.sh [public_html_dir]
#
#   public_html_dir  target directory (default: $ASTROSIVAM_PUBLIC_HTML,
#                    else ./public_html next to the repo)
#
# SAFETY
#   * api/config.php is NEVER overwritten when the target already has one
#     (it holds the live database credentials) - identical to deploy_cpanel.sh.
#   * api/astrology/tmp/app_secret_key.txt (the HMAC signing key) is never
#     copied.
#   * Nothing is deleted; only files present in this repo are (re)copied.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-${ASTROSIVAM_PUBLIC_HTML:-$ROOT/public_html}}"

if [ ! -d "$ROOT/api" ]; then
  echo "error: $ROOT/api not found - run this from a checkout of the repository." >&2
  exit 1
fi

mkdir -p "$TARGET/api"

copied=0
skipped=0

while IFS= read -r -d '' file; do
  relative="${file#"$ROOT"/api/}"

  case "$relative" in
    astrology/tmp/app_secret_key.txt|astrology/tmp/app_secret_key.txt.*)
      skipped=$((skipped + 1))
      continue
      ;;
  esac

  destination="$TARGET/api/$relative"

  # Keep the live database credentials on an already-configured host.
  if [ "$relative" = "config.php" ] && [ -f "$destination" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  mkdir -p "$(dirname "$destination")"
  cp -f "$file" "$destination"
  copied=$((copied + 1))
done < <(find "$ROOT/api" -type f -print0)

# The Muhurtham rule data is served from src/lib/muhurtham/rules.json.
if [ -f "$ROOT/src/lib/muhurtham/rules.json" ]; then
  mkdir -p "$TARGET/src/lib/muhurtham"
  cp -f "$ROOT/src/lib/muhurtham/rules.json" "$TARGET/src/lib/muhurtham/rules.json"
fi

# Local source-based astrologer knowledge files (guided menu, rules, remedies, sources).
if [ -d "$ROOT/knowledge" ]; then
  while IFS= read -r -d '' file; do
    destination="$TARGET/${file#"$ROOT"/}"
    mkdir -p "$(dirname "$destination")"
    cp -f "$file" "$destination"
    copied=$((copied + 1))
  done < <(find "$ROOT/knowledge" -type f -print0)
fi

# Static front-end bundle (dist/*), same source-map exclusion as deploy_cpanel.sh.
# A CommonJS server bundle is not part of the PHP/shared-host deployment.
if [ -d "$ROOT/dist" ]; then
  while IFS= read -r -d '' file; do
    case "$file" in
      *.map) continue ;;
      *.cjs)
        echo "error: refusing to deploy executable server bundle: $file" >&2
        exit 1
        ;;
    esac
    destination="$TARGET/${file#"$ROOT"/dist/}"
    mkdir -p "$(dirname "$destination")"
    cp -f "$file" "$destination"
    copied=$((copied + 1))
  done < <(find "$ROOT/dist" -type f -print0)
fi

if [ -f "$ROOT/public/.htaccess" ]; then
  cp -f "$ROOT/public/.htaccess" "$TARGET/.htaccess"
fi

echo "Synced $copied file(s) into $TARGET (skipped $skipped protected file(s))."
echo
echo "Per-file permissions expected on the host (deploy_cpanel.sh):"
echo "  directories 755, files 644, api/config.php 640, api/astrology/tmp/app_secret_key.txt 600"
echo
echo "REMOTE HOST: this script cannot upload. After running it, upload the changed"
echo "files (or run the same commands over SSH), in particular:"
echo "  api/services/index.php"
echo "  api/services/multi_person_order.php"
echo "  api/admin/index.php"
echo "  api/admin/order_items.php"
echo "  api/migrations/003_multi_person_orders.sql  (import this one in phpMyAdmin)"
