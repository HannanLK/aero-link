# AeroLink recovery - phase 2: run the db-bootstrap Job, then restart services.
#   powershell -ExecutionPolicy Bypass -File .\fix2.ps1
$ErrorActionPreference = "Continue"

Write-Host "== A: current identity-service error ==" -ForegroundColor Cyan
kubectl -n aerolink logs deploy/identity-service --tail=25 2>&1

Write-Host "== A2: confirm the in-cluster secret was updated by External Secrets ==" -ForegroundColor Cyan
$b = kubectl -n aerolink get secret identity-service-secrets -o jsonpath="{.data.DATABASE_URL}" 2>$null
if ($b) {
  $decoded = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b))
  Write-Host ("  k8s secret DATABASE_URL = {0}" -f $decoded)
  if ($decoded -notlike "postgresql://aerolink_admin:*") {
    Write-Host "  NOTE: cluster secret not refreshed yet; the restart at the end will pick it up." -ForegroundColor Yellow
  }
} else {
  Write-Host "  (could not read secret)" -ForegroundColor Yellow
}

Write-Host "== B: existing db-bootstrap Job status + logs ==" -ForegroundColor Cyan
kubectl -n aerolink get job db-bootstrap -o wide 2>&1
kubectl -n aerolink logs job/db-bootstrap --tail=30 2>&1

Write-Host "== C: delete the stale (failed) db-bootstrap Job so it re-runs with the fixed admin URL ==" -ForegroundColor Cyan
kubectl -n aerolink delete job db-bootstrap --ignore-not-found

Write-Host "== D: re-sync platform-init (recreates the Job, creates per-service databases) ==" -ForegroundColor Cyan
$patch = '{"operation":{"sync":{"revision":"HEAD"}}}'
$pf = Join-Path $env:TEMP "argocd-sync2.json"
$patch | Out-File -FilePath $pf -Encoding ascii -NoNewline
kubectl -n argocd patch applications platform-init --type merge --patch-file $pf

Write-Host "== E: wait for db-bootstrap to complete (creates identity_db, flight_db, ...) ==" -ForegroundColor Cyan
$done = $false
for ($i=0; $i -lt 36; $i++) {
  Start-Sleep -Seconds 5
  $s = kubectl -n aerolink get job db-bootstrap -o jsonpath="{.status.succeeded}" 2>$null
  $f = kubectl -n aerolink get job db-bootstrap -o jsonpath="{.status.failed}" 2>$null
  Write-Host ("  t={0}s  succeeded={1}  failed={2}" -f ($i*5), $s, $f)
  if ($s -eq "1") { $done = $true; break }
}
Write-Host "  --- db-bootstrap logs ---"
kubectl -n aerolink logs job/db-bootstrap --tail=40 2>&1
if (-not $done) { Write-Host "  db-bootstrap did not report success; check the logs above before continuing." -ForegroundColor Yellow }

Write-Host "== F: restart all service pods to reload secret + connect to the new databases ==" -ForegroundColor Cyan
kubectl -n aerolink delete pods --all

Write-Host "== G: wait then show status ==" -ForegroundColor Cyan
Start-Sleep -Seconds 30
kubectl -n aerolink get pods
Write-Host ""
kubectl -n argocd get applications
