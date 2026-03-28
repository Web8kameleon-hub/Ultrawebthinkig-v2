# 🔑 Clisonix Hetzner SSH Setup Helper (PowerShell)
# Automatizo gjenerimin e SSH keys dhe konfigurimin në Windows
# Përdorë: .\setup-hetzner-ssh.ps1

param(
    [string]$HetznerIP = ""
)

# ═══════════════════════════════════════════════════════════════════════════
# FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║ $($Text.PadRight(62)) ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "▶ $Text" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
}

function Write-Success {
    param([string]$Text)
    Write-Host "[✓] $Text" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Text)
    Write-Host "[!] $Text" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Text)
    Write-Host "[✗] $Text" -ForegroundColor Red
    exit 1
}

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

Write-Header "CLISONIX HETZNER SSH SETUP (PowerShell)"

$SSHDir = "$env:USERPROFILE\.ssh"
$HetznerKey = "$SSHDir\hetzner_deploy_key"
$HetznerKeyPub = "$HetznerKey.pub"
$SSHConfig = "$SSHDir\config"
$KeyComment = "Clisonix Hetzner Deploy Key"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: Check and create SSH directory
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "Step 1: Setting up SSH directory"

if (-not (Test-Path $SSHDir)) {
    Write-Host "Creating SSH directory: $SSHDir"
    New-Item -ItemType Directory -Path $SSHDir -Force | Out-Null
    Write-Success "SSH directory created"
} else {
    Write-Success "SSH directory exists: $SSHDir"
}

# Set proper permissions (Windows doesn't have strict permissions like Unix)
$ACL = Get-Acl $SSHDir
$ACL.SetAccessRuleProtection($true, $false)
Set-Acl -Path $SSHDir -AclObject $ACL

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2: Generate SSH key
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "Step 2: SSH Key Generation (RSA 4096)"

$GenerateKey = $true

if (Test-Path $HetznerKey) {
    Write-Warning "SSH key already exists: $HetznerKey"
    $response = Read-Host "Do you want to regenerate it? (y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backup = "$HetznerKey.backup.$timestamp"
        Copy-Item $HetznerKey $backup
        Write-Success "Backup created: $backup"
    } else {
        Write-Host "Skipping key generation"
        $GenerateKey = $false
    }
}

