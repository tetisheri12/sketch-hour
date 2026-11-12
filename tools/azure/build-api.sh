#!/usr/bin/env bash
# Builds the deploy package for Sketch Hour's API: dist/sketchhour-api.zip
# Needs Node 20+ and zip. Run from the repo folder:  bash tools/azure/build-api.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/dist"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp -R "$ROOT/api/host.json" "$ROOT/api/package.json" "$ROOT/api/package-lock.json" "$ROOT/api/src" "$STAGE/"
# the same board reader the daily sync uses
cp -R "$ROOT/scripts/lib" "$STAGE/lib"
(cd "$STAGE" && npm ci --omit=dev --no-audit --no-fund --loglevel=error)

mkdir -p "$OUT"
rm -f "$OUT/sketchhour-api.zip"
(cd "$STAGE" && zip -q -r -X "$OUT/sketchhour-api.zip" host.json package.json package-lock.json src lib node_modules)
echo "Built $OUT/sketchhour-api.zip ($(du -h "$OUT/sketchhour-api.zip" | cut -f1))"
