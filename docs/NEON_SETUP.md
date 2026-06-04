# Neon PostgreSQL Setup Guide

## Why Neon?

Neon is a serverless PostgreSQL database that's perfect for this deployment:
- ✅ Serverless scaling (pay for what you use)
- ✅ Branching for development/testing
- ✅ Automatic backups
- ✅ Compatible with Cloudflare Workers and Render
- ✅ Free tier available (up to 0.5GB storage)
- ✅ accessible from Iran (most of the time)

## Setup Steps

### 1. Create Neon Account

1. Go to https://neon.tech
2. Sign up for free account
3. Create a new project:
   - Project name: `novax-price-alert`
   - PostgreSQL version: 15
   - Region: Choose closest to your users (recommended: Frankfurt or Warsaw)

### 2. Get Connection String

After creating project:
1. Go to Dashboard → Your Project
2. Copy the connection string (looks like):
   ```
   postgresql://[user]:[password]@[host]/[database]?sslmode=require
   ```

### 3. Set Environment Variable in Render

In your Render service settings:
1. Add environment variable:
   - Key: `DATABASE_URL`
   - Value: Your Neon connection string

### 4. Run Migrations

After deployment, SSH into your Render service or use Render shell:
```bash
uv run alembic upgrade head
```

### 5. Seed Initial Data

```bash
uv run python -m novax_price_alert.scripts.seed_mvp
```

## Alternative: Use Render's Built-in PostgreSQL

If Neon doesn't work well from Iran, you can use Render's built-in PostgreSQL:

1. In `render.yaml`, the database is already configured
2. Render will provide `DATABASE_URL` automatically
3. No additional setup needed

## Connection String Format

For Neon, ensure your connection string uses `postgresql+asyncpg://` prefix:
```
postgresql+asyncpg://user:password@host/database?sslmode=require
```

## Troubleshooting

### Connection Issues from Iran
- Try different Neon regions (Frankfurt, Warsaw)
- Consider using Render's built-in PostgreSQL as fallback
- Check if your ISP blocks certain PostgreSQL ports

### SSL Issues
- Ensure `sslmode=require` is in connection string
- Neon requires SSL connections

### Performance
- Neon free tier has connection limits
- Consider connection pooling for higher traffic
- Monitor usage in Neon dashboard

## Migration Path

If you need to move from Neon to Render PostgreSQL or vice versa:
1. Export data using `pg_dump`
2. Import to new database
3. Update `DATABASE_URL` environment variable
4. No code changes needed