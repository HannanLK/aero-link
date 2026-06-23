#!/usr/bin/env bash
# Quick diagnostic — runs the exact same setup as deploy.sh
# but stops after Step 1 to show if/where it crashes.
set -euo pipefail

trap 'echo -e "\n\033[0;31m✖ FAILED at line $LINENO (exit code $?). See error above.\033[0m"; read -r -p "Press Enter to close..."' ERR

echo "=== test-deploy.sh ==="
echo "1. Resolving HERE..."
HERE="$(cd "$(dirname "$0")" && pwd)"
echo "   HERE = $HERE"

echo "2. Sourcing deploy.env..."
source "$HERE/deploy.env"
echo "   AWS_ACCESS_KEY_ID = ${AWS_ACCESS_KEY_ID:0:8}..."
echo "   AWS_DEFAULT_REGION = $AWS_DEFAULT_REGION"
echo "   TF_STATE_BUCKET = $TF_STATE_BUCKET"
echo "   DOMAIN_NAME = $DOMAIN_NAME"

echo "3. Changing to TF dir..."
TF_DIR="$HERE/terraform/environments/dev"
cd "$TF_DIR"
echo "   pwd = $(pwd)"

echo "4. Testing AWS CLI..."
aws sts get-caller-identity
echo "   AWS CLI OK"

echo "5. Testing terraform..."
terraform version | head -1
echo "   Terraform OK"

echo ""
echo "=== ALL CHECKS PASSED — deploy.sh should work ==="
read -r -p "Press Enter to close..."
