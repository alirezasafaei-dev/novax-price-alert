export interface Asset {
  symbol: string;
  name: string;
  nameFa: string;
  price: number; // in USD for crypto, in Toman for fiat/gold
  priceInToman?: number; // Calculated or direct
  type: 'crypto' | 'fiat' | 'gold';
  change24h: number; // percentage change (e.g. 1.25 for +1.25%)
  history: number[]; // 12-point recent history for sparkline
}

export interface Alert {
  id: string;
  symbol: string;
  assetName: string;
  assetNameFa: string;
  isCrypto: boolean;
  triggerType: 'UPPER' | 'LOWER';
  thresholdPrice: number; // threshold value
  label: string;
  isActive: boolean;
  isTriggered: boolean;
  createdAt: string;
  triggeredAt?: string;
  telegramUsername?: string;
}

export interface AlertLog {
  id: string;
  alertId: string;
  symbol: string;
  text: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
