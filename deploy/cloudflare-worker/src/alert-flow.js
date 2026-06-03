import { formatPrice } from "./prices.js";

export const FLOW_STATES = {
  CHOOSING_MARKET: "choosing_market",
  CHOOSING_ASSET: "choosing_asset",
  CHOOSING_CONDITION: "choosing_condition",
  ENTERING_PRICE: "entering_price",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
  ERRORED: "errored",
};

export const ALERT_LIFECYCLE = {
  PENDING_CONFIRMATION: "pending_confirmation",
  ACTIVE: "active",
  DELIVERY_IN_PROGRESS: "delivery_in_progress",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  FAILED: "failed",
};

export function normalizeTargetPrice(input) {
  const digitMap = {
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
  };
  const cleaned = String(input)
    .replace(/[۰-۹٠-٩]/g, (digit) => digitMap[digit] || digit)
    .replace(/[,،\s]/g, "");
  const normalized = Number(cleaned);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return Math.round(normalized * 100000000) / 100000000;
}


export function operatorLabel(operator) {
  return operator === "above" ? "بالاتر از" : "پایین‌تر از";
}

export function formatNormalizedTarget(target, unit, market = "fiat") {
  const decimals = market === "crypto" && target < 100 ? 2 : 0;
  return `${formatPrice(target, decimals)} ${unit}`;
}

export function buildAlertSummary(alertData, currentPriceText = "نامشخص") {
  const target = formatNormalizedTarget(
    alertData.target,
    alertData.target_price_display_unit,
    alertData.market,
  );
  return `لطفاً هشدار را بررسی و تایید کن:

دارایی: ${alertData.display_asset_name_at_creation}
شرط: ${operatorLabel(alertData.operator)} ${target}
قیمت فعلی: ${currentPriceText}

بعد از تایید، هشدار فعال می‌شود.`;
}
