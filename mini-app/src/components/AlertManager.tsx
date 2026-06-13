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
  }) => Promise<void>;
  onDeleteAlert: (id: string) => Promise<void>;
  onToggleAlert: (id: string) => Promise<void>;
  onEditAlert?: (id: string, thresholdPrice: number, label: string) => Promise<void>;
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
  onEditAlert,
  selectedAssetForAlert,
  clearSelectedAsset
}: AlertManagerProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(selectedAssetForAlert || 'BTC');
  const [triggerType, setTriggerType] = useState<'UPPER' | 'LOWER'>('UPPER');
  const [thresholdPrice, setThresholdPrice] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [telegramUsername, setTelegramUsername] = useState<string>('novax_user');
  const [errorText, setErrorText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editThresholdPrice, setEditThresholdPrice] = useState<string>('');
  const [editLabel, setEditLabel] = useState<string>('');

  const isFa = language === 'fa';
  const activeAsset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  const handleDelete = async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await onDeleteAlert(id);
    } catch (error) {
      console.error('Failed to delete alert:', error);
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleToggle = async (id: string) => {
    setTogglingIds(prev => new Set(prev).add(id));
    try {
      await onToggleAlert(id);
    } catch (error) {
      console.error('Failed to toggle alert:', error);
    } finally {
      setTogglingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const startEdit = (alert: Alert) => {
    setEditingId(alert.id);
    setEditThresholdPrice(String(alert.thresholdPrice));
    setEditLabel(alert.label || '');
  };

  const saveEdit = async (alert: Alert) => {
    if (!onEditAlert) return;
    const rawNum = persianToEntDigits(editThresholdPrice).trim();
    if (!rawNum || isNaN(Number(rawNum)) || Number(rawNum) <= 0) {
      setErrorText(isFa ? 'قیمت جدید معتبر نیست.' : 'Invalid new target.');
      return;
    }
    await onEditAlert(alert.id, Number(rawNum), editLabel.trim());
    setEditingId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessMessage('');

    const rawNum = persianToEntDigits(thresholdPrice).trim();
    if (!rawNum || isNaN(Number(rawNum)) || Number(rawNum) <= 0) {
      setErrorText(isFa ? 'لطفاً یک قیمت هدف معتبر وارد کنید.' : 'Please enter a valid target price.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddAlert({
        symbol: selectedSymbol,
        triggerType,
        thresholdPrice: Number(rawNum),
        label: label.trim() || (isFa ? `هدف ${activeAsset.nameFa}` : `Target ${activeAsset.name}`),
        telegramUsername: telegramUsername.trim() || 'novax_user'
      });

      // Show success message
      setSuccessMessage(isFa ? '✓ هشدار جدید با موفقیت ثبت شد' : '✓ New alert created successfully');

      // Reset fields
      setThresholdPrice('');
      setLabel('');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorText(isFa ? 'خطا در ثبت هشدار. لطفاً دوباره تلاش کنید.' : 'Error creating alert. Please try again.');
    } finally {
      setIsSubmitting(false);
      clearSelectedAsset();
    }
  };

  return (
    <div id="alert-manager" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: Alert Creation Form */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl h-fit">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <BellRing size={20} className="text-teal-400" />
          {isFa ? 'ایجاد هشدار جدید' : 'Create New Alert'}
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
                  {isFa ? asset.nameFa : asset.name} ({asset.symbol}) - {formatPrice(asset.price, asset.type, asset.unit)}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger Condition Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              {isFa ? 'شرط فعال‌سازی:' : 'Trigger Type:'}
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
                {isFa ? 'افزایش به بالای هدف' : 'Rises Above'}
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
                {isFa ? 'کاهش به پایین هدف' : 'Drops Below'}
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
              {isFa ? `قیمت فعلی: ${formatPrice(activeAsset.price, activeAsset.type, activeAsset.unit)}` : `Current Rate: ${formatPrice(activeAsset.price, activeAsset.type, activeAsset.unit)}`}
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

          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 font-semibold">
              <span>✓</span>
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-1.5 text-sm ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                {isFa ? 'در حال ثبت...' : 'Creating...'}
              </>
            ) : (
              <>
                <Plus size={16} />
                {isFa ? 'ثبت هشدار' : 'Create Alert'}
              </>
            )}
          </button>
        </form>
      </div>

      {/* CENTER & RIGHT: Registered Alarms and Live Logs */}
      <div className="lg:col-span-2 space-y-6">
        {/* Active Alerts List */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono mb-4">
            🔥 {isFa ? 'هشدارهای فعال' : 'Active Alerts'}
          </h3>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <div className="bg-slate-950/20 border border-slate-800/40 p-8 rounded-xl text-center text-zinc-500 text-xs">
                {isFa ? 'هیچ هشدار فعالی ندارید. یک هشدار جدید بسازید!' : 'No active alerts. Create one on the left!'}
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
                        <span>{isFa ? 'هدف:' : 'Target:'}</span>
                        <span className="font-mono text-zinc-200 font-semibold">
                          {formatPrice(alert.thresholdPrice, alert.isCrypto ? 'crypto' : 'fiat', alert.unit)}
                        </span>
                        {alert.label && (
                          <span className="text-zinc-500 text-[11px] font-normal italic">({alert.label})</span>
                        )}
                      </div>
                      {editingId === alert.id && (
                        <div className="mt-3 space-y-2">
                          <input value={editThresholdPrice} onChange={(e) => setEditThresholdPrice(persianToEntDigits(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm" />
                          <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-sm" />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => saveEdit(alert)} className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white">{isFa ? 'ذخیره' : 'Save'}</button>
                            <button type="button" onClick={() => setEditingId(null)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-zinc-300">{isFa ? 'انصراف' : 'Cancel'}</button>
                          </div>
                        </div>
                      )}
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
                        onClick={() => handleToggle(alert.id)}
                        disabled={togglingIds.has(alert.id)}
                        className={`text-zinc-400 hover:text-white transition-all cursor-pointer ${
                          togglingIds.has(alert.id) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title={alert.isActive ? 'Pause' : 'Activate'}
                      >
                        {togglingIds.has(alert.id) ? (
                          <div className="flex items-center gap-1 text-xs">
                            <div className="animate-spin w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full" />
                          </div>
                        ) : alert.isActive ? (
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

                    {onEditAlert && (
                      <button
                        onClick={() => startEdit(alert)}
                        className="p-1 px-2.5 rounded-lg text-sky-400/80 hover:text-sky-300 hover:bg-sky-500/10 transition-all cursor-pointer text-xs flex items-center gap-1"
                        title="Edit alert"
                      >
                        {isFa ? 'ویرایش' : 'Edit'}
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(alert.id)}
                      disabled={deletingIds.has(alert.id)}
                      className={`p-1 px-2.5 rounded-lg text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer text-xs flex items-center gap-1 ${
                        deletingIds.has(alert.id) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title="Delete alert"
                    >
                      {deletingIds.has(alert.id) ? (
                        <div className="animate-spin w-3 h-3 border-2 border-rose-600 border-t-rose-400 rounded-full" />
                      ) : (
                        <Trash2 size={14} />
                      )}
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
            {isFa ? 'گزارش وقایع هشدارها' : 'Alert Event Logs'}
          </h3>

          <div className="bg-slate-950 p-4 border border-zinc-900 rounded-xl space-y-2 h-44 overflow-y-auto font-mono text-xs text-zinc-400 custom-scrollbar">
            {alertLogs.length === 0 ? (
              <div className="text-zinc-600 italic select-none h-full flex items-center justify-center p-4">
                {isFa ? 'در انتظار وقوع هشدار...' : 'Waiting for alert events...'}
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
