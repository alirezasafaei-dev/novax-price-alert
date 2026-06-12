import { useState, useEffect, useRef, useCallback } from 'react';
import { formatPrice, formatPercent } from '../utils';
import { Asset } from '../types';
import { TrendingUp, TrendingDown, Bell, Coins, Activity, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PriceBoardProps {
  assets: Asset[];
  language: 'fa' | 'en';
  onSelectAssetForAlert: (symbol: string) => void;
  onManualTriggerPrice: (symbol: string, newPrice: number) => void;
}

export default function PriceBoard({ assets, language, onSelectAssetForAlert, onManualTriggerPrice }: PriceBoardProps) {
  const [filter, setFilter] = useState<'all' | 'crypto' | 'fiat' | 'gold'>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC');
  const [sliderPrice, setSliderPrice] = useState<number>(68500);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPrices = useRef<Record<string, number>>({});

  const selectedAsset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  // Track price changes for flash animation
  useEffect(() => {
    if (selectedAsset) {
      const prev = prevPrices.current[selectedAsset.symbol];
      if (prev !== undefined && prev !== selectedAsset.price) {
        // price changed — flash effect handled via key
      }
      prevPrices.current[selectedAsset.symbol] = selectedAsset.price;
    }
  }, [assets]);

  useEffect(() => {
    if (selectedAsset) {
      setSliderPrice(selectedAsset.price);
    }
  }, [selectedSymbol]);

  const filteredAssets = assets.filter(asset => {
    if (filter === 'all') return true;
    return asset.type === filter;
  });

  // Debounced slider change — only send to backend after user stops sliding
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSliderPrice(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onManualTriggerPrice(selectedSymbol, val);
    }, 300);
  }, [selectedSymbol, onManualTriggerPrice]);

  // Generate SVG path for line chart
  const generateChartPath = (history: number[], width: number, height: number) => {
    if (!history || history.length < 2) return '';
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min === 0 ? 1 : max - min;
    return history.map((val, index) => {
      const x = (index / (history.length - 1)) * width;
      const y = height - ((val - min) / range) * (height * 0.8) - (height * 0.1);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const generateAreaPath = (history: number[], width: number, height: number) => {
    if (!history || history.length < 2) return '';
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min === 0 ? 1 : max - min;
    const points = history.map((val, index) => {
      const x = (index / (history.length - 1)) * width;
      const y = height - ((val - min) / range) * (height * 0.8) - (height * 0.1);
      return `${x},${y}`;
    });
    return `M 0 ${height} L ${points.map((p, i) => (i === 0 ? 'M ' : 'L ') + p.replace(',', ' ')).join(' ')} L ${width} ${height} Z`;
  };

  const isFa = language === 'fa';

  const formatRawPrice = (price: number, type: 'crypto' | 'fiat' | 'gold', unit?: string) => {
    if (type === 'crypto') return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2 });
    // Convert IRT (Rial) to Toman if needed
    const displayPrice = unit && unit.toUpperCase() === 'IRT' ? price / 10 : price;
    return displayPrice.toLocaleString('fa-IR') + ' تومان';
  };

  const minSliderVal = selectedAsset ? Math.round(selectedAsset.price * 0.7) : 0;
  const maxSliderVal = selectedAsset ? Math.round(selectedAsset.price * 1.3) : 100000;
  const sliderStep = selectedAsset?.type === 'crypto' ? (selectedAsset.symbol === 'TON' ? 0.05 : 10) : 100;

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 text-sm p-6 text-center" role="status" aria-live="polite">
        <div className="w-16 h-16 rounded-full bg-slate-900/50 flex items-center justify-center mb-4" aria-hidden="true">
          <Activity size={32} className="text-zinc-600" />
        </div>
        <p className="text-zinc-400 font-medium mb-2">
          {isFa ? 'در انتظار دریافت قیمت‌ها...' : 'Waiting for price data...'}
        </p>
        <p className="text-zinc-600 text-xs">
          {isFa ? 'لطفاً اتصال اینترنت خود را بررسی کنید' : 'Please check your internet connection'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT & CENTER: Charts and Details */}
      <div className="lg:col-span-2 space-y-6">
        {/* Interactive Chart */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl" />

          <div className="flex justify-between items-start relative z-10">
            <div>
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={12} className="text-teal-400" />
                {isFa ? 'نمودار آنلاین' : 'LIVE CHART'}
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                {isFa ? selectedAsset.nameFa : selectedAsset.name}
                <span className="text-sm font-mono text-zinc-500 ml-2">({selectedAsset.symbol})</span>
              </h2>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-semibold text-teal-400">
                {formatPrice(selectedAsset.price, selectedAsset.type, selectedAsset.unit)}
              </div>
              <div className={`text-xs font-bold mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                selectedAsset.change24h >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
              }`}>
                {selectedAsset.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {formatPercent(selectedAsset.change24h)}
              </div>
            </div>
          </div>

          {/* SVG Chart */}
          <div className="h-56 mt-6 relative w-full">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0"/>
                </linearGradient>
              </defs>
              <line x1="0" y1="20" x2="100%" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="100" x2="100%" y2="100" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="180" x2="100%" y2="180" stroke="#1e293b" strokeDasharray="3 3" />
              <path d={generateAreaPath(selectedAsset.history, 500, 220)} fill="url(#chartGradient)" className="transition-all duration-500" />
              <path d={generateChartPath(selectedAsset.history, 500, 220)} fill="none"
                stroke={selectedAsset.change24h >= 0 ? '#14b8a6' : '#f43f5e'}
                strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-500" />
            </svg>
            <div className="absolute top-2 left-2 text-[10px] font-mono text-zinc-500 bg-slate-800/40 px-1.5 py-0.5 rounded">
              High: {formatRawPrice(Math.max(...selectedAsset.history), selectedAsset.type, selectedAsset.unit)}
            </div>
            <div className="absolute bottom-2 left-2 text-[10px] font-mono text-zinc-500 bg-slate-800/40 px-1.5 py-0.5 rounded">
              Low: {formatRawPrice(Math.min(...selectedAsset.history), selectedAsset.type, selectedAsset.unit)}
            </div>
          </div>

          {/* Set Alert CTA */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-950/40 border border-slate-800/50 rounded-xl p-4 mt-6 gap-3">
            <div className="text-zinc-400 text-sm text-center sm:text-left">
              {isFa ? `می‌خواهید برای ${selectedAsset.nameFa} هشدار قیمت بگذارید؟` : `Want to set price alerts for ${selectedAsset.name}?`}
            </div>
            <button onClick={() => onSelectAssetForAlert(selectedAsset.symbol)}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-semibold px-4 py-2 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] cursor-pointer text-sm">
              <Bell size={16} /> {isFa ? 'ایجاد هشدار جدید' : 'Create New Alert'}
            </button>
          </div>
        </div>

        {/* Price Drift Playground */}
        <div className="bg-gradient-to-br from-slate-900/40 to-slate-950/40 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-2 right-2 flex gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
            <Sliders size={10} className="self-center" />
            {isFa ? 'پلی‌گراند شبیه‌ساز' : 'PLAYGROUND MODE'}
          </div>

          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            📊 {isFa ? 'شبیه‌ساز و تست هشدارها' : 'Manual Alert Test'}
          </h3>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            {isFa ? 'با اسلایدر زیر می‌توانید قیمت را به صورت دستی تغییر دهید تا عملکرد هشدارها را تست کنید.' : 'Use the slider below to manually change the price and test alert trigger conditions.'}
          </p>

          <div className="bg-slate-900/80 border border-slate-800/60 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-white">{isFa ? 'قیمت شبیه‌سازی شده:' : 'Test price:'}</span>
              <span className="text-lg font-mono font-bold text-teal-400">{formatPrice(sliderPrice, selectedAsset.type, selectedAsset.unit)}</span>
            </div>
            <input type="range" min={minSliderVal} max={maxSliderVal} step={sliderStep} value={sliderPrice} onChange={handleSliderChange}
              className="w-full rounded-lg appearance-none h-2 cursor-pointer" />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>Min: {formatRawPrice(minSliderVal, selectedAsset.type, selectedAsset.unit)}</span>
              <span>Reset: {formatRawPrice(selectedAsset.price, selectedAsset.type, selectedAsset.unit)}</span>
              <span>Max: {formatRawPrice(maxSliderVal, selectedAsset.type, selectedAsset.unit)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR: Asset List */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col max-h-[660px] overflow-hidden">
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
            <Coins size={14} className="text-indigo-400" /> {isFa ? 'لیست دارایی‌ها' : 'Asset List'}
          </h3>
          <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-slate-800/50 text-xs">
            {['all', 'crypto', 'gold'].map((type) => (
              <button key={type} onClick={() => setFilter(type as any)}
                className={`py-1 px-2.5 rounded-md font-semibold transition-all cursor-pointer ${filter === type ? 'bg-gradient-to-r from-teal-500/20 to-indigo-500/20 text-teal-300 border border-teal-500/20 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {type === 'all' ? (isFa ? 'همه' : 'All') : type === 'crypto' ? (isFa ? 'کریپتو' : 'Crypto') : (isFa ? 'طلا/ارز' : 'Gold')}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
          {filteredAssets.map((asset) => {
            const isActive = selectedSymbol === asset.symbol;
            const priceUp = asset.change24h >= 0;
            return (
              <button key={asset.symbol} onClick={() => setSelectedSymbol(asset.symbol)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all text-white flex items-center justify-between cursor-pointer group ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500/10 via-indigo-500/5 to-slate-900/50 border-teal-500/40 shadow-teal-500/5 shadow-md scale-[1.01]'
                    : 'bg-slate-950/30 border-slate-800/50 hover:bg-slate-900/40 hover:border-slate-800'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white ${
                    asset.type === 'crypto' ? 'bg-teal-500/10 border border-teal-500/20 text-teal-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  }`}>
                    {asset.symbol.substring(0, 3)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-1.5">{isFa ? asset.nameFa : asset.name}</div>
                    <span className="text-slate-500 text-[11px] font-mono tracking-wider">{asset.symbol}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div className="w-14 h-8 overflow-hidden hidden sm:block">
                    <svg className="w-full h-full">
                      <path d={generateChartPath(asset.history, 56, 32)} fill="none"
                        stroke={priceUp ? '#10b981' : '#ef4444'} strokeWidth="1.5" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold font-mono text-sm">{formatPrice(asset.price, asset.type, asset.unit)}</div>
                    <div className={`text-[11px] font-bold mt-0.5 font-mono ${priceUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {priceUp ? '+' : ''}{asset.change24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
