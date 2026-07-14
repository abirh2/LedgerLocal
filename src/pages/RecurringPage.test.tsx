import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { RecurringPage } from './RecurringPage';
import { renderWithStore } from '../test/helpers/testUtils';
import { createTransaction } from '../test/factories/modelFactories';

describe('RecurringPage', () => {
  it('detects and renders recurring transactions', async () => {
    // 3 identical transactions for Netflix
    const tx1 = createTransaction({ merchantName: 'Netflix', amountCents: -1599, postedDate: '2026-05-01' });
    const tx2 = createTransaction({ merchantName: 'Netflix', amountCents: -1599, postedDate: '2026-06-01' });
    const tx3 = createTransaction({ merchantName: 'Netflix', amountCents: -1599, postedDate: '2026-07-01' });

    renderWithStore(<RecurringPage onNavigate={vi.fn()} />, {
      transactions: [tx1, tx2, tx3]
    });

    // Check if Netflix is detected
    expect(screen.getByText('Netflix')).toBeDefined();
    
    // Check if frequency is displayed
    expect(screen.getAllByText('Monthly').length).toBeGreaterThan(0);
    
    // Check if amount is displayed ($15.99)
    expect(screen.getAllByText(/\$15\.99/).length).toBeGreaterThan(0);
  });
});
