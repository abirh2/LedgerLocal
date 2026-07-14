import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionsPage } from './TransactionsPage';
import { StoreProvider } from '../store/StoreContext';

vi.mock('../database/db', () => ({
  dbApi: {
    getAccounts: vi.fn().mockResolvedValue([]),
    getTransactions: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
    getCategoryGroups: vi.fn().mockResolvedValue([]),
    getBudgets: vi.fn().mockResolvedValue([]),
    getRules: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({}),
    getImportProfiles: vi.fn().mockResolvedValue([]),
    getProfiles: vi.fn().mockResolvedValue([]),
    getHoldings: vi.fn().mockResolvedValue([]),
    getInvestmentTransactions: vi.fn().mockResolvedValue([]),
    getPriceSnapshots: vi.fn().mockResolvedValue([]),
    getAccountValuations: vi.fn().mockResolvedValue([]),
    getBalanceSnapshots: vi.fn().mockResolvedValue([]),
    getMerchants: vi.fn().mockResolvedValue([]),
    getTransferMatches: vi.fn().mockResolvedValue([]),
    getRecurringOverrides: vi.fn().mockResolvedValue([]),
    putTransaction: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
    putTransactions: vi.fn().mockResolvedValue(undefined),
    deleteImportHistory: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('TransactionsPage', () => {
  const mockNavigate = vi.fn();

  it('renders transactions table', () => {
    render(
      <StoreProvider>
        <TransactionsPage onNavigate={mockNavigate} />
      </StoreProvider>
    );
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search transactions...')).toBeInTheDocument();
  });

  it('opens add transaction modal', () => {
    render(
      <StoreProvider>
        <TransactionsPage onNavigate={mockNavigate} />
      </StoreProvider>
    );
    const addButton = screen.getByRole('button', { name: /Add Transaction/i });
    fireEvent.click(addButton);
    expect(screen.getByText('New Transaction')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Merchant Name')).toBeInTheDocument();
  });
});
