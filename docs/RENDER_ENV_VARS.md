# Render Environment Variables Guide

## Required Environment Variables

### Database & Cache
- `DATABASE_URL` - PostgreSQL connection string (Neon or Render built-in)
- `REDIS_URL` - Redis connection string (optional but recommended for caching)

### Telegram Configuration
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token from BotFather
- `TELEGRAM_RELAY_URL` - Cloudflare Worker URL: `https://novax-telegram-relay.asdevelooper.workers.dev`
- `TELEGRAM_RELAY_SECRET` - Shared secret between backend and Cloudflare Worker (from your .env)
- `TELEGRAM_AUTH_MAX_AGE_SECONDS` - Telegram auth token max age (default: 86400)
- `TELEGRAM_SEND_TIMEOUT_SECONDS` - Telegram send timeout (default: 10)

### Application Settings
- `ENVIRONMENT` - Set to `production`
- `DEBUG` - Set to `false`
- `APP_NAME` - Application name (default: iran-market-price-alert)

### Metrics & Monitoring (Optional)
- `METRICS_ACCESS_TOKEN` - Token for accessing `/metrics` endpoint (generate a secure random string)

### Provider Configuration
- `USE_MOCK_PROVIDER` - Set to `false` for production
- `USE_MOCK_NOTIFICATIONS` - Set to `false` for production

### Provider API Keys (Optional)
- `NERKH_API_KEY` - API key for nerkh.io (optional)
- `ALANCHAND_API_TOKEN` - Token for alanchand.com (optional)
- `API_IR_API_KEY` - API key for api.ir (optional)

## Setting Environment Variables in Render

### Via Dashboard
1. Go to your Render service
2. Navigate to "Environment" tab
3. Add each variable with its value

### Via Render CLI
```bash
render env set DATABASE_URL="postgresql+asyncpg://..."
render env set TELEGRAM_BOT_TOKEN="your-bot-token"
# ... repeat for other variables
```

### Via render.yaml
Some variables are already set in `render.yaml`. Add sensitive ones via dashboard for security.

## Security Best Practices

1. **Never commit secrets to git** - All sensitive values should be set in Render dashboard
2. **Use strong secrets** - Generate random strings for `TELEGRAM_RELAY_SECRET` and `METRICS_ACCESS_TOKEN`
3. **Rotate secrets regularly** - Update tokens periodically
4. **Use separate secrets for each environment** - Different values for dev/staging/production

## Secret Generation

Generate secure random strings for secrets:

```bash
# Generate 32-byte random hex string (64 hex characters)
python -c "import secrets; print(secrets.token_hex(32))"
```

## Example Values

### TELEGRAM_RELAY_SECRET
```
d0dea42744f215de668c40bbe208317a398b75f19fffe45226405a06b5a82197
```

### METRICS_ACCESS_TOKEN
```
a7f3c8e2d1b4f6a9c3e2d1b4f6a9c3e2d1b4f6a9c3e2d1b4f6a9c3e2d1b4f6a9
```

### DATABASE_URL (Neon format)
```
postgresql+asyncpg://user:password@ep-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## Validation

After setting variables, verify your deployment:

```bash
# Check health endpoint
curl https://your-app.onrender.com/health

# Check latest prices
curl https://your-app.onrender.com/api/v1/prices/latest
```

Expected health response:
```json
{"status":"ok","db":"connected"}
```

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` format
- Ensure `sslmode=require` is included
- Check if database is accessible from Render region

### Telegram Issues
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Ensure `TELEGRAM_RELAY_URL` is accessible
- Check `TELEGRAM_RELAY_SECRET` matches between backend and Cloudflare Worker

### Missing Variables
- Render will show deployment logs with missing variable errors
- Check "Environment" tab to ensure all required variables are set