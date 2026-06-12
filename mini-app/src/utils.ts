export function formatPrice(price: number, type: 'crypto' | 'fiat' | 'gold', unit: string = ''): string {
  if (type === 'crypto') {
    return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    // Convert IRT (Rial) to Toman if needed
    const displayPrice = unit.toUpperCase() === 'IRT' ? price / 10 : price;
    return displayPrice.toLocaleString('fa-IR') + ' تومان';
  }
}

export function formatPriceEn(price: number, type: 'crypto' | 'fiat' | 'gold', unit: string = ''): string {
  if (type === 'crypto') {
    return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    // Convert IRT (Rial) to Toman if needed
    const displayPrice = unit.toUpperCase() === 'IRT' ? price / 10 : price;
    return displayPrice.toLocaleString('en-US') + ' Toman';
  }
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
