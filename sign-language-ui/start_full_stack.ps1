# Starts: TRSL Docker API, Windows backend API, and Next.js UI
# Run from this folder: powershell -ExecutionPolicy Bypass -File .\start_full_stack.ps1

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendDir = Join-Path $root "SHuBERT_transferLearning"
$apiDir = Join-Path $backendDir "backEnd_API_signlanguage_UI"

Write-Host "Starting TRSL Docker API..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$backendDir`"; docker compose up -d trsl-api"

Write-Host "Starting Windows backend API (ASL + TRSL forwarder)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$apiDir`"; `"$backendDir\.venv310\Scripts\Activate.ps1`"; pip install fastapi uvicorn python-multipart requests; python api.py"

Write-Host "Starting Next.js UI..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$PSScriptRoot`"; npm run dev"

Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

Write-Host "All services launched." -ForegroundColor Green
