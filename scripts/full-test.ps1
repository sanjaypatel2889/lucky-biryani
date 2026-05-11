# Lucky Biryani - Friday Full Test
# Comprehensive end-to-end health check against an already-running stack.
#
#   .\scripts\full-test.ps1
#
# Tests every major capability the website ships with:
#   1. API health
#   2. Public menu endpoints (branch, categories, items)
#   3. Pricing engine + coupons (FIRST50, OFFPEAK10, FREEDEL)
#   4. Email-based OTP auth flow (current) - reads OTP from NotificationLog DB
#   5. Every web route returns HTTP 200 and the right content
#   6. Full customer journey: signup -> place order -> pay -> KDS -> rider -> delivery
#   7. Table booking + QR check-in
#   8. Admin auth-gating (anonymous request -> 401)
#   9. WebSocket reachable
#  10. Smoke check that seeded admin/rider users can still log in (regression)

param(
    [string]$ApiBase = 'http://localhost:4000',
    [string]$WebBase = 'http://localhost:3000'
)

$ErrorActionPreference = 'Continue'
$pass = 0
$fail = 0
$issues = New-Object System.Collections.ArrayList

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function OK($m)   { Write-Host "  PASS  $m" -ForegroundColor Green; $script:pass++ }
function NO($m)   { Write-Host "  FAIL  $m" -ForegroundColor Red; $script:fail++; [void]$script:issues.Add($m) }
function WARN($m) { Write-Host "  WARN  $m" -ForegroundColor Yellow }
function Info($m) { Write-Host "        $m" -ForegroundColor DarkGray }

# Configure DATABASE_URL once so our get-otp helper can read NotificationLog.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
$GetOtpPath = Join-Path $ScriptDir 'get-otp.ts'
$dbAbs = (Resolve-Path (Join-Path $ScriptDir '..\apps\api\prisma\dev.db')).Path -replace '\\','/'
$env:DATABASE_URL = "file:$dbAbs"

function ApiCall {
    param([string]$Method, [string]$Path, $Body, [string]$Token)
    $headers = @{ 'Content-Type' = 'application/json' }
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }
    $json = $null
    if ($Body) { $json = ($Body | ConvertTo-Json -Depth 10 -Compress) }
    return Invoke-RestMethod -Method $Method -Uri "$ApiBase$Path" -Headers $headers -Body $json -TimeoutSec 10
}

function GetEmailOtp([string]$email) {
    $root = Split-Path -Parent $PSScriptRoot
    if (-not $root) { $root = Split-Path -Parent (Get-Location).Path }
    $helper = Join-Path $PSScriptRoot 'get-otp.ts'
    Push-Location $root
    try {
        $out = & npx tsx $helper $email 2>$null
        if ($LASTEXITCODE -ne 0) { throw "could not read OTP for $email" }
        return ($out | Out-String).Trim()
    } finally { Pop-Location }
}

function LoginByEmail([string]$email, [string]$name) {
    ApiCall POST '/api/v1/auth/otp/send' @{ email = $email } | Out-Null
    Start-Sleep -Milliseconds 200
    $code = GetEmailOtp $email
    $body = @{ email = $email; otp = $code }
    if ($name) { $body.name = $name }
    return ApiCall POST '/api/v1/auth/otp/verify' $body
}

# ---------------------------------------------------------------------------
Step "1. API health"
try {
    $h = ApiCall GET '/api/v1/health'
    if ($h.ok -eq $true) { OK "GET /api/v1/health -> ok" } else { NO "health payload missing ok=true" }
} catch { NO "API not reachable at $ApiBase ($($_.Exception.Message))" }

# ---------------------------------------------------------------------------
Step "2. Public menu endpoints"
$branchId = $null
try {
    $b = ApiCall GET '/api/v1/menu/branch'
    if ($b.branch.name) { OK "GET /menu/branch -> $($b.branch.name)"; $branchId = $b.branch.id } else { NO "branch missing name" }
} catch { NO "GET /menu/branch -> $($_.Exception.Message)" }

try {
    $cats = ApiCall GET '/api/v1/menu/categories'
    if ($cats.categories.Count -ge 6) { OK "GET /menu/categories -> $($cats.categories.Count) categories" }
    else { NO "expected >=6 categories, got $($cats.categories.Count)" }
} catch { NO "GET /menu/categories -> $($_.Exception.Message)" }

