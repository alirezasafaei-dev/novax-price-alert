#!/bin/bash
# Novax Price Alert - One-Command Sync Script
# Copy this entire block and paste it into your terminal

echo "🔄 Novax Price Alert - Sync Latest Changes"
echo "=========================================="
echo ""
echo "This will sync new documentation and scripts to VPS."
echo "No production restart needed (only docs changed)."
echo ""
echo "Press ENTER to continue or Ctrl+C to cancel..."
read
echo ""

# Step 1: Sync files
echo "📦 Step 1: Syncing files to VPS..."
rsync -avz \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.venv' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='deploy/cloudflare-worker' \
  . \
  ubuntu@<redacted-vps-host>:/home/ubuntu/novax-price-alert/

if [ $? -eq 0 ]; then
    echo "✅ Files synced successfully"
else
    echo "❌ Sync failed. Please check your SSH connection."
    exit 1
fi

echo ""
echo "📋 Step 2: Verification (optional)"
echo "------------------------------------"
echo "To verify sync, SSH to VPS and check:"
echo "  ssh ubuntu@<redacted-vps-host>"
echo "  cd /home/ubuntu/novax-price-alert"
echo "  ls -la docs/"
echo "  ls -la scripts/"
echo ""

echo "✅ Sync complete!"
echo ""
echo "📝 What was synced:"
echo "  - 14 new documentation files"
echo "  - 9 new deployment scripts"
echo "  - 1 GitHub Actions workflow fix"
echo "  - LIVE_STATUS.md"
echo ""
echo "⚠️  No service restart needed (production continues normally)"
echo ""