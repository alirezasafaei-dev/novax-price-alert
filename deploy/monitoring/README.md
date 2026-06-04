# مانیتورینگ بیرونیِ ضربان cron

نبودِ اجرای cron از داخل خود Worker قابل‌تشخیص نیست (نبودِ اجرا رویدادی تولید
نمی‌کند و هیچ هشداری از داخل ممکن نیست). برای پوشش این گپ، Worker یک «ضربان»
ثبت می‌کند و یک مانیتورِ مستقل آن را از بیرون چک می‌کند.

## سمت Worker

- در پایان هر اجرای cron (`scheduled`)، زمان و شمارش‌ها در KV با کلید
  `cron:last_run` ثبت می‌شود (`src/heartbeat.js`).
- endpoint `GET /status` این ضربان را برمی‌گرداند:

  ```json
  {
    "status": "ok",            // ok | stale | unknown
    "last_cron_run": "2026-06-03T23:40:20.400Z",
    "age_seconds": 42,
    "stale": false,
    "expected_interval_seconds": 600,
    "stale_after_seconds": 1800,
    "checked": 5,
    "triggered": 1
  }
  ```

- وقتی ضربان کهنه باشد (پیش‌فرض: بیش از ۳ تیکِ ازدست‌رفته = ۳۰ دقیقه)،
  `/status` کد **503** برمی‌گرداند تا چک‌کننده‌های ساده فقط با کد HTTP هم بتوانند
  هشدار بدهند.

## سمت مانیتور (`cron_heartbeat_monitor.sh`)

اسکریپتِ سبکِ bash که `/status` را چک می‌کند و در صورت در دسترس نبودن Worker یا
کهنه‌بودن ضربان، به همان گروه ops تلگرام هشدار می‌دهد (با cooldown برای جلوگیری
از اسپم).

> **مهم — محل اجرا:** این مانیتور باید جایی اجرا شود که هم به Cloudflare و هم به
> `api.telegram.org` دسترسی داشته باشد. روی VPSهای داخل ایران معمولاً تلگرام فیلتر
> است و ارسال هشدار شکست می‌خورد؛ پس روشِ توصیه‌شده **GitHub Actions** است (پایین).

### روش توصیه‌شده: GitHub Actions (بدون سرور)

فایل `.github/workflows/cron-heartbeat-monitor.yml` همین اسکریپت را روی رانرهای
GitHub (خارج از ایران) هر ۱۵ دقیقه اجرا می‌کند — مستقل از Cloudflare cron و رایگان.

راه‌اندازی فقط دو Secret لازم دارد
(`Settings → Secrets and variables → Actions → New repository secret`):

| Secret | مقدار |
|---|---|
| `OPS_BOT_TOKEN` | توکن همان بات تلگرام |
| `OPS_CHAT_ID` | chat id گروه ops (مثلاً `-1003773212865`) |

پس از افزودن، می‌توانی از تب **Actions → Cron heartbeat monitor → Run workflow**
یک اجرای دستی برای تست بگیری.

### روش جایگزین: cron روی یک سرور (خارج از ایران)

```bash
# نصب وابستگی‌ها (curl و python3 معمولاً نصب‌اند)
chmod +x deploy/monitoring/cron_heartbeat_monitor.sh

# تست دستی
BOT_TOKEN='<bot-token>' OPS_CHAT_ID='-1003773212865' \
  deploy/monitoring/cron_heartbeat_monitor.sh

# افزودن به crontab (هر ۱۵ دقیقه)
crontab -e
# سپس این خط را اضافه کن:
*/15 * * * * BOT_TOKEN='<bot-token>' OPS_CHAT_ID='-1003773212865' /opt/novax/cron_heartbeat_monitor.sh >> /var/log/novax_monitor.log 2>&1
```

> توکن بات را در crontab به‌صورت ساده نگذار اگر ماشین چندکاربره است؛
> به‌جایش از یک فایل env با دسترسی محدود استفاده کن:
> `*/15 * * * * . /opt/novax/monitor.env && /opt/novax/cron_heartbeat_monitor.sh ...`

### متغیرهای محیطی

| متغیر | الزامی | پیش‌فرض | توضیح |
|---|---|---|---|
| `BOT_TOKEN` | بله | — | توکن همان بات تلگرام |
| `OPS_CHAT_ID` | بله | — | chat id گروه ops |
| `WORKER_URL` | خیر | `https://novax-telegram-relay.asdevelooper.workers.dev` | آدرس Worker |
| `COOLDOWN_SEC` | خیر | `3600` | حداقل فاصله بین دو هشدار |
| `STATE_DIR` | خیر | `/tmp` | محل فایل cooldown |
