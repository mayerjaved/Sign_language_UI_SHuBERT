# One-command backend bring-up + Cloudflare quick tunnel + Vercel env update.
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File .\sign-language-ui\start_backend_and_vercel.ps1

param(
  [switch]$RestartBackend,
  [switch]$SkipTrslDocker,
  [switch]$SkipLearningApi,
  [bool]$InlineBackendLogs = $false
)

$ErrorActionPreference = "Stop"

$uiDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $uiDir
$envFile = Join-Path $uiDir ".env.local"
$backendDir = "C:\code_projects\SHuBERT_transferLearning\backEnd_API_signlanguage_UI"
$mlRootDir = Split-Path -Parent $backendDir
$learningDir = Join-Path $mlRootDir "learning_mode"

function Show-DeploySourceNotice([string]$repoPath) {
  Write-Host "Note: Vercel deploy hooks redeploy code already pushed to Git; local files are not uploaded." -ForegroundColor Cyan

  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) {
    Write-Host "Git not found on PATH, so local commit/push status cannot be checked." -ForegroundColor Yellow
    return
  }

  $statusOutput = & git -C $repoPath status --porcelain --untracked-files=normal 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not read git status from $repoPath." -ForegroundColor Yellow
    return
  }

  $statusLines = @($statusOutput)
  if ($statusLines.Count -eq 0) {
    return
  }

  Write-Host "Warning: Detected local changes not included in Git history yet." -ForegroundColor Yellow
  Write-Host "If you expect UI updates on Vercel, commit and push first." -ForegroundColor Yellow

  $maxShown = [Math]::Min($statusLines.Count, 12)
  for ($i = 0; $i -lt $maxShown; $i++) {
    Write-Host ("  " + $statusLines[$i]) -ForegroundColor DarkYellow
  }

  if ($statusLines.Count -gt $maxShown) {
    Write-Host "  ... (more files omitted)" -ForegroundColor DarkYellow
  }
}

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

function Stop-ProcessOnPort([int]$Port, [string]$Label = "service") {
  $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $listening) { return }

  $pids = $listening | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $pids) {
    try {
      Write-Host "Stopping $Label on port $Port (PID $procId)..." -ForegroundColor Yellow
      Stop-Process -Id $procId -Force -ErrorAction Stop
    } catch {
      Write-Host "Could not stop PID ${procId}: $($_.Exception.Message)" -ForegroundColor Yellow
    }
  }
  Start-Sleep -Seconds 1
}

function Stop-BackendOnPort8000 {
  Stop-ProcessOnPort -Port 8000 -Label "backend API"
}

function Resolve-BackendPython([string]$PreferredVenvPython) {
  $candidates = @()
  if ($env:BACKEND_PYTHON) {
    $candidates += @{ Path = $env:BACKEND_PYTHON; PrefixArgs = @() }
  }
  if ($PreferredVenvPython) {
    $candidates += @{ Path = $PreferredVenvPython; PrefixArgs = @() }
  }
  $candidates += @(
    @{ Path = "C:\Users\mayer\AppData\Local\Programs\Python\Python311\python.exe"; PrefixArgs = @() },
    @{ Path = "C:\Users\mayer\AppData\Local\Programs\Python\Python310\python.exe"; PrefixArgs = @() },
    @{ Path = "python"; PrefixArgs = @() },
    @{ Path = "py"; PrefixArgs = @("-3.11") },
    @{ Path = "py"; PrefixArgs = @("-3.10") }
  )

  $seen = @{}
  foreach ($candidate in $candidates) {
    $path = $candidate.Path
    if (-not $path) { continue }
    $key = "$path|$($candidate.PrefixArgs -join ' ')"
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true

    if ($path -match '^[A-Za-z]:\\') {
      if (-not (Test-Path $path)) {
        continue
      }
    }

    try {
      $null = & $path @($candidate.PrefixArgs) --version 2>$null
      if ($LASTEXITCODE -eq 0) {
        return $candidate
      }
    } catch {
      continue
    }
  }

  throw "Could not find a working Python runtime for backend startup. Set BACKEND_PYTHON in .env.local to a valid python.exe."
}

