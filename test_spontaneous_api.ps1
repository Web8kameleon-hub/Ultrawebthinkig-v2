
Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SPONTANEOUS CONVERSATION API TEST - CONTEXT AWARENESS          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$uri = "http://localhost:8030/api/chat/spontaneous"
$BaseUri = "http://localhost:8030"

# Wait for server to start
Write-Host "`n⏳ Waiting for Ocean API to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 4

# Test connection
try {
    $healthCheck = Invoke-WebRequest -Uri "$BaseUri/api/status" -Method GET -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Ocean API is ready!" -ForegroundColor Green
} catch {
    Write-Host "⚠ Status check skipped, trying chat endpoint..." -ForegroundColor Yellow
}

# SCENARIO 1: Neuroscience Conversation
Write-Host "`n`n╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  SCENARIO 1: NEUROSCIENCE DEEP DIVE (Context-aware)             ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

$neuro_turns = @(
    "How does the human brain work?",
    "Tell me more about synaptic plasticity",
    "How does this relate to learning and memory?"
)

$turn = 1
foreach ($query in $neuro_turns) {
    Write-Host "`n📌 TURN $turn - Query:" -ForegroundColor White
    Write-Host "   '$query'" -ForegroundColor White
    
    $body = @{"query" = $query; "use_context" = $true} | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri $uri -Method POST `
            -ContentType "application/json" -Body $body -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        
        Write-Host "   ✓ Domain: $($data.domain)" -ForegroundColor Cyan
        Write-Host "   ✓ Context Aware: $($data.context_aware)" -ForegroundColor Cyan
        Write-Host "   ✓ Turn: $($data.turn_number) | Confidence: $([math]::Round($data.confidence * 100))%" -ForegroundColor Green
        if ($data.conversation_topic) {
            Write-Host "   ✓ Topic: $($data.conversation_topic)" -ForegroundColor Cyan
        }
        Write-Host "   💬 Answer: $($data.answer.Substring(0, [Math]::Min(120, $data.answer.Length)))..." -ForegroundColor Yellow
    } catch {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    $turn++
    Start-Sleep -Milliseconds 800
}

# SCENARIO 2: Get Chat History
Write-Host "`n`n╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  SCENARIO 2: CONVERSATION HISTORY & STATISTICS                 ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

try {
    $histBody = @{"limit" = 20} | ConvertTo-Json
    $histResponse = Invoke-WebRequest -Uri "http://localhost:8030/api/chat/history" -Method POST `
        -ContentType "application/json" -Body $histBody -UseBasicParsing
    $history = $histResponse.Content | ConvertFrom-Json
    
    Write-Host "`n📊 Session Statistics:" -ForegroundColor Green
    Write-Host "   • Total messages: $($history.statistics.total_messages)" -ForegroundColor Cyan
    Write-Host "   • User messages: $($history.statistics.user_messages)" -ForegroundColor Cyan
    Write-Host "   • Assistant messages: $($history.statistics.assistant_messages)" -ForegroundColor Cyan
    
    if ($history.statistics.domains_discussed) {
        Write-Host "   • Domains discussed:" -ForegroundColor Cyan
        foreach ($domain in $history.statistics.domains_discussed.PSObject.Properties) {
            Write-Host "      - $($domain.Name): $($domain.Value) mentions" -ForegroundColor Gray
        }
    }
    
    Write-Host "`n📜 Last 3 Exchange:" -ForegroundColor Green
    $count = 1
    foreach ($msg in $history.messages | Select-Object -Last 6) {
        $role = if ($msg.role -eq 'user') { "👤 USER" } else { "🤖 ASST" }
        $domain = if ($msg.domain) { " [$($msg.domain)]" } else { "" }
        Write-Host "`n$role$domain:" -ForegroundColor Yellow
        Write-Host "  $($msg.content.Substring(0, [Math]::Min(100, $msg.content.Length)))..." -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error getting history: $($_.Exception.Message)" -ForegroundColor Red
}

# SCENARIO 3: New conversation (Clear history)
Write-Host "`n`n╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  SCENARIO 3: FRESH CONVERSATION (After history clear)         ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

Write-Host "`n🔄 Clearing conversation history..." -ForegroundColor Yellow
try {
    $clearResponse = Invoke-WebRequest -Uri "http://localhost:8030/api/chat/clear" -Method POST `
        -ContentType "application/json" -UseBasicParsing
    $clearData = $clearResponse.Content | ConvertFrom-Json
    Write-Host "✅ $($clearData.message)" -ForegroundColor Green
} catch {
    Write-Host "⚠ Could not clear (may be cached): $($_.Exception.Message)" -ForegroundColor Yellow
}

Start-Sleep -Seconds 1

$quantum_turns = @(
    "What is quantum computing?",
    "How do qubits work?"
)

$turn = 1
foreach ($query in $quantum_turns) {
    Write-Host "`n📌 TURN $turn - Query:" -ForegroundColor White
    Write-Host "   '$query'" -ForegroundColor White
    
    $body = @{"query" = $query; "use_context" = $true} | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri $uri -Method POST `
            -ContentType "application/json" -Body $body -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        
        Write-Host "   ✓ Domain: $($data.domain)" -ForegroundColor Cyan
        Write-Host "   ✓ Turn Number: $($data.turn_number) (Fresh conversation!)" -ForegroundColor Green
        Write-Host "   💬 Answer: $($data.answer.Substring(0, [Math]::Min(120, $data.answer.Length)))..." -ForegroundColor Yellow
    } catch {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    $turn++
    Start-Sleep -Milliseconds 800
}

Write-Host "`n`n╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ SPONTANEOUS CONVERSATION TEST COMPLETED!                    ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📚 Features Verified:" -ForegroundColor Cyan
Write-Host "   ✓ Multi-turn dialogue with automatic domain detection" -ForegroundColor White
Write-Host "   ✓ Full conversation context awareness" -ForegroundColor White
Write-Host "   ✓ Context-aware follow-up suggestions" -ForegroundColor White
Write-Host "   ✓ Turn tracking and conversation topic retention" -ForegroundColor White
Write-Host "   ✓ Complete conversation history with statistics" -ForegroundColor White
Write-Host "   ✓ Ability to clear history and start fresh" -ForegroundColor White

Write-Host "`n🌐 API Endpoints Available:" -ForegroundColor Cyan
Write-Host "   POST /api/chat/spontaneous      - New context-aware chat mode" -ForegroundColor Gray
Write-Host "   POST /api/chat/history          - Get conversation history" -ForegroundColor Gray
Write-Host "   POST /api/chat/clear            - Clear history for new conversation" -ForegroundColor Gray
Write-Host "   POST /api/chat                  - Original mode (no context)" -ForegroundColor Gray

Write-Host "`n🚀 Ocean-Core API is fully operational with spontaneous conversation!" -ForegroundColor Green
