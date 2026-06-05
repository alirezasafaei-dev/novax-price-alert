import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client safely with lazy checks or try-catch
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      console.warn("⚠️ GEMINI_API_KEY is not defined or is placeholder. Gemini helper will fallback.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "",
    });
  }
  return aiClient;
}

// In-Memory Data Store for simulation and alerts
interface SimulatedAsset {
  symbol: string;
  name: string;
  nameFa: string;
  price: number;
  type: 'crypto' | 'fiat' | 'gold';
  change24h: number;
  history: number[];
}

let assets: SimulatedAsset[] = [
  { symbol: "BTC", name: "Bitcoin", nameFa: "بیت‌کوین", price: 68500, type: "crypto", change24h: 1.45, history: [67100, 67300, 67800, 67400, 67900, 68100, 68000, 68200, 68500, 68300, 68400, 68500] },
  { symbol: "ETH", name: "Ethereum", nameFa: "اتریوم", price: 3450, type: "crypto", change24h: -0.80, history: [3510, 3500, 3480, 3490, 3470, 3460, 3455, 3440, 3420, 3435, 3450, 3450] },
  { symbol: "SOL", name: "Solana", nameFa: "سولانا", price: 165.20, type: "crypto", change24h: 4.82, history: [155, 156, 158, 157, 161, 160, 162, 163, 165.20, 164.50, 165.00, 165.20] },
  { symbol: "TON", name: "Toncoin", nameFa: "تون‌کوین", price: 7.35, type: "crypto", change24h: 12.4, history: [6.4, 6.5, 6.7, 6.8, 6.9, 7.1, 7.15, 7.20, 7.42, 7.30, 7.32, 7.35] },
  { symbol: "USDT_IRT", name: "Tether / Toman", nameFa: "تتر به تومان", price: 60200, type: "fiat", change24h: 0.15, history: [59900, 60000, 60100, 60150, 60100, 60200, 60180, 60250, 60220, 60200, 60190, 60200] },
  { symbol: "USD_IRT", name: "US Dollar / Toman", nameFa: "دلار آزاد به تومان", price: 60500, type: "fiat", change24h: 0.20, history: [60200, 60300, 60400, 60450, 60400, 60500, 60480, 60550, 60520, 60500, 60490, 60500] },
  { symbol: "GOLD18", name: "Gold 18k (Garam)", nameFa: "طلای ۱۸ عیار", price: 3340000, type: "gold", change24h: -0.42, history: [3365000, 3360000, 3358000, 3350000, 3355000, 3352000, 3348000, 3345000, 3343000, 3341000, 3340000, 3340000] },
  { symbol: "COIN_EMAMI", name: "Emami Coin", nameFa: "سکه امامی", price: 40100000, type: "gold", change24h: -0.25, history: [40300000, 40250000, 40220000, 40200000, 40250000, 40210000, 40180000, 40150000, 40130000, 40110000, 40100000, 40100000] }
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
    id: "alert-1",
    symbol: "BTC",
    assetName: "Bitcoin",
    assetNameFa: "بیت‌کوین",
    isCrypto: true,
    triggerType: "UPPER",
    thresholdPrice: 70000,
    label: "بیت کوین هدف هفتاد هزار",
    isActive: true,
    isTriggered: false,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: "alert-2",
    symbol: "USD_IRT",
    assetName: "US Dollar / Toman",
    assetNameFa: "دلار آزاد به تومان",
    isCrypto: false,
    triggerType: "LOWER",
    thresholdPrice: 59500,
    label: "کاهش دلار به زیر شصت تومان",
    isActive: true,
    isTriggered: false,
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  }
];

let alertLogs: { id: string; alertId: string; symbol: string; text: string; timestamp: string }[] = [];

// Periodically simulate price changes (drift)
setInterval(() => {
  assets = assets.map(asset => {
    // Determine step size depending on cryptocurrency vs fiat/gold
    const pct = asset.type === 'crypto' ? 0.0015 : 0.0005;
    const direction = Math.random() > 0.48 ? 1 : -1;
    const change = asset.price * pct * direction * Math.random();
    const nextPrice = Math.round((asset.price + change) * 100) / 100;
    
    // update 12-point history
    const history = [...asset.history.slice(1), nextPrice];
    
    // calculate daily change
    const startPrice = history[0];
    const change24h = Math.round(((nextPrice - startPrice) / startPrice) * 10000) / 100;

    return {
      ...asset,
      price: nextPrice,
      change24h,
      history
    };
  });

  // Check alert triggers
  alerts.forEach(alert => {
    if (!alert.isActive || alert.isTriggered) return;

    const matchedAsset = assets.find(a => a.symbol === alert.symbol);
    if (!matchedAsset) return;

    let triggerCondition = false;
    if (alert.triggerType === 'UPPER' && matchedAsset.price >= alert.thresholdPrice) {
      triggerCondition = true;
    } else if (alert.triggerType === 'LOWER' && matchedAsset.price <= alert.thresholdPrice) {
      triggerCondition = true;
    }

    if (triggerCondition) {
      alert.isTriggered = true;
      alert.triggeredAt = new Date().toISOString();
      
      const logText = `🔔 هشدار قیمت NovaX: دارایی ${alert.assetNameFa} (${alert.symbol}) به قیمت هدف ${alert.thresholdPrice.toLocaleString('fa-IR')} رسید! (قیمت فعلی: ${matchedAsset.price.toLocaleString('fa-IR')})`;
      alertLogs.unshift({
        id: `log-${Math.random().toString(36).substr(2, 9)}`,
        alertId: alert.id,
        symbol: alert.symbol,
        text: logText,
        timestamp: new Date().toISOString()
      });
      console.log(`Alert Triggered: ${alert.label} (${alert.symbol})`);
    }
  });
}, 10000); // Check every 10 seconds

