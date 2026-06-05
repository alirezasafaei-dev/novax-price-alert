import { useState, FormEvent } from 'react';
import { Alert, Asset } from '../types';
import { formatPrice } from '../utils';
import { BellRing, Trash2, ToggleLeft, ToggleRight, CircleAlert, Clock, ArrowUpRight, ArrowDownRight, Plus, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AlertManagerProps {
  alerts: Alert[];
  alertLogs: { id: string; alertId: string; symbol: string; text: string; timestamp: string }[];
  assets: Asset[];
  language: 'fa' | 'en';
  onAddAlert: (alertData: {
    symbol: string;
    triggerType: 'UPPER' | 'LOWER';
    thresholdPrice: number;
    label: string;
    telegramUsername: string;
  }) => void;
  onDeleteAlert: (id: string) => void;
  onToggleAlert: (id: string) => void;
  selectedAssetForAlert: string | null;
  clearSelectedAsset: () => void;
}

// Convert Persian numbering characters to English for safety
function persianToEntDigits(str: string): string {
  const p = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const a = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  let cache = str;
  for (let i = 0; i < 10; i++) {
    cache = cache.replace(new RegExp(p[i], 'g'), a[i]);
  }
  return cache;
}

export default function AlertManager({
  alerts,
  alertLogs,
  assets,
  language,
  onAddAlert,
  onDeleteAlert,
  onToggleAlert,
  selectedAssetForAlert,
  clearSelectedAsset
}: AlertManagerProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(selectedAssetForAlert || 'BTC');
  const [triggerType, setTriggerType] = useState<'UPPER' | 'LOWER'>('UPPER');
  const [thresholdPrice, setThresholdPrice] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [telegramUsername, setTelegramUsername] = useState<string>('novax_user');
  const [errorText, setErrorText] = useState<string>('');

  const isFa = language === 'fa';
  const activeAsset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorText('');

    const rawNum = persianToEntDigits(thresholdPrice).trim();
    if (!rawNum || isNaN(Number(rawNum)) || Number(rawNum) <= 0) {
      setErrorText(isFa ? 'لطفاً یک قیمت هدف معتبر وارد کنید.' : 'Please enter a valid target price.');
      return;
    }

    onAddAlert({
      symbol: selectedSymbol,
      triggerType,
      thresholdPrice: Number(rawNum),
      label: label.trim() || (isFa ? `هدف ${activeAsset.nameFa}` : `Target ${activeAsset.name}`),
      telegramUsername: telegramUsername.trim() || 'novax_user'
    });

    // Reset fields
    setThresholdPrice('');
    setLabel('');
    clearSelectedAsset();
  };

  return (
    <div id="alert-manager" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: Alert Creation Form */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl h-fit">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <BellRing size={20} className="text-teal-400" />
          {isFa ? 'افزودن هشدار جدید' : 'Set New Alert'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Select Asset */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              {isFa ? 'انتخاب دارایی:' : 'Select Asset:'}
            </label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500/50 text-sm font-semibold cursor-pointer"
            >
              {assets.map((asset) => (
                <option key={asset.symbol} value={asset.symbol}>
                  {isFa ? asset.nameFa : asset.name} ({asset.symbol}) - {formatPrice(asset.price, asset.type)}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger Condition Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              {isFa ? 'شرط ماشه قیمت:' : 'Trigger Type:'}
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setTriggerType('UPPER')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  triggerType === 'UPPER'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-md'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <ArrowUpRight size={14} />
                {isFa ? 'افزایش قیمت به بالایی' : 'Rises Above'}
              </button>
              <button
                type="button"
                onClick={() => setTriggerType('LOWER')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  triggerType === 'LOWER'
                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-md'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <ArrowDownRight size={14} />
                {isFa ? 'کاهش قیمت به پایینی' : 'Drops Below'}
              </button>
            </div>
          </div>

          {/* Target Price Index */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              {isFa ? `قیمت هدف (به ${activeAsset.type === 'crypto' ? 'دلار USD' : 'تومان'}):` : `Target Threshold Price (${activeAsset.type === 'crypto' ? 'USD' : 'Toman'}):`}
            </label>
            <div className="relative">
              <input
                id="field-target-price"
                type="text"
                placeholder={activeAsset.type === 'crypto' ? 'e.g. 70000' : 'مثلاً 62000'}
                value={thresholdPrice}
                onChange={(e) => setThresholdPrice(persianToEntDigits(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500/50 font-mono text-sm leading-none"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs font-bold text-zinc-500 uppercase">
                {activeAsset.type === 'crypto' ? 'USD' : 'IRT'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1 py-0.5">
              {isFa ? `قیمت فعلی: ${formatPrice(activeAsset.price, activeAsset.type)}` : `Current Rate: ${formatPrice(activeAsset.price, activeAsset.type)}`}
            </p>
          </div>

          {/* Form alert label */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              {isFa ? 'برچسب یا توضیح هشدار (اختیاری):' : 'Custom Note/Label (optional):'}
            </label>
            <input
              id="field-alert-label"
              type="text"
              placeholder={isFa ? 'مثال: خرید پله‌ای طلا' : 'e.g. Accumulate BNB'}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500/50 text-sm"
            />
          </div>

          {/* Telegram mock sync handle */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              {isFa ? 'آیدی عددی یا کاربری تلگرام (برای ارسال):' : 'Telegram Handle:'}
            </label>
            <input
              id="field-tg-username"
              type="text"
              placeholder="@e.g. User"
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500/50 text-sm font-mono"
            />
          </div>

          {errorText && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 font-semibold">
              <CircleAlert size={14} />
              {errorText}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-1.5 text-sm"
          >
            <Plus size={16} />
            {isFa ? 'ثبت و همگام‌سازی موقت' : 'Save & Register Alert'}
          </button>
        </form>
      </div>

      {/* CENTER & RIGHT: Registered Alarms and Live Logs */}
      <div className="lg:col-span-2 space-y-6">
        {/* Active Alerts List */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono mb-4">
            🔥 {isFa ? 'هشدارهای زنده فعال' : 'Registered Alarms'}
          </h3>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <div className="bg-slate-950/20 border border-slate-800/40 p-8 rounded-xl text-center text-zinc-500 text-xs">
                {isFa ? 'هیچ هشدار فعالی در حال حاضر وجود ندارد. یکی اضافه کنید!' : 'No registered alarms right now. Create one on the left!'}
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  id={`alert-card-${alert.id}`}
                  key={alert.id}
                  className={`bg-slate-950/40 border p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
                    alert.isTriggered 
                      ? 'border-emerald-500/30 bg-emerald-500/5' 
                      : alert.isActive 
                        ? 'border-slate-800/80 hover:border-slate-800' 
                        : 'border-slate-800/30 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                      alert.triggerType === 'UPPER' 
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    }`}>
                      {alert.triggerType === 'UPPER' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                        {isFa ? alert.assetNameFa : alert.assetName}
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono font-normal">
                          {alert.symbol}
                        </span>
                      </div>
                      <div className="text-zinc-400 text-xs mt-1 flex flex-wrap items-center gap-1">
                        <span>{isFa ? 'هدف:' : 'Threshold:'}</span>
                        <span className="font-mono text-zinc-200 font-semibold">
                          {formatPrice(alert.thresholdPrice, alert.isCrypto ? 'crypto' : 'fiat')}
                        </span>
                        {alert.label && (
                          <span className="text-zinc-500 text-[11px] font-normal italic">({alert.label})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side actions */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end border-t sm:border-0 border-slate-800/45 pt-2 sm:pt-0">
                    {alert.isTriggered ? (
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full flex items-center gap-1 font-mono">
                        <Clock size={11} />
                        {isFa ? 'ارسال شده' : 'Triggered'}
                      </span>
                    ) : (
                      <button
                        onClick={() => onToggleAlert(alert.id)}
                        className="text-zinc-400 hover:text-white transition-all cursor-pointer"
                        title={alert.isActive ? 'Pause' : 'Activate'}
                      >
                        {alert.isActive ? (
                          <div className="text-teal-400 flex items-center gap-1 text-xs">
                            <ToggleRight size={24} />
                            <span className="hidden sm:inline text-[10px] uppercase font-mono">{isFa ? 'فعال' : 'ON'}</span>
                          </div>
                        ) : (
                          <div className="text-zinc-600 flex items-center gap-1 text-xs">
                            <ToggleLeft size={24} />
                            <span className="hidden sm:inline text-[10px] uppercase font-mono">{isFa ? 'غیرفعال' : 'OFF'}</span>
                          </div>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteAlert(alert.id)}
                      className="p-1 px-2.5 rounded-lg text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer text-xs flex items-center gap-1"
                      title="Delete alert"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Telegram Push Trigger Logs */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/60 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider font-mono mb-4 flex items-center gap-1.5">
            <Terminal size={14} className="text-indigo-400" />
            {isFa ? 'گزارش وقایع و ربات ارسال‌امواج (Telegram Bot Logs)' : 'Telegram Trigger & Event Stream Logs'}
          </h3>

          <div className="bg-slate-950 p-4 border border-zinc-900 rounded-xl space-y-2 h-44 overflow-y-auto font-mono text-xs text-zinc-400 custom-scrollbar">
            {alertLogs.length === 0 ? (
              <div className="text-zinc-600 italic select-none h-full flex items-center justify-center p-4">
                {isFa ? 'در انتظار ماشه‌ی زنگ یا وب‌هوک قیمت...' : 'Waiting for price updates to exceed bounds...'}
              </div>
            ) : (
              alertLogs.map((log) => (
                <div key={log.id} className="border-b border-slate-900/50 pb-2 flex items-start gap-2 select-text">
                  <span className="text-zinc-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <p className="flex-1 text-zinc-300 leading-relaxed text-[11px] font-sans">
                    {log.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
