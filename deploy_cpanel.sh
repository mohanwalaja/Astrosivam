#!/bin/bash
# ====================================================================
# ASTRO SIVAM - 1-Step cPanel SSH & Git Deployment Script
# ====================================================================

set -e

# Detect cPanel public_html directory
if [ -d "$HOME/public_html" ]; then
  TARGET_DIR="$HOME/public_html"
elif [ -d "/home/$USER/public_html" ]; then
  TARGET_DIR="/home/$USER/public_html"
elif [ -d "/var/www/html" ]; then
  TARGET_DIR="/var/www/html"
else
  TARGET_DIR="./public_html"
fi

echo "Starting ASTRO SIVAM deployment to $TARGET_DIR..."
mkdir -p "$TARGET_DIR"

# Keep the live cPanel database configuration out of the deployment overwrite.
CONFIG_BACKUP=""
if [ -f "$TARGET_DIR/api/config.php" ]; then
  # Keep the temporary copy outside the document root so credentials are never
  # web-readable while the deployment is in progress.
  CONFIG_BACKUP="$(mktemp "${TMPDIR:-/tmp}/astrosivam-config.XXXXXX")"
  cp -p "$TARGET_DIR/api/config.php" "$CONFIG_BACKUP"
  chmod 600 "$CONFIG_BACKUP"
fi

copy_public_dist() {
  local file relative target
  while IFS= read -r -d '' file; do
    relative="${file#dist/}"
    case "$relative" in
      *.map|*.cjs|server.cjs) echo "Skipping private build artifact: $relative"; continue ;;
    esac
    target="$TARGET_DIR/$relative"
    mkdir -p "$(dirname "$target")"
    cp -f "$file" "$target"
  done < <(find dist -type f -print0)
}

# Deploy public assets only. A Node server bundle and source maps must never be
# copied into public_html; the Node entry point belongs in a private app root.
if [ -d "dist" ]; then
  echo "Copying public production assets from dist/..."
  copy_public_dist
elif [ -f "dist.zip" ]; then
  echo "Extracting the deployment archive..."
  if unzip -Z1 dist.zip | grep -E '(^|/)([^/]*\.map|[^/]*\.cjs)$' >/dev/null; then
    echo "Refusing dist.zip: it contains a Node bundle or source map that must not be public."
    exit 1
  fi
  unzip -o -q dist.zip -d "$TARGET_DIR"
fi

# Copy the complete PHP API, including hidden protection files (.htaccess and
# .user.ini), but never overwrite or ship the generated fallback signing key.
# The copy is additive so runtime keys and staged storage already on the host
# remain intact.
if [ -d "api" ]; then
  mkdir -p "$TARGET_DIR/api"
  while IFS= read -r -d '' file; do
    relative="${file#api/}"
    case "$relative" in
      astrology/tmp/app_secret_key.txt|astrology/tmp/app_secret_key.txt.*)
        echo "Preserving private runtime signing key: $relative"
        continue
        ;;
    esac
    target="$TARGET_DIR/api/$relative"
    mkdir -p "$(dirname "$target")"
    cp -p "$file" "$target"
  done < <(find api -type f -print0)
fi

# PHP reports use the same ceremony rules as the browser's date scanner.
if [ -f "src/lib/muhurtham/rules.json" ]; then
  mkdir -p "$TARGET_DIR/src/lib/muhurtham"
  cp -f src/lib/muhurtham/rules.json "$TARGET_DIR/src/lib/muhurtham/rules.json"
fi

# Restore the live database configuration after copying source API files.
if [ -n "$CONFIG_BACKUP" ] && [ -f "$CONFIG_BACKUP" ]; then
  cp -p "$CONFIG_BACKUP" "$TARGET_DIR/api/config.php"
  rm -f "$CONFIG_BACKUP"
fi

# Always install the access-control files explicitly; shell globs omit hidden
# files, which previously left cPanel deployments without the API protections.
if [ -f "public/.htaccess" ]; then
  cp -f "public/.htaccess" "$TARGET_DIR/.htaccess"
fi
if [ -f "api/.htaccess" ]; then
  cp -f "api/.htaccess" "$TARGET_DIR/api/.htaccess"
fi
if [ -f "api/astrology/tmp/.htaccess" ]; then
  mkdir -p "$TARGET_DIR/api/astrology/tmp"
  cp -f "api/astrology/tmp/.htaccess" "$TARGET_DIR/api/astrology/tmp/.htaccess"
fi

# Keep PHP readable by its account handler without making credentials or
# runtime signing keys world-readable; directories remain owner-writable.
if [ -d "$TARGET_DIR/api" ]; then
  find "$TARGET_DIR/api" -type d -exec chmod 755 {} + 2>/dev/null || true
  find "$TARGET_DIR/api" -type f -exec chmod 644 {} + 2>/dev/null || true
  chmod 640 "$TARGET_DIR/api/config.php" 2>/dev/null || true
  chmod 600 "$TARGET_DIR/api/astrology/tmp/app_secret_key.txt" 2>/dev/null || true
fi
chmod 644 "$TARGET_DIR/.htaccess" 2>/dev/null || true

echo ""
echo "===================================================================="
echo "Deployment complete: $TARGET_DIR"
echo "===================================================================="
