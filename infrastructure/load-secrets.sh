#!/usr/bin/env bash
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

echo "Writing Stripe key ..."
put payment-service/stripe-api-key "$STRIPE_SECRET_KEY"

# Elastic APM is optional — leave empty placeholders so pods don't crash-loop.
put shared/elastic-apm-server-url   "disabled"
put shared/elastic-apm-secret-token "disabled"

echo "Done. NOTE: the 5 service databases (identity_db, flight_db, …) must exist"
echo "on the Aurora cluster. If you used a single default DB, point every db-url"
echo "at it, or create them once with:"
echo "  for db in identity flight booking payment checkin; do"
echo "    psql \"postgresql://${USER}:***@${AURORA}:5432/postgres\" -c \"CREATE DATABASE \${db}_db;\";"
echo "  done"
