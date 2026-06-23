# AeroLink recovery - phase 5: force ArgoCD to pull the LATEST git commit
# (hard refresh), then sync, verify the SA annotation, and restart pods.
#   powershell -ExecutionPolicy Bypass -File .\fix5.ps1
$ErrorActionPreference = "Continue"
$apps = @("identity-service","flight-service","booking-service","payment-service","checkin-service","baggage-service","notification-service")

Write-Host "== Step 1: HARD refresh (re-pull git) + sync each app ==" -ForegroundColor Cyan
$patch = '{"operation":{"sync":{"revision":"HEAD"}}}'
$pf = Join-Path $env:TEMP "argocd-sync5.json"
$patch | Out-File -FilePath $pf -Encoding ascii -NoNewline
foreach ($a in $apps) {
  kubectl -n argocd annotate application $a "argocd.argoproj.io/refresh=hard" --overwrite | Out-Null
}
Write-Host "  waiting 20s for repo refresh..."
Start-Sleep -Seconds 20
foreach ($a in $apps) {
  kubectl -n argocd patch applications $a --type merge --patch-file $pf | Out-Null
}
Start-Sleep -Seconds 20

Write-Host "== Step 2: what revision did ArgoCD sync, and is the annotation present? ==" -ForegroundColor Cyan
Write-Host "  synced revision:"
kubectl -n argocd get app identity-service -o jsonpath="{.status.sync.revision}"; Write-Host ""
Write-Host "  identity-service SA annotations:"
$ann = kubectl -n aerolink get sa identity-service -o jsonpath="{.metadata.annotations.eks\.amazonaws\.com/role-arn}" 2>$null
Write-Host ("    role-arn = {0}" -f $ann)

if (-not $ann) {
  Write-Host ""
  Write-Host "  STILL EMPTY. ArgoCD is not seeing the commit. Check that the push landed on" -ForegroundColor Red
  Write-Host "  the repo/branch ArgoCD tracks (github.com/HannanLK/aero-link, branch main):" -ForegroundColor Red
  Write-Host "    git log --oneline -1" -ForegroundColor Yellow
  Write-Host "    git rev-parse HEAD   (compare to the synced revision above)" -ForegroundColor Yellow
  Write-Host "  Stopping here - no point restarting pods until the SA has the role-arn." -ForegroundColor Red
  exit 1
}

Write-Host "== Step 3: SA is annotated - recreate pods so creds get injected ==" -ForegroundColor Cyan
kubectl -n aerolink delete pods --all

Write-Host "== Step 4: verify a pod got AWS creds ==" -ForegroundColor Cyan
Start-Sleep -Seconds 30
$pod = kubectl -n aerolink get pod -l app=identity-service -o jsonpath="{.items[0].metadata.name}" 2>$null
if ($pod) { kubectl -n aerolink exec $pod -- sh -c 'echo AWS_ROLE_ARN=$AWS_ROLE_ARN' 2>&1 }

Write-Host "== Step 5: status ==" -ForegroundColor Cyan
Start-Sleep -Seconds 35
kubectl -n aerolink get pods
Write-Host ""
kubectl -n argocd get applications
