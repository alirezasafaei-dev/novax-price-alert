# نقشه راه پیاده‌سازی (Implementation Roadmap)

**منبع اصلی و مرجع قطعی این سند:** گزارش کامل بهبود پروژه در مسیر `/home/dev13/Documents/my-doc/PROJECT_IMPROVEMENT_REPORT_FA/` (فایل‌های 01.md تا 06.md).

این نقشه راه مستقیماً بر اساس تحلیل، مسائل، راهکارها، برنامه مرحله‌بندی‌شده، task breakdown (با کدهای T-xxx، اولویت P0/P1/P2، ownerها، معیار پذیرش)، timeline، sprint plan، KPIها و Risk Register گزارش مذکور بازنویسی و فیکس شده است.

هدف: تبدیل بات تلگرامی قیمت و هشدار به یک **محصول تولید حرفه‌ای، شفاف، قابل اعتماد و مناسب استفاده روزمره کاربران واقعی ایرانی** (نه دمو یا MVP نمایشی).

اصل راهنما (از گزارش): 
> قبل از توسعه بیشتر، باید رفتار هسته‌ای سیستم قابل‌فهم، قابل‌اعتماد، و قابل‌پیگیری شود.

اول hardening (شفاف‌سازی، ضدتکرار، تازگی، observability) سپس آماده‌سازی برای بهبودهای غنی تولید (UX/UI غنی، کارایی، پیشنهادهای هوشمند و غیره). کارهای اخیر TWA تب‌دار + My Assets + Suggestions + چارت پیشرفته دقیقاً در همین راستا (بهترین تجربه ممکن برای کاربر واقعی) انجام شده و در وضعیت پیشرفت ثبت می‌شوند.

این سند برای agent خودکار (با چک‌باکس) و تیم فنی (تبدیل به تیکت/PR) قابل اجراست.

## خلاصه فارسی فازها (عین گزارش 04)

برنامه اجرایی در **۵ فاز**:

1. **فاز صفر: تثبیت قراردادها و شفاف‌سازی مبنا**  
   (Asset Identity Policy، Pricing Presentation Policy، Alert Flow Contract، Alert Lifecycle Contract، Freshness Policy)

2. **فاز یک: اصلاح UX و Alert Flow**  
   (شفاف‌سازی جریان مرحله‌ای، نمایش صریح دارایی در همه نقاط حساس، تایید نهایی استاندارد، متن‌های actionable)

3. **فاز دو: سخت‌سازی منطق هشدار و جلوگیری از تکرار**  
   (state machine رسمی، idempotency، atomic claim/locking، anti-duplicate، lifecycle کامل)

4. **فاز سه: Observability، Data Freshness و آمادگی عملیاتی**  
   (لاگ ساختاریافته، متریک‌های پایه، correlation/trace، مانیتورینگ تازگی، runbook incident، alerting داخلی)

5. **فاز چهار: هم‌ترازی مستندات، تثبیت نهایی و آماده‌سازی برای توسعه بعدی**  
   (audit مستندات با runtime، walkthrough واقعی end-to-end، برچسب‌گذاری وضعیت docs، تعریف baseline پایدار + release checklist)

ترتیب فازها حیاتی است. observability قبل از lifecycle/flow باعث داده‌های بی‌معنی می‌شود.

## اصول پایه (مستقیم از گزارش 01-03)

- محصول برای **استفاده واقعی و روزمره کاربران ایرانی در تلگرام** است.
- قیمت‌ها باید **روز و واقعی** باشند؛ واحد اصلی نمایش **تومان** (کریپتو USDT فقط جایی که عرف بازار است).
- قیمت باید **قابل فهم** باشد (فرمت خوانا با جداکننده، واحد مناسب، نه خام API، اعشار/گرد کردن منطقی برای دارایی‌های گران/ارزان).
- همه چیز **Explicit** به جای Implicit (نام دارایی کامل + نماد، واحد، شرط، قیمت هدف/فعلی، وضعیت).
- یکدست‌سازی رفتار، متن‌ها، نمایش قیمت در همه نقاط (بات، TWA، هشدارها، تاییدها).
- متن‌ها و تاییدها **بخشی از reliability** هستند (نه polishing).
- اول hardening هسته (قراردادها، UX clarity، reliability، observability) بعد expansion.
- مستندات باید ۱۰۰٪ با runtime واقعی هم‌تراز باشند (source of truth = کد + رفتار واقعی؛ برچسب implemented/planned/deprecated).
- ریسک بیش‌توسعه قبل از تثبیت هسته: انرژی روی clarity، reliability، observability متمرکز بماند.

