import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { renderWithStore } from '../../test/helpers/testUtils';

describe('Sidebar', () => {
  it('renders navigation items', () => {
    renderWithStore(<Sidebar currentView="overview" onNavigate={vi.fn()} />);
    
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Transactions')).toBeDefined();
    expect(screen.getByText('Accounts')).toBeDefined();
    expect(screen.getByText('LedgerLocal')).toBeDefined();
  });

  it('calls onNavigate when an item is clicked', () => {
    const onNavigate = vi.fn();
    renderWithStore(<Sidebar currentView="overview" onNavigate={onNavigate} />);
    
    fireEvent.click(screen.getByText('Transactions'));
    expect(onNavigate).toHaveBeenCalledWith('transactions');
  });

  it('toggles collapse state', () => {
    const updateSettings = vi.fn();
    renderWithStore(<Sidebar currentView="overview" onNavigate={vi.fn()} />, {
      updateSettings,
      settings: { sidebarCollapsed: false }
    });
    
    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
    // We can find it by the lucide icon or better, by adding an aria-label if it's missing.
    // Looking at the code, it's the button with ChevronLeft/Right.
    
    fireEvent.click(toggleButton);
    expect(updateSettings).toHaveBeenCalledWith({ sidebarCollapsed: true });
  });

  it('shows profile switcher when clicked', () => {
    renderWithStore(<Sidebar currentView="overview" onNavigate={vi.fn()} />, {
      profiles: [
        { id: '1', name: 'Profile 1' },
        { id: '2', name: 'Profile 2' }
      ],
      currentProfileId: '1'
    });
    
    const profileButton = screen.getByText('Profile 1');
    fireEvent.click(profileButton);
    
    expect(screen.getByText('Switch Profile')).toBeDefined();
    expect(screen.getByText('Profile 2')).toBeDefined();
  });
});
