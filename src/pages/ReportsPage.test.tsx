import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ReportsPage } from './ReportsPage';
import { renderWithStore } from '../test/helpers/testUtils';
import { createTransaction, createCategory } from '../test/factories/modelFactories';

describe('ReportsPage', () => {
  it('renders report summaries correctly', async () => {
    const category = createCategory({ id: 'cat1', name: 'Food' });
    const transaction = createTransaction({ 
      categoryId: 'cat1', 
      amountCents: -50000, 
      postedDate: new Date().toISOString().split('T')[0] 
    });

    renderWithStore(<ReportsPage onNavigate={vi.fn()} />, {
      categories: [category],
      transactions: [transaction]
    });

    // Check for "Total Spending" summary
    expect(screen.getByText(/Total Spending/i)).toBeDefined();
    
    // Check for the amount ($500.00)
    expect(screen.getAllByText(/\$500\.00/).length).toBeGreaterThan(0);
  });

  it('renders category breakdown', async () => {
    const category = createCategory({ id: 'cat1', name: 'Food' });
    const transaction = createTransaction({ 
      categoryId: 'cat1', 
      amountCents: -50000, 
      postedDate: new Date().toISOString().split('T')[0] 
    });

    renderWithStore(<ReportsPage onNavigate={vi.fn()} />, {
      categories: [category],
      transactions: [transaction]
    });

    // Check if category name appears in breakdown
    expect(screen.getAllByText('Food').length).toBeGreaterThan(0);
  });
});
