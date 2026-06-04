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
# AeroLink — guided AWS deployment.
#
# Runs the 11 deployment steps in order, PAUSING for confirmation before every
# step that creates/changes real (billed) AWS resources.
#
# Prereqs on THIS machine: aws CLI v2, terraform >=1.7, kubectl, helm, docker.
# Config + credentials come from infrastructure/deploy.env (gitignored).
#
# Usage:
#   cd infrastructure
#   chmod +x deploy.sh
#   ./deploy.sh            # full run, with confirmations
#   ./deploy.sh --from 5   # resume from a given step number
###############################################################################
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
TF_DIR="$HERE/terraform/environments/dev"
source "$HERE/deploy.env"

START_AT="${2:-1}"; [ "${1:-}" = "--from" ] || START_AT=1

c_grn='\033[0;32m'; c_yel='\033[1;33m'; c_red='\033[0;31m'; c_rst='\033[0m'
say()  { echo -e "${c_grn}▶ $*${c_rst}"; }
warn() { echo -e "${c_yel}⚠ $*${c_rst}"; }
step() { echo -e "\n${c_grn}═══ STEP $1: $2 ═══${c_rst}"; }

confirm() {
  echo -e "${c_red}This step creates or modifies real AWS resources (cost starts).${c_rst}"
  read -r -p "Proceed? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { warn "Skipped."; return 1; }
}

skip_before() { [ "$1" -lt "$START_AT" ]; }

cd "$TF_DIR"

# ── STEP 1 — credentials ─────────────────────────────────────────────────────
if ! skip_before 1; then
  step 1 "Configure AWS credentials"
  aws configure set aws_access_key_id     "$AWS_ACCESS_KEY_ID"
  aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY"
  aws configure set region                "$AWS_DEFAULT_REGION"
  aws configure set output                json
  say "Authenticated as: $(aws sts get-caller-identity --query Arn --output text)"
fi

# ── STEP 2 — remote state (S3 + DynamoDB) ────────────────────────────────────
if ! skip_before 2; then
  step 2 "Create Terraform remote-state bucket + lock table"
  if confirm; then
    aws s3api create-bucket --bucket "$TF_STATE_BUCKET" --region "$AWS_DEFAULT_REGION" 2>/dev/null \
      && say "Created bucket $TF_STATE_BUCKET" || warn "Bucket exists or already owned — continuing."
    aws s3api put-bucket-versioning --bucket "$TF_STATE_BUCKET" \
      --versioning-configuration Status=Enabled || true
    aws dynamodb create-table --table-name "$TF_LOCK_TABLE" \
      --attribute-definitions AttributeName=LockID,AttributeType=S \
      --key-schema AttributeName=LockID,KeyType=HASH \
      --billing-mode PAY_PER_REQUEST --region "$AWS_DEFAULT_REGION" 2>/dev/null \
      && say "Created lock table $TF_LOCK_TABLE" || warn "Lock table exists — continuing."
  fi
fi

# ── STEP 3 — terraform.tfvars ────────────────────────────────────────────────
if ! skip_before 3; then
  step 3 "terraform.tfvars"
  if [ -f "$TF_DIR/terraform.tfvars" ]; then
    say "terraform.tfvars present (domain=$DOMAIN_NAME). db password via TF_VAR env."
  else
    warn "terraform.tfvars missing — see terraform.tfvars.example."; exit 1
  fi
fi

# ── STEP 4 — init + plan ─────────────────────────────────────────────────────
if ! skip_before 4; then
  step 4 "terraform init + plan (review carefully)"
  terraform init \
    -backend-config="bucket=$TF_STATE_BUCKET" \
    -backend-config="dynamodb_table=$TF_LOCK_TABLE" \
    -backend-config="key=dev/terraform.tfstate" \
    -backend-config="region=$AWS_DEFAULT_REGION"

  # IMPORTANT: reuse the EXISTING hosted zone instead of creating a duplicate
  # (you already created $HOSTED_ZONE_ID and pointed your registrar at its NS).
  if ! terraform state list 2>/dev/null | grep -q 'module.route53.aws_route53_zone.main'; then
    warn "Importing existing hosted zone $HOSTED_ZONE_ID for $DOMAIN_NAME ..."
    terraform import module.route53.aws_route53_zone.main "$HOSTED_ZONE_ID" || \
      warn "Import failed (will be created fresh — then update registrar NS to match)."
  fi

  terraform plan -out=tfplan
  say "Review the plan above. Step 5 applies it."
