# novax.alirezasafaeisystems.ir Subdomain - Final Remaining Steps

## 1. DNS (do this first - manual)
Add A record in your DNS provider for alirezasafaeisystems.ir:
novax.alirezasafaeisystems.ir   300   IN   A   185.3.124.93

Verify propagation:
dig +short novax.alirezasafaeisystems.ir

## 2. Expand SSL certificate (on VPS, after DNS is live)
ssh novax-vps
sudo certbot --expand   -d alirezasafaeisystems.ir,www.alirezasafaeisystems.ir,novax.alirezasafaeisystems.ir   --webroot -w /var/www/letsencrypt
sudo nginx -s reload

Test:
curl -I https://novax.alirezasafaeisystems.ir/health
sudo certbot certificates | grep -A 5 alirezasafaeisystems.ir

The nginx config is already deployed at /etc/nginx/sites-enabled/novax.alirezasafaeisystems.ir.conf (also saved in this repo under deploy/nginx/).

## 3. Deploy the updated Cloudflare Worker (to activate the new bot button)
This makes the "🌐 اپ وب پیشرفته (چارت + تاریخچه)" button appear in the Telegram bot main menu.

cd /home/dev13/my-project/sites/secondary/novax-price-alert/deploy/cloudflare-worker

# Ensure secrets are available (CLOUDFLARE_API_TOKEN, TELEGRAM_BOT_TOKEN, RELAY_SECRET)
# They can be in .env or exported.

./scripts/deploy.sh
# or: npx wrangler deploy

## 4. Update GitHub Actions secrets (for reliable price ingest)
In the GitHub repo settings (Secrets and variables > Actions):

VPS_API_URL = https://novax.alirezasafaeisystems.ir
VPS_API_TOKEN = <the METRICS_ACCESS_TOKEN value from /home/deploy/novax-price-alert/.env on the VPS>

Then trigger the "Price Fetcher for Iranian VPS" workflow (or let the cron run).

This will POST fresh prices (Binance + TGJU + Nobitex) to the backend, which the TWA and history/chart use.

## 5. Tests and verification
- After DNS + cert: curl https://novax.alirezasafaeisystems.ir/health
- In the Telegram bot (after worker deploy): the new web app button should open the rich TWA with live prices + interactive price history chart + alert creation wizard.
- Ingest test: prices from GH Actions should appear in /api/v1/prices/latest and be visible in the TWA chart.
- Health monitoring on the VPS now covers both local backend and the public subdomain URL.

## Notes
- The TWA (with Chart.js history chart, improved SEO meta tags, better UX) is already updated in the backend and served via nginx.
- .env on VPS has API_BASE_URL set.
- Backup script + daily cron for the novax DB is active.
- Live sites healthcheck script includes novax checks.
- All source code changes (TWA, bot keyboards, API ingest, seeding, etc.) have been committed in the repo.
- Nginx config reference: deploy/nginx/novax.alirezasafaeisystems.ir.conf (and on server).

Once these steps are complete, the full production setup on the requested subdomain is done with the new UI/UX and bot features live.

See also the main deployment notes and SERVER_STATE.md.
