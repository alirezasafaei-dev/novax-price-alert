#!/usr/bin/env bash
# Novax Price Alert - VPS Setup (PM2 + Nginx, بدون Docker)
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err() { echo -e "${RED}✗${NC} $1"; exit 1; }

DOMAIN="${DOMAIN:?DOMAIN required (e.g. novax.example.com)}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
PROJECT_DIR="${PROJECT_DIR:-/opt/novax-price-alert}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN required}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -base64 32)}"
METRICS_TOKEN="${METRICS_TOKEN:-$(openssl rand -base32 32)}"

if [[ $EUID -ne 0 ]]; then exec sudo bash "$0" "$@"; fi

echo "=============================="
echo " Novax VPS Setup (PM2+Nginx)"
echo "=============================="

# ── 1. System packages ──────────────────────────────────────────
echo -e "\n${YELLOW}[1/12] به‌روزرسانی و نصب بسته‌های سیستمی${NC}"
apt-get update -qq
apt-get install -y -qq \
  curl wget git nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib redis-server \
  python3 python3-pip python3-venv nodejs npm
info "بسته‌های سیستمی نصب شد"

# ── 2. Install uv ───────────────────────────────────────────────
echo -e "\n${YELLOW}[2/12] نصب uv${NC}"
if ! command -v uv &>/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.cargo/bin:$PATH"
fi
info "uv $(uv --version)"

# ── 3. Install PM2 ──────────────────────────────────────────────
echo -e "\n${YELLOW}[3/12] نصب PM2${NC}"
npm install -g pm2 --silent
info "pm2 $(pm2 --version)"

# ── 4. User & project dir ──────────────────────────────────────
echo -e "\n${YELLOW}[4/12] کاربر deploy و مسیر پروژه${NC}"
if ! id -u "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi
mkdir -p "$PROJECT_DIR" /var/www/certbot "$PROJECT_DIR/logs"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$PROJECT_DIR"
info "کاربر $DEPLOY_USER / مسیر $PROJECT_DIR"

# ── 5. PostgreSQL ──────────────────────────────────────────────
echo -e "\n${YELLOW}[5/12] راه‌اندازی PostgreSQL${NC}"
systemctl enable --now postgresql
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='novax'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER novax WITH PASSWORD '$POSTGRES_PASSWORD';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='novax_price_alert'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE novax_price_alert OWNER novax ENCODING 'UTF8';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE novax_price_alert TO novax;"
info "PostgreSQL آماده است"

# ── 6. Redis ────────────────────────────────────────────────────
echo -e "\n${YELLOW}[6/12] راه‌اندازی Redis${NC}"
systemctl enable --now redis-server
info "Redis فعال"

# ── 7. .env ─────────────────────────────────────────────────────
echo -e "\n${YELLOW}[7/12] ایجاد .env${NC}"
cat > "$PROJECT_DIR/.env" << EOF
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=postgresql+asyncpg://novax:${POSTGRES_PASSWORD}@localhost:5432/novax_price_alert
REDIS_URL=redis://localhost:6379/0
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_WEBHOOK_URL=https://${DOMAIN}/api/v1/bot/webhook
METRICS_ACCESS_TOKEN=${METRICS_TOKEN}
ADMIN_ACCESS_TOKEN=$(openssl rand -base32 32)
ALLOWED_HOSTS=${DOMAIN}
WORKER_INTERVAL_SECONDS=3600
USE_MOCK_PROVIDER=false
USE_MOCK_NOTIFICATIONS=false
EOF
chown "$DEPLOY_USER:$DEPLOY_USER" "$PROJECT_DIR/.env"
chmod 600 "$PROJECT_DIR/.env"
info ".env ساخته شد"

# ── 8. Python deps (if project files exist) ────────────────────
echo -e "\n${YELLOW}[8/12] وابستگی‌های Python${NC}"
if [[ -f "$PROJECT_DIR/pyproject.toml" ]]; then
  sudo -u "$DEPLOY_USER" bash -c "
    export PATH=\"\$HOME/.cargo/bin:\$PATH\"
    cd '$PROJECT_DIR'
    uv sync
  "
  info "uv sync done"
