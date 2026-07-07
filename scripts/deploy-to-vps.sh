#!/bin/bash
# ⚠️  این اسکریپت قدیمی است (Docker+sshpass). از scripts/deploy-vps-only.sh استفاده کنید.

# Novax Price Alert Deployment Script (DEPRECATED - use deploy-vps-only.sh)
set -e

# VPS Configuration
VPS_IP="<redacted-vps-host>"
VPS_USER="ubuntu"
VPS_PASSWORD="${VPS_PASSWORD:?Set VPS_PASSWORD in your shell or .env; never commit it.}"
VPS_PORT=22
APP_DIR="/home/deploy/novax-price-alert"
DOMAIN="novax.alirezasafeidev.ir"
WORKER_URL="https://novax-telegram-relay.asdevelooper.workers.dev"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "📋 Deployment Configuration"
echo "---------------------------"
echo "VPS IP: $VPS_IP"
echo "User: $VPS_USER"
echo "Domain: $DOMAIN"
echo "App Directory: $APP_DIR"
echo "Cloudflare Worker: $WORKER_URL (optional)"
echo ""

# Function to run command on VPS
run_ssh() {
    local command=$1
    echo "🔧 Running on VPS: $command"
    sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$VPS_USER@$VPS_IP" -p "$VPS_PORT" "$command"
}

# Function to check deployment mode
check_deployment_mode() {
    echo "🎯 Checking deployment mode..."
    read -p "Deploy mode: (1) VPS-only (recommended) or (2) VPS + Cloudflare Worker? " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[1]$ ]]; then
        DEPLOY_MODE="vps-only"
        echo -e "${GREEN}✅ VPS-only mode selected${NC}"
    elif [[ $REPLY =~ ^[2]$ ]]; then
        DEPLOY_MODE="vps-worker"
        echo -e "${BLUE}✅ VPS + Cloudflare Worker mode selected${NC}"
    else
        echo -e "${YELLOW}⚠️  Defaulting to VPS-only mode${NC}"
        DEPLOY_MODE="vps-only"
    fi
}

# Step 0: Check deployment mode
check_deployment_mode
echo ""

# Step 1: Check VPS connection
echo "📡 Step 1: Checking VPS connection..."
if sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$VPS_USER@$VPS_IP" -p "$VPS_PORT" "echo 'Connection successful'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ VPS connection successful${NC}"
else
    echo -e "${RED}❌ VPS connection failed${NC}"
    exit 1
fi
echo ""

# Step 2: Update project files
echo "📦 Step 2: Syncing project files to VPS..."
echo "This may take a few minutes..."
if sshpass -p "$VPS_PASSWORD" rsync -avz --delete \
    -e "ssh -p $VPS_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" \
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
    "$VPS_USER@$VPS_IP:$APP_DIR/"; then
    echo -e "${GREEN}✅ Project files synced successfully${NC}"
else
    echo -e "${RED}❌ Project sync failed${NC}"
    exit 1
fi
echo ""

# Step 3: Install/update Python dependencies
echo "🔧 Step 3: Installing Python dependencies..."
run_ssh "cd $APP_DIR && python3 -m pip install --upgrade pip && python3 -m pip install -r requirements.txt"
echo ""

# Step 4: Install/update Node dependencies for mini-app
echo "🔧 Step 4: Installing Node dependencies for mini-app..."
run_ssh "cd $APP_DIR/mini-app && npm install && npm run build"
echo ""

# Step 5: Database migrations
echo "🗄️  Step 5: Running database migrations..."
run_ssh "cd $APP_DIR && alembic upgrade head"
echo ""

# Step 6: Configure .env for deployment mode
echo "🔧 Step 6: Configuring .env for $DEPLOY_MODE mode..."
if [ "$DEPLOY_MODE" = "vps-only" ]; then
    run_ssh "cd $APP_DIR && sed -i 's|^TELEGRAM_RELAY_URL=.*|TELEGRAM_RELAY_URL=|' .env"
    run_ssh "cd $APP_DIR && sed -i 's|^TELEGRAM_RELAY_SECRET=.*|TELEGRAM_RELAY_SECRET=|' .env"
    echo -e "${GREEN}✅ Configured for VPS-only (relay disabled)${NC}"
else
    run_ssh "cd $APP_DIR && sed -i 's|^TELEGRAM_RELAY_URL=.*|TELEGRAM_RELAY_URL=$WORKER_URL|' .env"
    echo -e "${BLUE}✅ Configured for VPS + Cloudflare Worker relay${NC}"
fi
echo ""

