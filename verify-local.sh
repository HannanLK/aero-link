#!/usr/bin/env bash
###############################################################################
# AeroLink — local verification (run on your machine before deploying).
# Works in Git Bash / WSL / macOS / Linux. Requires Node >=22 + npm.
#
#   chmod +x verify-local.sh && ./verify-local.sh
###############################################################################
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
fail=0
run() { echo -e "\n\033[0;32m▶ $*\033[0m"; "$@" || { echo -e "\033[0;31m✗ failed: $*\033[0m"; fail=1; }; }

# 1) Clean stray compiled artifacts that leaked into src/ (build pollution).
echo "▶ Cleaning stray compiled files from services/*/src ..."
find services/*/src \( -name "*.js" -o -name "*.js.map" -o -name "*.d.ts.map" \) -delete 2>/dev/null || true
for f in $(find services/*/src -name "*.d.ts" 2>/dev/null); do [ -f "${f%.d.ts}.ts" ] && rm -f "$f"; done

# 2) Install workspace deps (brings in @nestjs/swagger + @opentelemetry/*).
run npm install

# 3) Build shared packages first (services import their built dist).
run npm run packages:build

# 4) Generate Prisma clients (needs network for the engine the first time).
for svc in identity-service flight-service booking-service payment-service checkin-service; do
  if [ -f "services/$svc/prisma/schema.prisma" ]; then
    run npx --workspace="services/$svc" prisma generate
  fi
done

# 5) Type-check + build every service and the webui.
run npx turbo run build

# 6) Unit tests with coverage.
run npx turbo run test -- --coverage

# 7) Frontend type-check.
( cd webui && run npx tsc --noEmit )

echo
if [ "$fail" -eq 0 ]; then
  echo -e "\033[0;32m✓ ALL CHECKS PASSED — safe to deploy (infrastructure/deploy.sh).\033[0m"
else
  echo -e "\033[0;31m✗ Some checks failed — see output above.\033[0m"
fi
exit $fail
