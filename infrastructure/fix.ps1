# AeroLink recovery - run in PowerShell from infrastructure\
#   powershell -ExecutionPolicy Bypass -File .\fix.ps1
# Fixes the Aurora username in the affected secrets, then refreshes the cluster.

$ErrorActionPreference = "Continue"
$Region  = "us-east-1"
$DbUser  = "aerolink_admin"

Write-Host "== Step 0: read DB password from deploy.env ==" -ForegroundColor Cyan
$Pw = $null
Get-Content .\deploy.env | ForEach-Object {
  if ($_ -match "^\s*export\s+TF_VAR_db_master_password=(.*)$") {
    $Pw = $matches[1].Trim().Trim("'").Trim('"')
  }
  if ($_ -match "^\s*export\s+AWS_DEFAULT_REGION=(.*)$") {
    $Region = $matches[1].Trim().Trim("'").Trim('"')
  }
}
if (-not $Pw) { Write-Host "Could not read TF_VAR_db_master_password from deploy.env" -ForegroundColor Red; exit 1 }

Write-Host "== Step 0b: verify AWS credentials ==" -ForegroundColor Cyan
aws sts get-caller-identity --region $Region | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Host "AWS creds bad - fix deploy.env keys." -ForegroundColor Red; exit 1 }

Write-Host "== Step 1: discover Aurora endpoint ==" -ForegroundColor Cyan
Push-Location .\terraform\environments\dev
$Aurora = (terraform output -raw aurora_cluster_endpoint 2>$null)
Pop-Location
if ([string]::IsNullOrWhiteSpace($Aurora) -or $Aurora -match "No outputs|Error") {
  Write-Host "terraform output unavailable, falling back to AWS API..." -ForegroundColor Yellow
  $Aurora = (aws rds describe-db-clusters --db-cluster-identifier aerolink-dev-aurora --region $Region --query "DBClusters[0].Endpoint" --output text)
}
$Aurora = $Aurora.Trim()
if ([string]::IsNullOrWhiteSpace($Aurora) -or $Aurora -eq "None") {
  Write-Host "Could not determine Aurora endpoint. Aborting." -ForegroundColor Red; exit 1
}
Write-Host ("Aurora endpoint: {0}" -f $Aurora)
Write-Host ("DB user        : {0}" -f $DbUser)

# Only the secrets that embed the DB username need rewriting.
$secrets = [ordered]@{
  "/aerolink/dev/identity-service/db-url" = "postgresql://${DbUser}:${Pw}@${Aurora}:5432/identity_db"
  "/aerolink/dev/flight-service/db-url"   = "postgresql://${DbUser}:${Pw}@${Aurora}:5432/flight_db"
  "/aerolink/dev/booking-service/db-url"  = "postgresql://${DbUser}:${Pw}@${Aurora}:5432/booking_db"
  "/aerolink/dev/payment-service/db-url"  = "postgresql://${DbUser}:${Pw}@${Aurora}:5432/payment_db"
  "/aerolink/dev/checkin-service/db-url"  = "postgresql://${DbUser}:${Pw}@${Aurora}:5432/checkin_db"
  "/aerolink/dev/shared/aurora-admin-url" = "postgresql://${DbUser}:${Pw}@${Aurora}:5432/postgres"
}

Write-Host "== Step 2: write secrets ==" -ForegroundColor Cyan
foreach ($id in $secrets.Keys) {
  $val = $secrets[$id]
  $out = aws secretsmanager put-secret-value --secret-id $id --secret-string $val --region $Region 2>&1
  if ($LASTEXITCODE -ne 0) {
    $out = aws secretsmanager create-secret --name $id --secret-string $val --region $Region 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-Host ("  FAILED {0}" -f $id) -ForegroundColor Red
      Write-Host ("         {0}" -f ($out -join ' '))
      continue
    }
  }
  Write-Host ("  OK     {0}" -f $id) -ForegroundColor Green
}

Write-Host "== Step 3: verify identity-service db-url value ==" -ForegroundColor Cyan
$check = aws secretsmanager get-secret-value --secret-id "/aerolink/dev/identity-service/db-url" --region $Region --query SecretString --output text
Write-Host ("  now = {0}" -f $check)
if ($check -notlike "postgresql://aerolink_admin:*") {
  Write-Host "  WARNING: value does not start with aerolink_admin - stop and check." -ForegroundColor Red
}

Write-Host "== Step 4: force External Secrets to re-sync ==" -ForegroundColor Cyan
kubectl -n aerolink annotate externalsecret --all "force-sync=$(Get-Date -Format yyyyMMddHHmmss)" --overwrite

Write-Host "== Step 5: sync platform-init (creates per-service databases) ==" -ForegroundColor Cyan
$patch = '{"operation":{"sync":{"revision":"HEAD"}}}'
$patchFile = Join-Path $env:TEMP "argocd-sync-patch.json"
$patch | Out-File -FilePath $patchFile -Encoding ascii -NoNewline
kubectl -n argocd patch applications platform-init --type merge --patch-file $patchFile
Write-Host "  waiting for db-bootstrap Job..."
for ($i=0; $i -lt 24; $i++) {
  Start-Sleep -Seconds 5
  $j = kubectl -n aerolink get job db-bootstrap -o jsonpath="{.status.succeeded}" 2>$null
  if ($j -eq "1") { Write-Host "  db-bootstrap complete." -ForegroundColor Green; break }
}
kubectl -n aerolink logs job/db-bootstrap --tail=20 2>$null

Write-Host "== Step 6: restart service pods so they reload the corrected secret ==" -ForegroundColor Cyan
kubectl -n aerolink delete pods --all

Write-Host "== Step 7: status ==" -ForegroundColor Cyan
Start-Sleep -Seconds 10
kubectl -n aerolink get pods
Write-Host ""
kubectl -n argocd get applications
Write-Host ""
Write-Host "If pods are Running and ArgoCD shows Synced/Healthy, the app is recovered." -ForegroundColor Cyan
Write-Host "Front door (502 / argocd DNS) - check the ALB next:" -ForegroundColor Cyan
Write-Host "  kubectl -n aerolink get ingress"
Write-Host "  kubectl -n kube-system logs deploy/aws-load-balancer-controller --tail=60"
