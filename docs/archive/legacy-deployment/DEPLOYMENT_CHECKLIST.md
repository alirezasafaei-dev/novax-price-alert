# Deployment Checklist

**Last Updated**: 2026-06-12

## Pre-Deployment Checklist

### Code Quality ✅
- [x] Ruff linting passes
- [x] MyPy type checking passes
- [x] All unit tests pass (151/151)
- [x] No hardcoded secrets in code
- [x] Environment variables documented

### Security ✅
- [x] Secrets removed from code
- [x] Sensitive data in `.env.example` only
- [x] No real credentials in git history
- [x] Token validation in API endpoints
- [x] HTTPS enforced in production

### Localization ✅
- [x] All UI text in Persian
- [x] Error messages in Persian
- [x] Numbers in Persian format for user-facing displays
- [x] Admin panel Persian
- [x] Telegram bot messages Persian

### Performance ✅
- [x] Database indexes optimized
- [x] API response times acceptable
- [x] Error handling efficient
- [x] Logging not blocking main flow

### Documentation ✅
- [x] README up to date
- [x] Recent changes documented
- [x] Deployment guide current
- [x] API documentation complete
- [x] Troubleshooting guide available

## Server Deployment Checklist

### Before Deployment 🔄
- [ ] Backup current database
- [ ] Review changelog
- ] Check environment variables on VPS
- [ ] Verify SSH access
- [ ] Confirm server resources sufficient

### Deployment Steps 🚀

#### 1. Code Sync
```bash
ssh ubuntu@<redacted-vps-host>
cd /home/ubuntu/novax-price-alert
git pull origin main
```

#### 2. Dependencies
```bash
# Python dependencies
uv sync

# Mini-app dependencies
cd deploy/cloudflare-worker
npm ci
npm run build
cd ../..
```

#### 3. Database Migrations
```bash
# Check for new migrations
alembic current

# Run migrations if needed
alembic upgrade head
```

#### 4. Services Restart
```bash
# Restart all services
sudo systemctl restart novax-price-alert-api
sudo systemctl restart novax-price-alert-worker
sudo systemctl restart novax-mini-app

# Check status
sudo systemctl status novax-price-alert-api
sudo systemctl status novax-price-alert-worker
sudo systemctl status novax-mini-app
```

#### 5. Health Verification
```bash
# API health
curl https://novax.alirezasafeidev.ir/health

# Prices API
curl https://novax.alirezasafeiddev.ir/api/v1/prices/latest

# TWA
curl https://novax.alirezasafeidev.ir/

# SSL certificate
curl -I https://novax.alirezasafeidev.ir
```

#### 6. Logs Verification
```bash
# Check API logs
sudo journalctl -u novax-price-alert-api -n 50

# Check worker logs
sudo journalctl -u novax-price-alert-worker -n 50

# Check mini-app logs
sudo journalctl -u novax-mini-app -n 50
```

### Post-Deployment Checklist ✅

#### Verification 🧪
- [ ] All services running
- [ ] Health endpoint returns 200
- [ ] Prices API returning data
- [ ] TWA loading correctly
- [ ] SSL certificate valid
- [ ] Bot responding to commands
- [ ] Alert evaluation working

#### Monitoring 📊
- [ ] Error rates normal
- [ ] Response times acceptable
- [ ] Database connection stable
- [ ] Worker cron jobs running
- [ ] No spikes in error logs

#### User Testing 👤
- [ ] Test bot /start command
- [ ] Test price lookup
- [ ] Test alert creation
- [ ] Test alert confirmation
- [ ] Test alert deletion
- [ ] Test TWA in Telegram

## Rollback Procedure

If issues occur after deployment:

### Quick Rollback 🔄
```bash
# Rollback to previous commit
git log --oneline -5  # Find previous commit
git checkout <previous-commit-hash>
git push origin main --force  # CAUTION: force push
```

### Service Rollback 🔄
```bash
# Restart services to apply rolled back code
sudo systemctl restart novax-price-alert-api
sudo systemctl restart novax-price-alert-worker
sudo systemctl restart novax-mini-app
```

### Database Rollback 🔄
```bash
# If migration caused issues
alembic downgrade -1
```

## Monitoring Setup

### GitHub Actions
- [ ] Health check monitors disabled (currently)
- [ ] CI failure notifications to main branch only
- [ ] Test workflows passing

### Observability
- [ ] Metrics endpoint accessible
- [ ] Error tracking enabled
- [ ] Logging configured
- [ ] Performance monitoring

### Alerts
- [ ] Telegram bot notifications configured
- [ ] Email alerts (if configured)
- [ ] System resource monitoring

## Environment Variables Required

### Production VPS
```bash
# Database
DATABASE_URL=postgresql+asyncpg://...

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_RELAY_URL=...
TELEGRAM_RELAY_SECRET=...

# API
API_HOST=0.0.0.0
API_PORT=8001
APP_URL=https://novax.alirezasafeidev.ir

# Admin (optional)
ADMIN_ACCESS_TOKEN=...
METRICS_ACCESS_TOKEN=...
INGEST_API_TOKEN=...

# Price Providers
BINANCE_API_KEY=... (optional)
```

### GitHub Actions
```bash
API_BASE_URL=https://novax.alirezasafeidev.ir
OPS_BOT_TOKEN=...
OPS_CHAT_ID=...
INGEST_API_TOKEN=...
ADMIN_ACCESS_TOKEN=...
```

## Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
sudo journalctl -u novax-price-alert-api -f

# Check for missing dependencies
uv sync

# Check port conflicts
sudo lsof -i :8001
```

#### Database Connection Error
```bash
# Check database is running
sudo systemctl status postgresql

# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL
```

#### High Memory Usage
```bash
# Check memory usage
free -h

# Check process memory
ps aux --sort=-%mem | head

# Restart services if needed
sudo systemctl restart novax-price-alert-api
```

#### Telegram Bot Not Responding
```bash
# Check bot token
echo $TELEGRAM_BOT_TOKEN

# Test bot API
curl https://api.telegram.org/bot<TOKEN>/getMe

# Check worker logs
sudo journalctl -u novax-price-alert-worker -f
```

## Emergency Contacts

### Support Channels
- GitHub Issues: https://github.com/alirezasafaei-dev/novax-price-alert/issues
- Documentation: docs/README.md

### Critical Information
- VPS: <redacted-vps-host>
- Domain: novax.alirezasafeidev.ir
- Bot: @novax_price_bot (8858674032)
- Database: PostgreSQL (Neon or local)

---

**Note**: This checklist is updated after each deployment. Always verify the latest version before deploying.
