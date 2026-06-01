export async function getCryptoPrices() {
  try {
    // دریافت قیمت از CoinGecko (به دلار)
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether,dogecoin,shiba-inu,tron,cardano,polkadot&vs_currencies=usd",
      {
        headers: {
          'User-Agent': 'Novax-Price-Bot/1.0'
        }
      }
    );
    const data = await response.json();
    console.log("CoinGecko response:", JSON.stringify(data));
    
    const prices = {};
    
    // نقشه‌برداری از نام CoinGecko به نماد
    const mapping = {
      "tether": "USDT",
      "dogecoin": "DOGE",
      "shiba-inu": "SHIB",
      "tron": "TRX",
      "cardano": "ADA",
      "polkadot": "DOT"
    };
    
    // تبدیل دلار به تومان (نرخ تقریبی ۱ دلار = ۱۷۵,۰۰۰ تومان)
    const USD_TO_TOMAN = 175000;
    
    for (const [coinId, symbol] of Object.entries(mapping)) {
      if (data[coinId]?.usd) {
        prices[symbol] = Math.round(data[coinId].usd * USD_TO_TOMAN);
      }
    }
    
    console.log("Processed prices:", JSON.stringify(prices));
    prices._currency = "تومان";
    
    return prices;
  } catch (error) {
    console.error("Failed to fetch crypto prices:", error);
    return null;
  }
}

export async function getIranMarketPrices() {
  const prices = {};
  
  try {
    const response = await fetch("https://api.tgju.org/v1/market/indicator/summary-table-data/global-market");
    const data = await response.json();
    
    if (data?.price_dollar_rl?.p) {
      prices.USD = Math.round(data.price_dollar_rl.p / 10);
    }
    
    if (data?.geram18?.p) {
      prices.GOLD_18K = Math.round(data.geram18.p / 10);
    }
    
    if (data?.sekee?.p) {
      prices.SEKKEH_EMAMI = Math.round(data.sekee.p / 10);
    }
  } catch (error) {
    console.error("Failed to fetch Iran market prices:", error);
  }
  
  return prices;
}

export function formatPrice(price, decimals = 0) {
  return new Intl.NumberFormat("fa-IR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

export function formatCryptoPricesMessage(prices) {
  if (!prices) return "خطا در دریافت قیمت‌ها";
  
  const currency = prices._currency || "USDT";
  const lines = ["💰 قیمت‌های لحظه‌ای:\n"];
  
  if (prices.USDT) lines.push(`💵 تتر (USDT): ${formatPrice(prices.USDT, 0)} ${currency}`);
  if (prices.DOGE) lines.push(`🐕 دوج‌کوین (DOGE): ${formatPrice(prices.DOGE, 0)} ${currency}`);
  if (prices.SHIB) {
    // SHIB خیلی کوچک است، نمایش به ازای ۱ میلیون واحد
    const shibPer1M = prices.SHIB * 1000000;
    lines.push(`🐶 شیبا (SHIB): ${formatPrice(shibPer1M, 0)} ${currency} / ۱M`);
  }
  if (prices.TRX) lines.push(`⚡ ترون (TRX): ${formatPrice(prices.TRX, 0)} ${currency}`);
  if (prices.ADA) lines.push(`🔷 کاردانو (ADA): ${formatPrice(prices.ADA, 0)} ${currency}`);
  if (prices.DOT) lines.push(`🔴 پولکادات (DOT): ${formatPrice(prices.DOT, 0)} ${currency}`);
  
  const now = new Date();
  const time = now.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" });
  const date = now.toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" });
  lines.push(`\nآخرین بروزرسانی: ${date} ${time}`);
  lines.push(`\n⚠️ قیمت‌ها تقریبی و بر اساس نرخ جهانی`);
  
  return lines.join("\n");
}

export function formatIranMarketPricesMessage(prices) {
  if (!prices || Object.keys(prices).length === 0) return "خطا در دریافت قیمت‌ها";
  
  const lines = ["💰 قیمت‌های بازار ایران:\n"];
  
  if (prices.USD) lines.push(`دلار آزاد: ${formatPrice(prices.USD)} تومان`);
  if (prices.GOLD_18K) lines.push(`طلای ۱۸ عیار: ${formatPrice(prices.GOLD_18K)} تومان`);
  if (prices.SEKKEH_EMAMI) lines.push(`سکه امامی: ${formatPrice(prices.SEKKEH_EMAMI)} تومان`);
  
  const now = new Date();
  const time = now.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" });
  lines.push(`\nآخرین بروزرسانی: ${time}`);
  
  return lines.join("\n");
}