// GET Prices
app.get("/api/prices", (req, res) => {
  res.json(assets);
});

// GET Alerts
app.get("/api/alerts", (req, res) => {
  res.json(alerts);
});

// POST Create Alert
app.post("/api/alerts", (req, res) => {
  const { symbol, triggerType, thresholdPrice, label, telegramUsername } = req.body;
  
  const matchedAsset = assets.find(a => a.symbol === symbol);
  if (!matchedAsset) {
    return res.status(404).json({ error: "Asset not found" });
  }

  const newAlert: ServerAlert = {
    id: `alert-${Math.random().toString(36).substr(2, 9)}`,
    symbol,
    assetName: matchedAsset.name,
    assetNameFa: matchedAsset.nameFa,
    isCrypto: matchedAsset.type === 'crypto',
    triggerType,
    thresholdPrice: Number(thresholdPrice),
    label: label || `هشدار قیمت ${matchedAsset.nameFa}`,
    isActive: true,
    isTriggered: false,
    createdAt: new Date().toISOString(),
    telegramUsername: telegramUsername || "novax_user"
  };

  alerts.unshift(newAlert);
  res.json(newAlert);
});

// DELETE Alert
app.delete("/api/alerts/:id", (req, res) => {
  const id = req.params.id;
  alerts = alerts.filter(a => a.id !== id);
  res.json({ success: true, message: "Alert removed successfully" });
});

// PUT Toggle Alert Status
app.put("/api/alerts/:id/toggle", (req, res) => {
  const id = req.params.id;
  const alert = alerts.find(a => a.id === id);
  if (!alert) {
    return res.status(404).json({ error: "Alert not found" });
  }
  alert.isActive = !alert.isActive;
  // If reactivating, clear triggered state
  if (alert.isActive) {
    alert.isTriggered = false;
    delete alert.triggeredAt;
  }
  res.json(alert);
});

// GET Trigger logs
app.get("/api/alerts/logs", (req, res) => {
  res.json(alertLogs);
});

// POST Manual Price Trigger (to help testing the bot notifications!)
app.post("/api/prices/trigger-manual", (req, res) => {
  const { symbol, targetPrice } = req.body;
  const matchedAsset = assets.find(a => a.symbol === symbol);
  if (!matchedAsset) {
    return res.status(404).json({ error: "Asset not found" });
  }

  matchedAsset.price = Number(targetPrice);
  matchedAsset.history = [...matchedAsset.history.slice(1), matchedAsset.price];
  
  res.json({ success: true, asset: matchedAsset });
});

// POST Gemini AI Chat Assistant
app.post("/api/chat", async (req, res) => {
  const { message, chatHistory } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const ai = getGemini();
    const systemPrompt = `You are "NovaX Financial Assistant", an AI-powered financial market advisor integrated into the NovaX Telegram Bot (@novax_price_bot) and Mini App.
The NovaX project repository is hosted on GitHub (https://github.com/alirezasafaei-dev/novax-price-alert).
Your goals:
- Answer user questions regarding cryptocurrency (Binance quotes: BTC, ETH, TON, SOL) and Iranian local markets (TGJU quotes: Toman, gold, coins).
- Provide analytical, intelligent, and safe technical outlooks. Remind users everything is educational and not financial advice (سلب مسئولیت مالی).
- Support fluent Persian (Farsi) as the primary language, but you can also respond in English if asked. Under-the-hood, talk to them with a warm, expert, professional Persian tone.
- Explain how NovaX registered alerts work: users select assets, set upper or lower target boundaries (مثلاً بیت‌کوین هدف ۷۰ هزار دلار), and our cron schedules check every 10 minutes (or immediately via Webhook) and send a stylish Telegram push notifier.
- Refer to their repository (alirezasafaei-dev/novax-price-alert) if developers ask about hosting. It's written in TypeScript/Node and runs beautifully on a VPS, Render, or Cloudflare Workers.

Here is the current live asset prices matrix to help make your analysis extremely real and factual:
${JSON.stringify(assets.map(a => `${a.nameFa} (${a.symbol}): price ${a.price.toLocaleString()} ${a.type === 'crypto' ? 'USD' : 'Toman'} with 24h change of ${a.change24h}%`), null, 2)}
Include specific prices and calculations if they ask for trends or comparisons. Make sure your Persian rendering is beautiful, and formatting works cleanly with markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini Assistant Error:", error);
    const msg = (error?.message || "").toLowerCase();
    const isGeo = msg.includes("location") || msg.includes("not supported") || msg.includes("failed_precondition");
    const isDenied = msg.includes("denied") || msg.includes("permission") || msg.includes("403");
    let userError = "خطایی در برقراری ارتباط با هوش مصنوعی رخ داده است.";
    if (isGeo) {
      userError = "تحلیل‌گر هوشمند فعلاً در این منطقه در دسترس نیست (محدودیت ارائه‌دهنده). از ابزارهای دستی و هشدارهای ربات استفاده کنید.";
    } else if (isDenied) {
      userError = "دسترسی به هوش مصنوعی محدود شده. لطفاً کلید GEMINI_API_KEY معتبر را بررسی کنید.";
    }
    res.status(500).json({
      error: userError,
      details: isGeo || isDenied ? undefined : error.message
    });
  }
});


// Start the custom Express server with Vite orchestration
async function startServer() {
  // Vite developer middleware for non-production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 NovaX Full-Stack Server running on http://localhost:${PORT}`);
  });
}

startServer();