# Step 7: Restart/Start PM2 services
echo "🔄 Step 7: Restarting/Starting PM2 services..."
run_ssh "cd $APP_DIR && pm2 restart novax-api --update-env || pm2 start python -m novax_price_alert.api.main --name novax-api"
run_ssh "cd $APP_DIR && pm2 restart novax-worker --update-env || pm2 start python -m novax_price_alert.worker_main --name novax-worker"
run_ssh "cd $APP_DIR && pm2 restart novax-mini-app --update-env || pm2 start node --name novax-mini-app -- mini-app/server.cjs"
run_ssh "cd $APP_DIR && pm2 save"
echo ""

# Step 8: Health check
echo "🏥 Step 8: Performing health check..."
sleep 5
HEALTH_RESPONSE=$(curl -s "http://$VPS_IP:8001/health" 2>/dev/null || echo "failed")
if echo "$HEALTH_RESPONSE" | grep -q "ok\|healthy"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "Response: $HEALTH_RESPONSE"
fi
echo ""

# Step 9: Check PM2 status
echo "📊 Step 9: Checking PM2 status..."
run_ssh "pm2 status"
echo ""

# Step 10: Cloudflare Worker deployment (optional)
if [ "$DEPLOY_MODE" = "vps-worker" ]; then
    echo "☁️  Step 10: Deploying Cloudflare Worker (optional)..."
    echo "📝 Manual steps for Cloudflare Worker:"
    echo "   1. cd deploy/cloudflare-worker"
    echo "   2. bash scripts/deploy.sh"
    echo ""
    echo -e "${YELLOW}⚠️  Cloudflare Worker deployment requires manual execution${NC}"
else
    echo "☁️  Step 10: Skipping Cloudflare Worker (VPS-only mode)"
fi
echo ""

# Step 11: Final verification
echo "✅ Step 11: Final verification..."
echo "Checking endpoints:"

# Check API health
API_HEALTH=$(curl -s "http://$VPS_IP:8001/health" 2>/dev/null || echo "failed")
if echo "$API_HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✅ API Health: OK${NC}"
else
    echo -e "${RED}❌ API Health: FAILED${NC}"
fi

# Check domain
DOMAIN_HEALTH=$(curl -s "https://$DOMAIN/health" 2>/dev/null || echo "failed")
if echo "$DOMAIN_HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✅ Domain Health: OK${NC}"
else
    echo -e "${YELLOW}⚠️  Domain Health: May need DNS/SSL check${NC}"
fi

# Check latest prices
LATEST_PRICES=$(curl -s "http://$VPS_IP:8001/api/v1/prices/latest" 2>/dev/null || echo "failed")
if echo "$LATEST_PRICES" | grep -q "prices\|latest"; then
    echo -e "${GREEN}✅ Prices API: OK${NC}"
else
    echo -e "${RED}❌ Prices API: FAILED${NC}"
fi

echo ""
echo "======================================"
echo "🚀 Deployment Summary"
echo "======================"
echo -e "${GREEN}✅ Deployment completed successfully${NC}"
echo ""
echo "🌐 Live URLs:"
echo "   API: http://$VPS_IP:8001"
echo "   Domain: https://$DOMAIN"
echo "   Health: https://$DOMAIN/health"
echo "   Prices: https://$DOMAIN/api/v1/prices/latest"
echo ""
echo "🤖 Bot Info:"
echo "   ID: ${TELEGRAM_BOT_ID:-<set TELEGRAM_BOT_ID>}"
echo "   Username: @novax_price_bot"
echo ""
echo "🔧 Management Commands:"
echo "   ssh $VPS_USER@$VPS_IP pm2 status"
echo "   ssh $VPS_USER@$VPS_IP pm2 logs novax-api"
echo "   ssh $VPS_USER@$VPS_IP pm2 logs novax-worker"
echo "   ssh $VPS_USER@$VPS_IP pm2 logs novax-mini-app"
echo ""
echo "📋 Deployment Mode: $DEPLOY_MODE"
if [ "$DEPLOY_MODE" = "vps-only" ]; then
    echo "   Bot uses direct Telegram API connection from VPS"
else
    echo "   Bot uses Cloudflare Worker relay"
fi
echo ""

# Step 12: Test bot instructions
echo "🤖 Step 12: Bot Testing Instructions"
echo "--------------------------------------"
echo "To test the bot:"
echo "1. Open Telegram"
echo "2. Find bot: @novax_price_bot"
echo "3. Send /start command"
echo "4. Try /price command"
echo "5. Try creating an alert with /alert"
echo ""
echo "Bot should be responsive on production."
