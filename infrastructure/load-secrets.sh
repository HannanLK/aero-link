#!/usr/bin/env bash

# ── Make Windows-installed CLIs visible to Git Bash (no-op on Linux/macOS) ────
for _d in \
  "/c/Program Files/Amazon/AWSCLIV2" \
  "/c/ProgramData/chocolatey/bin" \
  "/c/Program Files/Docker/Docker/resources/bin" \
  "$HOME/AppData/Local/Microsoft/WinGet/Links" ; do
  if [ -d "$_d" ]; then case ":$PATH:" in *":$_d:"*) ;; *) PATH="$PATH:$_d" ;; esac; fi
done
export PATH
###############################################################################
# AeroLink — populate AWS Secrets Manager.
#
# Terraform creates the secret CONTAINERS (with ignore_changes on the value);
# this script writes the actual values, pulling endpoints from terraform output.
# Idempotent: re-running just overwrites the values.
###############################################################################
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TF_DIR="$HERE/terraform/environments/dev"
source "$HERE/deploy.env"
cd "$TF_DIR"

REGION="$AWS_DEFAULT_REGION"
PW="$TF_VAR_db_master_password"
# Prefer the username Terraform actually set on Aurora; fall back to deploy.env.
# This prevents the db-url user from drifting from the real cluster credential.
DB_USER="$(terraform output -raw aurora_master_username 2>/dev/null || true)"
DB_USER="${DB_USER:-$DB_MASTER_USERNAME}"
echo "Using DB user: ${DB_USER}"

# Fail fast if AWS credentials are not valid (this is the usual cause of the
# "exit 254" failures below — rotated/expired keys or missing permissions).
if ! aws sts get-caller-identity --region "$REGION" >/dev/null; then
  echo "AWS credentials are invalid/expired. Fix AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in deploy.env, then re-run." >&2
  exit 1
fi

# Pull live endpoints from terraform state.
AURORA=$(terraform output -raw aurora_cluster_endpoint | tr -d '\r\n')
REDIS=$(terraform output -raw redis_endpoint | tr -d '\r\n')
MSK=$(terraform output -raw msk_bootstrap_brokers_tls | tr -d '\r\n')

put() {  # put <secret-name> <value>
  local id="/aerolink/dev/$1"
  local val="$2"
  local err
  # Try update first (Terraform already created containers), fall back to create.
  # Capture stderr so a failure shows the real AWS error instead of just "exit 254".
  set +e
  err=$(aws secretsmanager put-secret-value \
    --secret-id "$id" --secret-string "$val" \
    --region "$REGION" 2>&1 >/dev/null)
  local rc=$?
  if [ $rc -ne 0 ]; then
    err=$(aws secretsmanager create-secret \
      --name "$id" --secret-string "$val" \
      --region "$REGION" 2>&1 >/dev/null)
    rc=$?
  fi
  set -e
  if [ $rc -eq 0 ]; then
    echo "  OK  $id"
  else
    echo "  FAILED: $id (exit $rc)"
    echo "      $err"
  fi
}

echo "Writing database URLs ..."
put identity-service/db-url "postgresql://${DB_USER}:${PW}@${AURORA}:5432/identity_db"
put flight-service/db-url   "postgresql://${DB_USER}:${PW}@${AURORA}:5432/flight_db"
put booking-service/db-url  "postgresql://${DB_USER}:${PW}@${AURORA}:5432/booking_db"
put payment-service/db-url  "postgresql://${DB_USER}:${PW}@${AURORA}:5432/payment_db"
put checkin-service/db-url  "postgresql://${DB_USER}:${PW}@${AURORA}:5432/checkin_db"

echo "Writing shared secrets ..."
put shared/jwt-public-key   "$(openssl rand -base64 48)"
put shared/kafka-brokers    "$MSK"
put shared/redis-url        "redis://${REDIS}:6379"
put shared/aurora-admin-url "postgresql://${DB_USER}:${PW}@${AURORA}:5432/postgres"

echo "Writing Stripe key ..."
put payment-service/stripe-api-key "$STRIPE_SECRET_KEY"

# Elastic APM is optional — leave empty placeholders so pods don't crash-loop.
put shared/elastic-apm-server-url   "disabled"
put shared/elastic-apm-secret-token "disabled"

echo "Done. The per-service databases (identity_db, flight_db, booking_db,"
echo "payment_db, checkin_db) are created in-cluster by the platform-init"
echo "db-bootstrap Job (ArgoCD PreSync hook) using shared/aurora-admin-url."
