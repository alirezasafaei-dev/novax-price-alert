#!/bin/bash

# Simple SSH-based deployment (requires SSH key or manual password)
# VPS: <redacted-vps-host>
# Bot: @novax_price_bot

echo "🚀 Novax Price Alert - SSH Deployment"
echo "======================================"
echo ""

VPS_IP="<redacted-vps-host>"
VPS_USER="ubuntu"
APP_DIR="/home/deploy/novax-price-alert"
DOMAIN="novax.alirezasafeidev.ir"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📋 Configuration:"
echo "   VPS: $VPS_USER@$VPS_IP"
echo "   Domain: $DOMAIN"
echo "   Bot ID: ${TELEGRAM_BOT_ID:-<set TELEGRAM_BOT_ID>} (@novax_price_bot)"
echo ""

echo "📝 This script uses standard SSH (no sshpass needed)"
echo "   You'll be prompted for password during rsync"
echo ""

# Step 1: Test SSH connection
echo "📡 Step 1: Testing SSH connection..."
if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$VPS_USER@$VPS_IP" "echo 'OK'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SSH connection successful${NC}"
else
    echo -e "${YELLOW}⚠️  SSH connection test failed (this is normal if no SSH key is set up)${NC}"
    echo "   Continuing anyway - you'll be prompted for password"
fi
echo ""

# Step 2: Sync files
echo "📦 Step 2: Syncing files..."
echo "   You'll be prompted for the VPS password. Do not paste it into docs or git."
echo ""
rsync -avz --delete \
    -e "ssh -o StrictHostKeyChecking=no" \
    --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.venv' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='dist' \
    --exclude='deploy/cloudflare-worker' \
    --exclude='.wrangler' \
    . \
    "$VPS_USER@$VPS_IP:$APP_DIR/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Files synced successfully${NC}"
else
    echo -e "${RED}❌ File sync failed${NC}"
    echo "   Please run manual deployment instead:"
    echo "   ./scripts/manual-deploy-guide.sh"
    exit 1
fi
echo ""

echo "🔧 Remaining steps need to be done on VPS:"
echo "=========================================="
echo ""
echo "SSH to VPS:"
echo "   ssh $VPS_USER@$VPS_IP"
echo ""
echo "Then run:"
echo "   cd $APP_DIR"
echo "   python3 -m pip install --upgrade pip"
echo "   python3 -m pip install -r requirements.txt"
echo "   cd mini-app && npm install && npm run build && cd .."
echo "   alembic upgrade head"
echo "   # Edit .env: set TELEGRAM_RELAY_URL= and TELEGRAM_RELAY_SECRET="
echo "   pm2 restart novax-api --update-env"
echo "   pm2 restart novax-worker --update-env"
echo "   pm2 restart novax-mini-app --update-env"
echo "   pm2 save"
echo "   pm2 status"
echo ""
echo "Health checks:"
echo "   curl http://127.0.0.1:8001/health"
echo "   curl https://$DOMAIN/health"
echo ""
echo -e "${GREEN}✅ File sync complete!${NC}"
echo "   Now follow the VPS steps above to complete deployment"
echo ""
