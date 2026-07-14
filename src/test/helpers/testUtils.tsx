import React, { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// We'll mock the useStore hook instead of providing a real context 
// to avoid complex DB dependencies in unit tests
import * as StoreContext from '../../store/StoreContext';

export const mockStoreValue: any = {
  accounts: [],
  transactions: [],
  categories: [],
  categoryGroups: [],
  budgets: [],
  recurringOverrides: [],
  balanceSnapshots: [],
  investmentTransactions: [],
  holdings: [],
  priceSnapshots: [],
  rules: [],
  merchants: [],
  profiles: [{ id: 'default', name: 'Default Profile' }],
  currentProfileId: 'default',
  settings: {
    currency: 'USD',
    sidebarCollapsed: false,
    theme: 'light',
  },
  isLoading: false,
  filters: {},
  setFilters: vi.fn(),
  clearFilters: vi.fn(),
  refreshData: vi.fn(),
  resetDemoData: vi.fn(),
  changeProfile: vi.fn(),
  updateSettings: vi.fn(),
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  renameProfile: vi.fn(),
};

export function renderWithStore(
  ui: React.ReactElement,
  overrides: any = {},
  options?: Omit<RenderOptions, 'queries'>
) {
  const spy = vi.spyOn(StoreContext, 'useStore');
  spy.mockReturnValue({ ...mockStoreValue, ...overrides });
  
  return render(ui, options);
}
