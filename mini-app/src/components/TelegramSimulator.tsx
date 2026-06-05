import { useState } from 'react';
import { Smartphone, CheckCircle2, HardDrive, Terminal, ExternalLink, Cpu, Layers, Wifi, Bell, ShieldCheck } from 'lucide-react';

interface TelegramSimulatorProps {
  language: 'fa' | 'en';
  onSimulateFakeNotification: () => void;
}

export default function TelegramSimulator({ language, onSimulateFakeNotification }: TelegramSimulatorProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const isFa = language === 'fa';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const envText = `# Environment configurations for VPS deployment
TELEGRAM_BOT_TOKEN="your_bot_token_here"
BINANCE_API_URL="https://api.binance.com"
TGJU_PROVIDER_URL="https://tgju.org"
EVALUATION_CRON="*/10 * * * *"
DB_PATH="./data/alerts.db"`;

  return (
    <div id="vps-hub" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: System Health & Crawler States */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
            <Layers size={12} className="text-teal-400" />
            {isFa ? 'مانیتورینگ توزیع‌شده' : 'DISTRIBUTED ARCHITECTURE'}
          </span>
          <h3 className="text-lg font-bold text-white mt-1">
            🖥️ {isFa ? 'وضعیت پلتفرم و رله‌ها' : 'System Health Monitor'}
          </h3>
        </div>

        {/* Dynamic Status indicators */}
        <div className="space-y-4">
          <div className="bg-slate-950 p-4 border border-slate-800/60 rounded-xl space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              {isFa ? 'عامل‌ها و ورودی‌ها (Crawlers):' : 'Active Crawlers:'}
            </h4>

            {/* Binance */}
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-2 text-zinc-300">
                <Wifi size={12} className="text-emerald-400 animate-pulse" />
                Binance USDT Feed
              </span>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold font-mono">
                {isFa ? 'متصل' : 'ONLINE'}
              </span>
            </div>

            {/* TGJU */}
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-2 text-zinc-300">
                <Wifi size={12} className="text-emerald-400 animate-pulse" />
                TGJU Toman Feed
              </span>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold font-mono">
                {isFa ? 'متصل' : 'ONLINE'}
              </span>
            </div>

            {/* Bot webhook */}
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-2 text-zinc-300">
                <HardDrive size={12} className="text-violet-400" />
                Telegram Webhook Relay
              </span>
              <span className="bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full font-bold font-mono">
                {isFa ? 'فعال' : 'READY'}
              </span>
            </div>
          </div>

          <div className="bg-slate-950 p-4 border border-slate-800/60 rounded-xl space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              {isFa ? 'بررسی‌کننده هشدارها (Worker Loop):' : 'Alert Evaluation worker:'}
            </h4>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-2 text-zinc-300 font-mono">
                Cron Jobs (10-Min Cycle)
              </span>
              <span className="text-zinc-400 font-mono">Idle (Standby)</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div className="bg-teal-500 h-1.5 rounded-full w-[45%] animate-pulse" />
            </div>
          </div>
        </div>

        {/* Telegram Sandbox Interactive Push CTA */}
        <div className="bg-gradient-to-br from-indigo-950/20 to-slate-900/30 p-4 border border-indigo-500/20 rounded-xl space-y-3">
          <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1">
            <Bell size={12} />
            {isFa ? 'تست اعلان فشاری تلگرام' : 'Sandbox Telegram Notifier'}
          </h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {isFa 
              ? 'با کلیک روی دکمه زیر می‌توانید دریافت پوش‌نوتیفیکیشن یا پیام اخطار ربات تلگرام را فوراً شبیه‌سازی کنید!'
              : 'Click below to dispatch an instant mock push notification mimicking Telegram bot delivery service.'}
          </p>
          <button
            onClick={onSimulateFakeNotification}
            className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex justify-center items-center gap-1.5"
          >
            <Smartphone size={13} />
            {isFa ? 'تست ارسال پیام ربات' : 'Simulate Bot Alert Notification'}
          </button>
        </div>
      </div>

      {/* CENTER & RIGHT: VPS Specs, Architecture details and Deployment sync */}
      <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
            <Cpu size={12} />
            {isFa ? 'مستندات و همگام‌سازی هاست' : 'VPS HOSTING & BOT SYNC'}
          </span>
          <h3 className="text-lg font-bold text-white mt-1">
            🚀 {isFa ? 'راهنمای راه‌اندازی و اتصال بات به مینی اپ' : 'NovaX Connection & Hosting Manual'}
          </h3>
        </div>

        {/* Bilingual Tabular Manual */}
        <div className="space-y-4">
          <p className="text-sm text-zinc-300 leading-relaxed">
            {isFa
              ? 'این مینی‌اپ فریم‌ورک ایده‌آلی برای نمایش زنده و ثبت هشدارها برای کاربران ربات شما فراهم می‌کند. کدهای ربات و ورکر تلگرامی شما به طور کامل در ریپازیتوری بالا قرار دارد. برای اتصال این مینی‌اپ به دیتابیس ربات خود، مراحل زیر را طی کنید:'
              : 'This Telegram Mini App layout acts as a premier client for your price alerter. Your Python/TypeScript bot files live inside your VPS host. To bind your live production bot to this mini app web experience, synchronize using standard Web APIs:'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 border border-zinc-900 rounded-xl space-y-2">
              <span className="text-xs font-bold text-teal-400 flex items-center gap-1">
                <CheckCircle2 size={12} />
                {isFa ? '۱. راه‌اندازی ربات تلگرام (VPS)' : '1. Spin up Alerter Bot on VPS'}
              </span>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isFa 
                  ? 'کدها را روی سرور یا VPS خود کلون کنید. پوشه‌ی docs/DEPLOYMENT.md راهنمای جامع مستندات فارسی برای اجرای دائم با pm2 را ارائه می‌کند.'
                  : 'Clone files to your secure Ubuntu host. Follow docs/DEPLOYMENT.md instructions in the repository to establish daemon workflows with pm2.'}
              </p>
            </div>

            <div className="bg-slate-950 p-4 border border-zinc-900 rounded-xl space-y-2">
              <span className="text-xs font-bold text-teal-400 flex items-center gap-1">
                <CheckCircle2 size={12} />
                {isFa ? '۲. راه‌اندازی وب‌هوک (Webhook Sync)' : '2. Bind Mini App via Webhook API'}
              </span>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isFa 
                  ? 'یک متغیر وب‌هوک تعریف کنید تا فیلترهای هشدار فورا ثبت شوند. وقتی کاربر کلید "ثبت هشدار جدید" را می‌زند، آدرس رله ربات تلگرامی را فراخوانی می‌کند.'
                  : 'Enable an API endpoint on your server block. When users tap "Create Custom Alert", it publishes JSON payload directly to your bot scheduler.'}
              </p>
            </div>
          </div>

          {/* Config Copy Area */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
              <span>{isFa ? 'تنظیمات فایل محیطی (.env):' : '.env file specs:'}</span>
              <button
                onClick={() => copyToClipboard(envText, 'env')}
                className="text-[11px] font-mono text-zinc-500 hover:text-white transition-all cursor-pointer flex items-center gap-1"
              >
                {copied === 'env' ? (
                  <span className="text-teal-400 shrink-0 font-sans">کپی شد! ✓</span>
                ) : (
                  <span className="shrink-0 font-sans">کپی کردن 📋</span>
                )}
              </button>
            </div>

            <div className="relative">
              <pre className="bg-slate-950/80 text-zinc-300 p-4 rounded-xl text-xs font-mono overflow-x-auto border border-zinc-900 select-all selection:bg-indigo-500/20 select-text leading-relaxed">
                {envText}
              </pre>
            </div>
          </div>

          {/* Git links and deployment statuses */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-950 p-4 border border-slate-800/50 rounded-xl gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-teal-400" />
              <span className="text-xs font-semibold text-white">
                {isFa ? 'پروژه متن‌باز و تایید شده در گیت‌هاب' : 'Open Source verified repository'}
              </span>
            </div>
            <div className="flex gap-2">
              <a
                href="https://github.com/alirezasafaei-dev/novax-price-alert"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-bold"
              >
                Repo <ExternalLink size={12} />
              </a>
              <span className="text-zinc-600">|</span>
              <a
                href="https://t.me/novax_price_bot"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 font-bold"
              >
                @novax_price_bot <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
