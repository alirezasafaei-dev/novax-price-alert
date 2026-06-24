#!/bin/bash

# Novax Price Alert - VPS Only Deployment (Simple)
# Deploys to VPS at <redacted-vps-host> without Cloudflare Worker
# Bot: @novax_price_bot

set -e

echo "🚀 Novax Price Alert - VPS Only Deployment"
echo "============================================"
echo ""
echo "🤖 Bot Info:"
echo "   ID: ${TELEGRAM_BOT_ID:-<set TELEGRAM_BOT_ID>}"
echo "   Username: @novax_price_bot"
echo ""

# VPS Configuration
VPS_IP="<redacted-vps-host>"
VPS_USER="ubuntu"
VPS_PASSWORD="${VPS_PASSWORD:?Set VPS_PASSWORD in your shell or .env; never commit it.}"
VPS_PORT=22
APP_DIR="/home/deploy/novax-price-alert"
DOMAIN="novax.alirezasafeidev.ir"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📋 Deployment Configuration"
echo "---------------------------"
echo "VPS IP: $VPS_IP"
echo "User: $VPS_USER"
echo "Domain: $DOMAIN"
echo "App Directory: $APP_DIR"
echo "Mode: VPS-Only (Direct Telegram API)"
echo ""

# Function to run command on VPS
run_ssh() {
    local command=$1
    echo "🔧 Running: $command"
    sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$VPS_USER@$VPS_IP" -p "$VPS_PORT" "$command"
}

# Step 1: Test VPS connection
echo "📡 Step 1: Testing VPS connection..."
if sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$VPS_USER@$VPS_IP" -p "$VPS_PORT" "echo 'OK'" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ VPS connection successful${NC}"
else
    echo -e "${RED}❌ VPS connection failed${NC}"
    exit 1
fi
echo ""

# Step 2: Sync files to VPS
echo "📦 Step 2: Syncing project files..."
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
    echo -e "${GREEN}✅ Files synced${NC}"
else
    echo -e "${RED}❌ Sync failed${NC}"
    exit 1
fi
echo ""

# Step 3: Install Python dependencies
echo "🔧 Step 3: Installing Python dependencies..."
run_ssh "cd $APP_DIR && python3 -m pip install -q --upgrade pip && python3 -m pip install -q -r requirements.txt"
echo ""

# Step 4: Build mini-app
echo "🔧 Step 4: Building mini-app..."
run_ssh "cd $APP_DIR/mini-app && npm install -q && npm run build"
echo ""

# Step 5: Database migrations
echo "🗄️  Step 5: Running database migrations..."
run_ssh "cd $APP_DIR && alembic upgrade head"
echo ""

# Step 6: Configure for VPS-only mode
echo "🔧 Step 6: Configuring for VPS-only mode (relay disabled)..."
run_ssh "cd $APP_DIR && sed -i 's|^TELEGRAM_RELAY_URL=.*|TELEGRAM_RELAY_URL=|' .env"
run_ssh "cd $APP_DIR && sed -i 's|^TELEGRAM_RELAY_SECRET=.*|TELEGRAM_RELAY_SECRET=|' .env"
echo -e "${GREEN}✅ Configured for VPS-only${NC}"
echo ""

# Step 7: Restart PM2 services
echo "🔄 Step 7: Restarting PM2 services..."
run_ssh "cd $APP_DIR && pm2 restart novax-api --update-env 2>/dev/null || pm2 start python -m novax_price_alert.api.main --name novax-api"
run_ssh "cd $APP_DIR && pm2 restart novax-worker --update-env 2>/dev/null || pm2 start python -m novax_price_alert.worker_main --name novax-worker"
run_ssh "cd $APP_DIR && pm2 restart novax-mini-app --update-env 2>/dev/null || pm2 start node --name novax-mini-app -- mini-app/server.cjs"
run_ssh "cd $APP_DIR && pm2 save"
echo ""

# Step 8: Health check
echo "🏥 Step 8: Health checks..."
sleep 3

HEALTH=$(curl -s "http://$VPS_IP:8001/health" 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✅ API Health: OK${NC}"
else
    echo -e "${RED}❌ API Health: FAIL${NC}"
fi

PRICES=$(curl -s "http://$VPS_IP:8001/api/v1/prices/latest" 2>/dev/null || echo "FAIL")
if echo "$PRICES" | grep -q "prices"; then
    echo -e "${GREEN}✅ Prices API: OK${NC}"
else
    echo -e "${RED}❌ Prices API: FAIL${NC}"
fi

DOMAIN=$(curl -s "https://$DOMAIN/health" 2>/dev/null || echo "FAIL")
if echo "$DOMAIN" | grep -q "ok"; then
    echo -e "${GREEN}✅ Domain: OK${NC}"
else
    echo -e "${YELLOW}⚠️  Domain: Check DNS/SSL${NC}"
fi
echo ""

# Step 9: PM2 status
echo "📊 Step 9: PM2 Status:"
run_ssh "pm2 status"
echo ""

# Step 10: Summary
echo "============================================"
echo "🚀 Deployment Complete"
echo "=========================="
echo -e "${GREEN}✅ VPS-only deployment successful${NC}"
echo ""
echo "🌐 Live URLs:"
echo "   https://$DOMAIN"
echo "   https://$DOMAIN/health"
echo "   https://$DOMAIN/api/v1/prices/latest"
echo ""
echo "🤖 Bot: @novax_price_bot (ID: ${TELEGRAM_BOT_ID:-<set TELEGRAM_BOT_ID>})"
echo ""
echo "🔧 Commands:"
echo "   ssh $VPS_USER@$VPS_IP pm2 logs novax-api"
echo "   ssh $VPS_USER@$VPS_IP pm2 logs novax-worker"
echo ""
echo "📝 Test the bot in Telegram:"
echo "   /start → /price → /alert"
echo ""
