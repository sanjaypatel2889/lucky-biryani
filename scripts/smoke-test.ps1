# Lucky Biryani - local smoke test
# Brings up the full stack on localhost, hits key endpoints, opens the browser.
#
#   .\scripts\smoke-test.ps1            # full bring-up + checks + open browser
#   .\scripts\smoke-test.ps1 -Reseed    # also wipe + reseed the SQLite DB
#   .\scripts\smoke-test.ps1 -NoBrowser # don't auto-open browser (CI mode)
#
# Stop the servers afterwards with:
#   Stop-Process -Id <api-pid>,<web-pid>

param(
    [switch]$Reseed,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$apiDir   = Join-Path $repoRoot 'apps\api'
$webDir   = Join-Path $repoRoot 'apps\web'
$logDir   = Join-Path $repoRoot 'scripts\logs'

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Pass($msg) { Write-Host "  PASS  $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "  FAIL  $msg" -ForegroundColor Red }
function Info($msg) { Write-Host "        $msg" -ForegroundColor DarkGray }

$failures = 0

# ---------------------------------------------------------------------------
# 1. Dependencies
# ---------------------------------------------------------------------------
Step "Checking workspace dependencies"
if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
    Info "node_modules missing - running npm install (this can take 1-2 min)"
    Push-Location $repoRoot
    npm install --no-audit --no-fund 2>&1 | Tee-Object -FilePath (Join-Path $logDir 'install.log') | Out-Null
    Pop-Location
    if ($LASTEXITCODE -ne 0) { Fail "npm install failed - see scripts\logs\install.log"; exit 1 }
}
Pass "dependencies present"

# ---------------------------------------------------------------------------
# 2. Database
# ---------------------------------------------------------------------------
Step "Checking SQLite database"
$dbPath = Join-Path $apiDir 'prisma\dev.db'
$needSeed = $Reseed -or -not (Test-Path $dbPath)

Push-Location $apiDir
if ($needSeed) {
    Info "running prisma db push + seed"
    npx prisma db push --skip-generate 2>&1 | Tee-Object -FilePath (Join-Path $logDir 'db-push.log') | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "prisma db push failed"; Pop-Location; exit 1 }
    npx prisma generate 2>&1 | Out-Null
    $env:SEED_FORCE = '1'
    npx tsx prisma\seed.ts 2>&1 | Tee-Object -FilePath (Join-Path $logDir 'seed.log') | Out-Null
    Remove-Item Env:\SEED_FORCE
    if ($LASTEXITCODE -ne 0) { Fail "seed failed"; Pop-Location; exit 1 }
    Pass "schema pushed and seed applied"
} else {
    Info "dev.db already exists (use -Reseed to wipe and re-seed)"
    Pass "database ready"
}
Pop-Location

# ---------------------------------------------------------------------------
# 3. Boot API and Web in the background
# ---------------------------------------------------------------------------
Step "Starting API on :4000 and Web on :3000"

# Kill any previous orphan processes on these ports (best effort)
foreach ($port in @(4000, 3000)) {
    $owners = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
    foreach ($processId in $owners) {
        try { Stop-Process -Id $processId -Force -ErrorAction Stop; Info "killed stale process $processId on :$port" } catch { }
    }
}

$apiLog = Join-Path $logDir 'api.log'
$webLog = Join-Path $logDir 'web.log'

$apiProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c','npm','run','dev','--workspace','apps/api','>',$apiLog,'2>&1' `
    -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden

$webProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c','npm','run','dev','--workspace','apps/web','>',$webLog,'2>&1' `
    -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden

Info "api pid: $($apiProc.Id)  log: $apiLog"
Info "web pid: $($webProc.Id)  log: $webLog"

# ---------------------------------------------------------------------------
# 4. Wait for both servers to come up
# ---------------------------------------------------------------------------
function Wait-ForUrl([string]$url, [int]$timeoutSec, [string]$label) {
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
                Pass "$label ready ($($r.StatusCode)) at $url"
                return $true
            }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    Fail "$label did not respond within $timeoutSec s at $url"
    return $false
}

