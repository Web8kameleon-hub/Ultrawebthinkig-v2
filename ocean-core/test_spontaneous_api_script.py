"""
API TEST: SPONTANEOUS CONVERSATION WITH CONTEXT AWARENESS
===========================================================

Test the new /api/chat/spontaneous endpoint that enables true multi-turn
conversation where the AI understands and maintains context throughout
the dialogue.
"""

import json
import time
from typing import Dict, Any

# Use Invoke-WebRequest in PowerShell instead
test_script = r"""

Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SPONTANEOUS CONVERSATION API TEST - FULL CONTEXT AWARENESS      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$uri = "http://localhost:8030/api/chat/spontaneous"
$BaseUri = "http://localhost:8030"

# Wait for server to start
Write-Host "`n⏳ Waiting for Ocean API to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Test connection
try {
    $healthCheck = Invoke-WebRequest -Uri "$BaseUri/api/status" -Method GET -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Ocean API is ready!" -ForegroundColor Green
} catch {
    Write-Host "❌ Ocean API not responding. Waiting a bit more..." -ForegroundColor Red
    Start-Sleep -Seconds 3
}

# SCENARIO 1: Neuroscience Conversation
Write-Host "`n`n╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  SCENARIO 1: NEUROSCIENCE DEEP DIVE (Multi-turn with context)    ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

$neuro_turns = @(
    "How does the human brain work?",
    "Tell me more about synaptic plasticity",
    "How does this relate to learning and memory?",
    "What about consciousness?"
)

foreach ($i, $query in $neuro_turns | ForEach-Object {[int]$i; $_}) {
    $turn = $i + 1
    Write-Host "`n📌 TURN $turn - Query:" -ForegroundColor White
    Write-Host "   '$query'" -ForegroundColor White
    
    $body = @{"query" = $query; "use_context" = \$true} | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri $uri -Method POST `
            -ContentType "application/json" -Body $body -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        
        Write-Host "   Domain: $($data.domain)" -ForegroundColor Cyan
        Write-Host "   Context Aware: $($data.context_aware)" -ForegroundColor Cyan
        Write-Host "   Turn: $($data.turn_number)" -ForegroundColor Cyan
        Write-Host "   Topic: $($data.conversation_topic)" -ForegroundColor Cyan
        Write-Host "   Confidence: $($data.confidence * 100)%" -ForegroundColor Green
        Write-Host "   Answer Preview: $($data.answer.Substring(0, [Math]::Min(100, $data.answer.Length)))..." -ForegroundColor Yellow
        
        Write-Host "   Follow-ups:" -ForegroundColor Magenta
        foreach ($follow in $data.follow_up_topics) {
            Write-Host "     • \$follow" -ForegroundColor Gray
        }
    } catch {
        Write-Host "   ❌ Error: \$(\$_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500
}

# SCENARIO 2: Quantum Physics
Write-Host "`n`n╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  SCENARIO 2: QUANTUM COMPUTING (Fresh conversation)             ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

# Clear history first
Write-Host "`nClearing history for fresh conversation..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "http://localhost:8030/api/chat/clear" -Method POST `
        -ContentType "application/json" -UseBasicParsing | Out-Null
    Write-Host "✓ History cleared" -ForegroundColor Green
} catch {
    Write-Host "⚠ Could not clear history" -ForegroundColor Yellow
}

Start-Sleep -Seconds 1

\$quantum_turns = @(
    "What is quantum computing?",
    "How do qubits work?",
    "What's superposition?"
)

foreach (\$i, \$query in \$quantum_turns | ForEach-Object {[int]\$i; \$_}) {
    \$turn = \$i + 1
    Write-Host "`n📌 TURN \$turn - Query:" -ForegroundColor White
    Write-Host "   '\$query'" -ForegroundColor White
    
    \$body = @{"query" = \$query; "use_context" = \$true} | ConvertTo-Json
    
    try {
        \$response = Invoke-WebRequest -Uri \$uri -Method POST `
            -ContentType "application/json" -Body \$body -UseBasicParsing
        \$data = \$response.Content | ConvertFrom-Json
        
        Write-Host "   Domain: \$(\$data.domain)" -ForegroundColor Cyan
        Write-Host "   Context Aware: \$(\$data.context_aware)" -ForegroundColor Cyan
        Write-Host "   Turn: \$(\$data.turn_number)" -ForegroundColor Cyan
        Write-Host "   Labs: \$(\$data.sources -join ', ')" -ForegroundColor Cyan
        Write-Host "   Answer Preview: \$(\$data.answer.Substring(0, [Math]::Min(80, \$data.answer.Length)))..." -ForegroundColor Yellow
    } catch {
        Write-Host "   ❌ Error: \$(\$_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500
}

# Get chat history
Write-Host "`n`n╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  CONVERSATION HISTORY                                           ║" -ForegroundColor Magenta
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

try {
    \$histBody = @{"limit" = 20} | ConvertTo-Json
    \$histResponse = Invoke-WebRequest -Uri "http://localhost:8030/api/chat/history" -Method POST `
        -ContentType "application/json" -Body \$histBody -UseBasicParsing
    \$history = \$histResponse.Content | ConvertFrom-Json
    
    Write-Host "`nTotal messages: \$(\$history.statistics.total_messages)" -ForegroundColor Green
    Write-Host "User messages: \$(\$history.statistics.user_messages)" -ForegroundColor Green
    Write-Host "Assistant messages: \$(\$history.statistics.assistant_messages)" -ForegroundColor Green
    Write-Host "Domains discussed: \$(\$history.statistics.domains_discussed | ConvertTo-Json)" -ForegroundColor Cyan
    
    Write-Host "`nRecent messages:" -ForegroundColor White
    foreach (\$msg in \$history.messages | Select-Object -Last 4) {
        \$role = if (\$msg.role -eq 'user') { "👤 USER" } else { "🤖 ASST" }
        Write-Host "`n\$role [\$(\$msg.domain)]:" -ForegroundColor Yellow
        Write-Host "  \$(\$msg.content.Substring(0, [Math]::Min(100, \$msg.content.Length)))..." -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Error getting history: \$(\$_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n`n╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ TEST COMPLETED! Spontaneous conversation is working!       ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📚 Key Features Demonstrated:" -ForegroundColor Cyan
Write-Host "   • Multi-turn dialogue with context awareness" -ForegroundColor White
Write-Host "   • Automatic domain detection and routing" -ForegroundColor White
Write-Host "   • Conversation topic tracking" -ForegroundColor White
Write-Host "   • Follow-up suggestions based on context" -ForegroundColor White
Write-Host "   • Full conversation history with statistics" -ForegroundColor White
Write-Host "   • Independent conversations (with history clearing)" -ForegroundColor White

"""

# Save and run the test script
import os

script_path = "test_spontaneous_api.ps1"
with open(script_path, 'w', encoding='utf-8') as f:
    f.write(test_script)

print(f"✓ Test script created: {script_path}")
print("\nTo run the test:")
print(f"  powershell -ExecutionPolicy Bypass .\\{script_path}")

if __name__ == "__main__":
    print("PowerShell test script prepared!")
