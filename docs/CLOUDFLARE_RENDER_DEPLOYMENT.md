# Cloudflare + Render Deployment Guide

## Strategy Overview

This deployment strategy uses:
- **Cloudflare Workers** → Telegram relay and webhook handling (edge, globally distributed)
- **Render** → Python FastAPI backend and background worker (serverless, auto-scaling)
- **Neon PostgreSQL** → Serverless database (or Render built-in PostgreSQL)
- **Vercel** → Frontend (if applicable)

### Why This Stack?

- ✅ **Accessible from Iran** - All services work from Iran (most of the time)
- ✅ **Serverless & Auto-scaling** - No server management, pay for usage
- ✅ **Cost-effective** - Free tiers available, scale as needed
- ✅ **Migration path** - Easy to move to Hetzner/DigitalOcean when traffic grows
- ✅ **Fast globally** - Cloudflare Workers edge deployment

## Prerequisites

- Cloudflare account with Workers edit token
- Render account
- Neon account (or use Render PostgreSQL)
- Telegram bot token from BotFather
- Domain (optional, for custom URLs)

## Deployment Steps

### 1. Cloudflare Telegram Relay (Already Deployed)

✅ **Status**: Already deployed to `https://novax-telegram-relay.asdevelooper.workers.dev`

If you need to redeploy:
```bash
export CLOUDFLARE_API_TOKEN=your_token
export TELEGRAM_BOT_TOKEN=your_bot_token
export TELEGRAM_RELAY_SECRET=your_secret
bash scripts/deploy-cloudflare-relay.sh
```

Verify:
```bash
curl https://novax-telegram-relay.asdevelooper.workers.dev/health
```

Expected response:
```json
{"status":"ok","service":"telegram-relay"}
```

### 2. Setup Database

#### Option A: Neon PostgreSQL (Recommended)

1. Create account at https://neon.tech
2. Create new project (region: Frankfurt or Warsaw)
3. Copy connection string
4. See [Neon Setup Guide](NEON_SETUP.md) for details

#### Option B: Render Built-in PostgreSQL

1. Database is already configured in `render.yaml`
2. Render will provide `DATABASE_URL` automatically
3. No manual setup needed

### 3. Deploy to Render

#### Option A: Via Render Dashboard (Easiest)

1. Create new **Web Service** in Render
2. Connect your GitHub repository
3. Select branch to deploy (usually `main`)
4. Render will detect `render.yaml` automatically
5. Set environment variables (see [Environment Variables Guide](RENDER_ENV_VARS.md))
6. Click "Deploy"

#### Option B: Via Render CLI

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Deploy
render deploy
```

### 4. Configure Environment Variables

In your Render service dashboard, add these variables:

**Required:**
- `DATABASE_URL` - Your Neon or Render PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN` - From BotFather
- `TELEGRAM_RELAY_URL` - `https://novax-telegram-relay.asdevelooper.workers.dev`
- `TELEGRAM_RELAY_SECRET` - The same secret used in Cloudflare Worker
- `ENVIRONMENT` - `production`
- `DEBUG` - `false`

**Optional:**
- `REDIS_URL` - Redis connection string (for caching)
- `METRICS_ACCESS_TOKEN` - For `/metrics` endpoint access
- Provider API keys (NERKH_API_KEY, etc.)

See [Environment Variables Guide](RENDER_ENV_VARS.md) for complete list.

### 5. Run Database Migrations

After deployment, SSH into your Render service:

```bash
# In Render dashboard, click "Shell" on your service
uv run alembic upgrade head
```

Or use Render CLI:
```bash
render shell novax-price-alert-api
uv run alembic upgrade head
```

### 6. Seed Initial Data

```bash
uv run python -m novax_price_alert.scripts.seed_mvp
```

### 7. Verify Deployment

```bash
# Health check
curl https://your-app.onrender.com/health

# Latest prices
curl https://your-app.onrender.com/api/v1/prices/latest

# Metrics (if METRICS_ACCESS_TOKEN is set)
curl -H "X-Metrics-Token: your-token" https://your-app.onrender.com/metrics
```

### 8. Setup Telegram Webhook

Update Telegram webhook to point to your Render API:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-app.onrender.com/api/v1/webhook/telegram"}'
```

Or use the Cloudflare Worker script:
```bash
bash deploy/cloudflare-worker/scripts/setup-webhook-via-worker.sh
```

## Architecture Diagram

```
User → Telegram Bot → Cloudflare Worker → Render API → Neon PostgreSQL
                      ↑                    ↑
                      |                    |
                   Cron Trigger      Background Worker
