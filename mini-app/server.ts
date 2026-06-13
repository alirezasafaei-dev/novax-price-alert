import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3002", 10);

app.use(express.json());

// ─── In-Memory Data Store ───
interface SimulatedAsset {
  symbol: string;
  name: string;
  nameFa: string;
  price: number;
  type: 'crypto' | 'fiat' | 'gold';
  unit?: string;
  change24h: number;
  history: number[];
}

let assets: SimulatedAsset[] = [
  { symbol: "BTC", name: "Bitcoin", nameFa: "بیت‌کوین", price: 63060, type: "crypto", unit: "USDT", change24h: 1.45, history: [62000, 62200, 62500, 62300, 62700, 62800, 62900, 63000, 62950, 63020, 63040, 63060] },
  { symbol: "ETH", name: "Ethereum", nameFa: "اتریوم", price: 1657, type: "crypto", unit: "USDT", change24h: -0.80, history: [1680, 1675, 1670, 1665, 1660, 1658, 1655, 1653, 1650, 1652, 1655, 1657] },
  { symbol: "SOL", name: "Solana", nameFa: "سولانا", price: 142, type: "crypto", unit: "USDT", change24h: 4.82, history: [135, 136, 137, 138, 139, 140, 141, 140.5, 141.5, 142, 141.8, 142] },
  { symbol: "TON", name: "Toncoin", nameFa: "تون‌کوین", price: 5.10, type: "crypto", unit: "USDT", change24h: 12.4, history: [4.5, 4.6, 4.7, 4.75, 4.8, 4.9, 4.95, 5.0, 5.05, 5.08, 5.09, 5.10] },
  { symbol: "USDT_IRT", name: "Tether / Toman", nameFa: "تتر به تومان", price: 1804930, type: "fiat", unit: "IRT", change24h: 0.15, history: [1800000, 1801000, 1802000, 1802500, 1803000, 1803500, 1804000, 1804200, 1804500, 1804700, 1804800, 1804930] },
  { symbol: "USD_IRT", name: "US Dollar / Toman", nameFa: "دلار آزاد به تومان", price: 1802000, type: "fiat", unit: "IRT", change24h: 0.20, history: [1798000, 1799000, 1800000, 1800500, 1801000, 1801200, 1801500, 1801700, 1801800, 1801900, 1801950, 1802000] },
  { symbol: "GOLD18", name: "Gold 18k (Garam)", nameFa: "طلای ۱۸ عیار", price: 178789000, type: "gold", unit: "IRT", change24h: -0.42, history: [179000000, 178950000, 178900000, 178850000, 178820000, 178800000, 178790000, 178785000, 178782000, 178780000, 178785000, 178789000] },
  { symbol: "COIN_EMAMI", name: "Emami Coin", nameFa: "سکه امامی", price: 1819900000, type: "gold", unit: "IRT", change24h: -0.25, history: [1822000000, 1821500000, 1821000000, 1820800000, 1820500000, 1820200000, 1820000000, 1819950000, 1819920000, 1819900000, 1819890000, 1819900000] },
];

interface ServerAlert {
  id: string;
  symbol: string;
  assetName: string;
  assetNameFa: string;
  isCrypto: boolean;
  triggerType: 'UPPER' | 'LOWER';
  thresholdPrice: number;
  label: string;
  isActive: boolean;
  isTriggered: boolean;
  createdAt: string;
  triggeredAt?: string;
  telegramUsername?: string;
}

let alerts: ServerAlert[] = [
  {
    id: "alert-1", symbol: "BTC", assetName: "Bitcoin", assetNameFa: "بیت‌کوین",
    isCrypto: true, triggerType: "UPPER", thresholdPrice: 70000,
    label: "بیت کوین هدف هفتاد هزار", isActive: true, isTriggered: false,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "alert-2", symbol: "USD_IRT", assetName: "US Dollar / Toman", assetNameFa: "دلار آزاد به تومان",
    isCrypto: false, triggerType: "LOWER", thresholdPrice: 59500,
    label: "کاهش دلار به زیر شصت تومان", isActive: true, isTriggered: false,
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  },
];

let alertLogs: { id: string; alertId: string; symbol: string; text: string; timestamp: string }[] = [];

