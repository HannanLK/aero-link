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
# AeroLink — clean teardown.
#
# Order matters. The AWS Load Balancer Controller and External-DNS create AWS
# resources (ALB, target groups, security groups) from Kubernetes Ingress that
# Terraform does NOT track. If you `terraform destroy` while they still exist,
# the VPC destroy hangs on leftover ENIs/SGs. So we delete the in-cluster
# ingress first, let the controller remove the ALB, THEN terraform destroy.
#
# The imported Route 53 hosted zone is PRESERVED (your registrar points at its
# nameservers) by removing it from Terraform state before destroy.
#
# Usage:
#   cd infrastructure
#   ./destroy.sh             # full teardown, keeps hosted zone + state bucket
#   ./destroy.sh --nuke      # also delete the Terraform state bucket + lock table
###############################################################################
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TF_DIR="$HERE/terraform/environments/dev"
source "$HERE/deploy.env"
cd "$TF_DIR"

c_red='\033[0;31m'; c_grn='\033[0;32m'; c_yel='\033[1;33m'; c_rst='\033[0m'
say(){ echo -e "${c_grn}▶ $*${c_rst}"; }
warn(){ echo -e "${c_yel}⚠ $*${c_rst}"; }

echo -e "${c_red}This DESTROYS all AeroLink AWS infrastructure for the dev environment.${c_rst}"
read -r -p "Type 'destroy' to confirm: " ans
[ "$ans" = "destroy" ] || { warn "Aborted."; exit 1; }

aws configure set aws_access_key_id     "$AWS_ACCESS_KEY_ID"
aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY"
aws configure set region                "$AWS_DEFAULT_REGION"

# ── 1. Tear down in-cluster load balancers FIRST ─────────────────────────────
say "Step 1/4 — removing Kubernetes ingress/LoadBalancers so the ALB is cleaned up"
CLUSTER=$(terraform output -raw eks_cluster_name 2>/dev/null || echo "aerolink-dev-eks")
if aws eks update-kubeconfig --name "$CLUSTER" --region "$AWS_DEFAULT_REGION" 2>/dev/null; then
  # Stop Argo CD re-creating things, then delete the app namespace (removes Ingress).
  kubectl delete applicationset aerolink-services -n argocd --ignore-not-found --timeout=60s || true
  kubectl delete ingress --all -n aerolink --ignore-not-found --timeout=120s || true
  kubectl delete svc --all -n aerolink --field-selector spec.type=LoadBalancer --ignore-not-found || true
  say "Waiting 90s for the AWS Load Balancer Controller to delete the ALB..."
  sleep 90
else
  warn "Could not reach the cluster (already gone?). Continuing."
fi

# ── 2. Preserve the Route 53 hosted zone ─────────────────────────────────────
say "Step 2/4 — removing hosted zone from TF state so it is NOT deleted"
terraform state rm module.route53.aws_route53_zone.main 2>/dev/null \
  && say "Hosted zone $HOSTED_ZONE_ID preserved (records will still be cleaned)." \
  || warn "Hosted zone not in state (already removed or never imported)."

# ── 3. Terraform destroy ─────────────────────────────────────────────────────
say "Step 3/4 — terraform destroy (~10–15 min)"
terraform init -input=false \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="dynamodb_table=$TF_LOCK_TABLE" \
  -backend-config="key=dev/terraform.tfstate" \
  -backend-config="region=$AWS_DEFAULT_REGION" >/dev/null
terraform destroy -auto-approve

# ── 4. Sweep for orphans the controllers may have left ───────────────────────
say "Step 4/4 — checking for orphaned load balancers / volumes"
LEFT=$(aws elbv2 describe-load-balancers --region "$AWS_DEFAULT_REGION" \
  --query "LoadBalancers[?contains(LoadBalancerName,'aerolink') || contains(LoadBalancerName,'k8s-aerolink')].LoadBalancerArn" \
  --output text 2>/dev/null)
if [ -n "$LEFT" ]; then
  warn "Orphaned load balancers found — deleting:"; echo "$LEFT"
  for arn in $LEFT; do aws elbv2 delete-load-balancer --load-balancer-arn "$arn" --region "$AWS_DEFAULT_REGION" || true; done
fi

if [ "${1:-}" = "--nuke" ]; then
  warn "Deleting Terraform state bucket + lock table"
  aws s3 rb "s3://$TF_STATE_BUCKET" --force --region "$AWS_DEFAULT_REGION" || true
  aws dynamodb delete-table --table-name "$TF_LOCK_TABLE" --region "$AWS_DEFAULT_REGION" || true
fi

say "Teardown complete."
echo "Verify zero spend in AWS Cost Explorer tomorrow. KMS keys enter a 7-day"
echo "deletion window (negligible cost). The hosted zone ($DOMAIN_NAME) is kept."
