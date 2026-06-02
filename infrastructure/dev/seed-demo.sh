#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Demo user seed script
# Runs inside the 'demo-seed' Docker Compose service.
# Waits for the identity-service to be healthy, then:
#   1. Registers 5 demo users via the REST API
#   2. Patches their roles directly in PostgreSQL
#
# Demo credentials (printed at the end):
#   admin@aerolink.app       / Demo@2024  → ADMIN + PASSENGER
#   passenger@aerolink.app   / Demo@2024  → PASSENGER
#   gateagent@aerolink.app   / Demo@2024  → GATE_AGENT
#   flightops@aerolink.app   / Demo@2024  → FLIGHT_OPS
#   immigration@aerolink.app / Demo@2024  → IMMIGRATION_OFFICER
# ─────────────────────────────────────────────────────────────────────────────

set -e

IDENTITY_URL="http://identity-service:3000/api/v1/auth"
PGPASSWORD=aerolink_dev
PGUSER=aerolink
PGHOST=postgres
PGDB=identity_service
PASSWORD="Demo@2024"

# ── Install curl + postgresql-client in the alpine container ─────────────────
apk add --no-cache curl postgresql-client > /dev/null 2>&1

# ── Wait for identity-service to be healthy ───────────────────────────────────
echo "⏳ Waiting for identity-service..."
until curl -sf "http://identity-service:3000/api/v1/health/live" > /dev/null 2>&1; do
  sleep 2
done
echo "✅ identity-service is ready"
sleep 2   # extra grace period for DB pool warm-up

# ── Helper: register one user ─────────────────────────────────────────────────
register() {
  EMAIL=$1; FIRST=$2; LAST=$3
  RESP=$(curl -sf -w "\n%{http_code}" -X POST "${IDENTITY_URL}/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"firstName\":\"${FIRST}\",\"lastName\":\"${LAST}\"}" 2>&1 || true)
  CODE=$(echo "$RESP" | tail -1)
  if [ "$CODE" = "201" ] || [ "$CODE" = "200" ]; then
    echo "  ✓ Registered ${EMAIL}"
  elif [ "$CODE" = "409" ]; then
    echo "  ↩ Already exists ${EMAIL}"
  else
    echo "  ⚠ ${EMAIL} → HTTP ${CODE} (continuing)"
  fi
}

echo ""
echo "👤 Registering demo users..."
register "admin@aerolink.app"       "Admin"       "User"
register "passenger@aerolink.app"   "Jane"        "Doe"
register "gateagent@aerolink.app"   "Gate"        "Agent"
register "flightops@aerolink.app"   "Flight"      "Ops"
register "immigration@aerolink.app" "Immigration" "Officer"

# ── Patch roles via psql ──────────────────────────────────────────────────────
# The enum type may need the new values added if migrations haven't run the
# ALTER TYPE yet. We add them idempotently before updating rows.
echo ""
echo "🔑 Patching user roles in PostgreSQL..."

PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -U "$PGUSER" -d "$PGDB" <<'SQL'

-- Add any new enum values that migrations may not have created yet
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'IMMIGRATION_OFFICER'
      AND enumtypid = 'UserRole'::regtype) THEN
    ALTER TYPE "UserRole" ADD VALUE 'IMMIGRATION_OFFICER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'FLIGHT_ATTENDANT'
      AND enumtypid = 'UserRole'::regtype) THEN
    ALTER TYPE "UserRole" ADD VALUE 'FLIGHT_ATTENDANT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AIRCRAFT_CREW'
      AND enumtypid = 'UserRole'::regtype) THEN
    ALTER TYPE "UserRole" ADD VALUE 'AIRCRAFT_CREW';
  END IF;
END $$;

-- Assign roles
UPDATE users SET roles = ARRAY['ADMIN','PASSENGER']::"UserRole"[]
  WHERE email = 'admin@aerolink.app';

UPDATE users SET roles = ARRAY['PASSENGER']::"UserRole"[]
  WHERE email = 'passenger@aerolink.app';

UPDATE users SET roles = ARRAY['GATE_AGENT']::"UserRole"[]
  WHERE email = 'gateagent@aerolink.app';

UPDATE users SET roles = ARRAY['FLIGHT_OPS']::"UserRole"[]
  WHERE email = 'flightops@aerolink.app';

UPDATE users SET roles = ARRAY['IMMIGRATION_OFFICER']::"UserRole"[]
  WHERE email = 'immigration@aerolink.app';

SELECT email, roles FROM users ORDER BY "createdAt";
SQL

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo "  ✅  DEMO CREDENTIALS READY"
echo "════════════════════════════════════════════════"
echo "  URL:      http://localhost:5173"
echo "  Password: Demo@2024  (all users)"
echo ""
echo "  admin@aerolink.app       → Admin dashboard"
echo "  passenger@aerolink.app   → Book & manage flights"
echo "  gateagent@aerolink.app   → Gate Agent panel"
echo "  flightops@aerolink.app   → Flight Ops panel"
echo "  immigration@aerolink.app → Immigration control"
echo "════════════════════════════════════════════════"
