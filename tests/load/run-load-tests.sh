#!/usr/bin/env bash
#
# AeroLink — load & stress test runner with results capture.
#
# Runs the k6 scenarios and writes machine-readable + human-readable results
# into ./k6-results/<timestamp>/ for inclusion in the Final Report.
#
# Usage:
#   API_BASE_URL=https://<your-api>/api/v1 \
#   BAGGAGE_HANDLER_EMAIL=baggagehandler@aerolink.app \
#   BAGGAGE_HANDLER_PASSWORD='Demo@2024' \
#   ./run-load-tests.sh [smoke|load|stress|baggage|all]
#
# Defaults to the local docker-compose gateway if API_BASE_URL is unset.
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8080/api/v1}"
SUITE="${1:-all}"
HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${HERE}/k6-results/${STAMP}"
mkdir -p "$OUT"

export API_BASE_URL

if ! command -v k6 >/dev/null 2>&1; then
  echo "ERROR: k6 is not installed. See https://k6.io/docs/get-started/installation/" >&2
  exit 1
fi

echo "▶ API_BASE_URL = $API_BASE_URL"
echo "▶ results dir  = $OUT"

run() {
  local name="$1"; shift
  local script="$1"; shift
  echo "── running: $name ──────────────────────────────────────────"
  # --summary-export gives the aggregate metrics table; --out json gives raw points.
  k6 run \
    --summary-export "${OUT}/${name}.summary.json" \
    --out "json=${OUT}/${name}.raw.json" \
    "$@" \
    "$script" 2>&1 | tee "${OUT}/${name}.console.log" || echo "⚠ $name finished with threshold breaches (captured)."
}

case "$SUITE" in
  smoke)   run smoke   "${HERE}/booking-flow.js" --env SCENARIO=smoke ;;
  load)    run load    "${HERE}/booking-flow.js" ;;
  stress)  run stress  "${HERE}/booking-flow.js" ;;
  baggage) run baggage "${HERE}/baggage-scan.js" ;;
  all)
    run booking-flow "${HERE}/booking-flow.js"
    run baggage      "${HERE}/baggage-scan.js"
    ;;
  *) echo "Unknown suite: $SUITE (use smoke|load|stress|baggage|all)"; exit 1 ;;
esac

# Build a compact metrics digest the report can quote directly.
node "${HERE}/summarise.mjs" "$OUT" > "${OUT}/DIGEST.md" 2>/dev/null || true

echo
echo "✓ Done. Results in: $OUT"
echo "  - *.summary.json  aggregate metrics (latency p95/p99, throughput, error rate)"
echo "  - *.console.log   full k6 console output"
echo "  - DIGEST.md       quick table for the report"