else
  warn "pyproject.toml یافت نشد. ابتدا پروژه را به $PROJECT_DIR منتقل کنید:"
  echo "  rsync -avz --exclude='.git' --exclude='.venv' --exclude='node_modules' ./ $DEPLOY_USER@YOUR_VPS:$PROJECT_DIR/"
fi

# ── 9. Mini-app bield ──────────────────────────────────────────
echo -e "\n${YELLOW}[9/12] بیلد مینی‌اپ${NC}"
if [[ -f "$PROJECT_DIR/mini-app/package.json" ]]; then
  # Set VITE_NOVAX_API_BASE to empty for auto-detect (uses window.location.origin)
  if [[ -f "$PROJECT_DIR/mini-app/.env" ]]; then
    sed -i 's|^VITE_NOVAX_API_BASE=.*|VITE_NOVAX_API_BASE=|' "$PROJECT_DIR/mini-app/.env"
  fi

  sudo -u "$DEPLOY_USER" bash -c "
    cd '$PROJECT_DIR/mini-app'
    npm install --silent
    npm run build 2>/dev/null
  "
  info "mini-app build done"
else
  warn "mini-app یافت نشد، مرحله رد شد"
fi

# ── 10. SSL + Nginx ─────────────────────────────────────────────
echo -e "\n${YELLOW}[10/12] SSL و Nginx${NC}"
certbot certonly --nginx --agree-tos --email "$EMAIL" -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive 2>/dev/null || warn "SSL later: certbot certonly --nginx -d $DOMAIN"

sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$PROJECT_DIR/nginx.vps.conf" > /etc/nginx/sites-available/novax
ln -sf /etc/nginx/sites-available/novax /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
info "Nginx پیکربندی شد"

# ── 11. PM2 services ──────────────────────────────────────────
echo -e "\n${YELLOW}[11/12] راه‌اندازی PM2${NC}"
sudo -u "$DEPLOY_USER" bash -c "
  export PATH=\"\$HOME/.cargo/bin:\$PATH\"
  cd '$PROJECT_DIR'
  pm2 start ecosystem.config.js
  pm2 save
  pm2 startup systemd -u $DEPLOY_USER --hp /home/$DEPLOY_USER 2>/dev/null || true
"
info "PM2: servis‌های novax-api و novax-worker فعال"

# ── 12. DB migrations ──────────────────────────────────────────
echo -e "\n${YELLOW}[12/12] اجرای migrationها${NC}"
sudo -u "$DEPLOY_USER" bash -c "
  export PATH=\"\$HOME/.cargo/bin:\$PATH\"
  cd '$PROJECT_DIR'
  uv run alembic upgrade head
" && info "migration‌ها اعمال شد" || warn "migration failed: uv run alembic upgrade head"

# ── Summary ─────────────────────────────────────────────────────
echo ""
echo "====================================="
echo "  Setup Complete"
echo "====================================="
echo ""
echo "  Domain:  https://$DOMAIN"
echo "  Health:  https://$DOMAIN/health"
echo "  MiniApp: https://$DOMAIN/mini-app/"
echo "  Webhook: https://$DOMAIN/api/v1/bot/webhook"
echo ""
echo "  PostgreSQL pass: $POSTGRES_PASSWORD"
echo "  METRICS_TOKEN:   $METRICS_TOKEN"
echo ""
echo "  PM2:"
echo "    pm2 status"
echo "    pm2 logs novax-api"
echo "    pm2 logs novax-worker"
echo ""
echo "  Webhook:"
echo "    curl -X POST 'https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook' \\"
echo "      -d 'url=https://${DOMAIN}/api/v1/bot/webhook'"
echo ""
echo "  Deploy update:"
echo "    rsync -avz --exclude='.git' --exclude='.venv' --exclude='node_modules' ./ $DEPLOY_USER@VPS_IP:$PROJECT_DIR/"
echo "    ssh $DEPLOY_USER@VPS_IP 'cd $PROJECT_DIR && uv sync && pm2 restart all'"
