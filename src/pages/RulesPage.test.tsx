import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RulesPage } from './RulesPage';
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
    putRule: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
    putTransactions: vi.fn().mockResolvedValue(undefined),
    deleteImportHistory: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('RulesPage', () => {
  const mockNavigate = vi.fn();

  it('renders rules list', () => {
    render(
      <StoreProvider>
        <RulesPage onNavigate={mockNavigate} />
      </StoreProvider>
    );
    expect(screen.getByText('Categorization Rules')).toBeInTheDocument();
  });

  it('opens rule editor modal', () => {
    render(
      <StoreProvider>
        <RulesPage onNavigate={mockNavigate} />
      </StoreProvider>
    );
    const addButton = screen.getByRole('button', { name: /Create Rule/i });
    fireEvent.click(addButton);
    expect(screen.getByText('New Rule')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Rule Name')).toBeInTheDocument();
  });
});
