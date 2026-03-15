# Wait for services
Start-Sleep -Seconds 5

Write-Host "
=== LOCALHOST SYSTEM TEST ===" -ForegroundColor Yellow

# Test Backend
Write-Host "
[1] Backend Health (8000)..." -ForegroundColor Cyan
try {
    $resp = curl -s http://localhost:8000/health
    $json = $resp | ConvertFrom-Json
    Write-Host "Status: $($json.status)" -ForegroundColor Green
    Write-Host "Service: $($json.service)" -ForegroundColor Green
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Frontend 
Write-Host "
[2] Frontend Home (3000)..." -ForegroundColor Cyan
try {
    $resp = curl -s http://localhost:3000
    if ($resp -match "next") {
        Write-Host "Frontend: UP" -ForegroundColor Green
    } else {
        Write-Host "Frontend response length: $($resp.Length) chars" -ForegroundColor Yellow
    }
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Frontend API Route
Write-Host "
[3] Frontend API Route (3000/api/system-status)..." -ForegroundColor Cyan
try {
    $resp = curl -s http://localhost:3000/api/system-status
    $json = $resp | ConvertFrom-Json
    Write-Host "Status: $($json.status)" -ForegroundColor Green
} catch {
    Write-Host "FAIL or no JSON" -ForegroundColor Yellow
}

# Test Backend API Route
Write-Host "
[4] Backend API Route (8000/api/system-status)..." -ForegroundColor Cyan
try {
    $resp = curl -s http://localhost:8000/api/system-status
    $json = $resp | ConvertFrom-Json
    Write-Host "Status: $($json.status)" -ForegroundColor Green
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "
=== SUMMARY ===" -ForegroundColor Yellow
Write-Host "Frontend:  http://localhost:3000" -ForegroundColor Green
Write-Host "Backend:   http://localhost:8000" -ForegroundColor Green
Write-Host "=== READY FOR DOCKER ===" -ForegroundColor Green
