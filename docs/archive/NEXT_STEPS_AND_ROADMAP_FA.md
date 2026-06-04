# نقشه راه و برنامه کارهای باقی‌مانده پس از Hardening هشدارها

> تاریخ تدوین: 2026-06-03
>
> وضعیت مبنا: PR hardening مربوط به lifecycle، idempotency، freshness، observability و Telegram Worker merge شده و این سند برنامه مرحله بعد را مشخص می‌کند.

## 1. خلاصه وضعیت فعلی

سیستم اکنون دو مسیر اجرایی دارد:

1. **Backend FastAPI + Worker** برای مدل دامنه، API هشدارها، evaluator، dispatcher، migrationها و تست‌های backend.
2. **Cloudflare Telegram Worker** برای UX مستقیم کاربر، منوی تلگرام، session flow، ذخیره KV و cron ارسال هشدار.

قابلیت‌های hardening که اکنون مبنا قرار می‌گیرند:

- شناسه canonical دارایی در مسیر Worker و backend.
- snapshot نام نمایشی دارایی و واحد قیمت در زمان ساخت هشدار.
- فعال‌سازی هشدار فقط بعد از confirmation صریح.
- lifecycle state برای هشدارها.
- event id و idempotency key برای مسیر trigger/send در backend.
- claim/finalization در dispatcher backend و claim/finalization ساده در Worker KV.
- freshness enforcement برای backend و رفتار محافظه‌کارانه unavailable/missing price در Worker.
- structured lifecycle logs و counterهای پایه.
- تست‌های backend و Worker برای duplicate prevention، stale/unavailable و confirmation flow.

## 2. هدف مرحله بعد

هدف مرحله بعد **feature sprint نیست**. هدف این است که نسخه harden‌شده را به یک release قابل پایش و قابل پشتیبانی تبدیل کنیم:

- رفتار runtime و مستندات کاملاً هم‌راستا باشند.
- rollout بدون ریسک duplicate notification انجام شود.
- وضعیت production قابل مشاهده باشد.
- کارهای باقی‌مانده به backlog شفاف P0/P1/P2 تبدیل شود.
- مسیر انتقال از KV-only Worker به backend-backed alerts، اگر لازم شد، واضح باشد.

## 3. نقشه راه پیشنهادی

### Phase A — Release Stabilization و Doc Alignment

**اولویت:** P0  
**هدف:** آماده‌سازی نسخه merge‌شده برای اجرا و مانیتورینگ امن.

#### Deliverables

- اجرای کامل تست‌های backend و Worker در CI یا pipeline محلی release.
- اجرای migration در staging/dev DB و بررسی backfill فیلدهای جدید.
- بازبینی مستندات operational با رفتار جدید confirmation/lifecycle.
- ثبت checklist نهایی rollout و rollback.
- تایید اینکه Worker و backend درباره asset identity، unit و lifecycle اصطلاحات مشترک دارند.

#### Exit Criteria

- همه تست‌ها پاس شوند.
- migration بدون خطا روی دیتابیس غیر-production اجرا شود.
- docs و runtime تناقض P0 نداشته باشند.
- دستورالعمل rollback موجود باشد.

---

### Phase B — Staging Validation و Production Smoke

**اولویت:** P0  
**هدف:** اطمینان از اینکه مسیر واقعی کاربر و cron در محیط نزدیک به production درست کار می‌کند.

#### Deliverables

- ساخت حداقل ۳ هشدار واقعی در Telegram Worker:
  - crypto above
  - fiat below/above
  - gold above
- تست اصلاح قیمت قبل از confirmation.
- تست cancel قبل از activation.
- تست cron با هشدار match شده و اطمینان از ارسال فقط یک notification.
- تست provider unavailable/missing price و بررسی لاگ `stale_data_detected`.
- بررسی KV بعد از ارسال: `lifecycle_state=delivered` و `enabled=false`.

#### Exit Criteria

- duplicate notification مشاهده نشود.
- alert بدون confirmation فعال نشود.
- خطاهای provider باعث trigger اشتباه نشوند.
- لاگ‌های key lifecycle قابل مشاهده باشند.

---

### Phase C — Observability و Operational Gates

