# Security Deployment Guide

## Overview
This guide covers deploying security improvements to the Novax Price Alert VPS.

## Prerequisites

1. SSH access to VPS with key-based authentication
2. Updated code from GitHub
3. Administrative access on VPS
4. PM2 process manager installed

## Pre-Deployment Checklist

- [ ] Read `docs/SECURITY.md` completely
- [ ] Backup current VPS configuration
- [ ] Test SSH key authentication
- [ ] Verify GitHub Actions security scan passed
- [ ] Have rollback plan ready

## Step 1: Update Code on VPS

### Option A: Git Pull (Recommended if git is configured)

```bash
ssh -i ~/.ssh/novax_deploy ubuntu@<redacted-vps-host>
cd /home/ubuntu/novax-price-alert
git pull origin main
```

### Option B: Manual Sync (if git not available)

```bash
# On local machine
cd /home/dev13/my-project/sites/secondary/novax-price-alert
rsync -avz \
  --exclude='.env' \
  --exclude='.venv' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='.pytest_cache' \
  --exclude='*.pyc' \
  -e "ssh -i ~/.ssh/novax_deploy" \
  . ubuntu@<redacted-vps-host>:/home/ubuntu/novax-price-alert/
```

## Step 2: Update Environment Variables

```bash
ssh -i ~/.ssh/novax_deploy ubuntu@<redacted-vps-host>
cd /home/ubuntu/novax-price-alert

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Add/update security configuration
nano .env
```

Add these security variables to `.env`:

```bash
# Security Tokens (generate new strong random strings)
ADMIN_ACCESS_TOKEN=<generate_64_char_random_string>
INGEST_API_TOKEN=<generate_64_char_random_string>
SECRET_KEY=<generate_32_char_random_string>

# SSH Configuration (if needed)
VPS_SSH_KEY_PATH=~/.ssh/novax_deploy
```

## Step 3: Restart Services

```bash
# Stop services
pm2 stop novax-api
pm2 stop novax-worker
pm2 stop novax-mini-app

# Install updated Python dependencies
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

# Install updated Node dependencies (for mini-app)
cd mini-app
npm install
npm run build
cd ..

# Start services
pm2 start novax-api --update-env
pm2 start novax-worker --update-env
pm2 start novax-mini-app --update-env

# Save PM2 configuration
pm2 save
```

## Step 4: Verify Security Headers

```bash
# Test security headers
curl -I https://novax.alirezasafeidev.ir/

# Expected headers:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# Referrer-Policy: strict-origin-when-cross-origin
# Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## Step 5: Verify Services

```bash
# Check service status
pm2 status

# Check health endpoint
curl https://novax.alirezasafeidev.ir/health

# Check prices API
curl https://novax.alirezasafeidev.ir/api/v1/prices/latest
```

## Step 6: Test Authentication

```bash
# Test admin authentication (should fail without token)
curl https://novax.alirezasafeidev.ir/admin

# Test with token (should succeed)
curl "https://novax.alirezasafeidev.ir/admin?token=YOUR_ADMIN_ACCESS_TOKEN"
```

## Step 7: Verify SSH Key Authentication

```bash
# Test SSH key authentication locally
ssh -i ~/.ssh/novax_deploy ubuntu@<redacted-vps-host> "echo 'SSH key authentication works'"

# Expected output: SSH key authentication works
```

## Step 8: Enable GitHub Actions Security

### In GitHub Repository:

1. Go to repository Settings → Actions
2. Enable GitHub Actions
3. Configure secrets in Settings → Secrets and variables → Actions:
   - `OPS_BOT_TOKEN`: Your Telegram bot token
   - `OPS_CHAT_ID`: Your Telegram chat ID
   - `VPS_SSH_KEY`: Your SSH private key content
   - `VPS_HOST`: <redacted-vps-host>
   - `VPS_USER`: ubuntu

4. Enable security features in Settings → Security:
   - Dependabot alerts
   - Dependabot security updates
   - Code scanning alerts

## Step 9: Monitor Security Scans

### Check GitHub Actions Security Tab:

1. Go to repository Security tab
2. Check Dependabot alerts
3. Check Code scanning results
4. Review security scan artifacts

### Expected Security Scan Results:

- Dependency review: No critical issues
- Bandit scan: No high severity issues
- Safety scan: No known vulnerabilities
- Secret scan: No leaked secrets
- CodeQL: No security issues

## Troubleshooting

### Issue: SSH Connection Fails

**Solution:**
```bash
# Check SSH key permissions
chmod 600 ~/.ssh/novax_deploy

# Test SSH connection
ssh -vvv -i ~/.ssh/novax_deploy ubuntu@<redacted-vps-host>

# Check if key is added to VPS authorized_keys
ssh ubuntu@<redacted-vps-host> "cat ~/.ssh/authorized_keys"
```

### Issue: Services Won't Start

**Solution:**
```bash
# Check PM2 logs
pm2 logs novax-api --lines 50
pm2 logs novax-worker --lines 50
pm2 logs novax-mini-app --lines 50

# Check specific error
pm2 show novax-api
```

### Issue: Security Headers Not Showing

**Solution:**
```bash
# Check if middleware is loaded
curl -v https://novax.alirezasafeidev.ir/

# Verify nginx configuration
sudo nginx -t
sudo systemctl restart nginx
```

### Issue: Environment Variables Not Loading

**Solution:**
```bash
# Verify .env file exists
ls -la /home/ubuntu/novax-price-alert/.env

# Check PM2 ecosystem configuration
pm2 show novax-api

# Restart with explicit env loading
pm2 restart novax-api --update-env
```

## Rollback Plan

If deployment fails:

```bash
# Restore backup .env
cd /home/ubuntu/novax-price-alert
cp .env.backup.YYYYMMDD_HHMMSS .env

# Revert to previous git commit
git log --oneline -5
git checkout PREVIOUS_COMMIT_HASH

# Restart services
pm2 restart all
```

## Post-Deployment Verification

### Security Checklist:

- [ ] Security headers present in HTTP responses
- [ ] Admin panel requires valid token
- [ ] API endpoints protected with tokens
- [ ] SSH key authentication working
- [ ] No hardcoded credentials in logs
- [ ] Environment variables not exposed
- [ ] Rate limiting functional
- [ ] CORS headers properly configured
- [ ] HTTPS enforced
- [ ] Security scans passing in GitHub

### Functionality Checklist:

- [ ] Health endpoint returns 200
- [ ] Prices API returns valid data
- [ ] Telegram bot working
- [ ] Alert creation functional
- [ ] Mini-app loading
- [ ] Admin panel accessible with token
- [ ] Worker processing alerts
- [ ] No errors in PM2 logs

## Maintenance

### Weekly Tasks:

- Review GitHub security alerts
- Check security scan results
- Monitor service logs for security events
- Verify SSL certificate validity

### Monthly Tasks:

- Rotate sensitive tokens
- Review and update dependencies
- Run full security audit
- Test disaster recovery procedures

### Quarterly Tasks:

- Penetration testing
- Security policy review
- Access audit
- Backup verification

## Support

For security issues:
- GitHub Security Advisories
- Direct contact to security team
- Review `docs/SECURITY.md` for procedures

## Version History

- 2026-06-12: Initial security deployment guide
