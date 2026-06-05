export function formatPrice(price: number, type: 'crypto' | 'fiat' | 'gold'): string {
  if (type === 'crypto') {
    return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    // Toman/Gold
    return price.toLocaleString('fa-IR') + ' تومان';
  }
}

export function formatPriceEn(price: number, type: 'crypto' | 'fiat' | 'gold'): string {
  if (type === 'crypto') {
    return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    return price.toLocaleString('en-US') + ' Toman';
  }
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
