# Hetzner SSH Key Recovery - Windows PowerShell Version
# Run this via SSH or console access to your server

Write-Host "🔐 Hetzner SSH Key Recovery Script"
Write-Host "===================================="

# Create .ssh directory if it doesn't exist
$sshDir = "/root/.ssh"
$authorized_keys = "/root/.ssh/authorized_keys"

# These commands would need to be run via SSH or console:
# mkdir -p /root/.ssh
# chmod 700 /root/.ssh

# Your public key to add
$publicKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIARZ6TL6msQSHUShByCyb2U+3t8WNxiQ+p7I5/HOrvFZ clisonix-hetzner"

Write-Host ""
Write-Host "📋 Steps to recover SSH access:"
Write-Host ""
Write-Host "1. Login to Hetzner Console (Strg + Alt + Entf or VNC)"
Write-Host ""
Write-Host "2. Run these commands in the server terminal:"
Write-Host ""
Write-Host "   mkdir -p /root/.ssh"
Write-Host "   chmod 700 /root/.ssh"
Write-Host ""
Write-Host "3. Add your public key:"
Write-Host ""
Write-Host "   cat >> /root/.ssh/authorized_keys << 'EOF'"
Write-Host $publicKey
Write-Host "   EOF"
Write-Host ""
Write-Host "4. Fix permissions:"
Write-Host ""
Write-Host "   chmod 600 /root/.ssh/authorized_keys"
Write-Host "   chown -R root:root /root/.ssh"
Write-Host ""
Write-Host "5. Verify the key was added:"
Write-Host ""
Write-Host "   cat /root/.ssh/authorized_keys"
Write-Host ""
Write-Host "6. Then SSH in:"
Write-Host ""
Write-Host "   ssh hetzner-old"
Write-Host ""