**اولویت:** P0/P1  
**هدف:** production بدون observability کافی منتشر نشود.

#### Deliverables

- تعریف dashboard یا حداقل query/runbook برای لاگ‌های زیر:
  - `alert_activated`
  - `alert_evaluated`
  - `stale_data_detected`
  - `duplicate_trigger_detected`
  - `duplicate_send_detected`
  - `notification_send_started`
  - `notification_send_succeeded`
  - `notification_send_failed`
- تعریف آستانه‌های هشدار عملیاتی:
  - هر duplicate send = توقف rollout و بررسی فوری.
  - spike در send failure = توقف rollout.
  - provider unavailable طولانی‌تر از یک cron window = بررسی provider.
  - backlog غیرعادی یا عدم اجرای cron = بررسی Worker/Cron.
- ثبت daily checks برای operator.

#### Exit Criteria

- operator بتواند با `wrangler tail` یا ابزار لاگ موجود lifecycle یک alert را دنبال کند.
- Go/No-Go criteria پیش از full rollout مشخص باشد.

---

### Phase D — Backend/Worker Integration Decision

**اولویت:** P1  
**هدف:** تصمیم‌گیری شفاف درباره اینکه source of truth هشدارها KV Worker بماند یا به backend منتقل شود.

#### گزینه ۱: Worker KV به عنوان source of truth کوتاه‌مدت

مناسب اگر:

- تعداد کاربران کم است.
- alertها ساده و one-shot هستند.
- latency و سادگی deployment اولویت دارد.

کارهای لازم:

- تقویت KV claim با durable object یا lock key اگر concurrency واقعی افزایش یافت.
- export/debug endpoint امن برای بررسی alertها.
- retention policy برای alertهای delivered/cancelled.

#### گزینه ۲: Backend DB به عنوان source of truth

مناسب اگر:

- نیاز به audit دقیق، retries واقعی، گزارش‌گیری و history بیشتر داریم.
- چند worker یا کانال notification اضافه می‌شود.
- نیاز به dashboard/API عمومی هشدارها وجود دارد.

کارهای لازم:

- Worker به جای KV مستقیم، endpointهای backend alert create/confirm/list/delete را صدا بزند.
- Cron evaluation به backend worker منتقل شود یا Worker فقط trigger کننده job باشد.
- KV فقط برای session کوتاه‌مدت conversation باقی بماند.

#### Exit Criteria

- یک ADR کوتاه ثبت شود: `KV-first` یا `Backend-source-of-truth`.
- migration plan برای مسیر انتخاب‌شده نوشته شود.

---

### Phase E — Product Enhancements بعد از پایدار شدن Reliability

**اولویت:** P2  
**هدف:** بعد از اطمینان از reliability، بهبود UX و قابلیت‌ها.

#### Candidate Features

- pause/resume alert از طریق Telegram.
- edit alert کامل، نه فقط اصلاح قیمت قبل از confirmation.
- چند notification channel.
- alertهای recurring با cooldown مشخص.
- alertهای percentage change.
- history و mini dashboard.
- پشتیبانی از دارایی‌های بیشتر و disambiguation پیشرفته.

## 4. Task Backlog با اولویت

### P0 — قبل از rollout کامل

| ID | Task | خروجی مورد انتظار | معیار پذیرش |
|---|---|---|---|
| P0-1 | اجرای migration در staging | DB با schema جدید | `alembic upgrade head` بدون خطا |
| P0-2 | تست end-to-end ساخت هشدار Telegram | alert با `lifecycle_state=active` | بدون confirmation هیچ alertای active نشود |
| P0-3 | تست duplicate prevention در cron | ارسال فقط یک پیام | اجرای دوباره cron پیام دوم نسازد |
| P0-4 | تست provider unavailable | عدم trigger و لاگ operational | `stale_data_detected` در لاگ دیده شود |
| P0-5 | بررسی لاگ‌های lifecycle | trace از activate تا delivered | `alert_id` و `worker_run_id/event_id` قابل دنبال کردن باشد |
| P0-6 | آماده‌سازی rollback | دستورالعمل rollback مستند | operator بداند چطور deploy قبلی را برگرداند |
| P0-7 | smoke production محدود | چند alert low-risk | هیچ duplicate/send failure critical رخ ندهد |

