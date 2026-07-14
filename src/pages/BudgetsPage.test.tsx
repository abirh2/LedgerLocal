import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { BudgetsPage } from './BudgetsPage';
import { renderWithStore } from '../test/helpers/testUtils';
import { createCategory, createBudget, createTransaction } from '../test/factories/modelFactories';

describe('BudgetsPage', () => {
  it('renders budget data correctly', async () => {
    const category = createCategory({ id: 'cat1', name: 'Groceries' });
    const budget = createBudget({ categoryId: 'cat1', amountCents: 50000, month: new Date().toISOString().slice(0, 7) });
    const transaction = createTransaction({ 
      categoryId: 'cat1', 
      amountCents: -20000, 
      postedDate: new Date().toISOString().split('T')[0] 
    });

    renderWithStore(<BudgetsPage onNavigate={vi.fn()} />, {
      categories: [category],
      budgets: [budget],
      transactions: [transaction],
      categoryGroups: [{ id: 'Food', name: 'Food', order: 0 }]
    });

    // Check if category name is rendered
    expect(screen.getByText('Groceries')).toBeDefined();
    
    // Check if budget amount is rendered ($500.00)
    expect(screen.getAllByText(/\$500\.00/).length).toBeGreaterThan(0);
    
    // Check if spending is rendered ($200.00)
    expect(screen.getAllByText(/\$200\.00/).length).toBeGreaterThan(0);
  });

  it('opens add budget dialog', async () => {
    const category = createCategory({ id: 'cat1', name: 'Groceries' });
    
    renderWithStore(<BudgetsPage onNavigate={vi.fn()} />, {
      categories: [category],
      categoryGroups: [{ id: 'Food', name: 'Food', order: 0 }]
    });

    // Clicking on "Add Budget" or similar might be needed if there's no budget
    // Usually clicking on a category in budgets page opens the dialog to set budget
    // In this app, there is an "Add Budget" button in the header or an edit icon
    const addButton = screen.getByText(/Add Budget/i);
    fireEvent.click(addButton);

    // Should see a dialog with "Save Budget"
    expect(screen.getByText(/Save Budget/i)).toBeDefined();
  });
});