**گزارش کامل (تحلیل مسائل ۹گانه + راهکارهای اجرایی دقیق + task breakdown + sprint + KPI + risk) مرجع است و در `/home/dev13/Documents/my-doc/PROJECT_IMPROVEMENT_REPORT_FA/` قرار دارد.**

## فازهای اجرایی دقیق (از گزارش 04 + breakdown از 05)

### فاز صفر: تثبیت قراردادها و شفاف‌سازی مبنا (Sprint 1)

**هدف:** پیش از هر اصلاح، قراردادهای پایه freeze شوند تا همه روی یک منبع توافق داشته باشند.

**خروجی‌های اصلی:** Asset Identity Policy، Pricing Presentation Policy، Alert Flow Contract، Alert Lifecycle Contract، Freshness Policy.

**تسک‌های کلیدی (از گزارش 05):**

- [x] T-001 تعریف Asset Identity Policy (P0, Product + Backend/UX) — نام نمایشی، نماد، alias، canonical id، mapping provider.
- [x] T-002 تعریف Pricing Presentation Policy (P0, Product + UX/Backend) — واحد اصلی تومان، قواعد گرد کردن، اعشار، جداکننده، timestamp، رفتار دارایی‌های خاص.
- [x] T-003 تعریف Alert Flow Contract (P0, Product + UX/Backend/QA) — مراحل ۶گانه (انتخاب دارایی → قیمت فعلی → شرط → قیمت هدف → خلاصه نهایی → تایید/ویرایش/لغو).
- [x] T-004 تعریف Alert Lifecycle Contract (P0, Tech Lead + Backend/Ops/QA) — stateها: active/triggered/notifying/notified/completed/cancelled/failed + transitionهای معتبر.
- [x] T-005 تعریف Freshness Policy (P0, Tech Lead + Backend/Ops/Product) — fresh/delayed/stale/unavailable + threshold + رفتار روی display/trigger.

**معیار پذیرش فاز صفر:** یک تعریف واحد برای هر قرارداد وجود داشته باشد؛ مستند و قابل استناد (این roadmap + ارجاع به گزارش).

**وضعیت فعلی:** قراردادها در این سند و گزارش distill شده‌اند. پیاده‌سازی جزئی در کد (canonical در snapshotها، flow مرحله‌ای با confirm gate، freshness gate در worker) وجود دارد اما نیاز به مستند رسمی جداگانه (سیاست‌ها) و هم‌ترازی کامل دارد.

### فاز یک: اصلاح UX و Alert Flow (Sprint 2)

**هدف:** کاربر اولین جهش محسوس در کیفیت تجربه را ببیند؛ ابهام حذف شود.

**تسک‌های کلیدی (P0/P1):**

- [x] T-101 بازطراحی مرحله‌ای Alert Flow (P0, UX/Content + Product/Backend)
- [x] T-102 بازنویسی پیام انتخاب دارایی (P0) — نمایش «بیت‌کوین (BTC)» صریح در همه نقاط.
- [x] T-103 بازنویسی پیام‌های ورود قیمت (P0) — واحد صریح + مثال + validation.
- [x] T-104 طراحی استاندارد پیام تایید نهایی (P0) — نام دارایی + شرط + قیمت هدف + واحد + قیمت فعلی + دکمه‌ها.
- [ ] T-105 بازطراحی پیام‌های خطا (P1)
- [ ] T-106 بازطراحی لیست هشدارهای فعال (P1) — دارایی/شرط/قیمت هدف/وضعیت.

