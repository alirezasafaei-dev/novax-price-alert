import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PriceBoard from '../PriceBoard';
import { Asset } from '../types';

describe('PriceBoard', () => {
  const mockAssets: Asset[] = [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      nameFa: 'بیت‌کوین',
      price: 63000,
      unit: 'USDT',
      type: 'crypto',
      change24h: 1.45,
      history: [62000, 62500, 63000],
    },
    {
      symbol: 'USDT_IRT',
      name: 'Tether / Toman',
      nameFa: 'تتر به تومان',
      price: 1800000,
      unit: 'IRT',
      type: 'fiat',
      change24h: 0.15,
      history: [1790000, 1795000, 1800000],
    },
  ];

  it('renders price board with assets', () => {
    render(
      <PriceBoard
        assets={mockAssets}
        language="fa"
        onSelectAssetForAlert={jest.fn()}
        onManualTriggerPrice={jest.fn()}
      />
    );

    expect(screen.getByText(/بیت‌کوین/i)).toBeInTheDocument();
    expect(screen.getByText(/تتر به تومان/i)).toBeInTheDocument();
  });

  it('shows loading state when no assets', () => {
    render(
      <PriceBoard
        assets={[]}
        language="fa"
        onSelectAssetForAlert={jest.fn()}
        onManualTriggerPrice={jest.fn()}
      />
    );

    expect(screen.getByText(/در انتظار داده‌های قیمت/i)).toBeInTheDocument();
  });

  it('formats prices correctly', () => {
    render(
      <PriceBoard
        assets={mockAssets}
        language="fa"
        onSelectAssetForAlert={jest.fn()}
        onManualTriggerPrice={jest.fn()}
      />
    );

    // Check that prices are displayed (Toman converted from Rial)
    expect(screen.getByText(/180,000/)).toBeInTheDocument();
  });
});