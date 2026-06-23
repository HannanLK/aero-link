# Diagnose why the webui ALB is not being provisioned, and confirm argocd host.
#   powershell -ExecutionPolicy Bypass -File .\diag-ingress.ps1
$ErrorActionPreference = "Continue"

Write-Host "== webui ingress: describe (look at Events at the bottom) ==" -ForegroundColor Cyan
kubectl -n aerolink describe ingress webui-webui 2>&1

Write-Host ""
Write-Host "== AWS Load Balancer Controller logs: webui / errors (tail) ==" -ForegroundColor Cyan
kubectl -n kube-system logs deploy/aws-load-balancer-controller --tail=200 2>&1 | Select-String -Pattern "webui|error|failed|subnet|certificate|aerolink" | Select-Object -Last 40

Write-Host ""
Write-Host "== argocd ingress host (confirms the example.com drift) ==" -ForegroundColor Cyan
kubectl -n argocd get ingress argocd-server -o jsonpath="{.spec.rules[*].host}"
Write-Host ""
