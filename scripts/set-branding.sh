#!/usr/bin/env bash
# Sets the active icon branding by copying from static/branding/<mode>/
# Usage:  bash scripts/set-branding.sh [production|upgrade]
#         deno task brand:production
#         deno task brand:upgrade

set -euo pipefail

MODE="${1:-production}"

if [[ "$MODE" != "production" && "$MODE" != "upgrade" ]]; then
  echo "Usage: $0 [production|upgrade]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
SRC="$ROOT/static/branding/$MODE"
DEST="$ROOT/static"

cp "$SRC/favicon.svg"          "$DEST/favicon.svg"
cp "$SRC/icon.svg"             "$DEST/icon.svg"
cp "$SRC/icon-512.png"         "$DEST/icon-512.png"
cp "$SRC/icon-192.png"         "$DEST/icon-192.png"
cp "$SRC/apple-touch-icon.png" "$DEST/apple-touch-icon.png"

echo "Branding set to: $MODE"
