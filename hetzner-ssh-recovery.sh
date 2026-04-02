#!/bin/bash
# Hetzner SSH Key Recovery Script
# Run this in the server console or via Rescue Mode

echo "🔐 Hetzner SSH Key Recovery Script"
echo "===================================="

# Create .ssh directory if it doesn't exist
mkdir -p /root/.ssh
chmod 700 /root/.ssh

# Add your public key
cat >> /root/.ssh/authorized_keys << 'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIARZ6TL6msQSHUShByCyb2U+3t8WNxiQ+p7I5/HOrvFZ clisonix-hetzner
EOF

# Fix permissions
chmod 600 /root/.ssh/authorized_keys
chown -R root:root /root/.ssh

echo "✅ SSH key added successfully!"
echo "You can now SSH in with:"
echo "   ssh hetzner-old"
echo ""
echo "Authorized keys:"
cat /root/.ssh/authorized_keys
