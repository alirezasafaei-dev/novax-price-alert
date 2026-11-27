import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Asset, Alert, AlertLog } from './types';
import PriceBoard from './components/PriceBoard';
import AlertManager from './components/AlertManager';

import AIChat from './components/AIChat';
import { formatPrice, toDisplayPrice } from './utils';
import { Coins, Bell, Sparkles, X, Wifi, WifiOff, Globe, MoreHorizontal, Wallet, TrendingUp, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/* ─── Toast notification system ─── */
interface Toast { id: string; text: string; type: 'success' | 'error' | 'info' }
let _toastId = 0;
interface PortfolioDraft { symbol: string; amount: string }
interface TelegramWebAppUser {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}
interface SubscriptionStatus {
  plan: 'free' | 'pro';
  alert_limit: number;
  active_alert_count: number;
  check_interval_seconds: number;
  subscription_expires_at: string | null;
  pro_price_toman: number;
  payment_instructions: string | null;
}

function isLocalHost() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

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
  const [activeTab, setActiveTab] = useState<'prices' | 'assets' | 'portfolio' | 'alerts' | 'chart' | 'ai'>('prices');
  const [bottomMenuOpen, setBottomMenuOpen] = useState<boolean>(false);
  const [language, setLanguage] = useState<'fa' | 'en'>('fa');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [selectedAssetForAlert, setSelectedAssetForAlert] = useState<string | null>(null);
  const [pushNotification, setPushNotification] = useState<{ id: string; text: string } | null>(null);
  const [useLiveData, setUseLiveData] = useState<boolean>(() => !isLocalHost());
  const [tgInitData, setTgInitData] = useState<string>('');
  const [tgUser, setTgUser] = useState<TelegramWebAppUser | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showConfirmDelete, setShowConfirmDelete] = useState<{ open: boolean; alertId: string | null }>({ open: false, alertId: null });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [portfolioDraft, setPortfolioDraft] = useState<PortfolioDraft>({ symbol: '', amount: '' });
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const assetsRef = useRef<Asset[]>([]);
  const hasLoadedOnce = useRef(false);
  const isFetchingRef = useRef(false);
  const lastHistoryFetchRef = useRef(0);
  const prevLogLen = useRef(0);

  const isFa = language === 'fa';

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  /* ── Toast helper ── */
  const showToast = useCallback((text: string, type: Toast['type'] = 'info') => {
    const id = `toast-${++_toastId}`;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  /* ── Backend base ── */
  const resolveBackendBase = () => {
    const runtimeOverride = (window as any).NOVAX_API_BASE;
    if (runtimeOverride) return String(runtimeOverride).replace(/\/$/, '');

    const envOverride = import.meta.env.VITE_NOVAX_API_BASE;
    if (envOverride) return String(envOverride).replace(/\/$/, '');

    const currentOrigin = window.location.origin;
    if (!isLocalHost()) return currentOrigin.replace(/\/$/, '');

    return currentOrigin.replace(/\/$/, '');
  };
  const backendBase = resolveBackendBase();
  const liveHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tgInitData) h['X-Telegram-Init-Data'] = tgInitData;
    return h;
  };

  /* ── Mappers ── */
  const mapLiveAlert = (item: any): Alert => {
    const symbol = item.symbol || item.asset_code || item.asset_id;
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
    const symbol = item.symbol || item.asset_code || 'UNKNOWN';
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
  const fetchAllData = async (options: { showOverlay?: boolean; refreshHistory?: boolean } = {}) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const showOverlay = options.showOverlay ?? !hasLoadedOnce.current;
    const now = Date.now();
    const shouldRefreshHistory = options.refreshHistory ?? (!hasLoadedOnce.current || now - lastHistoryFetchRef.current > 60_000);
    try {
      if (showOverlay) setIsLoading(true);
      let priceData: any[] = [];
      if (useLiveData) {
        const pRes = await fetch(`${backendBase}/api/v1/prices/latest`);
        if (pRes.ok) {
          const envelope = await pRes.json();
          const items = envelope.items || envelope;
          priceData = (items || []).map((it: any) => {
            const rawPrice = Number(it.price_value || it.price);
            const unit = it.display_unit || it.currency_code || '';
            return {
              symbol: it.asset_code || it.symbol,
              name: it.asset_name || it.name || it.asset_code,
              nameFa: it.asset_name || it.name || it.asset_code,
              price: rawPrice,
              type: (it.currency_code || it.display_unit || '').toUpperCase().includes('USDT') || (it.asset_code || '').toUpperCase().includes('USDT') ? 'crypto' : 'fiat',
              unit,
              change24h: 0,
              change24hKnown: false,
              history: [],
            };
          });
          const existingHistoryMap = new Map(assetsRef.current.map((asset) => [asset.symbol, asset.history]));
          const historyMap = new Map<string, any[] | null>();
          if (shouldRefreshHistory) {
            const historyResponses = await Promise.all(
              priceData.map(async (asset) => {
                try {
                  const range = '1d';
                  const response = await fetch(`${backendBase}/api/v1/prices/history?asset_code=${encodeURIComponent(asset.symbol)}&limit=24&range=${range}`);
                  if (!response.ok) return [asset.symbol, null] as const;
                  const payload = await response.json();
                  const history = (payload.items || []).filter((item: any) => Number.isFinite(Number(item.price_value)) && Number(item.price_value) > 0 && Number.isFinite(Date.parse(item.observed_at))).slice().sort((a: any, b: any) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime());
                  return [asset.symbol, history] as const;
                } catch {
                  return [asset.symbol, null] as const;
                }
              }),
            );
            for (const [symbol, history] of historyResponses) historyMap.set(symbol, history);
            lastHistoryFetchRef.current = now;
          }
          priceData = priceData.map((asset) => {
            const historyItems = historyMap.get(asset.symbol);
            const existingHistory = existingHistoryMap.get(asset.symbol);
            if (!historyItems || historyItems.length === 0) {
              // Preserve only previously received snapshots; never fabricate timestamped history.
              const existing = assetsRef.current.find(a => a.symbol === asset.symbol);
              return { ...asset, history: existingHistory || [], historyLabels: existing?.historyLabels || [] };
            }
            return {
              ...asset,
              history: historyItems.map((item: any) => Number(item.price_value)),
              historyLabels: historyItems.map((item: any) => {
                const d = new Date(item.observed_at);
                return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
              }),
            };
          });
        }
      } else {
        const pRes = await fetch('/api/prices');
        if (pRes.ok) priceData = await pRes.json();
      }
      if (priceData.length > 0) {
        assetsRef.current = priceData;
        setAssets(priceData);
      }

      if (useLiveData && tgInitData) {
        const sRes = await fetch(`${backendBase}/api/v1/subscription`, { headers: liveHeaders() });
        if (sRes.ok) setSubscription(await sRes.json());
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
      } else if (!useLiveData) {
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
      if (useLiveData && !tgInitData) {
        setAlerts([]);
        setAlertLogs([]);
      }
      setIsOnline(true);
      hasLoadedOnce.current = true;
    } catch (e) {
      setIsOnline(false);
      console.warn('Network sync warning:', e);
    } finally {
      if (showOverlay) setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    // Safety: ensure any static loading overlay is gone once App mounts
    const loading = document.getElementById('app-loading');
    if (loading && loading.parentNode) loading.parentNode.removeChild(loading);

    const bindTelegramWebApp = () => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initData) {
        setTgInitData(tg.initData);
        setTgUser(tg.initDataUnsafe?.user || null);
        setUseLiveData(true);
        tg.ready?.();
        tg.expand?.();
        return true;
      }
      return false;
    };

    try { bindTelegramWebApp(); } catch { /* not in TG */ }
    let telegramAttempts = 0;
    const telegramTimer = setInterval(() => {
      telegramAttempts += 1;
      try {
        if (bindTelegramWebApp() || telegramAttempts >= 20) clearInterval(telegramTimer);
      } catch {
        clearInterval(telegramTimer);
      }
    }, 250);

    fetchAllData({ showOverlay: !hasLoadedOnce.current, refreshHistory: false });
    const historyTimer = setTimeout(() => fetchAllData({ showOverlay: false, refreshHistory: true }), 1500);
    const historyRetryTimer = setTimeout(() => {
      if (!lastHistoryFetchRef.current) fetchAllData({ showOverlay: false, refreshHistory: true });
    }, 5000);
    const timer = setInterval(() => fetchAllData({ showOverlay: false }), 15000);
    return () => {
      clearInterval(telegramTimer);
      clearTimeout(historyTimer);
      clearTimeout(historyRetryTimer);
      clearInterval(timer);
    };
  }, [useLiveData, tgInitData]);

  const toggleLiveData = () => {
    if (!isLocalHost()) return; // Simulation is a local development feature only.
    if (!useLiveData && !tgInitData) {
      showToast(isFa ? 'برای هشدارهای واقعی، این مینی‌اپ را از داخل بات تلگرام باز کنید.' : 'Open this mini app from Telegram bot to use real alert APIs.', 'info');
    }
    setUseLiveData(p => !p);
    setTimeout(() => fetchAllData({ showOverlay: true, refreshHistory: true }), 10);
  };
  const handleRetryConnection = () => { fetchAllData({ showOverlay: true, refreshHistory: true }); };

  /* ── Handlers ── */
  const handleAddAlert = async (alertData: { symbol: string; triggerType: 'UPPER' | 'LOWER'; thresholdPrice: number; label: string; telegramUsername: string }) => {
    try {
      if (useLiveData && tgInitData) {
        // Live mode: Worker creates confirmed active alerts directly.
        const createRes = await fetch(`${backendBase}/api/v1/alerts`, {
          method: 'POST', headers: liveHeaders(),
          body: JSON.stringify({ asset_code: alertData.symbol, condition_type: alertData.triggerType === 'UPPER' ? 'above' : 'below', target_price: alertData.thresholdPrice, cooldown_minutes: 60 }),
        });
        if (!createRes.ok) {
          const errorPayload = await createRes.json().catch(() => null);
          const errorText = errorPayload?.detail || errorPayload?.error || 'Create failed';
          console.error('Create alert failed:', errorText);
          throw new Error(errorText);
        }
        const created = await createRes.json();
        if (!created.id) throw new Error('Create failed');
      } else {
        // Simulation mode
        const res = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alertData) });
        if (!res.ok) throw new Error('Create failed');
      }
      fetchAllData({ showOverlay: false, refreshHistory: true });
      setActiveTab('alerts');
      showToast(isFa ? 'هشدار جدید با موفقیت ایجاد شد ✓' : 'New alert created successfully ✓', 'success');
    } catch (e) {
      console.error('Alert creation error:', e);
      const message = String((e as Error)?.message || '');
      showToast(
        message.includes('Unauthorized') || message.includes('initData')
          ? (isFa ? 'برای ساخت هشدار واقعی باید مینی‌اپ را از داخل تلگرام باز کنید.' : 'Open the mini app inside Telegram to create real alerts.')
          : message.includes('سقف') || message.includes('Pro')
            ? message
          : (isFa ? 'خطا در ایجاد هشدار. لطفاً دوباره تلاش کنید.' : 'Failed to create alert. Please try again.'),
        'error',
      );
      throw e; // Re-throw to let AlertManager handle the error state
    }
  };

  const handleDeleteAlertDirect = async (id: string) => {
    try {
      const res = useLiveData && tgInitData
        ? await fetch(`${backendBase}/api/v1/alerts/${id}`, { method: 'DELETE', headers: liveHeaders() })
        : await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAllData({ showOverlay: false, refreshHistory: true });
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
        fetchAllData({ showOverlay: false });
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
    fetchAllData({ showOverlay: false, refreshHistory: true });
    showToast(isFa ? 'هشدار ویرایش شد' : 'Alert updated', 'info');
  };

  const handleManualPriceChange = async (symbol: string, val: number) => {
    try {
      if (useLiveData) {
        showToast(
          isFa
            ? 'تغییر دستی قیمت در LIVE برای کاربر عادی غیرفعال است و فقط در حالت شبیه‌سازی فعال است.'
            : 'Manual price override is disabled for normal users in LIVE mode; use SIM mode for testing.',
          'info',
        );
      } else {
        await fetch('/api/prices/trigger-manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, targetPrice: val }) });
      }
    } catch { /* silent */ }
  };

  const handleSelectAssetForAlert = (symbol: string) => { setSelectedAssetForAlert(symbol); setActiveTab('alerts'); };
  const handleBuyPro = () => {
    showToast(isFa ? 'خرید جدید Pro موقتاً متوقف است. لطفاً وجهی واریز نکنید.' : 'New Pro purchases are temporarily unavailable. Please do not send payments.', 'info');
  };


  const watchedAssets = useMemo(() => 
    assets.filter(asset => alerts.some(alert => alert.symbol === asset.symbol)), 
    [assets, alerts]
  );

  const portfolioHoldings = useMemo(() => {
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
  }, [assets]);

  const portfolioTotal = useMemo(() => 
    portfolioHoldings.reduce((sum, item) => {
      if (!item.asset) return sum;
      const multiplier = item.asset.type === 'crypto' ? item.asset.price : toDisplayPrice(item.asset.price, item.asset.unit || '');
      return sum + multiplier * item.amount;
    }, 0),
    [portfolioHoldings]
  );
  const persistPortfolio = (next: Record<string, number>) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('novax_portfolio', JSON.stringify(next));
    fetchAllData({ showOverlay: false, refreshHistory: true });
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
  const tabs = useMemo(() => [
    { id: 'prices' as const, icon: LayoutGrid, labelFa: 'قیمت‌ها', labelEn: 'Prices' },
    { id: 'alerts' as const, icon: Bell, labelFa: 'هشدارها', labelEn: 'Alerts' },
    { id: 'portfolio' as const, icon: Wallet, labelFa: 'پورتفولیو', labelEn: 'Portfolio' },
    { id: 'chart' as const, icon: TrendingUp, labelFa: 'چارت', labelEn: 'Chart' },
  ], []);

  const moreTabs = useMemo(() => [
    { id: 'assets' as const, icon: Coins, labelFa: 'دارایی‌های من', labelEn: 'My Assets' },
    { id: 'ai' as const, icon: Sparkles, labelFa: 'تحلیل‌گر هوشمند', labelEn: 'AI Analyst' },
  ], []);

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
      <div className="fixed bottom-24 md:bottom-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
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
                <span className="text-xs text-white font-bold font-mono">{tgUser?.username ? `@${tgUser.username}` : tgUser?.first_name || '@guest'}</span>
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
            {subscription && (
              <button
                onClick={subscription.plan === 'free' ? handleBuyPro : undefined}
                className={`text-[10px] px-3 py-2 rounded-xl border font-bold ${
                  subscription.plan === 'pro'
                    ? 'bg-violet-500/15 border-violet-400/30 text-violet-300'
                    : 'bg-amber-500/10 border-amber-400/30 text-amber-300 cursor-pointer'
                }`}
              >
                {subscription.plan === 'pro'
                  ? `PRO • ${subscription.active_alert_count}/${subscription.alert_limit}`
                  : `${isFa ? 'خرید Pro متوقف است' : 'Pro purchases paused'} • ${subscription.active_alert_count}/${subscription.alert_limit}`}
              </button>
            )}
            {useLiveData && !tgInitData && (
              <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                {isFa ? 'LIVE بدون احراز تلگرام: فقط مشاهده قیمت' : 'LIVE without Telegram auth: prices only'}
              </span>
            )}
            <button onClick={() => setLanguage(language === 'fa' ? 'en' : 'fa')}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs px-3 py-2 rounded-xl transition-all font-semibold text-zinc-300 cursor-pointer">
              <Globe size={13} /> {isFa ? 'EN' : 'FA'}
            </button>
            <button disabled={!isLocalHost()} onClick={toggleLiveData}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition-all font-semibold cursor-pointer border ${useLiveData ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-zinc-300'}`}>
              <Wifi size={13} /> {useLiveData ? (isFa ? 'واقعی' : 'LIVE') : (isFa ? 'شبیه‌سازی' : 'SIM')}
            </button>
          </div>
        </div>

        {/* ── Tab navigation — desktop ── */}
        <div className="hidden md:flex gap-2 bg-slate-950/60 border border-slate-900 p-1.5 rounded-2xl">
          {[...tabs, ...moreTabs].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold transition-all text-xs tracking-wide shrink-0 cursor-pointer
                ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-teal-500/15 via-indigo-500/15 to-indigo-600/10 border border-teal-500/30 text-teal-300 shadow-xl'
                  : 'text-zinc-500 hover:text-zinc-300'}`}>
              <tab.icon size={14} /> {isFa ? tab.labelFa : tab.labelEn}
            </button>
          ))}
        </div>

        {/* ── Screen viewport ── */}
        <div className="flex-1 min-h-0 pb-24 md:pb-0">
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
                {watchedAssets.length === 0 ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center mx-auto mb-4">
                      <Bell size={24} className="text-zinc-600" />
                    </div>
                    <div className="text-zinc-400 text-sm font-medium">{isFa ? 'هنوز داراییِ دارای هشدار ندارید.' : 'No watched assets yet.'}</div>
                    <div className="text-zinc-600 text-xs mt-1">{isFa ? 'از بخش قیمت‌ها هشدار بسازید.' : 'Create alerts from the Prices tab.'}</div>
                  </div>
                ) :
                  watchedAssets.map(asset => (
                    <div key={asset.symbol} className="bg-gradient-to-r from-slate-900/80 to-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-teal-500/30 transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-indigo-500/20 flex items-center justify-center">
                          <Coins size={18} className="text-teal-400" />
                        </div>
                        <div>
                          <div className="font-bold text-white">{isFa ? asset.nameFa : asset.name}</div>
                          <div className="text-zinc-400 text-sm">{formatPrice(asset.price, asset.type, asset.unit)}</div>
                        </div>
                      </div>
                      <button onClick={() => handleSelectAssetForAlert(asset.symbol)} className="rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2 text-sm font-bold text-white cursor-pointer transition-all group-hover:shadow-lg group-hover:shadow-teal-500/20">{isFa ? 'ساخت/مدیریت هشدار' : 'Manage Alerts'}</button>
                    </div>
                  ))}
              </motion.div>
            )}
            {activeTab === 'portfolio' && (
              <motion.div key="portfolio" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.2 }}
                className="grid gap-4">
                <div className="bg-gradient-to-br from-slate-900/80 to-indigo-950/40 border border-slate-800/80 rounded-2xl p-6">
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">{isFa ? 'ارزش تقریبی کل پورتفولیو' : 'Estimated portfolio value'}</div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-teal-300 to-indigo-300 bg-clip-text text-transparent">{portfolioTotal.toLocaleString(isFa ? 'fa-IR' : 'en-US')} <span className="text-lg text-zinc-400">{isFa ? 'تومان' : 'Toman'}</span></div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-[1fr,180px,auto] gap-3 items-end">
                  <div>
                    <div className="text-xs font-semibold text-zinc-400 mb-2">{isFa ? 'انتخاب دارایی' : 'Select Asset'}</div>
                    <select value={portfolioDraft.symbol} onChange={e => setPortfolioDraft(prev => ({ ...prev, symbol: e.target.value }))}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500/50 transition-colors appearance-none cursor-pointer">
                      <option value="" disabled>{isFa ? '— یک دارایی انتخاب کنید —' : '— Select an asset —'}</option>
                      {(['crypto', 'fiat', 'gold'] as const).map(group => {
                        const groupItems = assets.filter(a => a.type === group);
                        if (!groupItems.length) return null;
                        return (
                          <optgroup key={group} label={isFa
                            ? ({ crypto: 'رمزارز', fiat: 'فیات/ارز', gold: 'طلا' })[group]
                            : ({ crypto: 'Crypto', fiat: 'Fiat/Currency', gold: 'Gold' })[group]}>
                            {groupItems.map(a =>
                              <option key={a.symbol} value={a.symbol}>{a.symbol} — {isFa ? a.nameFa : a.name}</option>
                            )}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-400 mb-2">
                      {isFa ? 'مقدار' : 'Amount'}
                      {portfolioDraft.symbol ? <span className="text-teal-400"> ({portfolioDraft.symbol})</span> : ''}
                    </div>
                    <input value={portfolioDraft.amount} onChange={e => setPortfolioDraft(prev => ({ ...prev, amount: e.target.value }))} placeholder="0.5" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500/50 transition-colors" />
                  </div>
                  <button onClick={addPortfolioItem} className="rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 px-5 py-3 text-sm font-bold text-white cursor-pointer transition-all shadow-lg shadow-teal-500/20">{isFa ? 'افزودن' : 'Add'}</button>
                </div>
                {portfolioHoldings.length === 0 ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center mx-auto mb-4">
                      <Wallet size={24} className="text-zinc-600" />
                    </div>
                    <div className="text-zinc-400 text-sm font-medium">{isFa ? 'هنوز چیزی در پورتفولیو ذخیره نشده.' : 'No portfolio items saved yet.'}</div>
                  </div>
                ) :
                  portfolioHoldings.map(item => (
                    <div key={item.symbol} className="bg-gradient-to-r from-slate-900/80 to-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-teal-500/30 transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-indigo-500/20 flex items-center justify-center">
                          <Wallet size={18} className="text-teal-400" />
                        </div>
                        <div>
                          <div className="font-bold text-white">{item.symbol}</div>
                          <div className="text-zinc-400 text-sm">{item.amount} {item.asset?.symbol || ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-teal-300 font-bold">{item.asset ? formatPrice((item.asset.type === 'crypto' ? item.asset.price : toDisplayPrice(item.asset.price, item.asset.unit || '')) * item.amount, item.asset.type === 'crypto' ? 'crypto' : 'fiat', item.asset.type === 'crypto' ? 'USDT' : 'TOMAN') : '-'}</div>
                        <button onClick={() => removePortfolioItem(item.symbol)} className="rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-300 cursor-pointer transition-all">{isFa ? 'حذف' : 'Remove'}</button>
                      </div>
                    </div>
                  ))}
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

          </AnimatePresence>
        </div>
      </div>

      {/* ── Bottom navigation — mobile ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-2xl border-t border-slate-800/60 z-50 pb-safe">
        <div className="flex justify-around items-center py-1.5 px-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setBottomMenuOpen(false);
              }}
              className={`relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'text-teal-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {activeTab === tab.id && (
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-teal-400" />
              )}
              <tab.icon size={20} />
              <span className="text-[10px] font-semibold">{isFa ? tab.labelFa : tab.labelEn}</span>
            </button>
          ))}
          <button
            onClick={() => setBottomMenuOpen(!bottomMenuOpen)}
            className={`relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all cursor-pointer ${
              bottomMenuOpen ? 'text-teal-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {bottomMenuOpen && (
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-teal-400" />
            )}
            <MoreHorizontal size={20} />
            <span className="text-[10px] font-semibold">{isFa ? 'بیشتر' : 'More'}</span>
          </button>
        </div>

        {/* More menu overlay */}
        <AnimatePresence>
          {bottomMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setBottomMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="absolute bottom-full left-4 right-4 mb-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                {moreTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setBottomMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-teal-500/15 text-teal-300'
                        : 'text-zinc-400 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <tab.icon size={18} />
                    {isFa ? tab.labelFa : tab.labelEn}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
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
