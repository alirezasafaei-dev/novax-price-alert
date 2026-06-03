export const ASSETS = {
  "crypto:BTC": {
    canonical_asset_id: "crypto:BTC",
    market: "crypto",
    symbol: "BTC",
    display_name: "بیت‌کوین (BTC)",
    aliases: ["bitcoin", "btc", "بیت کوین"],
    unit: "USDT",
  },
  "crypto:ETH": {
    canonical_asset_id: "crypto:ETH",
    market: "crypto",
    symbol: "ETH",
    display_name: "اتریوم (ETH)",
    aliases: ["ethereum", "eth", "اتر"],
    unit: "USDT",
  },
  "crypto:SOL": {
    canonical_asset_id: "crypto:SOL",
    market: "crypto",
    symbol: "SOL",
    display_name: "سولانا (SOL)",
    aliases: ["solana", "sol"],
    unit: "USDT",
  },
  "crypto:BNB": {
    canonical_asset_id: "crypto:BNB",
    market: "crypto",
    symbol: "BNB",
    display_name: "بایننس کوین (BNB)",
    aliases: ["binance coin", "bnb"],
    unit: "USDT",
  },
  "fiat:USD": {
    canonical_asset_id: "fiat:USD",
    market: "fiat",
    symbol: "USD",
    display_name: "دلار (USD)",
    aliases: ["usd", "dollar", "دلار"],
    unit: "تومان",
  },
  "fiat:EUR": {
    canonical_asset_id: "fiat:EUR",
    market: "fiat",
    symbol: "EUR",
    display_name: "یورو (EUR)",
    aliases: ["eur", "euro", "یورو"],
    unit: "تومان",
  },
  "gold:GOLD_18K": {
    canonical_asset_id: "gold:GOLD_18K",
    market: "gold",
    symbol: "GOLD_18K",
    display_name: "طلای ۱۸ عیار",
    aliases: ["gold_18k", "geram18", "طلای ۱۸"],
    unit: "تومان",
  },
  "gold:SEKKEH_EMAMI": {
    canonical_asset_id: "gold:SEKKEH_EMAMI",
    market: "gold",
    symbol: "SEKKEH_EMAMI",
    display_name: "سکه امامی",
    aliases: ["sekee", "سکه", "امامی"],
    unit: "تومان",
  },
};

export function canonicalAssetId(market, symbol) {
  return `${market}:${symbol}`;
}

export function getAssetByMarketSymbol(market, symbol) {
  return ASSETS[canonicalAssetId(market, symbol)] || null;
}

export function getAssetByCanonicalId(canonicalAssetId) {
  return ASSETS[canonicalAssetId] || null;
}
