async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
      
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// نمادهای کریپتوی پشتیبانی‌شده و جفت معاملاتی Binance آن‌ها
const CRYPTO_BINANCE_SYMBOLS = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
};

export async function getCryptoPrices() {
  try {
    // قیمت لحظه‌ای از Binance (واحد: USDT)
    // از endpoint داده‌های عمومی Binance استفاده می‌کنیم که محدودیت جغرافیایی ندارد.
    const pairs = Object.values(CRYPTO_BINANCE_SYMBOLS);
    const symbolsParam = encodeURIComponent(JSON.stringify(pairs));
    const response = await fetchWithRetry(
      `https://data-api.binance.vision/api/v3/ticker/price?symbols=${symbolsParam}`,
      {
        headers: {
          'User-Agent': 'Novax-Price-Bot/1.0'
        }
      }
    );
    const data = await response.json();

    // نقشه‌برداری از جفت معاملاتی به نماد ساده
    const pairToSymbol = {};
    for (const [symbol, pair] of Object.entries(CRYPTO_BINANCE_SYMBOLS)) {
      pairToSymbol[pair] = symbol;
    }

    const prices = {};
    if (Array.isArray(data)) {
      for (const item of data) {
        const symbol = pairToSymbol[item?.symbol];
        const price = Number(item?.price);
        if (symbol && Number.isFinite(price)) {
          prices[symbol] = price;
        }
      }
    }

    prices._currency = "USDT";
    return prices;
  } catch (error) {
    console.error("Failed to fetch crypto prices:", error);
    return null;
  }
}

// مقدار خام TGJU ممکن است رشته‌ای با کاما (ریال) باشد یا عدد؛ هر دو را به عدد تبدیل می‌کنیم.
function parseTgjuRial(raw) {
  if (raw === undefined || raw === null) return null;
  const num = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

export async function getIranMarketPrices() {
  const prices = {};

  // endpointهای آینه‌ای TGJU؛ به ترتیب امتحان می‌شوند تا یکی پاسخ بدهد.
  const endpoints = [
    "https://call2.tgju.org/ajax.json",
    "https://call3.tgju.org/ajax.json",
    "https://call1.tgju.org/ajax.json",
  ];

  let data = null;
  for (const url of endpoints) {
    try {
      const response = await fetchWithRetry(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Novax-Price-Bot/1.0)" },
      });
      data = await response.json();
      if (data) break;
    } catch (error) {
      console.error(`Failed to fetch Iran market prices from ${url}:`, error.message);
    }
  }

  if (!data) return prices;

  // ساختار جدید TGJU مقادیر را زیر کلید current قرار می‌دهد؛ نسخه‌ی قدیمی در سطح بالا بود.
  const table = data.current && typeof data.current === "object" ? data.current : data;

  const assign = (key, target) => {
    const rial = parseTgjuRial(table?.[key]?.p);
    if (rial !== null) prices[target] = Math.round(rial / 10);
  };

  assign("price_dollar_rl", "USD");
  assign("price_eur", "EUR");
  assign("geram18", "GOLD_18K");
  assign("sekee", "SEKKEH_EMAMI");

  return prices;
}

export function formatPrice(price, decimals = 0) {
  return new Intl.NumberFormat("fa-IR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

// نام نمایشی دارایی‌ها
export const ASSET_NAMES = {
  BTC: "بیت‌کوین (BTC)",
  ETH: "اتریوم (ETH)",
  SOL: "سولانا (SOL)",
  BNB: "بایننس کوین (BNB)",
  USD: "دلار",
  EUR: "یورو",
  GOLD_18K: "طلای ۱۸ عیار",
  SEKKEH_EMAMI: "سکه امامی",
};

export const CRYPTO_SYMBOLS = Object.keys(CRYPTO_BINANCE_SYMBOLS);

// واحد نمایشی بر اساس بازار
export function unitForMarket(market) {
  return market === "crypto" ? "USDT" : "تومان";
}

// قیمت فعلی یک دارایی را از منبع مربوط به همان بازار می‌گیرد (یا null اگر در دسترس نبود).
export async function getCurrentPrice(market, symbol) {
  const prices = market === "crypto" ? await getCryptoPrices() : await getIranMarketPrices();
  const price = prices?.[symbol];
  return price === undefined || price === null ? null : price;
}

// قیمت فعلی را با واحد و تعداد رقم اعشار مناسبِ بازار قالب‌بندی می‌کند.
export function formatCurrentPrice(price, market, unit = unitForMarket(market)) {
  if (price === null || price === undefined) return "نامشخص";
  const decimals = market === "crypto" && price < 100 ? 2 : 0;
  return `${formatPrice(price, decimals)} ${unit}`;
}

export function assetLabel(symbol) {
  return ASSET_NAMES[symbol] || symbol;
}

function updatedAtLine() {
  const now = new Date();
  const time = now.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" });
  return `\nآخرین بروزرسانی: ${time}`;
}

export function formatCryptoPricesMessage(prices) {
  if (!prices || Object.keys(prices).filter((k) => k !== "_currency").length === 0) {
    return "خطا در دریافت قیمت‌ها. لطفاً دوباره تلاش کن.";
  }

  const lines = ["💰 قیمت‌های فعلی کریپتو\n"];
  for (const symbol of CRYPTO_SYMBOLS) {
    const price = prices[symbol];
    if (price === undefined || price === null) continue;
    const decimals = price >= 100 ? 0 : 2;
    lines.push(`${symbol}: ${formatPrice(price, decimals)} USDT`);
  }
  lines.push(updatedAtLine());
  return lines.join("\n");
}

export function formatFiatPricesMessage(prices) {
  if (!prices || (!prices.USD && !prices.EUR)) {
    return "خطا در دریافت قیمت‌ها. لطفاً دوباره تلاش کن.";
  }
  const lines = ["💵 قیمت ارز\n"];
  if (prices.USD) lines.push(`دلار (USD): ${formatPrice(prices.USD)} تومان`);
  if (prices.EUR) lines.push(`یورو (EUR): ${formatPrice(prices.EUR)} تومان`);
  lines.push(updatedAtLine());
  return lines.join("\n");
}

export function formatGoldPricesMessage(prices) {
  if (!prices || (!prices.GOLD_18K && !prices.SEKKEH_EMAMI)) {
    return "خطا در دریافت قیمت‌ها. لطفاً دوباره تلاش کن.";
  }
  const lines = ["🪙 قیمت طلا\n"];
  if (prices.GOLD_18K) lines.push(`طلای ۱۸ عیار: ${formatPrice(prices.GOLD_18K)} تومان`);
  if (prices.SEKKEH_EMAMI) lines.push(`سکه امامی: ${formatPrice(prices.SEKKEH_EMAMI)} تومان`);
  lines.push(updatedAtLine());
  return lines.join("\n");
}
