import { useState, useEffect, ChangeEvent } from 'react';
import { formatPrice, formatPercent } from '../utils';
import { Asset, Alert } from '../types';
import { TrendingUp, TrendingDown, Bell, Coins, DollarSign, Activity, Sliders, RefreshCw } from 'lucide-react';
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
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const selectedAsset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  useEffect(() => {
    if (selectedAsset) {
      setSliderPrice(selectedAsset.price);
    }
  }, [selectedSymbol]);

  const filteredAssets = assets.filter(asset => {
    if (filter === 'all') return true;
    return asset.type === filter;
  });

  // Calculate SVG line coords for selected chart
  const generateChartPath = (history: number[], width: number, height: number) => {
    if (!history || history.length === 0) return '';
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
    if (!history || history.length === 0) return '';
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min === 0 ? 1 : max - min;

    const points = history.map((val, index) => {
      const x = (index / (history.length - 1)) * width;
      const y = height - ((val - min) / range) * (height * 0.8) - (height * 0.1);
      return `${x},${y}`;
    });

    const startX = 0;
    const startY = height;
    const endX = width;
    const endY = height;

    return `M ${startX} ${startY} L ${points.map((p, i) => (i === 0 ? 'M ' : 'L ') + p.replace(',', ' ')).join(' ')} L ${endX} ${endY} Z`;
  };

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSliderPrice(val);
    onManualTriggerPrice(selectedSymbol, val);
  };

  const isFa = language === 'fa';

  const formatRawPrice = (price: number, type: 'crypto' | 'fiat' | 'gold') => {
    if (type === 'crypto') {
      return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2 });
    } else {
      return price.toLocaleString('fa-IR') + ' تومان';
    }
  };

  // Min and max estimates for slider boundary
  const minSliderVal = selectedAsset ? Math.round(selectedAsset.price * 0.7) : 0;
  const maxSliderVal = selectedAsset ? Math.round(selectedAsset.price * 1.3) : 100000;
  const sliderStep = selectedAsset?.type === 'crypto' ? (selectedAsset.symbol === 'TON' ? 0.05 : 10) : 100;

  return (
    <div id="price-board" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT & CENTER: Charts and Details */}
      <div className="lg:col-span-2 space-y-6">
        {/* Interactive Chart Container */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          {/* Subtle decoration elements */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl" />

          {/* Chart Header */}
          <div className="flex justify-between items-start relative z-10">
            <div>
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={12} className="text-teal-400" />
                {isFa ? 'نمودار زنده' : 'LIVE TICKER'}
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                {isFa ? selectedAsset.nameFa : selectedAsset.name} 
                <span className="text-sm font-mono text-zinc-500 ml-2">({selectedAsset.symbol})</span>
              </h2>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-semibold text-teal-400">
                {formatPrice(selectedAsset.price, selectedAsset.type)}
              </div>
              <div className={`text-xs font-bold mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                selectedAsset.change24h >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
              }`}>
                {selectedAsset.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {formatPercent(selectedAsset.change24h)}
              </div>
            </div>
          </div>

          {/* Custom Responsive SVG Chart */}
          <div className="h-56 mt-6 relative w-full">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0"/>
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1="20" x2="100%" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="100" x2="100%" y2="100" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="180" x2="100%" y2="180" stroke="#1e293b" strokeDasharray="3 3" />

              {/* Area path */}
              <path
                d={generateAreaPath(selectedAsset.history, 500, 220)}
                fill="url(#chartGradient)"
                className="transition-all duration-500"
              />

              {/* Line path */}
              <path
                d={generateChartPath(selectedAsset.history, 500, 220)}
                fill="none"
                stroke={selectedAsset.change24h >= 0 ? '#14b8a6' : '#f43f5e'}
                strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            
            {/* Low / High Tags */}
            <div className="absolute top-2 left-2 text-[10px] font-mono text-zinc-500 bg-slate-800/40 px-1.5 py-0.5 rounded">
              High: {formatRawPrice(Math.max(...selectedAsset.history), selectedAsset.type)}
            </div>
            <div className="absolute bottom-2 left-2 text-[10px] font-mono text-zinc-500 bg-slate-800/40 px-1.5 py-0.5 rounded">
              Low: {formatRawPrice(Math.min(...selectedAsset.history), selectedAsset.type)}
            </div>
          </div>

          {/* Set Alert Trigger CTA */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-950/40 border border-slate-800/50 rounded-xl p-4 mt-6 gap-3">
            <div className="text-zinc-400 text-sm text-center sm:text-left">
              {isFa
                ? `می‌خواهید برای تغییر قیمت ${selectedAsset.nameFa} هشدار دریافت کنید؟`
                : `Want customized alarms for ${selectedAsset.name}?`}
            </div>
            <button
              id={`btn-set-alert-${selectedAsset.symbol}`}
              onClick={() => onSelectAssetForAlert(selectedAsset.symbol)}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-semibold px-4 py-2 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] cursor-pointer text-sm"
            >
              <Bell size={16} />
              {isFa ? 'ثبت هشدار اختصاصی' : 'Create Custom Alert'}
            </button>
          </div>
        </div>

        {/* PRICE DRIFT PLAYGROUND (Interactive Simulator) */}
        <div className="bg-gradient-to-br from-slate-900/40 to-slate-950/40 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-2 right-2 flex gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
            <Sliders size={10} className="self-center" />
            {isFa ? 'پلی‌گراند شبیه‌ساز' : 'PLAYGROUND MODE'}
          </div>

          <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            📊 {isFa ? 'شبیه‌ساز و تست دستی هشدارها' : 'Manual Trigger Playbox'}
          </h3>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            {isFa
              ? 'با اسلایدر زیر می‌توانید قیمت فعلی دارایی مشخص شده را به صورت دستی تغییر دهید. این کار به شما اجازه می‌دهد تا بدون نیاز به انتظار قیمت بازار، نحوه ماشه خوردن و فرستادن پیام اخطار بات تلگرامی را مستقیماً شبیه‌سازی و تست نمایید!'
              : 'Slide below to manually modify current quote instantly. Use this to bypass market updates and test alert trigger conditions in real-time.'}
          </p>

          <div className="bg-slate-900/80 border border-slate-800/60 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-white">
                {isFa ? 'قیمت شبیه‌سازی:' : 'Simulation quote:'}
              </span>
              <span className="text-lg font-mono font-bold text-teal-400">
                {formatPrice(sliderPrice, selectedAsset.type)}
              </span>
            </div>

            <input
              type="range"
              min={minSliderVal}
              max={maxSliderVal}
              step={sliderStep}
              value={sliderPrice}
              onChange={handleSliderChange}
              className="w-full accent-teal-400 bg-slate-800 rounded-lg appearance-none h-2 cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>Min: {formatRawPrice(minSliderVal, selectedAsset.type)}</span>
              <span>Reset: {formatRawPrice(selectedAsset.price, selectedAsset.type)}</span>
              <span>Max: {formatRawPrice(maxSliderVal, selectedAsset.type)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR: Asset List with Micro Sparklines */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col max-h-[660px] overflow-hidden">
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
            <Coins size={14} className="text-indigo-400" />
            {isFa ? 'لیست دارایی‌ها' : 'Asset Quotes'}
          </h3>
          {/* Filter Chips */}
          <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-slate-800/50 text-xs">
            {['all', 'crypto', 'gold'].map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type as any)}
                className={`py-1 px-2.5 rounded-md font-semibold transition-all cursor-pointer ${
                  filter === type 
                    ? 'bg-gradient-to-r from-teal-500/20 to-indigo-500/20 text-teal-300 border border-teal-500/20 shadow-md' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {type === 'all' ? (isFa ? 'همه' : 'All') : type === 'crypto' ? (isFa ? 'کریپتو' : 'Crypto') : (isFa ? 'طلا/ارز' : 'Gold')}
              </button>
            ))}
          </div>
        </div>

        {/* Quote Cards */}
        <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
          {filteredAssets.map((asset) => {
            const isActive = selectedSymbol === asset.symbol;
            return (
              <button
                id={`card-${asset.symbol}`}
                key={asset.symbol}
                onClick={() => setSelectedSymbol(asset.symbol)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all text-white flex items-center justify-between cursor-pointer group ${
                  isActive 
                    ? 'bg-gradient-to-r from-teal-500/10 via-indigo-500/5 to-slate-900/50 border-teal-500/40 shadow-teal-500/5 shadow-md scale-[1.01]' 
                    : 'bg-slate-950/30 border-slate-800/50 hover:bg-slate-900/40 hover:border-slate-800'
                }`}
              >
                {/* Symbol/Name */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white ${
                    asset.type === 'crypto' 
                      ? 'bg-teal-500/10 border border-teal-500/20 text-teal-400' 
                      : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  }`}>
                    {asset.symbol.substring(0, 3)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      {isFa ? asset.nameFa : asset.name}
                    </div>
                    <span className="text-slate-500 text-[11px] font-mono tracking-wider">{asset.symbol}</span>
                  </div>
                </div>

                {/* Sparkling chart snippet & numeric change */}
                <div className="flex items-center gap-3 text-right">
                  {/* Miniature Sparkline */}
                  <div className="w-14 h-8 overflow-hidden hidden sm:block">
                    <svg className="w-full h-full">
                      <path
                        d={generateChartPath(asset.history, 56, 32)}
                        fill="none"
                        stroke={asset.change24h >= 0 ? '#10b981' : '#ef4444'}
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>

                  <div>
                    <div className="font-semibold font-mono text-sm">
                      {formatPrice(asset.price, asset.type)}
                    </div>
                    <div className={`text-[11px] font-bold mt-0.5 font-mono ${
                      asset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
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
