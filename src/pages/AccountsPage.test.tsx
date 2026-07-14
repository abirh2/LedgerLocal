import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountsPage } from './AccountsPage';
import { StoreProvider } from '../store/StoreContext';
import { dbApi } from '../database/db';

vi.mock('../database/db', () => ({
  dbApi: {
    putAccount: vi.fn().mockResolvedValue(undefined),
    getAccounts: vi.fn().mockResolvedValue([]),
    getTransactions: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
    getRules: vi.fn().mockResolvedValue([]),
    getBudgets: vi.fn().mockResolvedValue([]),
    getImportProfiles: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({}),
    getProfiles: vi.fn().mockResolvedValue([]),
    clearAll: vi.fn().mockResolvedValue(undefined),
    putTransactions: vi.fn().mockResolvedValue(undefined),
    deleteImportHistory: vi.fn().mockResolvedValue(undefined),
    getCategoryGroups: vi.fn().mockResolvedValue([]),
    getRecurringOverrides: vi.fn().mockResolvedValue([]),
    getBalanceSnapshots: vi.fn().mockResolvedValue([]),
    getInvestmentTransactions: vi.fn().mockResolvedValue([]),
    getHoldings: vi.fn().mockResolvedValue([]),
    getPriceSnapshots: vi.fn().mockResolvedValue([]),
    getAccountValuations: vi.fn().mockResolvedValue([]),
    getMerchants: vi.fn().mockResolvedValue([]),
    getTransferMatches: vi.fn().mockResolvedValue([]),
  }
}));

describe('AccountsPage', () => {
  const mockNavigate = vi.fn();

  it('renders empty state when no accounts exist', () => {
    render(
      <StoreProvider>
        <AccountsPage onNavigate={mockNavigate} />
      </StoreProvider>
    );
    expect(screen.getByText('No accounts yet')).toBeInTheDocument();
  });

  it('opens add account modal on click', () => {
    render(
      <StoreProvider>
        <AccountsPage onNavigate={mockNavigate} />
      </StoreProvider>
    );
    const addButton = screen.getAllByRole('button', { name: /Add Account/i })[0];
    fireEvent.click(addButton);
    expect(screen.getByText('Add New Account')).toBeInTheDocument();
  });
});