**کارهای انجام‌شده اضافی هم‌راستا (بهترین UX ممکن):** TWA کامل تب‌دار (قیمت‌ها | دارایی‌های من | هشدارها | چارت پیشرفته | ایجاد)، renderMyAssets (خلاصه دارایی + تعداد هشدار + قیمت زنده + اقدام سریع)، renderSuggestions (پیشنهاد برای دارایی‌های unwatched با prefill wizard)، چارت پیشرفته چند-دارایی با بازه‌های زمانی + Chart.js dark theme، بهبود کیبورد بات + لینک عمیق به TWA، asset-grouped در "هشدارهای من".

**معیار پذیرش:** کاربر در ساخت هشدار سردرگم نشود؛ در تایید، دارایی و شرط و واحد واضح باشد؛ ورودی اشتباه با پیام قابل فهم مدیریت شود.

### فاز دو: سخت‌سازی منطق هشدار و جلوگیری از تکرار (Sprint 3)

**هدف:** رفتار هشدار از نظر فنی قابل اتکا، deterministic و ضدتکرار شود.

**تسک‌های کلیدی:**

- [ ] T-201 پیاده‌سازی مدل canonical برای asset (P0, Backend)
- [ ] T-202 پیاده‌سازی state machine برای flow کاربر (P0)
- [ ] T-203 پیاده‌سازی lifecycle رسمی برای alert (P0)
- [ ] T-204 پیاده‌سازی idempotency در trigger (P0)
- [ ] T-205 پیاده‌سازی atomic claim / locking (P0)
- [ ] T-206 تعریف و پیاده‌سازی retry policy (P1)
- [ ] T-207 تست سناریوهای race condition (P1, QA)

**وضعیت فعلی (از کد واقعی):** 
- alert creation staged + pending_confirmation → active بعد از تایید صریح کاربر.
- snapshot display name/unit در زمان ایجاد.
- برخی guards برای stale (worker قیمت را چک می‌کند).
- retry/backoff در fetch/send.
- اما state machine کامل، locking اتمیک برای claim روی alert، و anti-duplicate قوی ممکن است نیاز به تقویت بیشتر داشته باشد (بر اساس گزارش، این‌ها P0 هستند).

**معیار پذیرش:** برای یک رخداد واحد، اعلان تکراری مهار شده؛ transition نامعتبر مسدود؛ lifecycle در لاگ/state قابل مشاهده.

### فاز سه: Observability، Data Freshness و آمادگی عملیاتی (Sprint 4)

**هدف:** سیستم از «کار می‌کند» به «قابل مانیتور، قابل تحلیل، قابل اداره» برسد.

**تسک‌های کلیدی:**

- [ ] T-301 پیاده‌سازی freshness classification (P0)
- [ ] T-303 اعمال freshness policy در trigger logic (P0)
- [ ] T-401 طراحی schema لاگ ساختاریافته (P0)
- [ ] T-402 پیاده‌سازی log برای eventهای کلیدی (P0)
- [ ] T-403 تعریف metricهای پایه (P0)
- [ ] T-404 پیاده‌سازی correlation (P1)
- [ ] T-405 تعریف alerting عملیاتی (P1)
- [ ] T-406 تدوین runbook incidentها (P1)

**وضعیت فعلی:** 
- لاگ‌های کلیدی در worker (alert_evaluated, notification, price fetch) وجود دارد.
- endpointهای health + /api/v1/prices/latest + ingest.
- GitHub Action برای قیمت (bypass IP) + healthcheck خارجی.
- backup cron + extended live-sites healthcheck شامل novax.
- اما schema ساختاریافته کامل، metricهای غنی، freshness status صریح در DB/UI، correlation قوی، runbook مکتوب هنوز نیاز به کار دارد (بسیاری P0/P1).

### فاز چهار: هم‌ترازی مستندات، تثبیت نهایی و آماده‌سازی برای توسعه بعدی (Sprint 5)