fi

# ── STEP 5 — apply (THE big one) ─────────────────────────────────────────────
if ! skip_before 5; then
  step 5 "terraform apply  (~15–25 min, billed resources)"
  if confirm; then
    terraform apply tfplan
    say "Infrastructure created."
  fi
fi

# ── STEP 6 — kubeconfig ──────────────────────────────────────────────────────
if ! skip_before 6; then
  step 6 "Connect kubectl to EKS"
  CLUSTER=$(terraform output -raw eks_cluster_name)
  aws eks update-kubeconfig --name "$CLUSTER" --region "$AWS_DEFAULT_REGION"
  kubectl get nodes
fi

# ── STEP 7 — build + push images to ECR ──────────────────────────────────────
if ! skip_before 7; then
  step 7 "Build & push 7 service images + lambda-qr to ECR"
  if confirm; then
    REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"
    aws ecr get-login-password --region "$AWS_DEFAULT_REGION" \
      | docker login --username AWS --password-stdin "$REGISTRY"
    cd "$REPO"
    for svc in identity-service flight-service booking-service payment-service \
               checkin-service baggage-service notification-service lambda-qr; do
      say "building $svc"
      docker build -t "$REGISTRY/aerolink-dev/$svc:latest" -f "services/$svc/Dockerfile" .
      docker push "$REGISTRY/aerolink-dev/$svc:latest"
    done
    # webui is a containerised nginx app (served via ALB + CloudFront), built
    # from its own context with the API URL baked in at build time.
    say "building webui"
    docker build -t "$REGISTRY/aerolink-dev/webui:latest" \
      --build-arg "VITE_API_BASE_URL=https://api.${DOMAIN_NAME}/api/v1" \
      --build-arg "VITE_STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}" \
      -f "$REPO/webui/Dockerfile" "$REPO/webui"
    docker push "$REGISTRY/aerolink-dev/webui:latest"
    cd "$TF_DIR"
  fi
fi

# ── STEP 8 — secrets ─────────────────────────────────────────────────────────
if ! skip_before 8; then
  step 8 "Populate AWS Secrets Manager"
  if confirm; then bash "$HERE/load-secrets.sh"; fi
fi

# ── STEP 9 — Argo CD ─────────────────────────────────────────────────────────
if ! skip_before 9; then
  step 9 "Argo CD sync (auto-deploys pods)"
  say "Argo CD password:"
  kubectl -n argocd get secret argocd-initial-admin-secret \
    -o jsonpath="{.data.password}" 2>/dev/null | base64 -d; echo
  say "Port-forward UI:  kubectl port-forward svc/argocd-server -n argocd 8443:443"
  kubectl -n argocd get applications 2>/dev/null || warn "ApplicationSet still initialising."
fi

# ── STEP 10 — health validation ──────────────────────────────────────────────
if ! skip_before 10; then
  step 10 "Validate health endpoints"
  API=$(terraform output -raw api_gateway_url)
  for path in "/api/v1/health/live" "/api/v1/flights/health/live"; do
    printf "  %-40s " "$path"; curl -fsS "${API}${path}" && echo || warn "not ready yet"
  done
fi

# ── STEP 11 — frontend verification ──────────────────────────────────────────
# NOTE: the webui is NOT an S3 static site. It is a containerised nginx app
# deployed by Argo CD (webui/helm), exposed through the ALB ingress, and
# fronted by CloudFront. So there is nothing to "sync" — Step 7 pushed the
# image and Step 9's Argo CD sync deploys it. This step only verifies it.
if ! skip_before 11; then
  step 11 "Verify frontend (served via CloudFront → ALB → webui pod)"
  CF=$(terraform output -raw cloudfront_distribution_domain 2>/dev/null || echo "")
  echo "  CloudFront domain : ${CF:-<pending>}"
  echo "  Site URL          : https://${DOMAIN_NAME}"
  kubectl -n aerolink get deploy webui 2>/dev/null || warn "webui pod not synced yet (check Argo CD)."
  printf "  %-30s " "https://${DOMAIN_NAME}"; curl -fsS -o /dev/null -w "HTTP %{http_code}\n" "https://${DOMAIN_NAME}" || warn "not resolving yet (DNS/ACM may still be propagating)."
fi

say "Deployment script complete. App URL: https://${DOMAIN_NAME}"
warn "Remember to: 'terraform destroy' when done to stop AWS billing."
