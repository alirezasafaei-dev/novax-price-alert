#!/bin/bash
# Post-Sync Verification Script
# Run this after syncing files to VPS

echo "🔍 Post-Sync Verification"
echo "========================"
echo ""

echo "Checking if new files exist on VPS..."
echo ""

echo "Expected new documentation files:"
docs="BOTFATHER_SETUP.md CODE_REALITY_REPORT.md DEPLOYMENT_ARCHITECTURE.md DEPLOYMENT_GUIDE.md DEPLOYMENT_SUMMARY.md QUICK_REFERENCE.md SERVER_STATUS.md PREMIUM_FEATURES_PLAN.md WORK_SUMMARY.md COMPLETE_WORK_REPORT.md FINAL_WORK_SUMMARY.md DEPLOYMENT_LIMITATIONS.md"

for doc in $docs; do
    if [ -f "docs/$doc" ]; then
        echo "✅ Local: docs/$doc exists"
    else
        echo "❌ Local: docs/$doc missing"
    fi
done

echo ""
echo "Expected new script files:"
scripts="deploy-to-vps.sh deploy-vps-only.sh deploy-ssh.sh deploy-plan.py deploy-python.py DEPLOY_NOW.sh manual-deploy-guide.sh test-vps-connection.sh local-quality-check.sh monitor-health.sh sync-latest.sh ONE-COMMAND-SYNC.sh"

for script in $scripts; do
    if [ -f "scripts/$script" ]; then
        echo "✅ Local: scripts/$script exists"
    else
        echo "❌ Local: scripts/$script missing"
    fi
done

echo ""
echo "To verify on VPS, SSH and run:"
echo "  ssh ubuntu@<redacted-vps-host>"
echo "  cd /home/ubuntu/novax-price-alert"
echo "  ls -la docs/"
echo "  ls -la scripts/"
echo ""
echo "✅ Verification complete"