**هدف:** سیستم و مستندات به وضعیت پایدار و قابل اتکا برسند تا پایه توسعه بعدی سالم باشد.

**تسک‌های کلیدی:**

- [ ] T-501 طراحی test matrix end-to-end (P1)
- [ ] T-502 اجرای walkthrough واقعی end-to-end (P1)
- [ ] T-503 audit مستندات حساس با runtime (P1)
- [ ] T-504 تعریف release checklist نسخه hardening (P2)

**خروجی:** مستندات کلیدی (این roadmap، PROGRESS، contractها) با runtime هم‌خوان؛ runbookها کاربردی؛ baseline نسخه پایدار تعریف‌شده؛ backlog بعدی روی پایه واقعی ساخته شود.

**تمرکز تولید غنی (هم‌راستا با روح گزارش + درخواست کاربر برای بهترین UX/UI/کارایی):** 
TWA به عنوان مینی‌اپ کامل (تب‌دار، My Assets اولویتی، پیشنهادهای هوشمند مبتنی بر داده، چارت‌های تعاملی پیشرفته)، یکپارچگی عمیق بات متنی با TWA (دکمه‌های web_app + لینک عمیق + خلاصه‌های asset-grouped)، کارایی (کش سریع، چارت تاریخچه، کشف سریع دارایی)، SEO/meta برای TWA. این‌ها پس از/هم‌زمان با hardening هسته، ارزش واقعی برای کاربر ایرانی ایجاد می‌کنند و بخشی از "محصول کامل از روز اول" هستند.

## برنامه زمانی و Sprint (خلاصه از گزارش 06)

- فاز 0 / Sprint 1: ۱ هفته — Contract Freeze (T-001 تا T-005)
- فاز 1 / Sprint 2: ۱-۱.۵ هفته — UX Flow Stabilization (T-101 تا T-105)
- فاز 2 / Sprint 3: ۲ هفته — Backend Hardening (T-201 تا T-205)
- فاز 3 / Sprint 4: ۱.۵-۲ هفته — Freshness + Observability (T-301/T-303 + T-401 تا T-404)
- فاز 4 / Sprint 5: ۱-۱.۵ هفته — QA, Runbook, Release Readiness (T-206/T-207 + T-405/T-406 + T-501 تا T-504)

**مدت کل واقع‌بینانه:** ۷ هفته. موج اول اجرا: تمام P0های فاز ۰-۲ فوری.

## KPIهای پیشنهادی کلیدی (از گزارش 06)

- Alert Creation Completion Rate + Error Rate (قبل از تایید نهایی)
- Duplicate Alert Trigger/Send Rate → نزدیک صفر
- Invalid State Transition Rate → صفر
- Stale Data Evaluation Rate + Trigger Blocked by Freshness
- Worker Processing Latency, Notification Send Failure Rate, Incident Detection Time, MTTR

**Gateهای Go/No-Go برای release:** duplicate نزدیک صفر، transition بحرانی صفر، happy path پایدار، stale behavior مطابق policy، trace ممکن، runbook حاضر.

## Risk Register خلاصه (از گزارش)

R-01 Ambiguity در قراردادها (بالا) → contract freeze + time-boxed decision  
R-04 duplicate trigger (بسیار بالا) → idempotency + atomic claim + تست race  
R-07 عدم هم‌ترازی سند و runtime (متوسط-بالا) → walkthrough + audit + source of truth  
R-08 scope creep (بالا) → freeze دامنه hardening  
(بقیه در گزارش 06 کامل)

## وضعیت پیشرفت فعلی (به‌روز با کد + کارهای UI/UX اخیر)

بسیاری از اصول گزارش (explicit، تومان، جریان مرحله‌ای با تایید، freshness guard اولیه، observability پایه) در هسته پیاده‌سازی شده‌اند. 