Step "Waiting for servers"
$apiUp = Wait-ForUrl 'http://localhost:4000/api/v1/health' 45 'API'
$webUp = Wait-ForUrl 'http://localhost:3000/' 90 'Web'

if (-not $apiUp) {
    Info "api log tail:"
    if (Test-Path $apiLog) { Get-Content $apiLog -Tail 20 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray } }
    $failures++
}
if (-not $webUp) {
    Info "web log tail:"
    if (Test-Path $webLog) { Get-Content $webLog -Tail 20 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray } }
    $failures++
}

# ---------------------------------------------------------------------------
# 5. API endpoint smoke checks
# ---------------------------------------------------------------------------
function Test-Endpoint([string]$method, [string]$url, [string]$label, [scriptblock]$validate) {
    try {
        $r = Invoke-RestMethod -Method $method -Uri $url -TimeoutSec 5
        if ($validate) {
            $ok = & $validate $r
            if ($ok) { Pass $label } else { Fail "$label - payload validation failed"; $script:failures++ }
        } else {
            Pass $label
        }
    } catch {
        Fail "$label - $($_.Exception.Message)"
        $script:failures++
    }
}

if ($apiUp) {
    Step "API endpoint checks"
    Test-Endpoint GET 'http://localhost:4000/api/v1/health'         'GET /api/v1/health'         { param($r) $r.ok -eq $true }
    Test-Endpoint GET 'http://localhost:4000/api/v1/menu/branch'    'GET /api/v1/menu/branch'    { param($r) $r.branch -ne $null -and $r.branch.name -match 'Lucky' }
    Test-Endpoint GET 'http://localhost:4000/api/v1/menu/categories' 'GET /api/v1/menu/categories' { param($r) $r.categories.Count -ge 6 }
    Test-Endpoint GET 'http://localhost:4000/api/v1/menu/items'     'GET /api/v1/menu/items'     { param($r) $r.items.Count -ge 19 }
}

# ---------------------------------------------------------------------------
# 6. Web page smoke checks (HTML response, status 200)
# ---------------------------------------------------------------------------
function Test-Page([string]$path, [string]$label, [string]$mustInclude) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000$path" -TimeoutSec 15 -UseBasicParsing
        if ($r.StatusCode -ne 200) { Fail "$label - HTTP $($r.StatusCode)"; $script:failures++; return }
        if ($mustInclude -and ($r.Content -notmatch [regex]::Escape($mustInclude))) {
            Fail "$label - body did not contain '$mustInclude'"
            $script:failures++
            return
        }
        Pass "$label"
    } catch {
        Fail "$label - $($_.Exception.Message)"
        $script:failures++
    }
}

if ($webUp) {
    Step "Web page checks"
    Test-Page '/'      'GET /'      'Lucky'
    Test-Page '/menu'  'GET /menu'  'Biryani'
    Test-Page '/book'  'GET /book'  $null
    Test-Page '/admin' 'GET /admin' $null
    Test-Page '/rider' 'GET /rider' $null
}

# ---------------------------------------------------------------------------
# 7. Summary and browser
# ---------------------------------------------------------------------------
Write-Host ""
if ($failures -eq 0) {
    Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
} else {
    Write-Host "$failures CHECK(S) FAILED" -ForegroundColor Red
}
Write-Host ""
Write-Host "Servers still running:" -ForegroundColor Yellow
Write-Host "  Web : http://localhost:3000     (pid $($webProc.Id))"
Write-Host "  API : http://localhost:4000     (pid $($apiProc.Id))"
Write-Host "  Logs: $logDir"
Write-Host ""
Write-Host "To stop:  Stop-Process -Id $($apiProc.Id),$($webProc.Id) -Force" -ForegroundColor Yellow
Write-Host ""

if (-not $NoBrowser -and $webUp) {
    Step "Opening browser"
    Start-Process 'http://localhost:3000/'
}

exit $failures
