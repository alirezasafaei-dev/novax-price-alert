#!/bin/bash
# Setup script for Iranian VPS deployment
# This script automates the entire setup process

set -e  # Exit on error

echo "🇮🇷 Novax Price Alert - Iranian VPS Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${DOMAIN:-"your-domain.ir"}
EMAIL=${EMAIL:-"admin@your-domain.ir"}
PROJECT_DIR="/opt/novax-price-alert"
POSTGRES_PASSWORD=$(openssl rand -base64 32)
METRICS_TOKEN=$(openssl rand -base64 32)
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}

echo -e "${YELLOW}Step 1: System Update${NC}"
sudo apt-get update && sudo apt-get upgrade -y

echo -e "${YELLOW}Step 2: Install Docker and Docker Compose${NC}"
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get install docker-compose-plugin -y

echo -e "${YELLOW}Step 3: Install Required Tools${NC}"
sudo apt-get install -y git curl openssl certbot python3-certbot-nginx

echo -e "${YELLOW}Step 4: Create Project Directory${NC}"
sudo mkdir -p $PROJECT_DIR
sudo chown $USER:$USER $PROJECT_DIR
cd $PROJECT_DIR

echo -e "${YELLOW}Step 5: Clone Repository${NC}"
# Replace with your actual repository
git clone https://github.com/yourusername/novax-price-alert.git .
# Or copy files manually if deploying from local

echo -e "${YELLOW}Step 6: Setup Directory Structure${NC}"
mkdir -p app logs backups certs

echo -e "${YELLOW}Step 7: Create Environment File${NC}"
cat > .env.production << EOF
# Database
POSTGRES_USER=novax
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=novax_price_alert

# Redis
REDIS_URL=redis://redis:6379/0

# Telegram
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_WEBHOOK_URL=https://${DOMAIN}/api/v1/bot/webhook

# Security
METRICS_ACCESS_TOKEN=${METRICS_TOKEN}

# Environment
ENVIRONMENT=production
DEBUG=false

# Application
ALLOWED_HOSTS=${DOMAIN}
USE_MOCK_PROVIDER=false
USE_MOCK_NOTIFICATIONS=false

# Optional APIs
NERKH_API_KEY=
EOF

echo -e "${GREEN}✓ Environment file created${NC}"
echo -e "${YELLOW}IMPORTANT: Save these passwords securely!${NC}"
echo "PostgreSQL Password: ${POSTGRES_PASSWORD}"
echo "Metrics Token: ${METRICS_TOKEN}"

echo -e "${YELLOW}Step 8: Setup SSL Certificates${NC}"
# First, start nginx temporarily for certbot
docker compose -f docker-compose.ir-vps.yml up -d nginx

# Obtain SSL certificate
sudo certbot certonly --nginx --agree-tos --email ${EMAIL} -d ${DOMAIN} -d www.${DOMAIN}

# Copy certificates to project directory
sudo cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem $PROJECT_DIR/certs/
sudo cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem $PROJECT_DIR/certs/
sudo chown $USER:$USER $PROJECT_DIR/certs/*

# Stop temporary nginx
docker compose -f docker-compose.ir-vps.yml down

echo -e "${GREEN}✓ SSL certificates obtained${NC}"

echo -e "${YELLOW}Step 9: Configure Nginx${NC}"
# Replace your-domain.ir with actual domain
sed -i "s/your-domain.ir/${DOMAIN}/g" nginx.ir-vps.conf
cp nginx.ir-vps.conf nginx.conf

echo -e "${YELLOW}Step 10: Build and Start Services${NC}"
docker compose -f docker-compose.ir-vps.yml build
docker compose -f docker-compose.ir-vps.yml up -d

echo -e "${YELLOW}Step 11: Wait for Services to be Ready${NC}"
sleep 30

echo -e "${YELLOW}Step 12: Run Database Migrations${NC}"
docker compose -f docker-compose.ir-vps.yml exec api uv run alembic upgrade head

echo -e "${YELLOW}Step 13: Seed Initial Data${NC}"
docker compose -f docker-compose.ir-vps.yml exec api uv run python -m novax_price_alert.scripts.seed_mvp

echo -e "${YELLOW}Step 14: Verify Deployment${NC}"
# Health checks
echo "Checking API health..."
curl -f http://localhost:8000/health || echo "API health check failed"

echo "Checking latest prices..."
curl -f http://localhost:8000/api/v1/prices/latest || echo "Prices API check failed"

echo -e "${GREEN}✓ VPS setup completed successfully!${NC}"
echo ""
echo "=========================================="
echo "Deployment Summary:"
echo "=========================================="
echo "Domain: https://${DOMAIN}"
echo "API URL: https://${DOMAIN}/api/v1"
echo "Health Check: https://${DOMAIN}/health"
echo ""
echo "IMPORTANT: Save these credentials securely:"
echo "------------------------------------------"
echo "PostgreSQL Password: ${POSTGRES_PASSWORD}"
echo "Metrics Token: ${METRICS_TOKEN}"
echo ""
echo "Next Steps:"
echo "1. Setup GitHub Actions for price fetching"
echo "2. Configure Telegram webhook"
echo "3. Setup automated backups"
echo "4. Configure firewall rules"
echo ""
echo "For detailed instructions, see docs/IRANIAN_VPS_DEPLOYMENT.md"
