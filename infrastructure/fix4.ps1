# AeroLink recovery - phase 4: apply the permanent IRSA ServiceAccount fix.
#
# PREREQUISITE (do this FIRST, from the repo root):
#   git add services/*/helm/values.yaml
#   git commit -m "fix: attach IRSA role-arn to service ServiceAccounts (MSK IAM auth)"
#   git push origin main
# ArgoCD self-heals from git; a live-only change would be reverted, so the push
# is what makes this permanent.
#
#   powershell -ExecutionPolicy Bypass -File .\fix4.ps1
$ErrorActionPreference = "Continue"
$apps = @("identity-service","flight-service","booking-service","payment-service","checkin-service","baggage-service","notification-service")

Write-Host "== Step 1: force ArgoCD to sync each service from git ==" -ForegroundColor Cyan
$patch = '{"operation":{"sync":{"revision":"HEAD"}}}'
$pf = Join-Path $env:TEMP "argocd-sync4.json"
$patch | Out-File -FilePath $pf -Encoding ascii -NoNewline
foreach ($a in $apps) { kubectl -n argocd patch applications $a --type merge --patch-file $pf }
Start-Sleep -Seconds 25

Write-Host "== Step 2: verify the ServiceAccount now carries the role-arn annotation ==" -ForegroundColor Cyan
kubectl -n aerolink get sa identity-service -o jsonpath="{.metadata.annotations}"
Write-Host ""

Write-Host "== Step 3: recreate pods so the EKS pod-identity webhook injects AWS creds ==" -ForegroundColor Cyan
kubectl -n aerolink delete pods --all

Write-Host "== Step 4: confirm a pod received IRSA env vars ==" -ForegroundColor Cyan
Start-Sleep -Seconds 25
$pod = kubectl -n aerolink get pod -l app=identity-service -o jsonpath="{.items[0].metadata.name}" 2>$null
if ($pod) {
  kubectl -n aerolink exec $pod -- sh -c 'echo AWS_ROLE_ARN=$AWS_ROLE_ARN' 2>&1
}

Write-Host "== Step 5: status ==" -ForegroundColor Cyan
Start-Sleep -Seconds 40
kubectl -n aerolink get pods
Write-Host ""
kubectl -n argocd get applications
Write-Host ""
Write-Host "Expect: pods 1/1 Running, apps Synced/Healthy." -ForegroundColor Cyan
Write-Host "If still crashing, run: powershell -ExecutionPolicy Bypass -File .\diag.ps1" -ForegroundColor Cyan
