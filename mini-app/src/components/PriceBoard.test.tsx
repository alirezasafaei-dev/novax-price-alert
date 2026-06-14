import { render, screen } from '@testing-library/react';
import PriceBoard from './PriceBoard';
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

    expect(screen.getAllByText(/بیت‌کوین/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/تتر به تومان/i).length).toBeGreaterThan(0);
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

    expect(screen.getByText(/در انتظار دریافت قیمت‌ها/i)).toBeInTheDocument();
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

    // Check that IRT prices are displayed as Toman using Persian digits.
    expect(screen.getAllByText(/۱۸۰٬۰۰۰ تومان/).length).toBeGreaterThan(0);
  });
});
