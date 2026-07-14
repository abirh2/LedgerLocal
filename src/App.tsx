/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './store/StoreContext';
import { Sidebar } from './components/layout/Sidebar';
import { OverviewPage } from './pages/OverviewPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { AccountsPage } from './pages/AccountsPage';
import { ImportsPage } from './pages/ImportsPage';
import { RulesPage } from './pages/RulesPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { MerchantsPage } from './pages/MerchantsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { RecurringPage } from './pages/RecurringPage';
import { ReportsPage } from './pages/ReportsPage';
import { InvestmentsPage } from './pages/InvestmentsPage';
import { GuidePage } from './pages/GuidePage';
import { ImportFixtureLabPage } from './pages/ImportFixtureLabPage';

function AppContent() {
  const [currentView, setCurrentView] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'overview';
  });
  const { isLoading } = useStore();

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setCurrentView(hash || 'overview');
    };
    window.addEventListener('hashchange', handleHashChange);

    // If there's no hash initially, set it to overview explicitly
    const initialHash = window.location.hash.replace('#', '');
    if (!initialHash) {
      window.location.hash = '#overview';
      setCurrentView('overview');
    } else {
      setCurrentView(initialHash);
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (view: string) => {
    window.location.hash = '#' + view;
    setCurrentView(view);
  };

  const renderView = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full text-on-surface-variant" id="db-loading-indicator">
          <p>Loading database...</p>
        </div>
      );
    }

    switch (currentView) {
      case 'overview':
        return <OverviewPage onNavigate={navigateTo} />;
      case 'transactions':
        return <TransactionsPage onNavigate={navigateTo} />;
      case 'accounts':
        return <AccountsPage onNavigate={navigateTo} />;
      case 'budgets':
        return <BudgetsPage onNavigate={navigateTo} />;
      case 'recurring':
        return <RecurringPage onNavigate={navigateTo} />;
      case 'investments':
        return <InvestmentsPage onNavigate={navigateTo} />;
      case 'reports':
        return <ReportsPage onNavigate={navigateTo} />;
      case 'imports':
        return <ImportsPage onNavigate={navigateTo} />;
      case 'rules':
        return <RulesPage onNavigate={navigateTo} />;
      case 'categories':
        return <CategoriesPage onNavigate={navigateTo} />;
      case 'merchants':
        return <MerchantsPage onNavigate={navigateTo} />;
      case 'settings':
        return <SettingsPage onNavigate={navigateTo} />;
      case 'privacy':
        return <PrivacyPage />;
      case 'guide':
        return <GuidePage onNavigate={navigateTo} />;
      case 'import-lab':
        return <ImportFixtureLabPage onNavigate={navigateTo} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-on-surface-variant">
            <p>Page "{currentView}" is under construction.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-surface font-sans text-on-surface overflow-hidden antialiased">
      <Sidebar currentView={currentView} onNavigate={navigateTo} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 px-8 py-8 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}