function Start-BackendIfNeeded([switch]$ForceRestart, [bool]$InlineLogs = $true) {
  if ($ForceRestart) {
    Stop-BackendOnPort8000
  }

  $listening = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
  if ($listening) {
    Write-Host "Backend already listening on port 8000." -ForegroundColor Green
    Write-Host "Backend process already existed before this run, so no new stdout/stderr log files were created by this script." -ForegroundColor DarkGray
    return
  }

  $venvPython = "C:\code_projects\SHuBERT_transferLearning\.venv310\Scripts\python.exe"
  $pythonConfig = Resolve-BackendPython -PreferredVenvPython $venvPython
  $python = $pythonConfig.Path
  $pythonPrefixArgs = @($pythonConfig.PrefixArgs)
  $apiPath = Join-Path $backendDir "api.py"

  if (!(Test-Path $apiPath)) {
    throw "Backend api.py not found at $apiPath"
  }

  Write-Host ("Using backend Python: " + $python + " " + ($pythonPrefixArgs -join " ")) -ForegroundColor DarkGray
  Write-Host "Starting backend API on http://localhost:8000 ..." -ForegroundColor Cyan
  $argList = @($pythonPrefixArgs + @("`"$apiPath`""))
  $outLog = $null
  $errLog = $null
  if ($InlineLogs) {
    Write-Host "Backend logs will stream in this terminal (InlineBackendLogs=true)." -ForegroundColor DarkGray
    $proc = Start-Process -FilePath $python -ArgumentList $argList -WorkingDirectory $backendDir -NoNewWindow -PassThru
  } else {
    $outLog = Join-Path $env:TEMP ("backend-api-" + ([Guid]::NewGuid().ToString("N")) + ".out.log")
    $errLog = Join-Path $env:TEMP ("backend-api-" + ([Guid]::NewGuid().ToString("N")) + ".err.log")
    $proc = Start-Process -FilePath $python -ArgumentList $argList -WorkingDirectory $backendDir -WindowStyle Normal -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    Write-Host "Backend stdout log: $outLog" -ForegroundColor DarkGray
    Write-Host "Backend stderr log: $errLog" -ForegroundColor DarkGray
  }
  Start-Sleep -Seconds 2

  $listeningAfter = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
  if (-not $listeningAfter) {
    $stdoutTail = ""
    $stderrTail = ""
    if ($outLog -and (Test-Path $outLog)) {
      $stdoutTail = (Get-Content -Path $outLog -Tail 20 -ErrorAction SilentlyContinue) -join "`n"
    }
    if ($errLog -and (Test-Path $errLog)) {
      $stderrTail = (Get-Content -Path $errLog -Tail 20 -ErrorAction SilentlyContinue) -join "`n"
    }
    if ($stdoutTail) {
      Write-Host "Backend stdout tail:" -ForegroundColor Yellow
      Write-Host $stdoutTail -ForegroundColor DarkYellow
    }
    if ($stderrTail) {
      Write-Host "Backend stderr tail:" -ForegroundColor Yellow
      Write-Host $stderrTail -ForegroundColor DarkYellow
    }
    if ($outLog -or $errLog) {
      throw "Backend failed to start on port 8000. Process PID was $($proc.Id). Logs: $outLog ; $errLog"
    }
    throw "Backend failed to start on port 8000. Process PID was $($proc.Id). Re-run with -InlineBackendLogs:`$false for captured temp logs."
  }
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
  Write-Host "Cloudflared stdout log: $log" -ForegroundColor DarkGray
  Write-Host "Cloudflared stderr log: $errLog" -ForegroundColor DarkGray

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

function Test-TrslApiHealthy {
  try {
    $res = Invoke-RestMethod -Method Get -Uri "http://localhost:8001/health" -TimeoutSec 4
    if ($res.status -eq "ok") { return $true }
    return $false
  } catch {
    return $false
  }
}

function Start-TrslApiIfNeeded([switch]$Skip) {
  if ($Skip) {
    Write-Host "Skipping TRSL Docker API startup (requested)." -ForegroundColor Yellow
    return
  }

  if (Test-TrslApiHealthy) {
    Write-Host "TRSL Docker API already healthy on port 8001." -ForegroundColor Green
    return
  }

  Write-Host "Starting TRSL Docker API (docker compose up -d --remove-orphans trsl-api)..." -ForegroundColor Cyan
  Push-Location $mlRootDir
  try {
    & docker compose up -d --remove-orphans trsl-api
    if ($LASTEXITCODE -ne 0) {
      Write-Host "TRSL Docker API startup command failed. TRSL requests may fail." -ForegroundColor Yellow
      return
    }
  } finally {
    Pop-Location
  }

  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    if (Test-TrslApiHealthy) {
      Write-Host "TRSL Docker API is healthy on http://localhost:8001." -ForegroundColor Green
      return
    }
  }

  Write-Host "TRSL Docker API did not become healthy in time. TRSL requests may fail." -ForegroundColor Yellow
}

function Test-LearningApiHealthy {
  try {
    $res = Invoke-RestMethod -Method Get -Uri "http://localhost:8002/api/learning/health" -TimeoutSec 4
    if ($res.status -eq "ok") { return $true }
    return $false
  } catch {
    return $false
  }
}