// ─── Price drift: gentle, realistic ───
setInterval(() => {
  assets = assets.map(asset => {
    // Much smaller drift: 0.02% per 10s for crypto, 0.005% for fiat/gold
    const pct = asset.type === 'crypto' ? 0.0002 : 0.00005;
    const direction = Math.random() > 0.48 ? 1 : -1;
    const change = asset.price * pct * direction * Math.random();
    const nextPrice = Math.round((asset.price + change) * 100) / 100;
    const history = [...asset.history.slice(1), nextPrice];
    const startPrice = history[0];
    const change24h = Math.round(((nextPrice - startPrice) / startPrice) * 10000) / 100;
    return { ...asset, price: nextPrice, change24h, history };
  });

  // Check alert triggers
  alerts.forEach(alert => {
    if (!alert.isActive || alert.isTriggered) return;
    const matchedAsset = assets.find(a => a.symbol === alert.symbol);
    if (!matchedAsset) return;
    const triggered = (alert.triggerType === 'UPPER' && matchedAsset.price >= alert.thresholdPrice) ||
                      (alert.triggerType === 'LOWER' && matchedAsset.price <= alert.thresholdPrice);
    if (triggered) {
      alert.isTriggered = true;
      alert.triggeredAt = new Date().toISOString();
      const logText = `🔔 هشدار قیمت NovaX: دارایی ${alert.assetNameFa} (${alert.symbol}) به قیمت هدف ${alert.thresholdPrice.toLocaleString('fa-IR')} رسید! (قیمت فعلی: ${matchedAsset.price.toLocaleString('fa-IR')})`;
      alertLogs.unshift({ id: `log-${Math.random().toString(36).substr(2, 9)}`, alertId: alert.id, symbol: alert.symbol, text: logText, timestamp: new Date().toISOString() });
      console.log(`Alert Triggered: ${alert.label} (${alert.symbol})`);
    }
  });
}, 10000);

// ─── Local AI responses (fallback when Gemini is unavailable) ───
const localResponses: Record<string, { fa: string; en: string }> = {
  btc: {
    fa: `📊 تحلیل بیت‌کوین (BTC):
قیمت فعلی: $63,060 | تغییر ۲۴ساعته: +1.45%

🔹 روند: صعودی ملایم
🔹 حمایت: $60,000 | مقاومت: $70,000
🔹 حجم معاملات: در حال افزایش
🔹 احتمال کوتاه‌مدت: ادامه صعود تا نزدیکی مقاومت $70,000

توصیه: اگر به دنبال خرید هستید، منتظر اصلاح به نزدیکی $60,000 باشید.`,
    en: `📊 Bitcoin (BTC) Analysis:
Current: $63,060 | 24h Change: +1.45%

🔹 Trend: Mildly bullish
🔹 Support: $60,000 | Resistance: $70,000
🔹 Volume: Increasing
🔹 Short-term: Likely continuation toward $70,000 resistance

Tip: Watch for a pullback near $60,000 for potential entry.`,
  },
  eth: {
    fa: `📊 تحلیل اتریوم (ETH):
قیمت فعلی: $1,657 | تغییر ۲۴ساعته: -0.80%

🔹 روند: نزولی ملایم
🔹 حمایت: $1,550 | مقاومت: $1,700
🔹 حجم معاملات: ثابت
🔹 احتمال کوتاه‌مدت: رنج بین حمایت و مقاومت

توصیه: منتظر شکست $1,700 برای تایید صعود باشید.`,
    en: `📊 Ethereum (ETH) Analysis:
Current: $1,657 | 24h Change: -0.80%

🔹 Trend: Mildly bearish
🔹 Support: $1,550 | Resistance: $1,700
🔹 Volume: Steady
🔹 Short-term: Range-bound between support and resistance

Tip: Wait for a break above $1,700 for bullish confirmation.`,
  },
  gold: {
    fa: `📊 تحلیل طلا و سکه:
طلای ۱۸ عیار: ۱۷۸,۷۸۹,۰۰۰ تومان (-0.42%)
سکه امامی: ۱,۸۱۹,۹۰۰,۰۰۰ تومان (-0.25%)

🔹 روند: کاهشی ملایم
🔹 دلار آزاد: ۱,۸۰۲,۰۰۰ تومان (+0.20%)
🔹 تتر: ۱,۸۰۴,۹۳۰ تومان (+0.15%)

توصیه: با توجه به کاهش طلا و تثبیت دلار، احتمال اصلاح بیشتر طلا وجود دارد.`,
    en: `📊 Gold & Coin Analysis:
18K Gold: 178,789,000 Toman (-0.42%)
Emami Coin: 1,819,900,000 Toman (-0.25%)

🔹 Trend: Mildly bearish
🔹 USD/Toman: 1,802,000 (+0.20%)
🔹 USDT/Toman: 1,804,930 (+0.15%)

Tip: Gold may see further correction given the stable dollar.`,
  },
  default: {
    fa: `🤖 دستیار هوشمند NovaX:

من می‌توانم در موارد زیر کمک کنم:
• تحلیل قیمت بیت‌کوین، اتریوم، سولانا، تون‌کوین
• تحلیل روند طلا و سکه امامی
• اطلاعات درباره دلار و تتر تومانی
• راهنمایی درباره تنظیم هشدارها

لطفاً سؤال خود را بپرسید! 💡`,
    en: `🤖 NovaX AI Assistant:

I can help you with:
• Bitcoin, Ethereum, Solana, TON price analysis
• Gold and Emami Coin trend analysis
• USD/Toman and Tether/Toman rates
• Alert setup guidance

Please ask your question! 💡`,
  },
};

