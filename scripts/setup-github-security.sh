#!/bin/bash
# GitHub Security Features Setup Script
# This script helps configure GitHub security features

set -e

echo "====================================="
echo "GitHub Security Features Setup"
echo "====================================="
echo ""

echo "Manual steps required for GitHub security configuration:"
echo ""

echo "1. Enable GitHub Actions"
echo "   - Go to repository Settings → Actions"
echo "   - Click 'Enable GitHub Actions'"
echo ""

echo "2. Configure Repository Secrets"
echo "   Go to Settings → Secrets and variables → Actions"
echo "   Add the following secrets:"
echo ""
echo "   Required Secrets:"
echo "   - OPS_BOT_TOKEN: Your Telegram bot token"
echo "   - OPS_CHAT_ID: Your Telegram chat ID for notifications"
echo "   - VPS_SSH_KEY: Content of ~/.ssh/novax_deploy (private key)"
echo "   - VPS_HOST: 193.93.169.58"
echo "   - VPS_USER: ubuntu"
echo ""

echo "3. Enable Dependabot"
echo "   Go to Settings → Code security and analysis"
echo "   Enable 'Dependabot alerts'"
echo "   Enable 'Dependabot security updates'"
echo ""

echo "4. Enable Code Scanning"
echo "   Go to Settings → Code security and analysis"
echo "   Enable 'Code scanning and analysis'"
echo ""

echo "5. Enable Secret Scanning"
echo "   Go to Settings → Code security and analysis"
echo "   Enable 'Secret scanning'"
echo ""

echo "6. Configure Branch Protection"
echo "   Go to Settings → Branches"
echo "   Click 'Add rule' for main branch:"
echo "   - Require status checks to pass"
echo "   - Require branches to be up to date"
echo "   - Select security-scan workflow"
echo "   - Select CI Pipeline workflow"
echo ""

echo "====================================="
echo "Security Features Summary"
echo "====================================="
echo ""
echo "After configuration, you will have:"
echo "✅ Automated dependency scanning"
echo "✅ Python security scanning (Bandit, Safety)"
echo "✅ JavaScript security scanning (npm audit)"
echo "✅ Secret scanning (TruffleHog)"
echo "✅ CodeQL analysis (Python, JavaScript)"
echo "✅ Dependency review on pull requests"
echo "✅ Security notifications"
echo "✅ Branch protection with security checks"
echo ""

echo "====================================="
echo "Verification Steps"
echo "====================================="
echo ""
echo "1. Go to repository Security tab"
echo "2. Check Dependabot alerts (should be empty initially)"
echo "3. Check Code scanning results"
echo "4. Go to Actions tab"
echo "5. Verify security-scan workflow runs"
echo "6. Review security scan artifacts"
echo ""

echo "====================================="
echo "Automated Security Scan Trigger"
echo "====================================="
echo ""
echo "The security-scan workflow will run:"
echo "- On push to main/develop branches"
echo "- On pull requests to main/develop"
echo "- Weekly on Sundays at 2 AM UTC"
echo "- Manually via Actions tab"
echo ""

read -p "Press Enter to continue to automatic verification setup..."

echo ""
echo "====================================="
echo "Automatic Verification"
echo "====================================="
echo ""

# Check if we have GitHub CLI installed
if command -v gh &> /dev/null; then
    echo "GitHub CLI found, attempting automatic configuration..."
    
    # Authenticate if needed
    if ! gh auth status &> /dev/null; then
        echo "Please authenticate with GitHub CLI:"
        gh auth login
    fi
    
    echo ""
    echo "Current repository security status:"
    gh api repos/alirezasafaei-dev/novax-price-alert 2>/dev/null || echo "Could not fetch repository info"
    
else
    echo "GitHub CLI not found"
    echo "Install it from: https://cli.github.com/"
    echo ""
    echo "Skipping automatic verification"
fi

echo ""
echo "====================================="
echo "Next Steps"
echo "====================================="
echo ""
echo "1. Complete manual configuration steps above"
echo "2. Trigger security scan manually via Actions tab"
echo "3. Review first security scan results"
echo "4. Address any issues found"
echo "5. Monitor security alerts regularly"
echo ""
echo "For detailed information, see:"
echo "- docs/SECURITY.md"
echo "- DEPLOY_SECURITY.md"
echo ""
