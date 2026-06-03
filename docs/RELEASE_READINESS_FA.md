# چک‌لیست Release Readiness پس از Hardening هشدارها

> هدف: rollout امن نسخه harden‌شده بدون فعال‌سازی ناخواسته، duplicate notification، یا trigger با داده stale/unavailable.

## 1. Pre-rollout checks / چک‌های قبل از rollout

- [ ] Branch حاوی تغییرات hardening است و تست‌های backend و Worker روی همان commit اجرا شده‌اند.
- [ ] `uv run alembic upgrade head` روی staging/dev DB بدون خطا اجرا شده است.
- [ ] backfill فیلدهای جدید alert مانند `lifecycle_state`, `target_price_display_unit`, `confirmed_at`, `triggered_at`, `delivered_at`, `cancelled_at` بررسی شده است.
- [ ] Cloudflare bindings برای `ALERTS_KV`, `SESSIONS_KV`, `USERS_KV` در محیط هدف وجود دارند.
- [ ] secrets با مقدار production/staging درست set شده‌اند: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET_TOKEN`, و Cloudflare credentials.
- [ ] مستندات API، runbook، operations و bot behavior با flow فعلی هم‌راستا هستند: create staged، activation بعد از confirmation، unit explicit، canonical asset id، freshness guard و idempotency.
- [ ] مسیر rollback Worker و backend مشخص است و operator دسترسی لازم برای deploy قبلی یا disable cron را دارد.

## 2. Staging validation / اعتبارسنجی staging

- [ ] Bot را با `/start` باز کنید و مطمئن شوید فقط منوی اصلی و `/help` مسیر slash-command لازم را پوشش می‌دهند.
- [ ] سه هشدار بسازید و تا مرحله summary پیش بروید:
  - [ ] crypto `above`
  - [ ] fiat `above` یا `below`
  - [ ] gold `above`
- [ ] قبل از confirm، قیمت هدف را با `edit target` تغییر دهید و مطمئن شوید summary جدید unit و مقدار normalized را نشان می‌دهد.
- [ ] در summary یک alert را cancel کنید و بررسی کنید هیچ رکورد alert در KV ساخته نشده باشد.
- [ ] بدون فشار دادن confirm، KV را بررسی کنید و مطمئن شوید هیچ alert فعالی persist نشده است.
- [ ] بعد از confirm، KV باید شامل `lifecycle_state=active`, `enabled=true`, `canonical_asset_id`, `display_asset_name_at_creation`, `target_price_display_unit`, `confirmed_at` باشد.
- [ ] cron را با alert match شده اجرا کنید و بعد از ارسال، KV باید `lifecycle_state=delivered`, `enabled=false`, `triggered_at`, `delivered_at`, و `trigger_event_id` داشته باشد.
- [ ] همان cron را دوباره اجرا کنید و مطمئن شوید notification دوم ارسال نمی‌شود.
- [ ] provider unavailable/missing price را شبیه‌سازی کنید و مطمئن شوید trigger رخ نمی‌دهد و log `stale_data_detected` ثبت می‌شود.

## 3. Limited production rollout / rollout محدود production

- [ ] rollout را با تعداد کمی alert کم‌ریسک شروع کنید.
- [ ] حداقل دو cron window کامل را با `npx wrangler tail` مانیتور کنید.
- [ ] برای هر market حداقل یک alert confirmed داشته باشید ولی alertهای high-value یا حساس را تا پایان observation فعال نکنید.
- [ ] بعد از اولین delivery، همان alert را در KV بررسی کنید: delivered و disabled باشد.
- [ ] اگر duplicate send، provider outage طولانی، یا spike در send failure دیده شد rollout را متوقف کنید.

## 4. Monitoring gates / دروازه‌های مانیتورینگ

Go only if all are true:

- [ ] `alert_activated` فقط بعد از confirm دیده می‌شود.
- [ ] `alert_evaluated` برای alertهای active ثبت می‌شود.
- [ ] provider unavailable یا missing price باعث `stale_data_detected` می‌شود و notification ارسال نمی‌شود.
- [ ] هر trigger موفق sequence کامل دارد: `notification_send_started` → `notification_send_succeeded` → `alert_evaluation_job_completed`.
- [ ] هیچ `duplicate_send_detected` واقعی وجود ندارد؛ هر رخداد duplicate باید incident محسوب شود.
- [ ] نرخ `notification_send_failed` صفر یا explainable و transient است.
- [ ] cron طبق schedule اجرا می‌شود و checked/triggered counts غیرعادی نیستند.

## 5. Rollback plan / برنامه rollback

1. اگر duplicate notification یا activation بدون confirmation دیده شد، فوراً rollout را stop کنید.
2. Cloudflare Cron را موقتاً disable کنید یا Worker قبلی را با Wrangler rollback/deploy کنید.
3. alertهای مشکوک را در `ALERTS_KV` غیرفعال کنید (`enabled=false`) یا به `lifecycle_state=cancelled` ببرید.
4. اگر مشکل فقط Worker runtime است، DB migration را rollback نکنید مگر migration خود عامل incident باشد.
5. logهای مرتبط با `alert_id`, `canonical_asset_id`, `chat_id/user_id`, `worker_run_id`, `event_id`, و timestamp را جمع‌آوری کنید.
6. بعد از root cause و fix، rollout را دوباره فقط با limited production smoke شروع کنید.

## 6. Duplicate notification incident response

- [ ] Incident را Sev بالا در نظر بگیرید؛ هر duplicate واقعی No-Go است.
- [ ] cron را disable یا deploy قبلی را restore کنید.
- [ ] با `wrangler tail` دنبال `duplicate_send_detected`, `duplicate_trigger_detected`, `notification_send_started`, `notification_send_succeeded` بگردید.
- [ ] برای alert مشکوک، KV را بررسی کنید: `trigger_event_id`, `triggered_at`, `delivered_at`, `enabled`, `lifecycle_state`.
- [ ] اگر `notification_sent:{event_id}` وجود ندارد ولی پیام ارسال شده، مسیر mark-sent/finalization را بررسی کنید.
- [ ] کاربرهای متاثر و تعداد پیام‌های duplicate را ثبت کنید.

## 7. Stale provider incident response

- [ ] اگر provider unavailable بیشتر از یک cron window طول کشید، rollout را نگه دارید یا alert evaluation را موقتاً محدود کنید.
- [ ] برای crypto وضعیت Binance endpoint و برای fiat/gold وضعیت TGJU mirrors را بررسی کنید.
- [ ] دنبال `stale_data_detected` با reasonهای `crypto_prices_unavailable`, `iran_market_prices_unavailable`, یا `asset_price_missing` بگردید.
- [ ] مطمئن شوید latest price قدیمی یا empty payload باعث notification نشده است.
- [ ] تا زمان برگشت provider، از lower reliability assumptions یا fallback نامطمئن استفاده نکنید.

## 8. Go/No-Go criteria

### Go

- همه تست‌های backend و Worker پاس شده‌اند.
- migration staging موفق بوده است.
- alert بدون confirmation فعال نمی‌شود.
- cancel در summary alert persist نمی‌کند.
- stale/unavailable provider trigger نمی‌کند.
- delivered alert در cron بعدی resend نمی‌شود.
- operator می‌تواند lifecycle را در logها trace کند.

### No-Go

- هر duplicate notification واقعی.
- فعال شدن alert بدون confirmation.
- trigger با داده missing/stale/unavailable.
- spike در `notification_send_failed`.
- عدم دسترسی به `wrangler tail` یا KV برای incident response.
- migration یا backfill نامطمئن.
