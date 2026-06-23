# Capture the CURRENT crash reason for identity-service.
#   powershell -ExecutionPolicy Bypass -File .\diag.ps1
$ErrorActionPreference = "Continue"

Write-Host "== identity-service: current container log (tail 50) ==" -ForegroundColor Cyan
kubectl -n aerolink logs -l app=identity-service --tail=50 2>&1

Write-Host ""
Write-Host "== identity-service: PREVIOUS crashed container (tail 50) ==" -ForegroundColor Cyan
$pod = kubectl -n aerolink get pod -l app=identity-service -o jsonpath="{.items[0].metadata.name}" 2>$null
if ($pod) { kubectl -n aerolink logs $pod --previous --tail=50 2>&1 }

Write-Host ""
Write-Host "== identity-service: pod events / exit codes ==" -ForegroundColor Cyan
if ($pod) { kubectl -n aerolink describe pod $pod 2>&1 | Select-String -Pattern "State|Reason|Exit Code|Last State|Liveness|Readiness|Back-off|Warning|Error" }

Write-Host ""
Write-Host "== init containers (migrations), if any ==" -ForegroundColor Cyan
if ($pod) { kubectl -n aerolink get pod $pod -o jsonpath="{range .spec.initContainers[*]}{.name}{'\n'}{end}" 2>$null }
