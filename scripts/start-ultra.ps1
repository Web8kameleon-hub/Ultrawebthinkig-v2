param(
  [switch]$NoExit,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

function Import-DotEnvFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) { return }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $separator = $trimmed.IndexOf('=')
    if ($separator -le 0) { continue }

    $name = $trimmed.Substring(0, $separator).Trim()
    if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { continue }
    $value = $trimmed.Substring($separator + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

function Test-PortAvailable {
  param([int]$Port)

  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new(
      [System.Net.IPAddress]::Loopback,
      $Port
    )
    $listener.Start()
    return $true
  }
  catch {
    return $false
  }
  finally {
    if ($null -ne $listener) { $listener.Stop() }
  }
}

function Get-AvailablePort {
  param(
    [int]$Preferred,
    [int]$Minimum,
    [int]$Maximum,
    [int[]]$Excluded = @()
  )

  if ($Preferred -notin $Excluded -and (Test-PortAvailable -Port $Preferred)) {
    return $Preferred
  }

  for ($attempt = 0; $attempt -lt 250; $attempt += 1) {
    $candidate = Get-Random -Minimum $Minimum -Maximum ($Maximum + 1)
    if ($candidate -notin $Excluded -and (Test-PortAvailable -Port $candidate)) {
      return $candidate
    }
  }

  throw "No free TCP port found between $Minimum and $Maximum"
}

function Start-UltraWindow {
  param(
    [string]$Title,
    [string]$Command,
    [hashtable]$Variables,
    [string]$WorkingDirectory = $projectRoot
  )

  $assignments = foreach ($entry in $Variables.GetEnumerator()) {
    $escaped = ([string]$entry.Value).Replace("'", "''")
    "[Environment]::SetEnvironmentVariable('$($entry.Key)', '$escaped', 'Process')"
  }
  $escapedRoot = $projectRoot.Replace("'", "''")
  $escapedWorkingDirectory = $WorkingDirectory.Replace("'", "''")
  $escapedTitle = $Title.Replace("'", "''")
  $childScript = @(
    "`$Host.UI.RawUI.WindowTitle = '$escapedTitle'"
    "Set-Location -LiteralPath '$escapedRoot'"
    "Set-Location -LiteralPath '$escapedWorkingDirectory'"
    $assignments
    $Command
    "if (`$LASTEXITCODE -ne 0) { Write-Host 'Service stopped with an error.' -ForegroundColor Red }"
    $(if ($NoExit) { "Read-Host 'Press Enter to close'" })
  ) -join "`n"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($childScript))

  Start-Process -FilePath 'pwsh.exe' -ArgumentList @(
    '-NoLogo',
    '-NoProfile',
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', $encoded
  ) -WorkingDirectory $WorkingDirectory -WindowStyle Normal | Out-Null
}

# Shared defaults first; private local values override them.
Import-DotEnvFile -Path (Join-Path $projectRoot '.env.unified')
Import-DotEnvFile -Path (Join-Path $projectRoot '.env.local')

$preferredFrontend = if ($env:FRONTEND_PORT) { [int]$env:FRONTEND_PORT } elseif ($env:NEXT_PUBLIC_PORT) { [int]$env:NEXT_PUBLIC_PORT } else { 2300 }
$preferredBackend = if ($env:BACKEND_PORT) { [int]$env:BACKEND_PORT } else { 23001 }
$frontendPort = Get-AvailablePort -Preferred $preferredFrontend -Minimum 2300 -Maximum 4999
$backendPort = Get-AvailablePort -Preferred $preferredBackend -Minimum 23001 -Maximum 29999 -Excluded @($frontendPort)
$frontendOrigin = "http://127.0.0.1:$frontendPort"
$backendOrigin = "http://127.0.0.1:$backendPort"

if ($DryRun) {
  Write-Host "Frontend: $frontendOrigin"
  Write-Host "Backend: $backendOrigin"
  return
}

Start-UltraWindow -Title "UltraWebThinking Backend :$backendPort" -Command 'npm run dev:backend' -Variables @{
  BACKEND_HOST    = '127.0.0.1'
  BACKEND_PORT    = $backendPort
  FRONTEND_ORIGIN = $frontendOrigin
}

Start-UltraWindow -Title "UltraWebThinking Frontend :$frontendPort" -Command "npm run dev" -Variables @{
  PORT                           = $frontendPort
  FRONTEND_PORT                  = $frontendPort
  NEXT_PUBLIC_PORT               = $frontendPort
  NEXT_PUBLIC_BASE_URL           = $frontendOrigin
  NEXT_PUBLIC_API_URL            = "$frontendOrigin/api"
  BACKEND_INTERNAL_URL           = $backendOrigin
  NEXT_PUBLIC_BACKEND_BRIDGE_URL = "$frontendOrigin/api/bridge"
}

Write-Host "UltraWebThinking services launched in external PowerShell windows." -ForegroundColor Green
Write-Host "Frontend: $frontendOrigin"
Write-Host "Backend bridge: $frontendOrigin/api/bridge/health"
Write-Host "Backend internal: $backendOrigin"