if ($GenerateKey) {
    Write-Host "Generating SSH key..."
    
    # Use ssh-keygen from Windows 10+ or Git Bash
    try {
        ssh-keygen.exe -t rsa -b 4096 -f $HetznerKey -N '""' -C $KeyComment
        Write-Success "SSH key generated successfully"
        Write-Host "   Privat key: $HetznerKey"
        Write-Host "   Public key:  $HetznerKeyPub"
    } catch {
        Write-Error-Custom "Failed to generate SSH key. Make sure OpenSSH is installed."
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 3: Display public key
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "Step 3: Your Public Key"

Write-Host "Copy this key to Hetzner Console:" -ForegroundColor Yellow
Write-Host "https://console.hetzner.com → SSH Keys" -ForegroundColor Yellow
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

$publicKeyContent = Get-Content $HetznerKeyPub
Write-Host $publicKeyContent -ForegroundColor Cyan

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

# Copy to clipboard
$publicKeyContent | Set-Clipboard
Write-Success "Public key copied to clipboard"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 4: Test SSH connection (optional)
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "Step 4: Test SSH Connection"

if ([string]::IsNullOrEmpty($HetznerIP)) {
    $HetznerIP = Read-Host "Enter Hetzner server IP (or press ENTER to skip)"
}

if (-not [string]::IsNullOrEmpty($HetznerIP)) {
    Write-Host "Testing connection to $HetznerIP..."
    
    try {
        $testCmd = ssh.exe -i $HetznerKey -o ConnectTimeout=10 `
            -o StrictHostKeyChecking=no `
            "root@$HetznerIP" `
            "echo 'SSH connection OK'" 2>$null
        
        Write-Success "SSH connection successful!"
    } catch {
        Write-Warning "SSH connection failed. Please verify:"
        Write-Host "   1. Server IP is correct: $HetznerIP"
        Write-Host "   2. SSH key is added to Hetzner console"
        Write-Host "   3. Server has finished initializing (wait 2-3 minutes)"
        Write-Host "   4. Firewall allows port 22"
    }
} else {
    Write-Host "Skipping connection test"
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 5: Update SSH config
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "Step 5: Updating SSH Config"

$UpdateConfig = $true

if (Test-Path $SSHConfig) {
    Write-Warning "SSH config already exists"
    $response = Read-Host "Do you want to update it? (y/n)"
    
    if ($response -eq 'n' -o $response -eq 'N') {
        Write-Host "Skipping SSH config update"
        $UpdateConfig = $false
    } else {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backup = "$SSHConfig.backup.$timestamp"
        Copy-Item $SSHConfig $backup
        Write-Success "Backup created: $backup"
    }
}

if ($UpdateConfig) {
    # Convert Windows path to Unix-style for SSH config
    $HetznerKeyUnix = $HetznerKey -replace '\\', '/'
    if ($HetznerKeyUnix -like "C:*") {
        # Only expand user home
        $HetznerKeyUnix = "$env:USERPROFILE\.ssh\hetzner_deploy_key" -replace '\\', '/'
    }
    
    $configEntry = @"

# ═══════════════════════════════════════════════════════════════════════════
# CLISONIX HETZNER SERVERS
# Added: $(Get-Date)
# ═══════════════════════════════════════════════════════════════════════════

Host hetzner-prod
    HostName 46.225.14.83
    User root
    Port 22
    IdentityFile $HetznerKeyUnix
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    AddKeysToAgent yes
    ConnectTimeout 10
    ServerAliveInterval 60
    Compression yes
"@
    
    if (-not [string]::IsNullOrEmpty($HetznerIP)) {
        $configEntry += @"

Host hetzner-new
    HostName $HetznerIP
    User root
    Port 22
    IdentityFile $HetznerKeyUnix
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    AddKeysToAgent yes
    ConnectTimeout 10
    ServerAliveInterval 60
    Compression yes
"@
    }
    
    # Append to config
    if (Test-Path $SSHConfig) {
        Add-Content -Path $SSHConfig -Value $configEntry
    } else {
        Set-Content -Path $SSHConfig -Value $configEntry
    }
    
    Write-Success "SSH config updated: $SSHConfig"
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 6: Add key to SSH agent
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "Step 6: Adding Key to SSH Agent"

# Ensure SSH agent is running
$sshAgentService = Get-Service -Name ssh-agent -ErrorAction SilentlyContinue
if ($sshAgentService) {
    if ($sshAgentService.Status -ne 'Running') {
        try {
            Start-Service ssh-agent
            Write-Success "SSH Agent started"
        } catch {
            Write-Warning "Could not start SSH Agent"
        }
    }
}

# Add key to agent
try {
    ssh-add.exe $HetznerKey 2>$null
    Write-Success "Key added to SSH agent"
} catch {
    Write-Warning "SSH agent not available or key already added"
    Write-Host "You can manually add it later with:"
    Write-Host "   ssh-add $HetznerKey"
}

# ═══════════════════════════════════════════════════════════════════════════
# COMPLETION SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

Write-Header "SSH SETUP COMPLETE ✓"

Write-Success "SSH key generated: $HetznerKey"
Write-Success "SSH config updated: $SSHConfig"
Write-Success "Key added to SSH agent"

Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Add public key to Hetzner console:"
Write-Host "   https://console.hetzner.com → SSH Keys" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Create new server with the SSH key selected"
Write-Host ""
Write-Host "3. Connect to server:"
Write-Host "   ssh hetzner-prod     # Production server" -ForegroundColor Green
if (-not [string]::IsNullOrEmpty($HetznerIP)) {
    Write-Host "   ssh hetzner-new      # New server ($HetznerIP)" -ForegroundColor Green
}
Write-Host ""
Write-Host "4. Verify connection:"
Write-Host "   ssh hetzner-prod 'docker ps'" -ForegroundColor Green
Write-Host ""
Write-Host "5. For more setup instructions, see:"
Write-Host "   HETZNER_SSH_SETUP.md" -ForegroundColor Green
Write-Host ""