function Start-LearningApiIfNeeded([switch]$ForceRestart, [switch]$Skip, [bool]$InlineLogs = $true) {
  if ($Skip) {
    Write-Host "Skipping Learning API startup (requested)." -ForegroundColor Yellow
    return
  }

  if ($ForceRestart) {
    Stop-ProcessOnPort -Port 8002 -Label "learning API"
  }

  if (Test-LearningApiHealthy) {
    Write-Host "Learning API already healthy on http://localhost:8002." -ForegroundColor Green
    Write-Host "Learning API process already existed before this run, so no new stdout/stderr log files were created by this script." -ForegroundColor DarkGray
    return
  }

  $learningApiPath = Join-Path $learningDir "api.py"
  if (!(Test-Path $learningApiPath)) {
    throw "Learning API not found at $learningApiPath"
  }

  $venvPython = Join-Path $mlRootDir ".venv310\Scripts\python.exe"
  $pythonConfig = Resolve-BackendPython -PreferredVenvPython $venvPython
  $python = $pythonConfig.Path
  $pythonPrefixArgs = @($pythonConfig.PrefixArgs)
  $argList = @($pythonPrefixArgs + @("-m", "uvicorn", "learning_mode.api:app", "--host", "0.0.0.0", "--port", "8002"))

  Write-Host ("Using learning Python: " + $python + " " + ($pythonPrefixArgs -join " ")) -ForegroundColor DarkGray
  Write-Host "Starting Learning API on http://localhost:8002 ..." -ForegroundColor Cyan

  $outLog = $null
  $errLog = $null
  if ($InlineLogs) {
    Write-Host "Learning API logs will stream in this terminal (InlineBackendLogs=true)." -ForegroundColor DarkGray
    $proc = Start-Process -FilePath $python -ArgumentList $argList -WorkingDirectory $mlRootDir -NoNewWindow -PassThru
  } else {
    $outLog = Join-Path $env:TEMP ("learning-api-" + ([Guid]::NewGuid().ToString("N")) + ".out.log")
    $errLog = Join-Path $env:TEMP ("learning-api-" + ([Guid]::NewGuid().ToString("N")) + ".err.log")
    $proc = Start-Process -FilePath $python -ArgumentList $argList -WorkingDirectory $mlRootDir -WindowStyle Normal -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    Write-Host "Learning API stdout log: $outLog" -ForegroundColor DarkGray
    Write-Host "Learning API stderr log: $errLog" -ForegroundColor DarkGray
  }

  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    if (Test-LearningApiHealthy) {
      Write-Host "Learning API is healthy on http://localhost:8002." -ForegroundColor Green
      return
    }
  }

  $stdoutTail = ""
  $stderrTail = ""
  if ($outLog -and (Test-Path $outLog)) {
    $stdoutTail = (Get-Content -Path $outLog -Tail 20 -ErrorAction SilentlyContinue) -join "`n"
  }
  if ($errLog -and (Test-Path $errLog)) {
    $stderrTail = (Get-Content -Path $errLog -Tail 20 -ErrorAction SilentlyContinue) -join "`n"
  }
  if ($stdoutTail) {
    Write-Host "Learning API stdout tail:" -ForegroundColor Yellow
    Write-Host $stdoutTail -ForegroundColor DarkYellow
  }
  if ($stderrTail) {
    Write-Host "Learning API stderr tail:" -ForegroundColor Yellow
    Write-Host $stderrTail -ForegroundColor DarkYellow
  }
  if ($outLog -or $errLog) {
    throw "Learning API failed to start on port 8002. Process PID was $($proc.Id). Logs: $outLog ; $errLog"
  }
  throw "Learning API failed to start on port 8002. Process PID was $($proc.Id). Re-run with -InlineBackendLogs:`$false for captured temp logs."
}

function Upsert-VercelEnv(
  [string]$projectId,
  [string]$teamId,
  [string]$teamSlug,
  [string]$token,
  [string]$envKey,
  [string]$envValue
) {
  # Vercel env upsert endpoint is in v10.
  $base = "https://api.vercel.com/v10/projects/$projectId/env?upsert=true"
  if ($teamId) {
    $base = "$base&teamId=$teamId"
  } elseif ($teamSlug) {
    $base = "$base&slug=$teamSlug"
  }

  $headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
  }

  $body = @{
    key = $envKey
    value = $envValue
    type = "encrypted"
    target = @("production", "preview", "development")
  } | ConvertTo-Json

  Write-Host "Updating Vercel env $envKey ..." -ForegroundColor Cyan
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

