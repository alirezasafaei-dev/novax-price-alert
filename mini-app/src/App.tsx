import { useState, useEffect, useCallback, useRef } from 'react';
import { Asset, Alert, AlertLog } from './types';
import PriceBoard from './components/PriceBoard';
import AlertManager from './components/AlertManager';
import TelegramSimulator from './components/TelegramSimulator';
import AIChat from './components/AIChat';
import { formatPrice, toDisplayPrice } from './utils';
import { Coins, Bell, HelpCircle, Sparkles, X, Wifi, WifiOff, Globe, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/* ─── Toast notification system ─── */
interface Toast { id: string; text: string; type: 'success' | 'error' | 'info' }
let _toastId = 0;
interface PortfolioDraft { symbol: string; amount: string }

/* ─── Chime on alert trigger ─── */
function playChime() {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o1.type = 'sine'; o1.frequency.setValueAtTime(523.25, ctx.currentTime);
    o1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    o2.type = 'sine'; o2.frequency.setValueAtTime(659.25, ctx.currentTime);
    o2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o1.connect(g); o2.connect(g); g.connect(ctx.destination);
    o1.start(); o2.start(); o1.stop(ctx.currentTime + 0.5); o2.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close(), 600);
  } catch { /* silent */ }
}

/* ─── Confirm dialog ─── */
function ConfirmDialog({ open, title, message, onConfirm, onCancel, language }: {
  open: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void; language: 'fa' | 'en';
}) {
  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-white font-bold text-base mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer">
            {language === 'fa' ? 'انصراف' : 'Cancel'}
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all cursor-pointer">
            {language === 'fa' ? 'تأیید' : 'Confirm'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main App ─── */
export default function App() {
  const [activeTab, setActiveTab] = useState<'prices' | 'assets' | 'portfolio' | 'alerts' | 'chart' | 'ai' | 'vps'>('prices');
  const [language, setLanguage] = useState<'fa' | 'en'>('fa');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [selectedAssetForAlert, setSelectedAssetForAlert] = useState<string | null>(null);
  const [pushNotification, setPushNotification] = useState<{ id: string; text: string } | null>(null);
  const [useLiveData, setUseLiveData] = useState<boolean>(false);
  const [tgInitData, setTgInitData] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showConfirmDelete, setShowConfirmDelete] = useState<{ open: boolean; alertId: string | null }>({ open: false, alertId: null });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [portfolioDraft, setPortfolioDraft] = useState<PortfolioDraft>({ symbol: '', amount: '' });
  const prevLogLen = useRef(0);

  const isFa = language === 'fa';

  /* ── Toast helper ── */
  const showToast = useCallback((text: string, type: Toast['type'] = 'info') => {
    const id = `toast-${++_toastId}`;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  /* ── Backend base ── */
  const backendBase = ((import.meta as any).env?.VITE_NOVAX_API_BASE || (window as any).NOVAX_API_BASE || 'http://localhost:8001').replace(/\/$/, '');
  const liveHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tgInitData) h['X-Telegram-Init-Data'] = tgInitData;
    return h;
  };

  /* ── Mappers ── */
  const mapLiveAlert = (item: any): Alert => {
    const symbol = item.asset_code || item.symbol || item.asset_id;
    const isCrypto = String(item.target_price_display_unit || '').toUpperCase().includes('USDT') || String(symbol || '').includes('USDT');
    const state = String(item.lifecycle_state || '');
    return {
      id: item.id, symbol,
      assetName: item.asset_name || item.display_asset_name_at_creation || symbol,
      assetNameFa: item.asset_name || item.display_asset_name_at_creation || symbol,
      isCrypto,
      triggerType: String(item.condition_type || '').toUpperCase() === 'ABOVE' ? 'UPPER' : 'LOWER',
      thresholdPrice: Number(item.target_price),
      label: item.display_asset_name_at_creation || item.asset_name || symbol,
      isActive: Boolean(item.is_active),
      isTriggered: ['triggered', 'delivery_in_progress', 'delivered'].includes(state),
      createdAt: item.created_at || new Date().toISOString(),
      triggeredAt: item.triggered_at || item.last_triggered_at || undefined,
      telegramUsername: '',
      lifecycleState: state,
      unit: item.target_price_display_unit || '',
    };
  };

  const mapLiveEventToLog = (item: any): AlertLog => {
    const symbol = item.asset_code || 'UNKNOWN';
    const assetName = item.asset_name || symbol;
    const status = String(item.status || '').toLowerCase();
    const text = status === 'sent'
      ? `🔔 هشدار NovaX برای ${assetName} (${symbol}) با قیمت ${Number(item.triggered_price).toLocaleString('fa-IR')} ارسال شد.`
      : status === 'failed'
        ? `⚠️ ارسال هشدار ${assetName} (${symbol}) ناموفق بود.${item.error_message ? ` ${item.error_message}` : ''}`
        : `⏳ هشدار ${assetName} (${symbol}) در وضعیت ${status} ثبت شد.`;
    return { id: item.id, alertId: item.alert_id, symbol, text, timestamp: item.sent_at || item.triggered_at || new Date().toISOString() };
  };

  /* ── Fetch all data ── */
  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      let priceData: any[] = [];
      if (useLiveData) {
        const pRes = await fetch(`${backendBase}/api/v1/prices/latest`);
        if (pRes.ok) {
          const envelope = await pRes.json();
          const items = envelope.items || envelope;
          priceData = (items || []).map((it: any) => {
            const rawPrice = Number(it.price_value || it.price);
            const unit = it.display_unit || it.currency_code || '';
            const normalizedUnit = unit.toUpperCase();
            // Convert IRR to Toman for Iranian market prices
            const displayPrice = normalizedUnit === 'IRT' || normalizedUnit === 'IRR' ? rawPrice / 10 : rawPrice;
            return {
              symbol: it.asset_code || it.symbol,
              name: it.asset_name || it.name || it.asset_code,
              nameFa: it.asset_name || it.name || it.asset_code,
              price: displayPrice,
              type: (it.currency_code || it.display_unit || '').toUpperCase().includes('USDT') || (it.asset_code || '').toUpperCase().includes('USDT') ? 'crypto' : 'fiat',
              unit: normalizedUnit === 'IRT' || normalizedUnit === 'IRR' ? 'TOMAN' : unit,
              change24h: 0,
              history: Array.from({ length: 12 }, (_, index) => {
                const base = displayPrice;
                const variance = base * 0.008;
                return Math.max(0, base - variance + ((variance * 2) / 11) * index);
              }),
            };
          });
        }
      } else {
        const pRes = await fetch('/api/prices');
        if (pRes.ok) priceData = await pRes.json();
      }
      if (priceData.length > 0) setAssets(priceData);

      if (useLiveData && tgInitData) {
        const aRes = await fetch(`${backendBase}/api/v1/alerts`, { headers: liveHeaders() });
        if (aRes.ok) { const d = await aRes.json(); setAlerts((d.items || []).map(mapLiveAlert)); }
        const lRes = await fetch(`${backendBase}/api/v1/alerts/events`, { headers: liveHeaders() });
        if (lRes.ok) {
          const d = await lRes.json();
          const mapped = (d.items || []).map(mapLiveEventToLog);
          if (mapped.length > prevLogLen.current && prevLogLen.current > 0) {
            playChime();
            setPushNotification({ id: mapped[0].id, text: mapped[0].text });
            setTimeout(() => setPushNotification(null), 6000);
          }
          prevLogLen.current = mapped.length;
          setAlertLogs(mapped);
        }
      } else {
        const aRes = await fetch('/api/alerts');
        if (aRes.ok) setAlerts(await aRes.json());
        const lRes = await fetch('/api/alerts/logs');
        if (lRes.ok) {
          const d = await lRes.json();
          if (d.length > prevLogLen.current && prevLogLen.current > 0) {
            playChime();
            setPushNotification({ id: d[0].id, text: d[0].text });
            setTimeout(() => setPushNotification(null), 6000);
          }
          prevLogLen.current = d.length;
          setAlertLogs(d);
        }
      }
      setIsOnline(true);
    } catch (e) {
      setIsOnline(false);
      console.warn('Network sync warning:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    try { const tg = (window as any).Telegram?.WebApp; if (tg?.initData) { setTgInitData(tg.initData); tg.expand?.(); } } catch { /* not in TG */ }
    fetchAllData();
    const timer = setInterval(fetchAllData, 4000);
    return () => clearInterval(timer);
  }, [useLiveData, tgInitData]);

  useEffect(() => { setMobileMenuOpen(false); }, [activeTab]);

  const toggleLiveData = () => { setUseLiveData(p => !p); setTimeout(() => fetchAllData(), 10); };
  const handleRetryConnection = () => { fetchAllData(); };

  /* ── Handlers ── */
  const handleAddAlert = async (alertData: { symbol: string; triggerType: 'UPPER' | 'LOWER'; thresholdPrice: number; label: string; telegramUsername: string }) => {
    try {
      let alertId = '';
      if (useLiveData && tgInitData) {
        // Live mode: create alert, then confirm it
        const createRes = await fetch(`${backendBase}/api/v1/alerts`, {
          method: 'POST', headers: liveHeaders(),
          body: JSON.stringify({ asset_code: alertData.symbol, condition_type: alertData.triggerType === 'UPPER' ? 'above' : 'below', target_price: alertData.thresholdPrice, cooldown_minutes: 60 }),
        });
        if (!createRes.ok) {
          const errorText = await createRes.text();
          console.error('Create alert failed:', errorText);
          throw new Error(errorText || 'Create failed');
        }
        const created = await createRes.json();
        alertId = created.id;
        // Confirm the alert to activate it
        const confirmRes = await fetch(`${backendBase}/api/v1/alerts/${alertId}/confirm`, { method: 'POST', headers: liveHeaders() });
        if (!confirmRes.ok) {
          console.error('Confirm alert failed:', await confirmRes.text());
          throw new Error('Confirm failed');
        }
      } else {
        // Simulation mode
        const res = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alertData) });
        if (!res.ok) throw new Error('Create failed');
      }
      fetchAllData();
      setActiveTab('alerts');
      showToast(isFa ? 'هشدار جدید با موفقیت ایجاد شد ✓' : 'New alert created successfully ✓', 'success');
    } catch (e) {
      console.error('Alert creation error:', e);
      showToast(isFa ? 'خطا در ایجاد هشدار. لطفاً دوباره تلاش کنید.' : 'Failed to create alert. Please try again.', 'error');
      throw e; // Re-throw to let AlertManager handle the error state
    }
  };

  const handleDeleteAlert = (id: string) => { setShowConfirmDelete({ open: true, alertId: id }); };

  const handleDeleteAlertDirect = async (id: string) => {
    try {
      const res = useLiveData && tgInitData
        ? await fetch(`${backendBase}/api/v1/alerts/${id}`, { method: 'DELETE', headers: liveHeaders() })
        : await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAllData();
        showToast(isFa ? 'هشدار با موفقیت حذف شد' : 'Alert deleted successfully', 'info');
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      showToast(isFa ? 'خطا در حذف هشدار. لطفاً دوباره تلاش کنید.' : 'Failed to delete alert. Please try again.', 'error');
      throw error; // Re-throw to let AlertManager handle the error state
    }
  };
  const confirmDelete = async () => {
    const id = showConfirmDelete.alertId;
    if (!id) return;
    setShowConfirmDelete({ open: false, alertId: null });
    await handleDeleteAlertDirect(id);
  };

  const handleToggleAlert = async (id: string) => {
    try {
      const current = alerts.find(a => a.id === id);
      if (!current) return;
      const res = useLiveData && tgInitData
        ? await fetch(`${backendBase}/api/v1/alerts/${id}`, { method: 'PATCH', headers: liveHeaders(), body: JSON.stringify({ is_active: !current.isActive }) })
        : await fetch(`/api/alerts/${id}/toggle`, { method: 'PUT' });
      if (res.ok) {
        fetchAllData();
        showToast(isFa ? 'وضعیت هشدار با موفقیت تغییر کرد' : 'Alert status updated successfully', 'info');
      } else {
        throw new Error('Toggle failed');
      }
    } catch (error) {
      showToast(isFa ? 'خطا در تغییر وضعیت هشدار. لطفاً دوباره تلاش کنید.' : 'Failed to toggle alert. Please try again.', 'error');
      throw error; // Re-throw to let AlertManager handle the error state
    }
  };

  const handleEditAlert = async (id: string, thresholdPrice: number, label: string) => {
    const res = useLiveData && tgInitData
      ? await fetch(`${backendBase}/api/v1/alerts/${id}`, { method: 'PATCH', headers: liveHeaders(), body: JSON.stringify({ target_price: thresholdPrice }) })
      : await fetch(`/api/alerts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thresholdPrice, label }) });
    if (!res.ok) {
      showToast(isFa ? 'خطا در ویرایش هشدار' : 'Failed to edit alert', 'error');
      throw new Error('Edit failed');
    }
    fetchAllData();
    showToast(isFa ? 'هشدار ویرایش شد' : 'Alert updated', 'info');
  };

  const handleManualPriceChange = async (symbol: string, val: number) => {
    try {
      if (useLiveData) {
        await fetch(`${backendBase}/api/v1/prices/test/override-price`, { method: 'POST', headers: liveHeaders(), body: JSON.stringify({ symbol, price: val }) });
      } else {
        await fetch('/api/prices/trigger-manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, targetPrice: val }) });
      }
    } catch { /* silent */ }
  };

  const handleSelectAssetForAlert = (symbol: string) => { setSelectedAssetForAlert(symbol); setActiveTab('alerts'); };
  const handleSimulateFakePush = () => {
    setPushNotification({ id: `sim-${Math.random()}`, text: isFa ? '🔔 هشدار قیمت تستی: دارایی تتر به تومان (USDT_IRT) به مرز حمایتی ۵۹,۵۰۰ تومان رسید!' : '🔔 Mock Bot Alert: Tether / Toman (USDT_IRT) has violated lower boundary 59,500 Tomans!' });
    playChime();
    setTimeout(() => setPushNotification(null), 6000);
  };

  const watchedAssets = assets.filter(asset => alerts.some(alert => alert.symbol === asset.symbol));
  const portfolioHoldings = (() => {
    if (typeof window === 'undefined') return [] as Array<{ symbol: string; amount: number; asset?: Asset }>;
    try {
      const raw = window.localStorage.getItem('novax_portfolio');
      const parsed = raw ? JSON.parse(raw) : {};
      return Object.entries(parsed).map(([symbol, amount]) => ({
        symbol,
        amount: Number(amount),
        asset: assets.find(a => a.symbol === symbol),
      }));
    } catch {
      return [] as Array<{ symbol: string; amount: number; asset?: Asset }>;
    }
  })();
  const portfolioTotal = portfolioHoldings.reduce((sum, item) => {
    if (!item.asset) return sum;
    const multiplier = item.asset.type === 'crypto' ? item.asset.price : toDisplayPrice(item.asset.price, item.asset.unit || '');
    return sum + multiplier * item.amount;
  }, 0);
  const persistPortfolio = (next: Record<string, number>) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('novax_portfolio', JSON.stringify(next));
    fetchAllData();
  };
  const addPortfolioItem = () => {
    const symbol = portfolioDraft.symbol.trim().toUpperCase();
    const amount = Number(portfolioDraft.amount);
    if (!symbol || !amount || amount <= 0) {
      showToast(isFa ? 'نماد و مقدار معتبر وارد کنید.' : 'Enter a valid symbol and amount.', 'error');
      return;
    }
    const targetAsset = assets.find(asset => asset.symbol === symbol);
    if (!targetAsset) {
      showToast(isFa ? 'این دارایی در لیست قیمت‌ها پیدا نشد.' : 'Asset not found in current market list.', 'error');
      return;
    }
    const current = typeof window !== 'undefined' ? JSON.parse(window.localStorage.getItem('novax_portfolio') || '{}') : {};
    current[symbol] = Number(current[symbol] || 0) + amount;
    persistPortfolio(current);
    setPortfolioDraft({ symbol: '', amount: '' });
    showToast(isFa ? 'دارایی به پورتفولیو اضافه شد.' : 'Asset added to portfolio.', 'success');
  };
  const removePortfolioItem = (symbol: string) => {
    if (typeof window === 'undefined') return;
    const current = JSON.parse(window.localStorage.getItem('novax_portfolio') || '{}');
    delete current[symbol];
    persistPortfolio(current);
    showToast(isFa ? 'دارایی از پورتفولیو حذف شد.' : 'Asset removed from portfolio.', 'info');
  };

  /* ── Tab definitions ── */
  const tabs = [
    { id: 'prices' as const, icon: Coins, labelFa: 'تابلو قیمت‌ها', labelEn: 'Price Board' },
    { id: 'assets' as const, icon: Coins, labelFa: 'دارایی‌های من', labelEn: 'My Assets' },
    { id: 'portfolio' as const, icon: Coins, labelFa: 'پورتفولیو من', labelEn: 'My Portfolio' },
    { id: 'alerts' as const, icon: Bell, labelFa: 'مرکز هشدارها', labelEn: 'Alert Center' },
    { id: 'chart' as const, icon: Sparkles, labelFa: 'چارت پیشرفته', labelEn: 'Advanced Chart' },
    { id: 'ai' as const, icon: Sparkles, labelFa: 'تحلیل‌گر هوشمند', labelEn: 'AI Analyst' },
    { id: 'vps' as const, icon: HelpCircle, labelFa: 'مستندات استقرار', labelEn: 'VPS Docs' },
  ];

  return (
    <div className="min-h-screen bg-[#060814] text-white flex flex-col font-sans">

      {/* ── Push notification popup ── */}
      <AnimatePresence>
        {pushNotification && (
          <motion.div initial={{ opacity: 0, y: -80, scale: 0.95 }} animate={{ opacity: 1, y: 16, scale: 1 }} exit={{ opacity: 0, y: -40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed top-12 left-1/2 -translate-x-1/2 z-50 w-full max-w-[420px] px-4 cursor-pointer"
            onClick={() => setPushNotification(null)}>
            <div className="bg-[#181d33]/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 ring-2 ring-indigo-500/20">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                <Sparkles size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-sky-400 tracking-wide">@novax_price_bot</span>
                  <span className="text-[9px] font-mono text-zinc-500">{isFa ? 'الان' : 'now'}</span>
                </div>
                <p className="text-xs text-white leading-relaxed mt-1 font-medium truncate">{pushNotification.text}</p>
              </div>
              <button className="text-zinc-500 hover:text-white shrink-0 pointer-events-none"><X size={14} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast notifications ── */}
      <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg border backdrop-blur-md cursor-pointer
                ${t.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' : t.type === 'error' ? 'bg-rose-950/90 border-rose-500/30 text-rose-300' : 'bg-slate-800/90 border-slate-600/30 text-zinc-300'}`}
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Confirm delete dialog ── */}
      <ConfirmDialog open={showConfirmDelete.open}
        title={isFa ? 'حذف هشدار' : 'Delete Alert'}
        message={isFa ? 'آیا مطمئن هستید که می‌خواهید این هشدار را حذف کنید؟' : 'Are you sure you want to delete this alert?'}
        onConfirm={confirmDelete} onCancel={() => setShowConfirmDelete({ open: false, alertId: null })}
        language={language} />

      {/* ── Loading overlay ── */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#060814]/80 backdrop-blur-sm z-[200] flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
              <p className="text-zinc-400 text-sm font-medium">
                {isFa ? 'در حال دریافت اطلاعات...' : 'Loading data...'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main container ── */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col gap-5">

        {/* ── Upper HUD ── */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-950/45 border border-slate-900 rounded-2xl px-5 py-3.5 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500/20 to-sky-400/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-wider text-sky-400 uppercase">NOVAX STUDIO</span>
                {isOnline
                  ? <span className="flex items-center gap-1 text-[10px] text-emerald-400"><Wifi size={10} /> {isFa ? 'متصل' : 'Online'}</span>
                  : <span className="flex items-center gap-1 text-[10px] text-rose-400"><WifiOff size={10} /> {isFa ? 'قطع' : 'Offline'}</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-400 font-semibold">{isFa ? 'کاربر:' : 'User:'}</span>
                <span className="text-xs text-white font-bold font-mono">@novax_user</span>
                {!isOnline && (
                  <button
                    onClick={handleRetryConnection}
                    className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                  >
                    {isFa ? 'تلاش مجدد' : 'Retry'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="hidden md:block text-lg font-black bg-gradient-to-r from-teal-400 via-indigo-400 to-indigo-500 bg-clip-text text-transparent uppercase tracking-wider">
            NOVAX ALERT STUDIO
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            <button onClick={() => setLanguage(language === 'fa' ? 'en' : 'fa')}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs px-3 py-2 rounded-xl transition-all font-semibold text-zinc-300 cursor-pointer">
              <Globe size={13} /> {isFa ? 'EN' : 'FA'}
            </button>
            <button onClick={toggleLiveData}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition-all font-semibold cursor-pointer border ${useLiveData ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-zinc-300'}`}>
              <Wifi size={13} /> {useLiveData ? (isFa ? 'واقعی' : 'LIVE') : (isFa ? 'شبیه‌سازی' : 'SIM')}
            </button>
          </div>
        </div>

        {/* ── Tab navigation — desktop ── */}
        <div className="hidden md:flex gap-2 bg-slate-950/60 border border-slate-900 p-1.5 rounded-2xl">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold transition-all text-xs tracking-wide shrink-0 cursor-pointer
                ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-teal-500/15 via-indigo-500/15 to-indigo-600/10 border border-teal-500/30 text-teal-300 shadow-xl'
                  : 'text-zinc-500 hover:text-zinc-300'}`}>
              <tab.icon size={14} /> {isFa ? tab.labelFa : tab.labelEn}
            </button>
          ))}
        </div>

        {/* ── Tab navigation — mobile dropdown ── */}
        <div className="md:hidden relative">
          <button onClick={() => setMobileMenuOpen(p => !p)}
            className="w-full flex items-center justify-between bg-slate-950/60 border border-slate-900 rounded-2xl px-4 py-3 cursor-pointer">
            <span className="flex items-center gap-2 text-sm font-bold text-teal-300">
              {(() => { const t = tabs.find(x => x.id === activeTab)!; return <t.icon size={14} />; })()}
              {isFa ? tabs.find(x => x.id === activeTab)!.labelFa : tabs.find(x => x.id === activeTab)!.labelEn}
            </span>
            <ChevronDown size={16} className={`text-zinc-400 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-40 overflow-hidden">
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all cursor-pointer
                      ${activeTab === tab.id ? 'bg-teal-500/10 text-teal-300' : 'text-zinc-400 hover:bg-slate-800 hover:text-white'}`}>
                    <tab.icon size={16} /> {isFa ? tab.labelFa : tab.labelEn}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Screen viewport ── */}
        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {activeTab === 'prices' && (
              <motion.div key="prices" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}>
                <PriceBoard assets={assets} language={language} onSelectAssetForAlert={handleSelectAssetForAlert} onManualTriggerPrice={handleManualPriceChange} />
              </motion.div>
            )}
            {activeTab === 'alerts' && (
              <motion.div key="alerts" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}>
                <AlertManager alerts={alerts} alertLogs={alertLogs} assets={assets} language={language}
                  onAddAlert={handleAddAlert} onDeleteAlert={handleDeleteAlertDirect} onToggleAlert={handleToggleAlert} onEditAlert={handleEditAlert}
                  selectedAssetForAlert={selectedAssetForAlert} clearSelectedAsset={() => setSelectedAssetForAlert(null)} />
              </motion.div>
            )}
            {activeTab === 'assets' && (
              <motion.div key="assets" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}
                className="grid gap-4">
                {watchedAssets.length === 0 ? <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-zinc-400">{isFa ? 'هنوز داراییِ دارای هشدار ندارید.' : 'No watched assets yet.'}</div> :
                  watchedAssets.map(asset => (
                    <div key={asset.symbol} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4">
                      <div><div className="font-bold text-white">{isFa ? asset.nameFa : asset.name}</div><div className="text-zinc-400 text-sm">{formatPrice(asset.price, asset.type, asset.unit)}</div></div>
                      <button onClick={() => handleSelectAssetForAlert(asset.symbol)} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white">{isFa ? 'ساخت/مدیریت هشدار' : 'Manage Alerts'}</button>
                    </div>
                  ))}
              </motion.div>
            )}
            {activeTab === 'portfolio' && (
              <motion.div key="portfolio" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}
                className="grid gap-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                  <div className="text-zinc-400 text-sm mb-2">{isFa ? 'ارزش تقریبی کل پورتفولیو' : 'Estimated portfolio value'}</div>
                  <div className="text-2xl font-bold text-white">{portfolioTotal.toLocaleString(isFa ? 'fa-IR' : 'en-US')} {isFa ? 'تومان' : 'Toman'}</div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-[1fr,180px,auto] gap-3 items-end">
                  <div>
                    <div className="text-xs font-semibold text-zinc-400 mb-2">{isFa ? 'نماد دارایی' : 'Asset Symbol'}</div>
                    <input value={portfolioDraft.symbol} onChange={e => setPortfolioDraft(prev => ({ ...prev, symbol: e.target.value }))} placeholder={isFa ? 'مثال: BTC یا USD_IRT' : 'e.g. BTC or USD_IRT'} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-400 mb-2">{isFa ? 'مقدار' : 'Amount'}</div>
                    <input value={portfolioDraft.amount} onChange={e => setPortfolioDraft(prev => ({ ...prev, amount: e.target.value }))} placeholder="0.5" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none" />
                  </div>
                  <button onClick={addPortfolioItem} className="rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 px-5 py-3 text-sm font-bold text-white cursor-pointer">{isFa ? 'افزودن' : 'Add'}</button>
                </div>
                {portfolioHoldings.length === 0 ? <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-zinc-400">{isFa ? 'هنوز چیزی در پورتفولیو ذخیره نشده.' : 'No portfolio items saved yet.'}</div> :
                  portfolioHoldings.map(item => <div key={item.symbol} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4"><div><div className="font-bold text-white">{item.symbol}</div><div className="text-zinc-400 text-sm">{item.amount}</div></div><div className="flex items-center gap-3"><div className="text-teal-300 font-bold">{item.asset ? formatPrice((item.asset.type === 'crypto' ? item.asset.price : toDisplayPrice(item.asset.price, item.asset.unit || '')) * item.amount, item.asset.type === 'crypto' ? 'crypto' : 'fiat', item.asset.type === 'crypto' ? 'USDT' : 'TOMAN') : '-'}</div><button onClick={() => removePortfolioItem(item.symbol)} className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 cursor-pointer">{isFa ? 'حذف' : 'Remove'}</button></div></div>)}
              </motion.div>
            )}
            {activeTab === 'chart' && (
              <motion.div key="chart" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}>
                <PriceBoard assets={assets} language={language} onSelectAssetForAlert={handleSelectAssetForAlert} onManualTriggerPrice={handleManualPriceChange} mode="chart" />
              </motion.div>
            )}
            {activeTab === 'ai' && (
              <motion.div key="ai" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}>
                <AIChat assets={assets} language={language} />
              </motion.div>
            )}
            {activeTab === 'vps' && (
              <motion.div key="vps" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}>
                <TelegramSimulator language={language} onSimulateFakeNotification={handleSimulateFakePush} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="w-full bg-[#03050c] border-t border-slate-950 py-5 text-zinc-500 text-xs text-center mt-auto select-none">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>&copy; 2026 NovaX Price Alert. Crafted to perfection.</div>
          <div className="flex gap-4 font-mono text-[11px]">
            <a href="https://github.com/alirezasafaei-dev/novax-price-alert" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
            <span>&bull;</span>
            <a href="https://t.me/novax_price_bot" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">@novax_price_bot</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
