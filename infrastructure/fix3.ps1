# AeroLink recovery - phase 3: create the per-service databases directly,
# bypassing the stuck ArgoCD platform-init sync, then restart the services.
#   powershell -ExecutionPolicy Bypass -File .\fix3.ps1
$ErrorActionPreference = "Continue"

Write-Host "== A: confirm the admin-url secret exists in-cluster ==" -ForegroundColor Cyan
$ka = kubectl -n aerolink get secret platform-init-secrets -o jsonpath="{.data.AURORA_ADMIN_URL}" 2>$null
if ($ka) {
  $adminUrl = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($ka))
  Write-Host ("  AURORA_ADMIN_URL = {0}" -f $adminUrl)
  if ($adminUrl -notlike "postgresql://aerolink_admin:*") {
    Write-Host "  Forcing External Secrets refresh first..." -ForegroundColor Yellow
    kubectl -n aerolink annotate externalsecret platform-init-secrets "force-sync=$(Get-Date -Format yyyyMMddHHmmss)" --overwrite
    Start-Sleep -Seconds 8
  }
} else {
  Write-Host "  platform-init-secrets not found - refreshing External Secret..." -ForegroundColor Yellow
  kubectl -n aerolink annotate externalsecret platform-init-secrets "force-sync=$(Get-Date -Format yyyyMMddHHmmss)" --overwrite
  Start-Sleep -Seconds 8
}

Write-Host "== B: run the database bootstrap Job ==" -ForegroundColor Cyan
kubectl -n aerolink delete job db-bootstrap-manual --ignore-not-found
kubectl apply -f .\bootstrap-db.yaml

Write-Host "== C: wait for it to finish ==" -ForegroundColor Cyan
$done = $false
for ($i=0; $i -lt 36; $i++) {
  Start-Sleep -Seconds 5
  $s = kubectl -n aerolink get job db-bootstrap-manual -o jsonpath="{.status.succeeded}" 2>$null
  $f = kubectl -n aerolink get job db-bootstrap-manual -o jsonpath="{.status.failed}" 2>$null
  Write-Host ("  t={0}s  succeeded={1}  failed={2}" -f ($i*5), $s, $f)
  if ($s -eq "1") { $done = $true; break }
}
Write-Host "  --- bootstrap logs ---"
kubectl -n aerolink logs job/db-bootstrap-manual --tail=40 2>&1
if (-not $done) {
  Write-Host "  Job did not succeed - read the logs above and stop here." -ForegroundColor Red
  exit 1
}

Write-Host "== D: restart all service pods ==" -ForegroundColor Cyan
kubectl -n aerolink delete pods --all

Write-Host "== E: wait then show status ==" -ForegroundColor Cyan
Start-Sleep -Seconds 35
kubectl -n aerolink get pods
Write-Host ""
kubectl -n argocd get applications
Write-Host ""
Write-Host "Then test the API/site:" -ForegroundColor Cyan
Write-Host "  kubectl -n aerolink get ingress"
