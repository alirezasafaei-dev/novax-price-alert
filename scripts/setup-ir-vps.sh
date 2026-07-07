#!/usr/bin/env bash
# Novax Price Alert - VPS Setup (بدون Docker)
# نصب و راه‌اندازی کامل روی VPS خارج از ایران
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err() { echo -e "${RED}✗${NC} $1"; exit 1; }

DOMAIN="${DOMAIN:-your-domain.ir}"
EMAIL="${EMAIL:-admin@your-domain.ir}"
PROJECT_DIR="${PROJECT_DIR:-/opt/novax-price-alert}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN required}"

if [[ $EUID -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

echo "=============================="
echo " Novax VPS Setup (بدون Docker)"
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
echo -e "\n${YELLOW}[2/12] نصب uv (مدیریت پکیج Python)${NC}"
if ! command -v uv &>/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.cargo/bin:$PATH"
fi
info "uv نصب شد: $(uv --version)"

# ── 3. Create deploy user ───────────────────────────────────────
echo -e "\n${YELLOW}[3/12] ایجاد کاربر deploy${NC}"
if ! id -u "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
  usermod -aG "$DEPLOY_USER" "$SUDO_USER"
fi
info "کاربر $DEPLOY_USER آماده است"

# ── 4. Project directory ────────────────────────────────────────
echo -e "\n${YELLOW}[4/12] آماده‌سازی مسیر پروژه${NC}"
mkdir -p "$PROJECT_DIR" /var/www/certbot
chown "$DEPLOY_USER:$DEPLOY_USER" "$PROJECT_DIR"

if [[ -d "$PROJECT_DIR/.git" ]]; then
  info "پروژه از قبل clone شده"
else
  warn "پروژه در $PROJECT_DIR وجود ندارد."
  warn "فایل‌ها را با rsync از ماشین محلی خود کپی کنید:"
  echo "  rsync -avz --exclude='.git' --exclude='.venv' --exclude='node_modules' ./ $DEPLOY_USER@VPS_IP:$PROJECT_DIR/"
fi

# ── 5. PostgreSQL ──────────────────────────────────────────────
echo -e "\n${YELLOW}[5/12] راه‌اندازی PostgreSQL${NC}"
systemctl enable --now postgresql

POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -base64 32)}"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='novax'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER novax WITH PASSWORD '$POSTGRES_PASSWORD';"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='novax_price_alert'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE novax_price_alert OWNER novax ENCODING 'UTF8';"
fi
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE novax_price_alert TO novax;"

info "PostgreSQL: کاربر novax / دیتابیس novax_price_alert"

# ── 6. Redis ────────────────────────────────────────────────────
echo -e "\n${YELLOW}[6/12] راه‌اندازی Redis${NC}"
systemctl enable --now redis-server
info "Redis active"

# ── 7. .env ─────────────────────────────────────────────────────
echo -e "\n${YELLOW}[7/12] ایجاد .env${NC}"
cat > "$PROJECT_DIR/.env" << EOF
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=postgresql+asyncpg://novax:${POSTGRES_PASSWORD}@localhost:5432/novax_price_alert
REDIS_URL=redis://localhost:6379/0
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_WEBHOOK_URL=https://${DOMAIN}/api/v1/bot/webhook
METRICS_ACCESS_TOKEN=${METRICS_ACCESS_TOKEN:-$(openssl rand -base32 32)}
ADMIN_ACCESS_TOKEN=$(openssl rand -base32 32)
ALLOWED_HOSTS=${DOMAIN}
WORKER_INTERVAL_SECONDS=3600
USE_MOCK_PROVIDER=false
USE_MOCK_NOTIFICATIONS=false
EOF
chown "$DEPLOY_USER:$DEPLOY_USER" "$PROJECT_DIR/.env"
chmod 600 "$PROJECT_DIR/.env"

info ".env ساخته شد (پسوردها در ادامه نمایش داده می‌شوند)"

# ── 8. Python venv + deps ──────────────────────────────────────
echo -e "\n${YELLOW}[8/12] نصب وابستگی‌های Python${NC}"
sudo -u "$DEPLOY_USER" bash -c "
  cd '$PROJECT_DIR'
  export PATH=\"\$HOME/.cargo/bin:\$PATH\"
  uv sync
"
info "uv sync completed"

# ── 9. Mini-app build ──────────────────────────────────────────
echo -e "\n${YELLOW}[9/12] بیلد مینی‌اپ${NC}"
if [[ -d "$PROJECT_DIR/mini-app" ]]; then
  sudo -u "$DEPLOY_USER" bash -c "
    cd '$PROJECT_DIR/mini-app'
    npm install --silent
    npm run build 2>/dev/null || warn 'mini-app build failed, skipping'
  "
  info "mini-app build done"
else
  warn "mini-app directory not found, skipping"
fi

# ── 10. SSL + Nginx ─────────────────────────────────────────────
echo -e "\n${YELLOW}[10/12] راه‌اندازی SSL و Nginx${NC}"
if [[ "$DOMAIN" != "your-domain.ir" ]]; then
  certbot certonly --nginx --agree-tos --email "$EMAIL" -d "$DOMAIN" -d "www.$DOMAIN" || \
    warn "SSL failed; run certbot manually later"
fi

# نصب nginx config
sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$PROJECT_DIR/nginx.vps.conf" > /etc/nginx/sites-available/novax
if [[ ! -f /etc/nginx/sites-enabled/novax ]]; then
  ln -sf /etc/nginx/sites-available/novax /etc/nginx/sites-enabled/
fi
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
info "Nginx configured"

# ── 11. systemd services ────────────────────────────────────────
echo -e "\n${YELLOW}[11/12] نصب سرویس‌های systemd${NC}"
for svc in novax-api novax-worker; do
  cp "$PROJECT_DIR/deploy/$svc.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable "$svc"
  systemctl restart "$svc"
  systemctl is-active --quiet "$svc" || warn "srvice $svc active?"
done
info "systemd services running"

# ── 12. DB migrations ──────────────────────────────────────────
echo -e "\n${YELLOW}[12/12] اجرای migrationها${NC}"
sudo -u "$DEPLOY_USER" bash -c "
  cd '$PROJECT_DIR'
  export PATH=\"\$HOME/.cargo/bin:\$PATH\"
  uv run alembic upgrade head
" && info "Migrations done" || warn "Migrations failed; run manually: uv run alembic upgrade head"

# ── Summary ─────────────────────────────────────────────────────
echo ""
echo "=============================="
echo "  Setup Complete"
echo "=============================="
echo ""
echo "🔗 Domain: https://$DOMAIN"
echo "🏥 Health: https://$DOMAIN/health"
echo "🤖 Webhook: https://$DOMAIN/api/v1/bot/webhook"
echo ""
echo "📋 ذخیره این مقادیر:"
echo "   PostgreSQL Password: $POSTGRES_PASSWORD"
echo "   METRICS_ACCESS_TOKEN: ${METRICS_ACCESS_TOKEN:-$(grep METRICS_ACCESS_TOKEN "$PROJECT_DIR/.env" | cut -d= -f2)}"
echo ""
echo "🔧 مدیریت سرویس‌ها:"
echo "   systemctl status novax-api"
echo "   systemctl status novax-worker"
echo "   journalctl -u novax-api -f"
echo ""
echo "📝 تنظیم webhook تلگرام:"
echo "   curl -X POST 'https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook' -d 'url=https://${DOMAIN}/api/v1/bot/webhook'"
echo ""
echo "⚠️  اگر دامنه واقعی ندارید، nginx.vps.conf را دستی ویرایش کنید."
