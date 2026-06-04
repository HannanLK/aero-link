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
USER="$DB_MASTER_USERNAME"

# Pull live endpoints from terraform state.
AURORA=$(terraform output -raw aurora_cluster_endpoint)
REDIS=$(terraform output -raw redis_endpoint)
MSK=$(terraform output -raw msk_bootstrap_brokers_tls)

put() {  # put <secret-suffix> <value>
  local id="/aerolink/dev/$1"; shift
  if aws secretsmanager describe-secret --secret-id "$id" --region "$REGION" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value --secret-id "$id" --secret-string "$1" --region "$REGION" >/dev/null
  else
    aws secretsmanager create-secret --name "$id" --secret-string "$1" --region "$REGION" >/dev/null
  fi
  echo "  ✓ $id"
}

echo "Writing database URLs ..."
put identity-service/db-url "postgresql://${USER}:${PW}@${AURORA}:5432/identity_db"
put flight-service/db-url   "postgresql://${USER}:${PW}@${AURORA}:5432/flight_db"
put booking-service/db-url  "postgresql://${USER}:${PW}@${AURORA}:5432/booking_db"
put payment-service/db-url  "postgresql://${USER}:${PW}@${AURORA}:5432/payment_db"
put checkin-service/db-url  "postgresql://${USER}:${PW}@${AURORA}:5432/checkin_db"

echo "Writing shared secrets ..."
put shared/jwt-public-key "$(openssl rand -base64 48)"
put shared/kafka-brokers  "$MSK"
put shared/redis-url      "redis://${REDIS}:6379"
# Admin connection (to the default 'postgres' DB) — used by the platform-init
# db-bootstrap Job to CREATE the per-service databases.
put shared/aurora-admin-url "postgresql://${USER}:${PW}@${AURORA}:5432/postgres"

echo "Writing Stripe key ..."
put payment-service/stripe-api-key "$STRIPE_SECRET_KEY"

# Elastic APM is optional — leave empty placeholders so pods don't crash-loop.
put shared/elastic-apm-server-url   "disabled"
put shared/elastic-apm-secret-token "disabled"

echo "Done. The per-service databases (identity_db, flight_db, booking_db,"
echo "payment_db, checkin_db) are created in-cluster by the platform-init"
echo "db-bootstrap Job (ArgoCD PreSync hook) using shared/aurora-admin-url."
