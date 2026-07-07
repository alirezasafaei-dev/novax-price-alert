# فهرست مستندات

آخرین بازبینی: 2026-07-07

## اسناد زنده

| سند | کاربرد |
|---|---|
| [PROGRESS.md](PROGRESS.md) | وضعیت واقعی پیاده‌سازی و production |
| [ARCHITECTURE.md](ARCHITECTURE.md) | معماری فعلی |
| [API.md](API.md) | APIهای backend |
| [OPERATIONS.md](OPERATIONS.md) | runbook عملیاتی Worker و D1 |
| [OBSERVABILITY.md](OBSERVABILITY.md) | مانیتورینگ و عیب‌یابی |
| [SECURITY.md](SECURITY.md) | کنترل‌های امنیتی فنی |
| [CONTRACTS_AND_POLICIES.md](CONTRACTS_AND_POLICIES.md) | قراردادهای پایدار دامنه |
| [CLOUDFLARE_PAGES_MINI_APP.md](CLOUDFLARE_PAGES_MINI_APP.md) | راهنمای mini-app روی Worker |
| [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) | راهنمای دیپلوی مستقل روی VPS (بدون Cloudflare) |
| [PREMIUM_FEATURES_PLAN.md](PREMIUM_FEATURES_PLAN.md) | وضعیت قابلیت‌های درآمدی |
| [USER_GUIDE_FA.md](USER_GUIDE_FA.md) | راهنمای کوتاه کاربر |
| [privacy_policy.md](privacy_policy.md) | سیاست حریم خصوصی |
| [terms_of_service.md](terms_of_service.md) | شرایط استفاده |

راهنمای اجرایی Worker و D1 در
[`deploy/cloudflare-worker/README.md`](../deploy/cloudflare-worker/README.md)
قرار دارد.

## تصمیم‌های معماری

- [ADR-0001: منبع اصلی هشدارها](adr/0001-alert-source-of-truth.md)
- [ADR-0002: محل مانیتور heartbeat](adr/0002-cron-heartbeat-monitor-placement.md)

## آرشیو

[`archive/`](archive/) فقط مرجع تاریخی است. این بخش شامل موارد زیر است:

- deploymentهای قدیمی VPS، Render، Neon و KV
- checklistها و راهنماهای superseded
- گزارش‌های وضعیت و تکمیل مقطعی
- قراردادها و roadmapهای قدیمی

برای تصمیم عملیاتی از آرشیو استفاده نکنید مگر یک سند زنده صریحاً به آن ارجاع دهد.

## قانون نگهداری

- `README.md`، این فهرست و `PROGRESS.md` باید با کد واقعی هم‌راستا بمانند.
- گزارش مقطعی جدید ساخته نشود؛ نتیجه در `PROGRESS.md` ثبت شود.
- هر سند superseded مستقیماً به `archive/` منتقل شود.
- secret یا اطلاعات اتصال واقعی حتی در آرشیو مجاز نیست.