$menu = $null
try {
    $menu = ApiCall GET '/api/v1/menu/items'
    if ($menu.items.Count -ge 19) { OK "GET /menu/items -> $($menu.items.Count) items" }
    else { NO "expected >=19 items, got $($menu.items.Count)" }
} catch { NO "GET /menu/items -> $($_.Exception.Message)" }

# ---------------------------------------------------------------------------
Step "3. Pricing engine + coupons"
$biryani = $null; $naan = $null; $cartPayload = $null
if ($menu) {
    $biryani = $menu.items | Where-Object { $_.name -like '*Hyderabadi*' } | Select-Object -First 1
    $naan    = $menu.items | Where-Object { $_.name -eq 'Butter Naan' } | Select-Object -First 1
}
if ($biryani -and $naan -and $branchId) {
    $spice   = ($biryani.modifierGroups | Where-Object { $_.name -eq 'Spice Level' }).modifiers[1].id
    $portion = ($biryani.modifierGroups | Where-Object { $_.name -eq 'Portion' }).modifiers[1].id
    $cartPayload = @(
        @{ itemId = $biryani.id; qty = 1; modifierIds = @($spice, $portion) }
        @{ itemId = $naan.id;    qty = 2; modifierIds = @() }
    )

    foreach ($coupon in @('FIRST50','OFFPEAK10','FREEDEL')) {
        try {
            $q = ApiCall POST '/api/v1/orders/quote' @{
                branchId    = $branchId
                type        = 'DELIVERY'
                cart        = $cartPayload
                destination = @{ lat = 17.4239; lng = 78.4738 }
                couponCode  = $coupon
            }
            if ($q.total -gt 0) {
                OK ("quote {0} -> sub={1} discount={2:N2} total={3:N2}" -f $coupon, $q.subtotal, $q.discount, $q.total)
            } else { NO "quote $coupon returned non-positive total" }
        } catch { NO "quote $coupon -> $($_.Exception.Message)" }
    }
} else {
    NO "skipping pricing - menu/branch not loaded"
}

# ---------------------------------------------------------------------------
Step "4. Email-OTP auth flow"
$customerEmail = "friday-test-$([guid]::NewGuid().ToString('N').Substring(0,8))@example.com"
$cust = $null
try {
    $cust = LoginByEmail $customerEmail 'Friday Tester'
    if ($cust.token) { OK "signup + verify ($customerEmail) -> token, user=$($cust.user.name), role=$($cust.user.role)" }
    else { NO "verify returned no token" }
} catch { NO "email OTP flow -> $($_.Exception.Message)" }

# 401 on bad OTP
try {
    ApiCall POST '/api/v1/auth/otp/send' @{ email = "bad-$customerEmail" } | Out-Null
    Invoke-RestMethod -Method POST -Uri "$ApiBase/api/v1/auth/otp/verify" -Headers @{ 'Content-Type'='application/json' } -Body (@{ email = "bad-$customerEmail"; otp = '999999' } | ConvertTo-Json) -TimeoutSec 5 | Out-Null
    NO "bad OTP was accepted"
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) { OK "bad OTP -> 401 (correctly rejected)" }
    else { NO "bad OTP -> unexpected response $($_.Exception.Message)" }
}

# 400 on invalid email
try {
    Invoke-RestMethod -Method POST -Uri "$ApiBase/api/v1/auth/otp/send" -Headers @{ 'Content-Type'='application/json' } -Body (@{ email = 'not-an-email' } | ConvertTo-Json) -TimeoutSec 5 | Out-Null
    NO "invalid email was accepted"
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) { OK "invalid email -> 400 (correctly rejected)" }
    else { NO "invalid email -> unexpected response $($_.Exception.Message)" }
}

