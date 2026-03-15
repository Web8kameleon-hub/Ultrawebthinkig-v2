# Test localhost endpoints after 15 seconds
Start-Sleep -Seconds 15

Write-Host "
[TEST] Backend health..." -ForegroundColor Cyan
try {
    $resp = curl -s http://localhost:8000/health
    Write-Host "Backend /health: OK" -ForegroundColor Green
    Write-Host $resp | ConvertFrom-Json | ConvertTo-Json
} catch {
    Write-Host "Backend /health: FAIL" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host "
[TEST] Frontend home..." -ForegroundColor Cyan
try {
    $resp = curl -s http://localhost:3000
    Write-Host "Frontend /: OK" -ForegroundColor Green
} catch {
    Write-Host "Frontend /: FAIL" -ForegroundColor Red
}

Write-Host "
[TEST] Frontend API endpoint..." -ForegroundColor Cyan
try {
    $resp = curl -s http://localhost:3000/api/system-status
    Write-Host "Frontend /api/system-status: OK" -ForegroundColor Green
} catch {
    Write-Host "Frontend /api/system-status: FAIL" -ForegroundColor Red
}

Write-Host "
[TEST] Backend system-status..." -ForegroundColor Cyan
try {
    $resp = curl -s http://localhost:8000/api/system-status
    Write-Host "Backend /api/system-status: OK" -ForegroundColor Green
    $resp | ConvertFrom-Json | ConvertTo-Json | Write-Host
} catch {
    Write-Host "Backend /api/system-status: FAIL" -ForegroundColor Red
}

Write-Host "
=== SUMMARY ===" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "=== All tests completed ===" -ForegroundColor Yellow
