import { useState, useEffect } from 'react';
import { Asset, Alert } from './types';
import PriceBoard from './components/PriceBoard';
import AlertManager from './components/AlertManager';
import AIChat from './components/AIChat';
import TelegramSimulator from './components/TelegramSimulator';
import { Coins, Bell, HelpCircle, Bot, Globe, Smartphone, User, Sparkles, X, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Chime synthesized audio helper for alert triggers
function playChime() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
    osc2.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.15); // C6

    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 0.5);
    osc2.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'prices' | 'alerts' | 'chat' | 'vps'>('prices');
  const [language, setLanguage] = useState<'fa' | 'en'>('fa');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertLogs, setAlertLogs] = useState<any[]>([]);
  const [selectedAssetForAlert, setSelectedAssetForAlert] = useState<string | null>(null);
  
  // Custom Push Notification state
  const [pushNotification, setPushNotification] = useState<{ id: string; text: string } | null>(null);

  // Live mode: when true, prices come from the real Novax backend (and slider can override via test endpoint)
  // Requires the mini-app to be opened as Telegram WebApp (initData available) for authenticated test overrides.
  const [useLiveData, setUseLiveData] = useState<boolean>(false);
  const [tgInitData, setTgInitData] = useState<string>("");

  const isFa = language === 'fa';

  // Fetch prices, alerts, and logs on boot + interval polling
  const fetchAllData = async () => {
    try {
      let priceData: any[] = [];

      if (useLiveData) {
        // Live prices from the real Novax backend (no auth needed for /latest)
        // Default assumes you run the main Python backend on :8001 (common in this project) while mini-app is on :3000 for demo.
        const base = (import.meta as any).env?.VITE_NOVAX_API_BASE || (window as any).NOVAX_API_BASE || 'http://localhost:8001';
        const url = `${base.replace(/\/$/, '')}/api/v1/prices/latest`;
        const pRes = await fetch(url);
        if (pRes.ok) {
          const envelope = await pRes.json();
          const items = envelope.items || envelope; // support both {items:[]} and flat from sim
          // Map real LatestPrices shape to the shape the mini components expect
          priceData = (items || []).map((it: any) => ({
            symbol: it.asset_code || it.symbol,
            name: it.asset_name || it.name || it.asset_code,
            nameFa: it.asset_name || it.name || it.asset_code,
            price: Number(it.price_value || it.price),
            type: (it.currency_code || it.display_unit || '').toUpperCase().includes('USDT') || (it.asset_code || '').toUpperCase().includes('USDT') ? 'crypto' : 'fiat',
            change24h: 0,
            history: [Number(it.price_value || it.price)],
          }));
        }
      } else {
        const pRes = await fetch('/api/prices');
        if (pRes.ok) {
          priceData = await pRes.json();
        }
      }
      if (priceData.length > 0) setAssets(priceData);

      // Alerts and logs stay on the mini-app's fast local simulation (beautiful demo + instant feedback)
      const aRes = await fetch('/api/alerts');
      if (aRes.ok) {
        const aData = await aRes.json();
        setAlerts(aData);
      }

      const lRes = await fetch('/api/alerts/logs');
      if (lRes.ok) {
        const lData = await lRes.json();
        
        // If new logs appeared higher than what we currently have, trigger push chime
        if (lData.length > alertLogs.length && alertLogs.length > 0) {
          const newestLog = lData[0];
          setPushNotification({ id: newestLog.id, text: newestLog.text });
          playChime();
          
          // Clear notification after 6 seconds
          setTimeout(() => {
            setPushNotification(null);
          }, 6000);
        }
        setAlertLogs(lData);
      }
    } catch (e) {
      console.warn('Network sync warning:', e);
    }
  };

  useEffect(() => {
    // Capture Telegram initData when the mini-app is opened from inside the real @novax_price_bot (as WebApp)
    // This allows authenticated calls to the real backend (prices are public, test/override-price requires valid session).
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg && tg.initData) {
        setTgInitData(tg.initData);
        // Optionally expand the webapp
        tg.expand?.();
      }
    } catch (e) {
      // not running inside Telegram — fine, live mode will be limited to public endpoints
    }

    fetchAllData();
    const timer = setInterval(fetchAllData, 4000); // Poll server every 4 seconds for immediate responsive feel
    return () => clearInterval(timer);
  }, [alertLogs.length, useLiveData]); // re-poll strategy when toggling live

  // Toggle live data mode (connects price board + manual slider to the real backend test endpoint)
  const toggleLiveData = () => {
    const next = !useLiveData;
    setUseLiveData(next);
    // Immediate refetch with new mode
    setTimeout(() => fetchAllData(), 10);
  };

  // Handle Create Alert
  const handleAddAlert = async (alertData: {
    symbol: string;
    triggerType: 'UPPER' | 'LOWER';
    thresholdPrice: number;
    label: string;
    telegramUsername: string;
  }) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData)
      });
      if (res.ok) {
        fetchAllData();
        // Shift tab to Alerts to see it
        setActiveTab('alerts');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Delete Alert
  const handleDeleteAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Toggle Alert active state
  const handleToggleAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}/toggle`, { method: 'PUT' });
      if (res.ok) {
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle manual price triggers from price slider
  const handleManualPriceChange = async (symbol: string, val: number) => {
    try {
      if (useLiveData) {
        // Call the real backend's test override (will affect real LatestPrice and thus future alert evaluations)
        const base = (import.meta as any).env?.VITE_NOVAX_API_BASE || (window as any).NOVAX_API_BASE || 'http://localhost:8001';
        const url = `${base.replace(/\/$/, '')}/api/v1/test/override-price`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (tgInitData) {
          headers['X-Telegram-Init-Data'] = tgInitData;
        }
        await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ symbol, price: val })
        });
      } else {
        await fetch('/api/prices/trigger-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, targetPrice: val })
        });
      }
      fetchAllData();
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger alert selection from price board CTA
  const handleSelectAssetForAlert = (symbol: string) => {
    setSelectedAssetForAlert(symbol);
    setActiveTab('alerts');
  };

  // Simulated push trigger
  const handleSimulateFakePush = () => {
    setPushNotification({
      id: `sim-${Math.random()}`,
      text: isFa 
        ? '🔔 هشدار قیمت تستی: دارایی تتر به تومان (USDT_IRT) به مرز حمایتی ۵۹,۵۰۰ تومان رسید! (تراکنش موفق تست وب‌هوک)' 
        : '🔔 Mock Bot Alert: Tether / Toman (USDT_IRT) has violated lower boundary 59,500 Tomans! (Webhook trigger test successful)'
    });
    playChime();
    setTimeout(() => setPushNotification(null), 6000);
  };

  return (
    <div id="main-frame" className="min-h-screen bg-[#060814] text-white flex flex-col font-sans">
      {/* Dynamic Slide-Down Smartphone Notification (Mimicking Telegram) */}
      <AnimatePresence>
        {pushNotification && (
          <motion.div
            initial={{ opacity: 0, y: -80, scale: 0.95 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed top-12 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-[420px] px-4 cursor-pointer"
            onClick={() => setPushNotification(null)}
          >
            <div className="bg-[#181d33]/95 backdrop-blur-xl border border-indigo-505/30 rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 ring-2 ring-indigo-550/20">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                <Bot size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-sky-450 tracking-wide">@novax_price_bot</span>
                  <span className="text-[9px] font-mono text-zinc-500">{isFa ? 'الان' : 'now'}</span>
                </div>
                <p className="text-xs text-white leading-relaxed mt-1 font-medium font-sans">
                  {pushNotification.text}
                </p>
                <div className="text-[10px] text-zinc-400 mt-1 font-mono">
                  {isFa ? '📳 کشیدن برای بستن' : '📳 Swipe/Tap to dismiss'}
                </div>
              </div>
              <button className="text-zinc-500 hover:text-white shrink-0 pointer-events-none">
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main App Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col gap-6">
        {/* UPPER HUD: Connection indicators and Language toggle */}
        <div id="upper-hud" className="flex flex-col sm:flex-row justify-between items-center bg-slate-950/45 border border-slate-900 rounded-2xl px-6 py-4 gap-4">
          {/* Telegram Connection Simulation Indicator */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500/20 to-sky-400/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Smartphone size={16} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-wider text-sky-450 uppercase">TELEGRAM WEB_APP</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-400 font-semibold">Active User:</span>
                <span className="text-xs text-white font-bold flex items-center gap-1 font-mono">
                  @novax_user
                  <span className="text-[10px] bg-gradient-to-r from-teal-400 to-indigo-400 text-slate-950 px-1.5 py-0 rounded font-black uppercase">PREMIUM</span>
                </span>
              </div>
            </div>
          </div>

          {/* Central Logo & branding */}
          <div className="hidden md:flex items-center gap-2 select-none">
            <span className="text-xl font-black bg-gradient-to-r from-teal-400 via-indigo-400 to-indigo-550 bg-clip-text text-transparent uppercase tracking-wider font-sans">
              NOVAX ALERT STUDIO
            </span>
            <span className="text-[10px] border border-indigo-500/30 text-indigo-400 font-mono px-2 py-0.5 rounded-full font-bold">
              v1.2.0
            </span>
          </div>

          {/* Language Switcher + Live mode toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLanguage(language === 'fa' ? 'en' : 'fa')}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs px-3.5 py-2 rounded-xl transition-all font-semibold text-zinc-300 cursor-pointer"
            >
              <Globe size={13} />
              {isFa ? 'English 🇺🇸' : 'فارسی 🇮🇷'}
            </button>

            <button
              onClick={toggleLiveData}
              className={`flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl transition-all font-semibold cursor-pointer border ${useLiveData ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-zinc-300'}`}
              title={useLiveData ? 'Using real Novax backend prices + test override (affects real alerts)' : 'Using fast local simulation (great for instant demo)'}
            >
              <Wifi size={13} />
              {useLiveData ? (isFa ? 'داده واقعی' : 'LIVE') : (isFa ? 'شبیه‌سازی' : 'SIM')}
            </button>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-850 p-1 rounded-xl text-[11px] font-semibold text-zinc-450">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="px-1">{isFa ? 'اتصال برقرار است' : 'Vite Server Connected'}</span>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION CHIPS */}
        <div id="navigation-bar" className="flex overflow-x-auto gap-2 bg-slate-950/60 border border-slate-900 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('prices')}
            className={`flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold transition-all text-xs tracking-wide shrink-0 cursor-pointer ${
              activeTab === 'prices'
                ? 'bg-gradient-to-r from-teal-500/15 via-indigo-500/15 to-indigo-600/10 border border-teal-500/30 text-teal-300 shadow-xl'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Coins size={14} />
            {isFa ? 'داشبورد ارزها و طلا' : 'Price Board'}
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold transition-all text-xs tracking-wide shrink-0 cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-gradient-to-r from-teal-500/15 via-indigo-500/15 to-indigo-600/10 border border-teal-500/30 text-teal-300 shadow-xl'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Bell size={14} />
            {isFa ? 'دیده بان و ثبت هشدارها' : 'Alert Center'}
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold transition-all text-xs tracking-wide shrink-0 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-gradient-to-r from-teal-500/15 via-indigo-500/15 to-indigo-600/10 border border-teal-500/30 text-teal-300 shadow-xl'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Bot size={14} />
            {isFa ? 'دستیار هوش مصنوعی نووا' : 'NovaX AI Analyst'}
          </button>

          <button
            onClick={() => setActiveTab('vps')}
            className={`flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold transition-all text-xs tracking-wide shrink-0 cursor-pointer ${
              activeTab === 'vps'
                ? 'bg-gradient-to-r from-teal-500/15 via-indigo-500/15 to-indigo-600/10 border border-teal-500/30 text-teal-300 shadow-xl'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <HelpCircle size={14} />
            {isFa ? 'راهنمای استقرار بات و هاست' : 'VPS Hosting Docs'}
          </button>
        </div>

        {/* SCREEN VIEWS TRANSITION AREA */}
        <div id="screen-viewport" className="flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'prices' && (
              <motion.div
                key="prices"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <PriceBoard
                  assets={assets}
                  language={language}
                  onSelectAssetForAlert={handleSelectAssetForAlert}
                  onManualTriggerPrice={handleManualPriceChange}
                />
              </motion.div>
            )}

            {activeTab === 'alerts' && (
              <motion.div
                key="alerts"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <AlertManager
                  alerts={alerts}
                  alertLogs={alertLogs}
                  assets={assets}
                  language={language}
                  onAddAlert={handleAddAlert}
                  onDeleteAlert={handleDeleteAlert}
                  onToggleAlert={handleToggleAlert}
                  selectedAssetForAlert={selectedAssetForAlert}
                  clearSelectedAsset={() => setSelectedAssetForAlert(null)}
                />
              </motion.div>
            )}

            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <AIChat
                  assets={assets}
                  language={language}
                />
              </motion.div>
            )}

            {activeTab === 'vps' && (
              <motion.div
                key="vps"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <TelegramSimulator
                  language={language}
                  onSimulateFakeNotification={handleSimulateFakePush}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="w-full bg-[#03050c] border-t border-slate-950 py-6 text-zinc-500 text-xs text-center border-slate-900 mt-auto select-none">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            &copy; 2026 NovaX Price Alert. Crafted to perfection.
          </div>
          <div className="flex gap-4 font-mono text-[11px]">
            <a href="https://github.com/alirezasafaei-dev/novax-price-alert" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              GitHub repository
            </a>
            <span>&bull;</span>
            <a href="https://t.me/novax_price_bot" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              @novax_price_bot
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