function getLocalResponse(message: string, isFa: boolean): string {
  const lower = message.toLowerCase();
  if (lower.includes('btc') || lower.includes('bitcoin') || lower.includes('بیت')) return localResponses.btc[isFa ? 'fa' : 'en'];
  if (lower.includes('eth') || lower.includes('ethereum') || lower.includes('اتریوم')) return localResponses.eth[isFa ? 'fa' : 'en'];
  if (lower.includes('gold') || lower.includes('طلا') || lower.includes('سکه') || lower.includes('coin')) return localResponses.gold[isFa ? 'fa' : 'en'];
  return localResponses.default[isFa ? 'fa' : 'en'];
}

// ─── API Routes ───

app.get("/api/prices", (req, res) => { res.json(assets); });

app.get("/api/alerts", (req, res) => { res.json(alerts); });

app.post("/api/alerts", (req, res) => {
  const { symbol, triggerType, thresholdPrice, label, telegramUsername } = req.body;
  const matchedAsset = assets.find(a => a.symbol === symbol);
  if (!matchedAsset) return res.status(404).json({ error: "Asset not found" });
  const newAlert: ServerAlert = {
    id: `alert-${Math.random().toString(36).substr(2, 9)}`,
    symbol, assetName: matchedAsset.name, assetNameFa: matchedAsset.nameFa,
    isCrypto: matchedAsset.type === 'crypto', triggerType,
    thresholdPrice: Number(thresholdPrice),
    label: label || `هشدار قیمت ${matchedAsset.nameFa}`,
    isActive: true, isTriggered: false,
    createdAt: new Date().toISOString(),
    telegramUsername: telegramUsername || "novax_user",
  };
  alerts.unshift(newAlert);
  res.json(newAlert);
});

app.delete("/api/alerts/:id", (req, res) => {
  alerts = alerts.filter(a => a.id !== req.params.id);
  res.json({ success: true, message: "Alert removed" });
});

app.patch("/api/alerts/:id", (req, res) => {
  const alert = alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  const { thresholdPrice, label } = req.body;
  if (thresholdPrice !== undefined) {
    alert.thresholdPrice = Number(thresholdPrice);
    alert.isTriggered = false;
    delete alert.triggeredAt;
  }
  if (label !== undefined) {
    alert.label = String(label || "");
  }
  res.json(alert);
});

app.put("/api/alerts/:id/toggle", (req, res) => {
  const alert = alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  alert.isActive = !alert.isActive;
  if (alert.isActive) { alert.isTriggered = false; delete alert.triggeredAt; }
  res.json(alert);
});

app.get("/api/alerts/logs", (req, res) => { res.json(alertLogs); });

app.post("/api/prices/trigger-manual", (req, res) => {
  const { symbol, targetPrice } = req.body;
  const matchedAsset = assets.find(a => a.symbol === symbol);
  if (!matchedAsset) return res.status(404).json({ error: "Asset not found" });
  matchedAsset.price = Number(targetPrice);
  matchedAsset.history = [...matchedAsset.history.slice(1), matchedAsset.price];
  res.json({ success: true, asset: matchedAsset });
});

// ─── AI Chat with local fallback ───
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  const isFa = /[آ-ی]/.test(message);
  const lower = message.toLowerCase();

  // Try Gemini first if key is configured
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.length > 10 && !geminiKey.includes('.')) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const model = ai.models['gemini-2.0-flash'] || ai.models['gemini-2.5-flash'];
      if (model) {
        const priceContext = assets.map(a => `${a.symbol}: ${a.price} (${a.change24h > 0 ? '+' : ''}${a.change24h}%)`).join(', ');
        const prompt = isFa
          ? `شما یک تحلیلگر مالی حرفه‌ای هستید. قیمت‌های فعلی: ${priceContext}. سؤال کاربر: ${message}. پاسخ کوتاه و حرفه‌ای به فارسی بدهید.`
          : `You are a professional financial analyst. Current prices: ${priceContext}. User question: ${message}. Give a concise, professional answer.`;
        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.() || '';
        if (text) return res.json({ text });
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('location') || msg.includes('denied') || msg.includes('403')) {
        // Geo-restricted or key issue — use local fallback
        const response = getLocalResponse(message, isFa);
        return res.json({ text: response + (isFa ? '\n\n(استفاده از پاسخ محلی — دستیار هوشمند در این منطقه در دسترس نیست)' : '\n\n(Using local response — AI assistant is not available in this region)') });
      }
      throw err;
    }
  }

  // Local fallback
  const response = getLocalResponse(message, isFa);
  res.json({ text: response });
});

// ─── Start server ───
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 NovaX Full-Stack Server running on http://localhost:${PORT}`);
  });
}

startServer();