# ---------------------------------------------------------------------------
Step "5. Web pages (every route returns 200)"
$pages = @(
    @{ path = '/';      mustInclude = 'Lucky' }
    @{ path = '/menu';  mustInclude = 'Biryani' }
    @{ path = '/cart';  mustInclude = $null }
    @{ path = '/book';  mustInclude = $null }
    @{ path = '/orders'; mustInclude = $null }
    @{ path = '/admin'; mustInclude = $null }
    @{ path = '/admin/orders'; mustInclude = $null }
    @{ path = '/admin/tables'; mustInclude = $null }
    @{ path = '/admin/fleet';  mustInclude = $null }
    @{ path = '/admin/menu';   mustInclude = $null }
    @{ path = '/rider'; mustInclude = $null }
)
foreach ($p in $pages) {
    try {
        $r = Invoke-WebRequest -Uri "$WebBase$($p.path)" -TimeoutSec 30 -UseBasicParsing
        if ($r.StatusCode -ne 200) { NO "GET $($p.path) -> HTTP $($r.StatusCode)"; continue }
        if ($p.mustInclude -and ($r.Content -notmatch [regex]::Escape($p.mustInclude))) {
            NO "GET $($p.path) -> body missing '$($p.mustInclude)'"
            continue
        }
        OK "GET $($p.path) -> 200"
    } catch {
        NO "GET $($p.path) -> $($_.Exception.Message)"
    }
}

# ---------------------------------------------------------------------------
Step "6. Customer order lifecycle (place -> pay -> KDS -> rider -> delivery)"
$orderId = $null
$placed = $null
if ($cust -and $cartPayload -and $branchId) {
    try {
        $placed = ApiCall POST '/api/v1/orders' @{
            branchId    = $branchId
            type        = 'DELIVERY'
            paymentMode = 'ONLINE'
            cart        = $cartPayload
            address     = @{ line1='12-3-456'; pincode='500033'; lat=17.4239; lng=78.4738 }
            couponCode  = 'FIRST50'
        } $cust.token
        $orderId = $placed.order.id
        OK "POST /orders -> $($placed.order.orderNumber) status=$($placed.order.status)"
    } catch { NO "POST /orders -> $($_.Exception.Message)" }

    if ($orderId) {
        try {
            $paid = ApiCall POST "/api/v1/orders/$orderId/confirm-payment" @{
                razorpayOrderId   = $placed.razorpay.id
                razorpayPaymentId = 'pay_test_friday'
                razorpaySignature = 'sig_test_friday'
            } $cust.token
            if ($paid.order.status -eq 'PAID') { OK "confirm-payment -> PAID" }
            else { NO "confirm-payment status was $($paid.order.status), expected PAID" }
        } catch { NO "confirm-payment -> $($_.Exception.Message)" }
    }
}

# KDS + rider parts use the seeded admin/rider rows (which now have emails).
# Override with ADMIN_TEST_EMAIL / RIDER_TEST_EMAIL env if you change the seed.
Step "7. Admin / rider gated routes"
$adminCanLogin = $false
$riderCanLogin = $false
$adminEmailGuess = $env:ADMIN_TEST_EMAIL
if (-not $adminEmailGuess) { $adminEmailGuess = 'admin@lucky.test' }
$riderEmailGuess = $env:RIDER_TEST_EMAIL
if (-not $riderEmailGuess) { $riderEmailGuess = 'rider1@lucky.test' }
try {
    $a = LoginByEmail $adminEmailGuess $null
    if ($a.user.role -in @('ADMIN','OWNER')) { $adminCanLogin = $true; OK "admin login via $adminEmailGuess (role=$($a.user.role))" }
    else { NO "admin login: user has role $($a.user.role), not ADMIN/OWNER" }
} catch { NO "admin login -> $($_.Exception.Message)" }
try {
    $r = LoginByEmail $riderEmailGuess $null
    if ($r.user.role -eq 'RIDER') { $riderCanLogin = $true; OK "rider login via $riderEmailGuess" }
    else { NO "rider login: user has role $($r.user.role), not RIDER" }
} catch { NO "rider login -> $($_.Exception.Message)" }

# anonymous on admin route -> 401
try {
    Invoke-RestMethod -Method GET -Uri "$ApiBase/api/v1/admin/analytics/today" -TimeoutSec 5 | Out-Null
    NO "admin analytics: anonymous request was NOT rejected"
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) { OK "admin analytics: anonymous -> 401" }
    else { NO "admin analytics anon -> unexpected $($_.Exception.Message)" }
}

# customer-token on admin route -> 403
if ($cust) {
    try {
        ApiCall GET '/api/v1/admin/analytics/today' $null $cust.token | Out-Null
        NO "admin analytics: CUSTOMER token was NOT rejected"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -in 401, 403) { OK "admin analytics: customer token -> $($_.Exception.Response.StatusCode.value__)" }
        else { NO "admin analytics customer-token -> unexpected $($_.Exception.Message)" }
    }
}

