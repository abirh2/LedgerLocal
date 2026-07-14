import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
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
    getDiagnostics: vi.fn().mockResolvedValue({}),
    clearAll: vi.fn().mockResolvedValue(undefined),
    putTransactions: vi.fn().mockResolvedValue(undefined),
    deleteImportHistory: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('SettingsPage', () => {
  const mockNavigate = vi.fn();

  it('renders settings navigation', () => {
    render(
      <StoreProvider>
        <SettingsPage onNavigate={mockNavigate} />
      </StoreProvider>
    );
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getAllByText('General').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Display').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Data Management').length).toBeGreaterThan(0);
  });

  it('switches sections on click', () => {
    render(
      <StoreProvider>
        <SettingsPage onNavigate={mockNavigate} />
      </StoreProvider>
    );
    const displayButton = screen.getByRole('button', { name: /Display/i });
    fireEvent.click(displayButton);
    expect(screen.getByText('Density')).toBeInTheDocument();
  });
});
