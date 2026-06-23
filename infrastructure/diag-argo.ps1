# Diagnose why ArgoCD is not syncing.
#   powershell -ExecutionPolicy Bypass -File .\diag-argo.ps1
$ErrorActionPreference = "Continue"

Write-Host "== ArgoCD pods ==" -ForegroundColor Cyan
kubectl -n argocd get pods -o wide

Write-Host ""
Write-Host "== identity-service app: sync / health ==" -ForegroundColor Cyan
kubectl -n argocd get app identity-service -o jsonpath="sync={.status.sync.status}  health={.status.health.status}  revision={.status.sync.revision}"
Write-Host ""

Write-Host "-- conditions --" -ForegroundColor Cyan
kubectl -n argocd get app identity-service -o jsonpath="{range .status.conditions[*]}{.type}: {.message}{'\n'}{end}"

Write-Host "-- last operation (phase / message) --" -ForegroundColor Cyan
kubectl -n argocd get app identity-service -o jsonpath="{.status.operationState.phase}: {.status.operationState.message}"
Write-Host ""
kubectl -n argocd get app identity-service -o jsonpath="syncResult.revision={.status.operationState.syncResult.revision}"
Write-Host ""

Write-Host "== repo-server logs (tail 30) ==" -ForegroundColor Cyan
kubectl -n argocd logs deploy/argocd-repo-server --tail=30 2>&1

Write-Host ""
Write-Host "== application-controller logs filtered for identity-service / errors (tail 40) ==" -ForegroundColor Cyan
kubectl -n argocd logs statefulset/argocd-application-controller --tail=200 2>&1 | Select-String -Pattern "identity-service|error|level=error|failed|unable" | Select-Object -Last 40
