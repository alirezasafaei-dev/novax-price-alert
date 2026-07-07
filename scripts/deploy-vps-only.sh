#!/bin/bash
# Novax Price Alert - VPS Only Deployment (بدون Docker)
set -euo pipefail

echo "============================================"
echo " Novax VPS Only Deployment (بدون Docker)"
echo "============================================"

VPS_IP="${VPS_IP:?VPS_IP required (e.g. 1.2.3.4)}"
VPS_USER="${VPS_USER:-root}"
APP_DIR="${APP_DIR:-/opt/novax-price-alert}"
DOMAIN="${DOMAIN:?DOMAIN required}"

if [[ "$VPS_USER" != "root" ]]; then
  SUDO_PREFIX="sudo "
else
  SUDO_PREFIX=""
fi

run_ssh() {
  ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$VPS_USER@$VPS_IP" "$*"
}

# Step 1: Test connection
echo "📡 Testing VPS connection..."
run_ssh "echo OK" || exit 1
echo "✅ Connection OK"
echo ""

# Step 2: Install uv if missing
echo "🔧 Ensuring uv is installed on VPS..."
run_ssh "command -v uv || curl -LsSf https://astral.sh/uv/install.sh | sh"
echo ""

# Step 3: Sync files
echo "📦 Syncing project files..."
rsync -avz --delete \
  -e "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.venv' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='deploy/cloudflare-worker' \
  --exclude='.wrangler' \
  . "$VPS_USER@$VPS_IP:$APP_DIR/"
echo "✅ Files synced"
echo ""

# Step 4: Install Python deps
echo "🔧 Installing Python dependencies..."
run_ssh "cd $APP_DIR && ${SUDO_PREFIX}env PATH=\$HOME/.cargo/bin:\$PATH uv sync"
echo ""

# Step 5: Build mini-app
if [[ -d "mini-app" ]]; then
  echo "🔧 Building mini-app..."
  run_ssh "cd $APP_DIR/mini-app && npm install --silent && npm run build 2>/dev/null || true"
  echo ""
fi

# Step 6: Run DB migrations
echo "🗄️  Running migrations..."
run_ssh "cd $APP_DIR && ${SUDO_PREFIX}env PATH=\$HOME/.cargo/bin:\$PATH uv run alembic upgrade head"
echo ""

# Step 7: Restart PM2 services
echo "🔄 Restarting PM2 services..."
run_ssh "cd $APP_DIR && ${SUDO_PREFIX}pm2 restart ecosystem.config.js 2>/dev/null; ${SUDO_PREFIX}pm2 restart novax-api novax-worker --update-env"
echo ""

# Step 8: Health check
echo "🏥 Health checks..."
sleep 3
HEALTH=$(curl -s "http://$VPS_IP:8000/health" 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q "ok"; then echo "✅ API Health: OK"; else echo "⚠️  API Health: $HEALTH"; fi
PRICES=$(curl -s "http://$VPS_IP:8000/api/v1/prices/latest" 2>/dev/null || echo "FAIL")
if echo "$PRICES" | grep -q "prices"; then echo "✅ Prices API: OK"; else echo "⚠️  Prices API: $PRICES"; fi

echo ""
echo "✅ Deploy complete"
echo "   https://$DOMAIN/health"