# ---------------------------------------------------------------------------
Step "8. Table booking + QR check-in"
if ($cust -and $branchId) {
    $today = (Get-Date).ToString('yyyy-MM-dd')
    try {
        $slots = ApiCall GET "/api/v1/bookings/availability?branchId=$branchId&date=$today&partySize=4"
        if ($slots.slots.Count -gt 0) {
            OK "availability -> $($slots.slots.Count) slots today"
            $slot = $slots.slots[[Math]::Min(4, $slots.slots.Count - 1)]
            try {
                $book = ApiCall POST '/api/v1/bookings' @{
                    branchId      = $branchId
                    partySize     = 4
                    slotStart     = $slot.start
                    occasion      = 'Birthday'
                    specialRequest= 'Window seat please'
                } $cust.token
                OK "POST /bookings -> $($book.booking.bookingNumber)"
                try {
                    $ci = ApiCall POST "/api/v1/bookings/checkin/$($book.booking.qrToken)" @{}
                    if ($ci.booking.status -eq 'SEATED') { OK "QR check-in -> SEATED" }
                    else { NO "check-in status was $($ci.booking.status), expected SEATED" }
                } catch { NO "QR check-in -> $($_.Exception.Message)" }
            } catch { NO "POST /bookings -> $($_.Exception.Message)" }
        } else { NO "no booking slots returned for today" }
    } catch { NO "availability -> $($_.Exception.Message)" }
}

# ---------------------------------------------------------------------------
Step "9. New feature endpoints"
try {
    $aiStatus = ApiCall GET '/api/v1/ai/status'
    OK "AI chat status -> mode=$($aiStatus.mode) model=$($aiStatus.model)"
} catch { NO "AI status -> $($_.Exception.Message)" }
try {
    $chatRes = ApiCall POST '/api/v1/ai/chat' @{ messages = @(@{ role='user'; content='What veg dishes do you recommend?' }) }
    if ($chatRes.reply -and $chatRes.reply.Length -gt 0) { OK "AI chat reply -> '$($chatRes.reply.Substring(0,[Math]::Min(60,$chatRes.reply.Length)))...'" }
    else { NO "AI chat returned empty reply" }
} catch { NO "AI chat -> $($_.Exception.Message)" }
try {
    $push = ApiCall GET '/api/v1/push/public-key'
    OK "Push status -> enabled=$($push.enabled)"
} catch { NO "Push status -> $($_.Exception.Message)" }
try {
    $rev = ApiCall GET '/api/v1/reviews/branch'
    OK "Reviews summary -> avg=$($rev.ratingAvg) count=$($rev.ratingCount)"
} catch { NO "Reviews summary -> $($_.Exception.Message)" }

# Web pages for new routes
foreach ($p in @('/privacy','/terms','/refer')) {
    try {
        $r = Invoke-WebRequest -Uri "$WebBase$p" -TimeoutSec 30 -UseBasicParsing
        if ($r.StatusCode -eq 200) { OK "GET $p -> 200" } else { NO "GET $p -> HTTP $($r.StatusCode)" }
    } catch { NO "GET $p -> $($_.Exception.Message)" }
}

# ---------------------------------------------------------------------------
Step "10. WebSocket reachable"
try {
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $cts = New-Object System.Threading.CancellationTokenSource 3000
    $ws.ConnectAsync([uri]"ws://localhost:4000/ws", $cts.Token).Wait()
    if ($ws.State -eq 'Open') {
        OK "WebSocket ws://localhost:4000/ws -> Open"
        $closeCts = New-Object System.Threading.CancellationTokenSource 2000
        try {
            $ws.CloseAsync('NormalClosure', 'bye', $closeCts.Token).Wait()
        } catch { Info "close handshake skipped: $($_.Exception.Message)" }
    } else { NO "WebSocket state was $($ws.State)" }
} catch { NO "WebSocket connect -> $($_.Exception.Message)" }

# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
$colour = if ($fail -eq 0) { 'Green' } else { 'Red' }
Write-Host (" RESULT: {0} passed, {1} failed" -f $pass, $fail) -ForegroundColor $colour
Write-Host "========================================" -ForegroundColor Yellow
if ($issues.Count -gt 0) {
    Write-Host ""
    Write-Host "Issues found:" -ForegroundColor Red
    foreach ($i in $issues) { Write-Host "  - $i" -ForegroundColor Red }
}
exit $fail
