import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { InvestmentsPage } from './InvestmentsPage';
import { renderWithStore } from '../test/helpers/testUtils';
import { createInvestmentTransaction, createHolding, createPriceSnapshot, createAccount } from '../test/factories/modelFactories';

describe('InvestmentsPage', () => {
  it('renders investment holdings correctly', async () => {
    const account = createAccount({ id: 'acc1', name: 'Brokerage', type: 'Brokerage' });
    const holding = createHolding({ symbol: 'AAPL', name: 'Apple', accountId: 'acc1' });
    const tx = createInvestmentTransaction({ 
      symbol: 'AAPL', 
      type: 'Buy', 
      quantity: 10, 
      price: 15000, 
      amountCents: 150000, 
      accountId: 'acc1' 
    });
    const price = createPriceSnapshot({ symbol: 'AAPL', price: 17500 });

    renderWithStore(<InvestmentsPage onNavigate={vi.fn()} />, {
      accounts: [account],
      holdings: [holding],
      investmentTransactions: [tx],
      priceSnapshots: [price]
    });

    // Check for "Total Value" summary
    expect(screen.getByText(/Total Value/i)).toBeDefined();
    
    // Check for the amount ($1,750.00)
    expect(screen.getAllByText(/\$1,750\.00/).length).toBeGreaterThan(0);
    
    // Check for the symbol
    expect(screen.getByText('AAPL')).toBeDefined();
  });
});
