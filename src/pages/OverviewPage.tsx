import React, { useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '../components/layout/PageHeader';

interface OverviewPageProps {
  onNavigate: (view: string) => void;
}

export function OverviewPage({ onNavigate }: OverviewPageProps) {
  const { accounts, transactions } = useStore();

  const netWorth = accounts.filter(a => a.includeInNetWorth).reduce((sum, a) => sum + a.balanceCents, 0);
  const cash = accounts.filter(a => a.type === 'Checking').reduce((sum, a) => sum + a.balanceCents, 0);
  const investments = accounts.filter(a => ['Brokerage', 'Retirement'].includes(a.type)).reduce((sum, a) => sum + a.balanceCents, 0);
  const creditCards = accounts.filter(a => a.type === 'Credit Card').reduce((sum, a) => sum + a.balanceCents, 0);

  // Simplified cash flow for demo based on transactions
  const income = transactions.filter(t => t.amountCents > 0 && !t.isTransfer).reduce((sum, t) => sum + t.amountCents, 0);
  const spending = transactions.filter(t => t.amountCents < 0 && !t.isTransfer).reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
  const netCashFlow = income - spending;
  const savingsRate = income > 0 ? Math.round((netCashFlow / income) * 100) : 0;

  // Placeholder static budgets
  const budgets = [
    { name: 'Groceries', current: 41000, limit: 50000, color: 'bg-primary' },
    { name: 'Dining', current: 21000, limit: 25000, color: 'bg-primary' },
    { name: 'Transportation', current: 18500, limit: 30000, color: 'bg-primary' },
    { name: 'Shopping', current: 34000, limit: 20000, color: 'bg-error', isWarning: true },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Overview" onImportClick={() => onNavigate('imports')} />

      <div className="flex-1 overflow-y-auto">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6">
              <div className="text-4xl font-bold">L</div>
            </div>
            <h1 className="text-3xl font-bold text-on-surface mb-2">Welcome to LedgerLocal</h1>
            <p className="text-on-surface-variant max-w-md mb-8">
              Your private, local-first personal finance companion. 
              Start by adding an account or importing your transactions.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => onNavigate('accounts')}
                className="btn-physical px-8 py-3 rounded-xl text-primary font-bold shadow-lg hover:shadow-xl transition-all"
              >
                Add First Account
              </button>
              <button 
                onClick={() => onNavigate('imports')}
                className="btn-physical px-8 py-3 rounded-xl bg-surface-container text-on-surface font-semibold border border-outline-variant"
              >
                Import CSV
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6 pb-8">
          {/* Summary Strip */}
          <div className="col-span-12 h-auto py-6 bg-surface-bright border border-outline-variant rounded-xl flex flex-wrap gap-8 items-center justify-between px-10 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-1">Net Worth</span>
              <span className="text-3xl font-light tabular-nums text-on-surface">{formatCurrency(netWorth)}</span>
            </div>
            <div className="hidden lg:block h-12 w-[1px] bg-outline-variant"></div>
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-1">Monthly Change</span>
              <span className="text-xl font-medium tabular-nums text-primary">+{formatCurrency(income - spending)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-1">Cash</span>
              <span className="text-xl font-medium tabular-nums text-on-surface">{formatCurrency(cash)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-1">Investments</span>
              <span className="text-xl font-medium tabular-nums text-on-surface">{formatCurrency(investments)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant font-medium uppercase tracking-wider mb-1">Liabilities</span>
              <span className="text-xl font-medium tabular-nums text-error">{formatCurrency(creditCards)}</span>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            
            <div className="card-raised p-6 h-64 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wide">Cash Flow</h2>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                    <span className="text-xs text-on-surface-variant">Income ({formatCurrency(income)})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-surface-container-highest"></span>
                    <span className="text-xs text-on-surface-variant">Spending ({formatCurrency(spending)})</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 flex items-end justify-around h-32 pt-4">
                {[40, 30, 45, 38, 50].map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="flex gap-1 items-end">
                      <div className="w-8 bg-primary rounded-t" style={{ height: `${h * 2}px` }}></div>
                      <div className="w-8 bg-surface-container-highest rounded-t" style={{ height: `${h * 1.5}px` }}></div>
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-medium">
                      {['MAR', 'APR', 'MAY', 'JUN', 'JUL'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-raised flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-surface-container-low flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide">Recent Activity</h2>
                <button onClick={() => onNavigate('transactions')} className="text-xs font-semibold text-primary hover:underline">View All Transactions</button>
              </div>
              
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-container-low border-b border-surface-container">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-on-surface-variant text-[10px] uppercase tracking-wider w-24">Date</th>
                      <th className="px-4 py-2 font-semibold text-on-surface-variant text-[10px] uppercase tracking-wider">Merchant</th>
                      <th className="px-4 py-2 font-semibold text-on-surface-variant text-[10px] uppercase tracking-wider">Category</th>
                      <th className="px-4 py-2 font-semibold text-on-surface-variant text-[10px] uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    {transactions.slice(0, 5).map(tx => {
                      const acc = accounts.find(a => a.id === tx.accountId);
                      const isPositive = tx.amountCents > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-4 py-2 tabular-nums text-on-surface-variant">{format(parseISO(tx.postedDate), 'MMM d')}</td>
                          <td className="px-4 py-2 font-medium truncate">{tx.merchantName}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-[11px] ${isPositive ? 'bg-primary-container/20 text-primary font-medium' : 'bg-surface-container text-on-surface-variant'}`}>
                              {tx.categoryId?.replace('cat_', '').replace('_', ' ') || 'Uncategorized'}
                            </span>
                          </td>
                          <td className={`px-4 py-2 text-right tabular-nums ${isPositive ? 'text-primary font-medium' : 'text-on-surface'}`}>
                            {isPositive ? '+' : ''}{formatCurrency(tx.amountCents)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            
            <div className="card-raised p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide mb-5">Budgets</h2>
              <div className="space-y-6">
                {budgets.map(b => {
                  const percent = Math.min(100, (b.current / b.limit) * 100);
                  return (
                    <div key={b.name}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-on-surface font-medium">{b.name}</span>
                        <span className={b.isWarning ? 'text-error font-bold tracking-tight' : 'text-on-surface-variant tabular-nums font-medium'}>
                          {b.isWarning ? `OVER BY ${formatCurrency(b.current - b.limit)}` : `${formatCurrency(b.current)} / ${formatCurrency(b.limit)}`}
                        </span>
                      </div>
                      <div className="h-2 w-full track-inset rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${b.color}`} style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card-raised flex-1 flex flex-col p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide mb-6">Top Spending</h2>
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-primary rounded-sm"></div>
                    <span className="flex-1 text-xs text-on-surface-variant">Housing</span>
                    <span className="text-xs font-bold tabular-nums">$1,800.00</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-tertiary rounded-sm"></div>
                    <span className="flex-1 text-xs text-on-surface-variant">Food</span>
                    <span className="text-xs font-bold tabular-nums">$785.42</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-secondary rounded-sm"></div>
                    <span className="flex-1 text-xs text-on-surface-variant">Transportation</span>
                    <span className="text-xs font-bold tabular-nums">$412.10</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-surface-container-highest rounded-sm"></div>
                    <span className="flex-1 text-xs text-on-surface-variant">Others</span>
                    <span className="text-xs font-bold tabular-nums">$220.00</span>
                 </div>
              </div>
              
              <div className="mt-auto pt-6">
                <div className="p-3 track-inset rounded-lg">
                  <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Data Freshness</div>
                  <div className="text-xs text-on-surface leading-tight font-medium">
                    Your data is current through {format(new Date(), 'MMMM d, yyyy')}.
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
