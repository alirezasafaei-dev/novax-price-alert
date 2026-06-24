#!/bin/bash

# Quick VPS Connection Test
# Tests connection to <redacted-vps-host> before full deployment

echo "🔍 Testing VPS Connection..."
echo "VPS: <redacted-vps-host>"
echo "User: ubuntu"
echo ""

VPS_IP="<redacted-vps-host>"
VPS_USER="ubuntu"
VPS_PASSWORD="${VPS_PASSWORD:?Set VPS_PASSWORD in your shell or .env; never commit it.}"
VPS_PORT=22

echo "Attempting connection..."
if sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$VPS_USER@$VPS_IP" -p "$VPS_PORT" "echo '✅ Connection successful'; pwd; ls -la /home/deploy/" 2>&1; then
    echo ""
    echo "✅ VPS connection successful!"
    echo "Deployment directory exists and accessible."
    echo ""
    echo "You can now run: ./scripts/deploy-to-vps.sh"
else
    echo ""
    echo "❌ VPS connection failed!"
    echo "Please check:"
    echo "1. VPS is online"
    echo "2. SSH port 22 is open"
    echo "3. Credentials are correct"
    exit 1
fi