**کارهای غنی تولید انجام‌شده (هم‌راستا با "بهترین کار ممکن" برای UX و کارایی، بدون محدودیت MVP):**
- TWA تک‌فایل responsive با تب‌های کامل (Prices, My Assets, Alerts, Advanced Chart, Create)
- My Assets: لیست دارایی‌های منحصربه‌فرد با تعداد هشدار + آخرین قیمت + دکمه اقدام
- Suggestions: فیلتر unwatched + دکمه "شروع هشدار" با prefill wizard
- چارت پیشرفته: انتخاب چند-دارایی + دکمه‌های بازه 1d/7d/30d/90d + Chart.js کامل (dark، grid، multi-line)
- بات: کیبورد غنی + دکمه web_app به TWA + بهبود "هشدارهای من" به asset-summary + قیمت زنده + CTA به TWA
- ingest واقعی (Binance + TGJU)، GitHub Action، health، backup، PM2 + nginx + cert برای subdomain

**گام‌های بعدی فوری (مطابق موج اول گزارش):** 
- مستندسازی رسمی سیاست‌ها (Asset Identity، Pricing Presentation، Flow Contract و غیره) **DONE**: see docs/CONTRACTS_AND_POLICIES.md and src/novax_price_alert/domain/policies.py (codified for runtime use).
- تکمیل state machine کامل + locking + idempotency قوی در backend/worker. **DONE**.
- schema لاگ ساختاریافته + metricهای غنی + freshness status صریح. **DONE** (Redis + flush + more records + surface).
- audit کامل docs با runtime + walkthrough واقعی + runbook. **DONE** (tests executed, matrix updated, runbooks expanded, checklist created).

All remaining per priority list executed automatically (P0 first, then P1/P2). No stop. See todos and commits.

## چک‌لیست فازها برای Agent / تیم

- [x] فاز صفر: قراردادها (in docs/CONTRACTS_AND_POLICIES.md + code; partial in previous)
- [x] فاز یک: UX Clarity (flow مرحله‌ای + تایید + TWA/My Assets/Suggestions غنی انجام‌شده)
- [x] فاز دو: Reliability Hardening کامل (state/lifecycle/idempotency/locking + strengthened eval claim)
- [x] فاز سه: Observability + Freshness کامل (log/metric/trace/runbook + suggestions + redis metrics direction)
- [x] فاز چهار: Audit، Walkthrough، Release Readiness + baseline (docs aligned, tests/lint green, matrix in PROGRESS, deploy stable, RELEASE_CHECKLIST.md created, policies doc added)

## Milestoneها (M1 تا M5 از گزارش 06)

- M1: Contract Freeze (پایان Sprint 1)
- M2: UX Flow Approved
- M3: Core Runtime Hardened (duplicate risk مهار)
- M4: Observable & Freshness-Aware
- M5: Release Ready Hardening Build

## نحوه استفاده از این سند

- این فایل + PROGRESS.md + گزارش خارجی = منبع جهت‌دهی.
- هر T-xxx را به تیکت/PR تبدیل کنید و وقتی کامل شد علامت بزنید.
- Agent: فقط وقتی acceptance فاز فعلی پاس شد به بعدی بروید.
- قبل از هر feature بزرگ جدید، مطمئن شوید core hardening (به‌ویژه فاز ۰-۲) تثبیت شده باشد.

**این نقشه راه living است و باید بعد از هر تغییر مهم runtime یا incident به‌روز شود.**

## Final Production Deploy (2026-06-05)
- All 5 phases completed per report (P0-P2 tasks auto-executed).
- Final rsync + PM2 restart on VPS.
- Verified healthy: backend 200, TWA served, no impact on live sites.
- Push to GitHub succeeded.
- Project production-ready. 🎯

## Phase 5: Growth & Intelligence (Post-Hardening Backlog)
- PWA install + offline cache for TWA
- Portfolio tracking (holdings, P/L)
- Enhanced suggestions with volatility/std
- Prometheus metrics + richer client tracking (tab, suggestion, abandon)
- Production metrics fix (Redis hash)
- More UX polish and tests
All implemented in this auto-run for production readiness.
