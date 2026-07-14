import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency } from '../lib/utils';
import { Plus, MoreHorizontal } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '../components/layout/PageHeader';
import { dbApi } from '../database/db';
import { Account, AccountType } from '../models/types';

interface AccountsPageProps {
  onNavigate: (view: string) => void;
}

export function AccountsPage({ onNavigate }: AccountsPageProps) {
  const { accounts, refreshData } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'Checking' as AccountType,
    institution: '',
    balanceCents: '0.00'
  });

  const handleSaveAccount = async () => {
    const balance = parseFloat(accountForm.balanceCents) * 100;
    const newAcc: Account = {
      id: `acc_${Date.now()}`,
      name: accountForm.name,
      type: accountForm.type,
      institution: accountForm.institution || 'Manual',
      balanceCents: isNaN(balance) ? 0 : Math.round(balance),
      includeInNetWorth: true,
      isManual: true
    };
    await dbApi.putAccount(newAcc);
    setShowAddModal(false);
    setAccountForm({ name: '', type: 'Checking', institution: '', balanceCents: '0.00' });
    refreshData();
  };

  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.type]) acc[account.type] = [];
    acc[account.type].push(account);
    return acc;
  }, {} as Record<string, typeof accounts>);

  // Define an ordered priority for account types
  const typeOrder = ['Checking', 'Savings', 'Credit Card', 'Brokerage', 'Retirement', 'Loan', 'Other'];
  const orderedTypes = Object.keys(groupedAccounts).sort((a, b) => {
    const idxA = typeOrder.indexOf(a);
    const idxB = typeOrder.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Accounts" onImportClick={() => onNavigate('imports')}>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-physical flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold"
        >
          <Plus size={16} /> Add Account
        </button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto pb-8 max-w-4xl w-full">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-4">
              <Plus size={32} />
            </div>
            <h2 className="text-lg font-bold text-on-surface">No accounts yet</h2>
            <p className="text-sm text-on-surface-variant max-w-sm mt-2 mb-6">
              Add your first account to start tracking your finances.
            </p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="btn-physical px-6 py-2 rounded-lg text-primary text-sm font-bold"
            >
              Add Account
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {orderedTypes.map(type => {
            const accountsList = groupedAccounts[type];
            const total = accountsList.reduce((sum, a) => sum + a.balanceCents, 0);
            return (
              <section key={type} className="space-y-4">
                <div className="flex justify-between items-baseline border-b border-outline-variant pb-2 px-2">
                  <h3 className="text-sm font-bold text-on-surface uppercase tracking-wide">{type}s</h3>
                  <span className="text-sm font-tabular font-bold text-on-surface">{formatCurrency(total)}</span>
                </div>
                
                <div className="card-raised flex flex-col divide-y divide-surface-container-low">
                  {accountsList.map(account => (
                    <div key={account.id} className="p-4 hover:bg-surface-container-low transition-colors cursor-pointer group flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center text-on-surface-variant font-bold text-xs uppercase shadow-sm">
                          {account.institution.substring(0, 2)}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">{account.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-0.5">
                            <span>{account.institution}</span>
                            <span>•</span>
                            <span>Updated {account.lastImportedDate ? format(parseISO(account.lastImportedDate), 'MMM d, yyyy') : 'Manual'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className={`text-base font-tabular font-semibold ${account.balanceCents < 0 ? 'text-error' : 'text-on-surface'}`}>
                            {formatCurrency(account.balanceCents)}
                          </p>
                        </div>
                        <button className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surface-container rounded">
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant p-6 space-y-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold">Add New Account</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="acc-name" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Account Name</label>
                <input 
                  id="acc-name"
                  type="text" 
                  value={accountForm.name}
                  onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                  placeholder="e.g. Main Checking"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="acc-type" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Type</label>
                  <select 
                    id="acc-type"
                    value={accountForm.type}
                    onChange={e => setAccountForm({ ...accountForm, type: e.target.value as AccountType })}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  >
                    <option value="Checking">Checking</option>
                    <option value="Savings">Savings</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Brokerage">Brokerage</option>
                    <option value="Retirement">Retirement</option>
                    <option value="Loan">Loan</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="acc-balance" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Balance</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
                    <input 
                      id="acc-balance"
                      type="text" 
                      value={accountForm.balanceCents}
                      onChange={e => setAccountForm({ ...accountForm, balanceCents: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-7 pr-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm tabular-nums"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="acc-institution" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Institution (Optional)</label>
                <input 
                  id="acc-institution"
                  type="text" 
                  value={accountForm.institution}
                  onChange={e => setAccountForm({ ...accountForm, institution: e.target.value })}
                  placeholder="e.g. Chase, Vanguard"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowAddModal(false)} 
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container text-on-surface font-semibold text-sm border border-outline-variant"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAccount} 
                disabled={!accountForm.name}
                className="flex-1 btn-physical px-4 py-2.5 rounded-xl text-primary font-bold text-sm disabled:opacity-50"
              >
                Save Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