function Upsert-VercelEnvBestEffort(
  [string]$projectId,
  [string]$projectName,
  [string]$teamId,
  [string]$teamSlug,
  [string]$token,
  [string]$envKey,
  [string]$envValue
) {
  $attempts = @()
  if ($projectId) {
    if ($teamId) { $attempts += @{ idOrName = $projectId; teamId = $teamId } }
    if ($teamSlug) { $attempts += @{ idOrName = $projectId; teamSlug = $teamSlug } }
    $attempts += @{ idOrName = $projectId; teamId = $null }
  }
  if ($projectName) {
    if ($teamId) { $attempts += @{ idOrName = $projectName; teamId = $teamId } }
    if ($teamSlug) { $attempts += @{ idOrName = $projectName; teamSlug = $teamSlug } }
    $attempts += @{ idOrName = $projectName; teamId = $null }
  }

  $seen = @{}
  foreach ($attempt in $attempts) {
    $idOrName = $attempt.idOrName
    $scope = $attempt.teamId
    $scopeSlug = $attempt.teamSlug
    $key = "$idOrName|$scope|$scopeSlug"
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true

    try {
      Upsert-VercelEnv -projectId $idOrName -teamId $scope -teamSlug $scopeSlug -token $token -envKey $envKey -envValue $envValue
      return @{ idOrName = $idOrName; teamId = $scope; teamSlug = $scopeSlug }
    } catch {
      Write-Host "Upsert failed for '$idOrName' with teamId '$scope' and slug '$scopeSlug'." -ForegroundColor Yellow
    }
  }

  throw "Unable to update $envKey using any configured project/team scope. Verify VERCEL_PROJECT_ID / VERCEL_PROJECT_NAME and team access."
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
  try {
    Invoke-WebRequest -Method Post -Uri $hookUrl -UseBasicParsing | Out-Null
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
    Write-Host "Deploy hook call failed (status $status). Redeploy manually in Vercel." -ForegroundColor Yellow
    if ($detail) { Write-Host $detail -ForegroundColor DarkYellow }
  }
}

Show-DeploySourceNotice -repoPath $repoRoot

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

Start-BackendIfNeeded -ForceRestart:$RestartBackend -InlineLogs:$InlineBackendLogs
Start-TrslApiIfNeeded -Skip:$SkipTrslDocker
Start-LearningApiIfNeeded -ForceRestart:$RestartBackend -Skip:$SkipLearningApi -InlineLogs:$InlineBackendLogs
$tunnelUrl = Start-QuickTunnelAndGetUrl
Write-Host "Tunnel URL: $tunnelUrl" -ForegroundColor Green

try {
  $resolvedApi = Upsert-VercelEnvBestEffort -projectId $env:VERCEL_PROJECT_ID -projectName $env:VERCEL_PROJECT_NAME -teamId $env:VERCEL_TEAM_ID -teamSlug $env:VERCEL_TEAM_SLUG -token $env:VERCEL_TOKEN -envKey "NEXT_PUBLIC_API_URL" -envValue $tunnelUrl
  Write-Host "Updated NEXT_PUBLIC_API_URL for project '$($resolvedApi.idOrName)' (teamId '$($resolvedApi.teamId)', slug '$($resolvedApi.teamSlug)')." -ForegroundColor Green

  $resolvedLearning = Upsert-VercelEnvBestEffort -projectId $env:VERCEL_PROJECT_ID -projectName $env:VERCEL_PROJECT_NAME -teamId $env:VERCEL_TEAM_ID -teamSlug $env:VERCEL_TEAM_SLUG -token $env:VERCEL_TOKEN -envKey "NEXT_PUBLIC_LEARNING_API_URL" -envValue $tunnelUrl
  Write-Host "Updated NEXT_PUBLIC_LEARNING_API_URL for project '$($resolvedLearning.idOrName)' (teamId '$($resolvedLearning.teamId)', slug '$($resolvedLearning.teamSlug)')." -ForegroundColor Green

  Trigger-VercelDeploy -hookUrl $env:VERCEL_DEPLOY_HOOK_URL
  Write-Host "Done. The UI should be live once the deploy finishes." -ForegroundColor Green
} catch {
  Write-Host "Vercel env update failed. Backend + tunnel are running." -ForegroundColor Yellow
  Write-Host "Manual step: set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_LEARNING_API_URL in Vercel to $tunnelUrl and redeploy." -ForegroundColor Yellow
  if ($env:VERCEL_DEPLOY_HOOK_URL) {
    Write-Host "Deploy hook is set, but env update failed; redeploy manually after updating the env var." -ForegroundColor Yellow
  }
}
