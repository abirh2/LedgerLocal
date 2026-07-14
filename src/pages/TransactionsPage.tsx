import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency, cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { Filter, ChevronDown, MoreHorizontal, Search, Save, Edit2, X, RefreshCw, Link, ArrowLeftRight, Trash2, Tag, Archive, Ban, Plus } from 'lucide-react';
import { dbApi } from '../database/db';
import { PageHeader } from '../components/layout/PageHeader';
import { findTransferCandidates } from '../lib/transferMatcher';
import { processTransactionWithRules } from '../lib/ruleEngine';
import { normalizeMerchantName } from '../lib/merchantManager';
import { Transaction, TransferMatch } from '../models/types';

interface TransactionsPageProps {
  onNavigate: (view: string) => void;
}

export function TransactionsPage({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { transactions, accounts, categories, transferMatches, filters, setFilters, clearFilters, refreshData, rules } = useStore();
  const [selectedTx, setSelectedTx] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<string>('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showTransfers, setShowTransfers] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [txForm, setTxForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    merchant: '',
    amount: '',
    categoryId: '',
    accountId: accounts[0]?.id || ''
  });

  const handleSaveTransaction = async () => {
    const amount = parseFloat(txForm.amount) * 100 * -1; // Assuming manual entry is usually expense
    const initialTx: Transaction = {
      id: `tx_${Date.now()}`,
      accountId: txForm.accountId,
      postedDate: txForm.date,
      originalDescription: txForm.merchant,
      merchantName: normalizeMerchantName(txForm.merchant),
      amountCents: isNaN(amount) ? 0 : Math.round(amount),
      categoryId: txForm.categoryId || undefined,
      excludedFromReports: false,
      isTransfer: false,
      createdAt: new Date().toISOString()
    };

    // Apply rules immediately for manual transactions
    const { transaction } = processTransactionWithRules(initialTx, rules);
    
    await dbApi.putTransaction(transaction);
    setShowAddModal(false);
    setTxForm({ 
      date: format(new Date(), 'yyyy-MM-dd'), 
      merchant: '', 
      amount: '', 
      categoryId: '', 
      accountId: accounts[0]?.id || '' 
    });
    refreshData();
  };

  const transferCandidates = useMemo(() => {
    return findTransferCandidates(transactions, transferMatches);
  }, [transactions, transferMatches]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (filters.search) {
        const lowerSearch = filters.search.toLowerCase();
        if (!tx.merchantName.toLowerCase().includes(lowerSearch) && 
            !tx.originalDescription.toLowerCase().includes(lowerSearch)) return false;
      }
      if (filters.categoryId && tx.categoryId !== filters.categoryId) return false;
      if (filters.accountId && tx.accountId !== filters.accountId) return false;
      if (filters.startDate && tx.postedDate < filters.startDate) return false;
      if (filters.endDate && tx.postedDate > filters.endDate) return false;
      if (filters.isTransfer !== undefined && tx.isTransfer !== filters.isTransfer) return false;
      return true;
    });
  }, [transactions, filters]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedTx);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTx(next);
  };

  const toggleAll = () => {
    if (selectedTx.size === filteredTransactions.length) setSelectedTx(new Set());
    else setSelectedTx(new Set(filteredTransactions.map(t => t.id)));
  };

  const startEdit = (tx: any) => {
    setEditingId(tx.id);
    setEditCategory(tx.categoryId || '');
  };

  const saveEdit = async (tx: any) => {
    const updated = { ...tx, categoryId: editCategory, manualEdit: true };
    await dbApi.putTransaction(updated);
    await refreshData();
    setEditingId(null);
  };

  const handleBulkAssignCategory = async (catId: string) => {
    const updated = transactions
      .filter(t => selectedTx.has(t.id))
      .map(t => ({ ...t, categoryId: catId, manualEdit: true }));
    await dbApi.putTransactions(updated);
    setSelectedTx(new Set());
    refreshData();
  };

  const handleConfirmTransfer = async (tx1: Transaction, tx2: Transaction) => {
    const match: TransferMatch = {
      id: `tm_${Date.now()}`,
      tx1Id: tx1.id,
      tx2Id: tx2.id,
      confidence: 100,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };
    
    const u1 = { ...tx1, isTransfer: true, transferId: tx2.id, manualEdit: true };
    const u2 = { ...tx2, isTransfer: true, transferId: tx1.id, manualEdit: true };
    
    await dbApi.putTransactions([u1, u2]);
    await dbApi.putTransferMatch(match);
    refreshData();
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <PageHeader title="Transactions" onImportClick={() => onNavigate('imports')}>
        <div className="flex gap-2">
          {transferCandidates.length > 0 && (
            <button 
              onClick={() => setShowTransfers(!showTransfers)}
              className="btn btn-secondary flex items-center gap-2 relative"
            >
              <ArrowLeftRight size={16} />
              {showTransfers ? 'Hide Candidates' : 'Transfer Candidates'}
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-on-primary text-[10px] flex items-center justify-center rounded-full">
                {transferCandidates.length}
              </span>
            </button>
          )}
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-physical flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold"
          >
            <Plus size={16} /> Add Transaction
          </button>
        </div>
      </PageHeader>

      {showTransfers && transferCandidates.length > 0 && (
        <div className="card-raised p-4 bg-primary/5 border-primary/20 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
            <RefreshCw size={14} /> Potential Transfers Detected
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {transferCandidates.slice(0, 4).map((c, i) => (
              <div key={i} className="bg-surface-container-low p-3 rounded-xl border border-primary/10 flex items-center justify-between">
                <div className="flex-1 flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">From {accounts.find(a => a.id === c.tx1.accountId)?.name}</p>
                    <p className="text-sm font-bold text-error">-${Math.abs(c.tx1.amountCents / 100).toFixed(2)}</p>
                  </div>
                  <ArrowLeftRight size={16} className="text-on-surface-variant" />
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">To {accounts.find(a => a.id === c.tx2.accountId)?.name}</p>
                    <p className="text-sm font-bold text-primary">+${Math.abs(c.tx2.amountCents / 100).toFixed(2)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleConfirmTransfer(c.tx1, c.tx2)}
                  className="btn btn-primary text-xs py-1.5 px-3"
                >
                  Confirm Match
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Bulk Actions Bar */}
      {selectedTx.size > 0 && (
        <div className="bg-surface-bright border border-primary p-3 rounded-xl flex items-center gap-4 shadow-lg animate-in slide-in-from-bottom-2">
          <span className="text-sm font-bold text-primary">{selectedTx.size} selected</span>
          <div className="h-6 w-px bg-outline-variant"></div>
          <div className="flex items-center gap-2">
            <select 
              onChange={(e) => handleBulkAssignCategory(e.target.value)}
              className="bg-surface border border-outline-variant rounded-md px-2 py-1 text-xs font-bold focus:outline-none"
              defaultValue=""
            >
              <option value="" disabled>Assign Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="p-2 hover:bg-surface-container rounded-md text-on-surface-variant" title="Add Tag"><Tag size={16} /></button>
            <button className="p-2 hover:bg-surface-container rounded-md text-on-surface-variant" title="Mark Transfer"><ArrowLeftRight size={16} /></button>
            <button className="p-2 hover:bg-surface-container rounded-md text-on-surface-variant" title="Exclude"><Ban size={16} /></button>
            <button className="p-2 hover:bg-surface-container rounded-md text-error" title="Delete"><Trash2 size={16} /></button>
          </div>
          <button onClick={() => setSelectedTx(new Set())} className="ml-auto p-1.5 hover:bg-surface-container rounded-md"><X size={18} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="card-raised p-4 flex gap-4 items-center shrink-0 overflow-x-auto">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Search transactions..."
            value={filters.search || ''}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="w-full pl-9 pr-4 py-1.5 rounded-md bg-surface border border-outline-variant text-sm focus:outline-none focus:border-primary"
          />
        </div>
        
        {Object.keys(filters).length > 0 && (
          <button 
            onClick={clearFilters}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <X size={12} />
            Clear Filters
          </button>
        )}
        
        <div className="h-6 w-px bg-outline-variant mx-2"></div>
        
        <div className="text-xs text-on-surface-variant flex gap-4 ml-auto font-medium">
          <span>{filteredTransactions.length} transactions</span>
        </div>
      </div>

      {/* Table */}
      <div className="card-raised flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-surface-container-low sticky top-0 z-10 shadow-[0_1px_0_var(--color-surface-container)]">
              <tr className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                <th className="py-3 px-4 w-12 border-b border-surface-container">
                  <span className="sr-only">Select All</span>
                  <input 
                    type="checkbox" 
                    className="rounded border-outline text-primary focus:ring-primary" 
                    checked={selectedTx.size === filteredTransactions.length && filteredTransactions.length > 0}
                    onChange={toggleAll}
                    aria-label="Select all transactions"
                  />
                </th>
                <th className="py-3 px-2 w-28 border-b border-surface-container">Date</th>
                <th className="py-3 px-2 border-b border-surface-container">Merchant</th>
                <th className="py-3 px-2 hidden md:table-cell border-b border-surface-container">Original Description</th>
                <th className="py-3 px-2 border-b border-surface-container">Category</th>
                <th className="py-3 px-2 border-b border-surface-container">Account</th>
                <th className="py-3 px-4 text-right w-32 border-b border-surface-container">Amount</th>
                <th className="py-3 px-2 w-16 border-b border-surface-container text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="font-tabular text-on-surface divide-y divide-surface-container-low">
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                    {transactions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                          <Search size={24} />
                        </div>
                        <div className="text-center">
                          <p className="text-base font-bold text-on-surface">No transactions yet</p>
                          <p className="text-sm text-on-surface-variant mt-1">Import a CSV file to get started.</p>
                        </div>
                        <button onClick={() => onNavigate('imports')} className="btn-physical px-4 py-2 rounded-lg text-primary text-sm font-bold mt-2">
                          Go to Imports
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-base font-bold text-on-surface">No results found</p>
                        <p className="text-sm text-on-surface-variant mt-1">Try adjusting your search query.</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
              {filteredTransactions.map(tx => {
                const acc = accounts.find(a => a.id === tx.accountId);
                const isPositive = tx.amountCents > 0;
                const isSelected = selectedTx.has(tx.id);
                const isEditing = editingId === tx.id;
                
                return (
                  <tr 
                    key={tx.id} 
                    className={cn(
                      "hover:bg-surface-container-low transition-colors h-10 group",
                      isSelected ? "bg-primary-container/10" : "",
                      isPositive && !isSelected ? "bg-primary-container/20" : ""
                    )}
                  >
                    <td className="py-2 px-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-outline text-primary focus:ring-primary"
                        checked={isSelected}
                        onChange={() => toggleSelect(tx.id)}
                        aria-label={`Select transaction with ${tx.merchantName}`}
                      />
                    </td>
                    <td className="py-2 px-2 text-on-surface-variant text-xs">{format(parseISO(tx.postedDate), 'MM/dd/yy')}</td>
                    <td className="py-2 px-2 truncate font-medium">
                      <div className="flex items-center gap-1.5">
                        {tx.merchantName}
                        {tx.isTransfer && <ArrowLeftRight size={12} className="text-primary" title="Transfer" />}
                        {tx.isRefund && <RefreshCw size={12} className="text-success" title="Refund" />}
                      </div>
                    </td>
                    <td className="py-2 px-2 truncate text-on-surface-variant hidden md:table-cell text-[10px]">{tx.originalDescription}</td>
                    <td className="py-2 px-2">
                      {isEditing ? (
                        <select 
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded p-1 text-[11px]"
                          value={editCategory}
                          onChange={e => setEditCategory(e.target.value)}
                        >
                          <option value="">Uncategorized</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded bg-surface-container-low border border-outline-variant/50 text-on-surface-variant text-[10px] truncate inline-block max-w-[100px]",
                            tx.ruleId && "border-primary/30 text-primary"
                          )}>
                            {categories.find(c => c.id === tx.categoryId)?.name || 'Uncategorized'}
                          </span>
                          {tx.ruleId && <Filter size={10} className="text-primary/50" title="Assigned by Rule" />}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-on-surface-variant truncate text-[10px]">{acc?.name}</td>
                    <td className={`py-2 px-4 text-right tabular-nums ${isPositive ? 'text-primary font-medium' : 'text-on-surface'}`}>
                      {isPositive ? '+' : ''}{formatCurrency(tx.amountCents)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end">
                        {isEditing ? (
                          <button onClick={() => saveEdit(tx)} className="p-1 rounded bg-primary text-on-primary hover:bg-primary/90 transition-colors">
                            <Save size={14} />
                          </button>
                        ) : (
                          <button onClick={() => startEdit(tx)} className="p-1 rounded text-on-surface-variant hover:bg-surface-container opacity-0 group-hover:opacity-100 transition-all">
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant p-6 space-y-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold">New Transaction</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="tx-merchant" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Merchant Name</label>
                <input 
                  id="tx-merchant"
                  type="text" 
                  value={txForm.merchant}
                  onChange={e => setTxForm({ ...txForm, merchant: e.target.value })}
                  placeholder="Merchant Name"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="tx-date" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Date</label>
                  <input 
                    id="tx-date"
                    type="date" 
                    value={txForm.date}
                    onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="tx-amount" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">$</span>
                    <input 
                      id="tx-amount"
                      type="text" 
                      value={txForm.amount}
                      onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-7 pr-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm tabular-nums"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="tx-account" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Account</label>
                <select 
                  id="tx-account"
                  value={txForm.accountId}
                  onChange={e => setTxForm({ ...txForm, accountId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                >
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="tx-category" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Category</label>
                <select 
                  id="tx-category"
                  value={txForm.categoryId}
                  onChange={e => setTxForm({ ...txForm, categoryId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                >
                  <option value="">Uncategorized</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
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
                onClick={handleSaveTransaction} 
                disabled={!txForm.merchant || !txForm.amount || !txForm.accountId}
                className="flex-1 btn-physical px-4 py-2.5 rounded-xl text-primary font-bold text-sm disabled:opacity-50"
              >
                Save Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
