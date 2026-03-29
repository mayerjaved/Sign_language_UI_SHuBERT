# Starts: TRSL Docker API, Windows backend API, and Next.js UI
# Run from this folder: powershell -ExecutionPolicy Bypass -File .\start_full_stack.ps1
#
# Optional:
#   powershell -ExecutionPolicy Bypass -File .\start_full_stack.ps1 -TrslApiMemoryLimit 16g
#   powershell -ExecutionPolicy Bypass -File .\start_full_stack.ps1 -SkipTrslRebuild
#   powershell -ExecutionPolicy Bypass -File .\start_full_stack.ps1 -ForceTrslRebuild

param(
  [string]$TrslApiMemoryLimit = "16g",
  [switch]$SkipTrslRebuild,
  [switch]$ForceTrslRebuild
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendDir = Join-Path $root "SHuBERT_transferLearning"
$apiDir = Join-Path $backendDir "backEnd_API_signlanguage_UI"

function Assert-LastExitCode([string]$step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$step failed with exit code $LASTEXITCODE."
  }
}

Write-Host "Preparing TRSL Docker API..." -ForegroundColor Cyan
Push-Location $backendDir
try {
  # BuildKit keeps rebuilds efficient by reusing cache layers while still
  # allowing base-image refreshes when needed.
  $env:DOCKER_BUILDKIT = "1"
  $env:COMPOSE_DOCKER_CLI_BUILD = "1"

  $shouldRebuild = $false
  if ($ForceTrslRebuild) {
    $shouldRebuild = $true
  } elseif ($SkipTrslRebuild) {
    $shouldRebuild = $false
  } else {
    # Default local-dev behavior: avoid rebuild unless image is missing.
    $imageId = docker compose images -q trsl-api 2>$null
    if ([string]::IsNullOrWhiteSpace($imageId)) {
      $shouldRebuild = $true
      Write-Host "No trsl-api image found, rebuilding once..." -ForegroundColor Yellow
    }
  }

  if ($shouldRebuild) {
    Write-Host "Rebuilding trsl-api image (cached layers + latest base image)..." -ForegroundColor Cyan
    docker compose build --pull trsl-api
    Assert-LastExitCode "docker compose build trsl-api"
  } else {
    Write-Host "Skipping trsl-api rebuild (dev fast-start)." -ForegroundColor Yellow
  }

  Write-Host "Starting trsl-api container..." -ForegroundColor Cyan
  docker compose up -d --no-deps --force-recreate trsl-api
  Assert-LastExitCode "docker compose up trsl-api"

  Write-Host "Applying memory cap to trsl_api: $TrslApiMemoryLimit" -ForegroundColor Cyan
  docker update --memory $TrslApiMemoryLimit --memory-swap $TrslApiMemoryLimit trsl_api | Out-Null
  Assert-LastExitCode "docker update trsl_api memory"

  $memoryBytes = docker inspect trsl_api --format "{{.HostConfig.Memory}}"
  Assert-LastExitCode "docker inspect trsl_api memory"
  $memoryGiB = [Math]::Round(([double]$memoryBytes / 1GB), 2)
  Write-Host "trsl_api memory limit confirmed: $memoryGiB GiB" -ForegroundColor Green
}
finally {
  Pop-Location
}

Write-Host "Starting Windows backend API (ASL + TRSL forwarder)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$apiDir`"; `"$backendDir\.venv310\Scripts\Activate.ps1`"; pip install fastapi uvicorn python-multipart requests; python api.py"

Write-Host "Starting Next.js UI..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$PSScriptRoot`"; npm run dev"

Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

Write-Host "All services launched." -ForegroundColor Green
