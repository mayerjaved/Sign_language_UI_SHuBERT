# One-command backend bring-up + Cloudflare quick tunnel + Vercel env update.
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File .\sign-language-ui\start_backend_and_vercel.ps1

$ErrorActionPreference = "Stop"

$uiDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $uiDir ".env.local"
$backendDir = "C:\code_projects\SHuBERT_transferLearning\backEnd_API_signlanguage_UI"

function Load-EnvFile([string]$path) {
  if (!(Test-Path $path)) {
    throw "Missing $path. Create it and add VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID."
  }
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
      $key = $matches[1]
      $val = $matches[2].Trim()
      if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Trim('"') }
      Set-Item -Path "Env:$key" -Value $val
    }
  }
}

function Start-BackendIfNeeded {
  $listening = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
  if ($listening) {
    Write-Host "Backend already listening on port 8000." -ForegroundColor Green
    return
  }

  $venvPython = "C:\code_projects\SHuBERT_transferLearning\.venv310\Scripts\python.exe"
  $python = if (Test-Path $venvPython) { $venvPython } else { "python" }
  $apiPath = Join-Path $backendDir "api.py"

  if (!(Test-Path $apiPath)) {
    throw "Backend api.py not found at $apiPath"
  }

  Write-Host "Starting backend API on http://localhost:8000 ..." -ForegroundColor Cyan
  Start-Process -FilePath $python -ArgumentList "`"$apiPath`"" -WorkingDirectory $backendDir -WindowStyle Normal | Out-Null
  Start-Sleep -Seconds 2
}

function Get-CloudflaredPath {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $fallback = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
  if (Test-Path $fallback) { return $fallback }
  throw "cloudflared not found. Install it with: winget install --id Cloudflare.cloudflared"
}

function Start-QuickTunnelAndGetUrl {
  $cloudflared = Get-CloudflaredPath
  # Use unique log files so parallel/previous runs don't collide.
  $log = Join-Path $env:TEMP ("cloudflared-quick-" + ([Guid]::NewGuid().ToString("N")) + ".log")

  Write-Host "Starting Cloudflare Quick Tunnel for http://localhost:8000 ..." -ForegroundColor Cyan
  # PowerShell requires different files for stdout/stderr redirection.
  $errLog = Join-Path $env:TEMP ("cloudflared-quick-" + ([Guid]::NewGuid().ToString("N")) + ".err.log")
  Start-Process -FilePath $cloudflared -ArgumentList "tunnel --url http://localhost:8000" -RedirectStandardOutput $log -RedirectStandardError $errLog -PassThru | Out-Null

  $tunnelUrl = $null
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $log) {
      $content = Get-Content $log -Raw
      if ($content -match "https://[a-z0-9-]+\.trycloudflare\.com") {
        $tunnelUrl = $matches[0]
        break
      }
    }
    if (-not $tunnelUrl -and (Test-Path $errLog)) {
      $errContent = Get-Content $errLog -Raw
      if ($errContent -match "https://[a-z0-9-]+\.trycloudflare\.com") {
        $tunnelUrl = $matches[0]
        break
      }
    }
  }

  if (-not $tunnelUrl) {
    throw "Could not detect tunnel URL. Check $log and $errLog for details."
  }
  return $tunnelUrl
}

function Upsert-VercelEnv([string]$projectId, [string]$teamId, [string]$token, [string]$apiUrl) {
  # Vercel env upsert endpoint is in v10.
  $base = "https://api.vercel.com/v10/projects/$projectId/env?upsert=true"
  if ($teamId) { $base = "$base&teamId=$teamId" }

  $headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
  }

  $body = @{
    key = "NEXT_PUBLIC_API_URL"
    value = $apiUrl
    type = "encrypted"
    target = @("production")
  } | ConvertTo-Json

  Write-Host "Updating Vercel env NEXT_PUBLIC_API_URL ..." -ForegroundColor Cyan
  try {
    Invoke-RestMethod -Method Post -Uri $base -Headers $headers -Body $body | Out-Null
  } catch {
    $status = $null
    $detail = $null
    if ($_.Exception.Response) {
      $status = $_.Exception.Response.StatusCode.value__
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $detail = $reader.ReadToEnd()
      } catch {}
    }
    Write-Host "Vercel env update failed (status $status)." -ForegroundColor Red
    if ($detail) { Write-Host $detail -ForegroundColor Yellow }
    throw
  }
}

function Invoke-VercelGet([string]$uri, [hashtable]$headers) {
  try {
    return Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
  } catch {
    $status = $null
    $detail = $null
    if ($_.Exception.Response) {
      $status = $_.Exception.Response.StatusCode.value__
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $detail = $reader.ReadToEnd()
      } catch {}
    }
    return @{ __error = $true; status = $status; detail = $detail; uri = $uri }
  }
}

function Test-VercelAuth([string]$token) {
  $headers = @{ Authorization = "Bearer $token" }
  $res = Invoke-VercelGet -uri "https://api.vercel.com/v2/user" -headers $headers
  if ($res.__error) {
    Write-Host "Vercel token test failed (status $($res.status))." -ForegroundColor Red
    if ($res.detail) { Write-Host $res.detail -ForegroundColor Yellow }
    return $false
  }
  Write-Host "Vercel token is valid for user: $($res.user.email)" -ForegroundColor Green
  return $true
}

function Resolve-TeamIdFromSlug([string]$teamSlug, [string]$token) {
  if (-not $teamSlug) { return $null }
  $headers = @{ Authorization = "Bearer $token" }
  $res = Invoke-VercelGet -uri "https://api.vercel.com/v2/teams" -headers $headers
  if ($res.__error) {
    Write-Host "Team list lookup failed (status $($res.status))." -ForegroundColor Yellow
    return $null
  }
  $team = $res.teams | Where-Object { $_.slug -eq $teamSlug } | Select-Object -First 1
  if ($team) { return $team.id }
  return $null
}

function Resolve-VercelScope([string]$projectId, [string]$teamId, [string]$token, [string]$fallbackName) {
  $headers = @{ Authorization = "Bearer $token" }

  $attempts = @()
  if ($teamId) { $attempts += @{ teamId = $teamId; idOrName = $projectId } }
  $attempts += @{ teamId = $null; idOrName = $projectId }
  if ($fallbackName) {
    if ($teamId) { $attempts += @{ teamId = $teamId; idOrName = $fallbackName } }
    $attempts += @{ teamId = $null; idOrName = $fallbackName }
  }

  foreach ($attempt in $attempts) {
    $tryTeam = $attempt.teamId
    $idOrName = $attempt.idOrName
    $uri = "https://api.vercel.com/v9/projects/$idOrName"
    if ($tryTeam) { $uri = "$uri?teamId=$tryTeam" }
    $res = Invoke-VercelGet -uri $uri -headers $headers
    if (-not $res.__error) {
      if ($tryTeam) {
        Write-Host "Verified project '$idOrName' under team scope." -ForegroundColor Green
      } else {
        Write-Host "Verified project '$idOrName' under personal scope (no teamId)." -ForegroundColor Green
      }
      return @{ teamId = $tryTeam; idOrName = $idOrName }
    }
    Write-Host "Project lookup failed for '$idOrName' with teamId '$tryTeam' (status $($res.status))." -ForegroundColor Yellow
    if ($res.detail) { Write-Host $res.detail -ForegroundColor DarkYellow }
  }

  throw "Project not found with or without teamId. Verify VERCEL_PROJECT_ID (or VERCEL_PROJECT_NAME) and that the token belongs to the same Vercel account/team."
}

function Trigger-VercelDeploy([string]$hookUrl) {
  if (-not $hookUrl) {
    Write-Host "No VERCEL_DEPLOY_HOOK_URL set. Redeploy manually in Vercel." -ForegroundColor Yellow
    return
  }
  Write-Host "Triggering Vercel deploy hook ..." -ForegroundColor Cyan
  Invoke-WebRequest -Method Post -Uri $hookUrl | Out-Null
}

Load-EnvFile $envFile

if (-not $env:VERCEL_TOKEN -or (-not $env:VERCEL_PROJECT_ID -and -not $env:VERCEL_PROJECT_NAME)) {
  throw "Missing VERCEL_TOKEN and VERCEL_PROJECT_ID (or VERCEL_PROJECT_NAME) in .env.local."
}

if ($env:VERCEL_TEAM_SLUG -and -not $env:VERCEL_TEAM_ID) {
  $resolvedTeam = Resolve-TeamIdFromSlug -teamSlug $env:VERCEL_TEAM_SLUG -token $env:VERCEL_TOKEN
  if ($resolvedTeam) {
    $env:VERCEL_TEAM_ID = $resolvedTeam
    Write-Host "Resolved VERCEL_TEAM_ID from slug '$env:VERCEL_TEAM_SLUG'." -ForegroundColor Green
  } else {
    Write-Host "Could not resolve VERCEL_TEAM_ID from VERCEL_TEAM_SLUG." -ForegroundColor Yellow
  }
}

if (-not (Test-VercelAuth -token $env:VERCEL_TOKEN)) {
  throw "Vercel token invalid or unauthorized."
}

Start-BackendIfNeeded
$tunnelUrl = Start-QuickTunnelAndGetUrl
Write-Host "Tunnel URL: $tunnelUrl" -ForegroundColor Green

try {
  $resolved = Resolve-VercelScope -projectId $env:VERCEL_PROJECT_ID -teamId $env:VERCEL_TEAM_ID -token $env:VERCEL_TOKEN -fallbackName $env:VERCEL_PROJECT_NAME
  Upsert-VercelEnv -projectId $resolved.idOrName -teamId $resolved.teamId -token $env:VERCEL_TOKEN -apiUrl $tunnelUrl
  Trigger-VercelDeploy -hookUrl $env:VERCEL_DEPLOY_HOOK_URL
  Write-Host "Done. The UI should be live once the deploy finishes." -ForegroundColor Green
} catch {
  Write-Host "Vercel update failed. Backend + tunnel are running." -ForegroundColor Yellow
  Write-Host "Manual step: set NEXT_PUBLIC_API_URL in Vercel to $tunnelUrl and redeploy." -ForegroundColor Yellow
  if ($env:VERCEL_DEPLOY_HOOK_URL) {
    Write-Host "Deploy hook is set, but env update failed; redeploy manually after updating the env var." -ForegroundColor Yellow
  }
}