```

## File Structure

```
novax-price-alert/
├── render.yaml                 # Render deployment config
├── Dockerfile                   # Container config (optional)
├── docs/
│   ├── CLOUDFLARE_RENDER_DEPLOYMENT.md  # This file
│   ├── NEON_SETUP.md           # Neon database setup
│   └── RENDER_ENV_VARS.md      # Environment variables
├── deploy/cloudflare-worker/    # Telegram relay (already deployed)
└── src/novax_price_alert/      # Backend code
```

## Cost Estimate (Free Tier)

- **Cloudflare Workers**: Free (100k requests/day)
- **Render Web Service**: Free (750 hours/month)
- **Render Worker**: Free (750 hours/month)
- **Neon PostgreSQL**: Free (0.5GB storage, ~200 hours compute)
- **Total**: $0/month initially

Scale as needed:
- Render: ~$7/month for basic paid tier
- Neon: ~$19/month for 1GB storage
- Cloudflare: Pay-as-you-go (very affordable)

## Troubleshooting

### Deployment Fails

1. Check Render deployment logs
2. Verify all environment variables are set
3. Ensure `render.yaml` is valid
4. Check database connectivity

### Database Connection Issues

1. Verify `DATABASE_URL` format
2. Ensure `sslmode=require` is included for Neon
3. Check firewall/region compatibility

### Telegram Not Working

1. Verify webhook is set correctly
2. Check `TELEGRAM_BOT_TOKEN` is valid
3. Ensure Cloudflare Relay URL is accessible
4. Check `TELEGRAM_RELAY_SECRET` matches

### Worker Not Processing Alerts

1. Check worker logs in Render dashboard
2. Verify worker service is running
3. Check database connection in worker
4. Ensure cron jobs are configured (if using Render cron)

## Monitoring

### Health Checks

- API: `/health` - Should return `{"status":"ok","db":"connected"}`
- Relay: `https://novax-telegram-relay.asdevelooper.workers.dev/health`
- Status: `/status` - Service status and metrics

### Metrics

- `/metrics` - Prometheus-style metrics (requires `METRICS_ACCESS_TOKEN`)
- `/metrics/summary` - Operational summary
- Cloudflare Analytics Engine - For Worker metrics

### Logging

- Render provides built-in logging for all services
- Cloudflare Workers has logging in dashboard
- Check logs regularly for errors

## Scaling Path

When traffic grows:

1. **Upgrade Render plans** - Move to paid tiers for more resources
2. **Add Redis** - For caching and session management
3. **Add CDN** - Cloudflare already handles CDN
4. **Database optimization** - Add connection pooling, read replicas
5. **Migration to VPS** - Move to Hetzner/DigitalOcean when cost-effective

## Migration to VPS (Future)

If you need to move to a VPS later:

1. Keep Cloudflare Workers for relay
2. Replace Render with VPS (Hetzner/DigitalOcean)
3. Use existing `scripts/deploy-backend-production.sh`
4. Update environment variables
5. No code changes needed

## Backup & Recovery

### Database Backups

- **Neon**: Automatic backups, point-in-time recovery
- **Render PostgreSQL**: Automatic backups

### Manual Backup

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M%S).sql
```

### Recovery

1. Restore from backup in Neon/Render dashboard
2. Or restore manually:
```bash
psql "$DATABASE_URL" < backup-file.sql
```

## Security Checklist

- ✅ All secrets set in Render dashboard (not in git)
- ✅ `TELEGRAM_RELAY_SECRET` is strong and random
- ✅ `METRICS_ACCESS_TOKEN` is set (if using metrics)
- ✅ Database uses SSL connections
- ✅ `DEBUG=false` in production
- ✅ `ENVIRONMENT=production` set
- ✅ HTTPS only (Render enforces this)
- ✅ Regular secret rotation

## Support & Resources

- [Render Documentation](https://render.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Project DEPLOYMENT.md](DEPLOYMENT.md) - Original VPS deployment guide
- [Project ARCHITECTURE.md](ARCHITECTURE.md) - System architecture

## Next Steps

1. Complete deployment following steps above
2. Test all functionality
3. Set up monitoring alerts
4. Configure custom domain (optional)
5. Document any custom configurations
6. Plan scaling strategy based on usage