### P1 — بعد از rollout محدود

| ID | Task | خروجی مورد انتظار | معیار پذیرش |
|---|---|---|---|
| P1-1 | ADR source of truth | تصمیم KV یا backend | سند کوتاه با tradeoffها |
| P1-2 | metric/export بهتر | dashboard یا endpoint عملیاتی | نرخ failure و duplicate قابل شمارش باشد |
| P1-3 | retention policy | پاکسازی delivered/cancelled قدیمی | KV/DB بی‌نهایت رشد نکند |
| P1-4 | تست‌های failure Worker | send failure و unavailable provider | تست automated برای مسیرهای خطا |
| P1-5 | runbook incident duplicate | دستورالعمل توقف و بررسی | operator بداند alertهای مشکوک را چطور غیرفعال کند |
| P1-6 | مستندسازی API جدید confirmation | docs/API هماهنگ با runtime | create/confirm/list/delete شفاف باشد |

### P2 — بهبود محصول و مقیاس‌پذیری

| ID | Task | خروجی مورد انتظار | معیار پذیرش |
|---|---|---|---|
| P2-1 | pause/resume در Telegram | دکمه pause/resume | lifecycle درست تغییر کند |
| P2-2 | edit alert بعد از activation | ویرایش target/condition | نیازمند confirmation مجدد باشد |
| P2-3 | دارایی‌های بیشتر | catalog گسترده‌تر | ambiguity مدیریت شود |
| P2-4 | alertهای recurring | ارسال چندباره با cooldown | duplicate guard حفظ شود |
| P2-5 | dashboard ساده | مشاهده health و alert history | operator بتواند وضعیت را سریع ببیند |

## 5. Go/No-Go Criteria برای rollout

### Go

- تست‌های backend و Worker پاس شده‌اند.
- migration staging موفق بوده است.
- حداقل یک alert در هر market با confirmation ساخته شده است.
- cron فقط یک notification برای alert match شده ارسال کرده است.
- unavailable provider باعث trigger نشده است.
- لاگ‌های lifecycle قابل مشاهده‌اند.

### No-Go

- هرگونه duplicate notification واقعی.
- فعال شدن alert بدون confirmation.
- trigger شدن با داده missing/unavailable.
- failure spike در ارسال Telegram.
- عدم امکان مشاهده لاگ‌های cron یا lifecycle.
- migration error یا backfill نامطمئن.

## 6. Rollback Plan خلاصه

1. deploy قبلی Cloudflare Worker را با Wrangler برگردانید.
2. اگر مشکل از backend migration نیست، DB را دست نزنید و فقط runtime را rollback کنید.
3. اگر duplicate send رخ داد، cron را موقتاً غیرفعال کنید یا alertهای active مشکوک را disabled کنید.
4. لاگ‌های `event_id`، `alert_id`، `chat_id/user_id` و timestamp را جمع‌آوری کنید.
5. بعد از root cause، rollout را فقط برای alertهای low-risk تکرار کنید.

## 7. مالکیت پیشنهادی کارها

- **Backend reliability:** lifecycle، migration، evaluator، dispatcher، backend tests.
- **Worker UX/runtime:** Telegram flow، KV state، cron delivery، Worker tests.
- **Operations:** deployment، wrangler tail، webhook، incident response، monitoring gates.
- **Product:** متن پیام‌ها، flow correction، دارایی‌های جدید، اولویت featureها.

## 8. برنامه پیشنهادی اجرای نزدیک‌مدت

### روز ۱

- اجرای همه تست‌ها.
- اجرای migration در staging/dev DB.
- بررسی manual flow در Telegram Worker.

### روز ۲

- production limited rollout با چند هشدار low-risk.
- مانیتور لاگ‌ها در حداقل دو cron cycle.
- ثبت هر failure یا duplicate suspicious.

### روز ۳

- تصمیم Go/No-Go برای full rollout.
- ثبت ADR درباره KV-first یا backend-source-of-truth.
- برنامه‌ریزی P1ها بر اساس داده واقعی rollout.
