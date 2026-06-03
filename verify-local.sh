#!/usr/bin/env bash
###############################################################################
# AeroLink — local verification (run on your machine before deploying).
# Works in Git Bash / WSL / macOS / Linux. Requires Node >=22 + npm.
#
#   bash verify-local.sh
#
# NOTE on Prisma: every service's `prisma generate` writes to the SAME
# node_modules/.prisma/client, so building all services in parallel would race
# (the last client wins). We therefore generate → build → test each Prisma
# service SEQUENTIALLY, so each runs against its own freshly-generated client.
# (Docker/CI are unaffected — they build each service in its own isolated image.)
###############################################################################
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
fail=0
run() { echo -e "\n\033[0;32m▶ $*\033[0m"; "$@" || { echo -e "\033[0;31m✗ failed: $*\033[0m"; fail=1; }; }

PRISMA_SVCS="identity-service flight-service booking-service payment-service checkin-service"
PLAIN_SVCS="baggage-service notification-service lambda-qr"

# 1) Clean stray compiled artifacts that leaked into src/ (build pollution).
echo "▶ Cleaning stray compiled files from services/*/src ..."
find services/*/src \( -name "*.js" -o -name "*.js.map" -o -name "*.d.ts.map" \) -delete 2>/dev/null || true
for f in $(find services/*/src -name "*.d.ts" 2>/dev/null); do [ -f "${f%.d.ts}.ts" ] && rm -f "$f"; done

# 2) Install workspace deps (Swagger, OpenTelemetry, Kafka IAM signer, etc.).
run npm install

# 3) Build shared packages first (services import their built dist).
run npm run packages:build

# 4) Prisma services — generate + build + test, one at a time.
for svc in $PRISMA_SVCS; do
  echo -e "\n\033[1;33m═══ $svc (generate → build → test) ═══\033[0m"
  run bash -c "cd services/$svc && npx prisma generate && npm run build && npm test -- --coverage --passWithNoTests"
done

# 5) Non-Prisma services — build + test.
for svc in $PLAIN_SVCS; do
  echo -e "\n\033[1;33m═══ $svc (build → test) ═══\033[0m"
  run bash -c "cd services/$svc && npm run build && npm test -- --coverage --passWithNoTests"
done

# 6) Frontend — build + type-check.
echo -e "\n\033[1;33m═══ webui (build → type-check) ═══\033[0m"
run bash -c "cd webui && npm run build && npx tsc --noEmit"

echo
if [ "$fail" -eq 0 ]; then
  echo -e "\033[0;32m✓ ALL CHECKS PASSED — safe to deploy (infrastructure/deploy.sh).\033[0m"
else
  echo -e "\033[0;31m✗ Some checks failed — see output above.\033[0m"
fi
exit $fail
