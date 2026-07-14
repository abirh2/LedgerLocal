import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { dbApi } from '../database/db';
import { Search, Edit2, Merge, Split, Filter, List, ArrowRight, MoreVertical, Plus } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Merchant, Transaction, Category } from '../models/types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export function MerchantsPage({ onNavigate }: { onNavigate: (v: string) => void }) {
  const { merchants, transactions, categories, refreshData } = useStore();
  const [search, setSearch] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [mergeForm, setMergeForm] = useState({ sourceId: '', targetId: '' });

  const merchantStats = useMemo(() => {
    const stats: Record<string, { count: number, totalCents: number, lastDate: string, txs: Transaction[] }> = {};
    
    transactions.forEach(tx => {
      const name = tx.merchantName.toLowerCase();
      if (!stats[name]) {
        stats[name] = { count: 0, totalCents: 0, lastDate: '', txs: [] };
      }
      stats[name].count++;
      stats[name].totalCents += Math.abs(tx.amountCents);
      if (!stats[name].lastDate || tx.postedDate > stats[name].lastDate) {
        stats[name].lastDate = tx.postedDate;
      }
      stats[name].txs.push(tx);
    });
    
    return stats;
  }, [transactions]);

  const filteredMerchants = useMemo(() => {
    let result = [...merchants];
    if (search) {
      result = result.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    }
    // Sort by spending
    result.sort((a, b) => {
      const sA = merchantStats[a.name.toLowerCase()]?.totalCents || 0;
      const sB = merchantStats[b.name.toLowerCase()]?.totalCents || 0;
      return sB - sA;
    });
    return result;
  }, [merchants, search, merchantStats]);

  const handleRenameMerchant = async (merchant: Merchant, newName: string) => {
    if (!newName || newName === merchant.name) return;
    
    // Update all transactions with this merchant name
    const txsToUpdate = transactions.filter(t => t.merchantName === merchant.name);
    if (txsToUpdate.length > 0) {
      const updatedTxs = txsToUpdate.map(t => ({ ...t, merchantName: newName }));
      await dbApi.putTransactions(updatedTxs);
    }

    // Update merchant record
    await dbApi.putMerchant({ ...merchant, name: newName });
    refreshData();
  };

  const handleMergeMerchants = async () => {
    if (!mergeForm.sourceId || !mergeForm.targetId) return;
    const source = merchants.find(m => m.id === mergeForm.sourceId);
    const target = merchants.find(m => m.id === mergeForm.targetId);
    if (!source || !target) return;

    const confirmed = confirm(`Merge "${source.name}" into "${target.name}"?`);
    if (!confirmed) return;

    // 1. Update transactions
    const txsToUpdate = transactions.filter(t => t.merchantName === source.name);
    if (txsToUpdate.length > 0) {
      const updatedTxs = txsToUpdate.map(t => ({ ...t, merchantName: target.name }));
      await dbApi.putTransactions(updatedTxs);
    }

    // 2. Update merchant
    const updatedTarget: Merchant = {
      ...target,
      originalDescriptions: Array.from(new Set([...target.originalDescriptions, ...source.originalDescriptions]))
    };
    await dbApi.putMerchant(updatedTarget);
    await dbApi.deleteMerchant(source.id);

    setShowMergeModal(false);
    refreshData();
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader title="Merchant Management">
        <div className="flex gap-2">
          <button onClick={() => setShowMergeModal(true)} className="btn btn-secondary flex items-center gap-2">
            <Merge size={16} />
            Merge
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
            <input 
              type="text" 
              placeholder="Search merchants..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 w-64"
            />
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto pb-8">
        <div className="card-raised overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-surface-container">
              <tr>
                <th className="px-6 py-4">Merchant Name</th>
                <th className="px-6 py-4">Transactions</th>
                <th className="px-6 py-4">Total Spent</th>
                <th className="px-6 py-4">Last Date</th>
                <th className="px-6 py-4">Default Category</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {filteredMerchants.map(merchant => {
                const stats = merchantStats[merchant.name.toLowerCase()] || { count: 0, totalCents: 0, lastDate: 'N/A' };
                const category = categories.find(c => c.id === merchant.defaultCategoryId);
                
                return (
                  <tr key={merchant.id} className="hover:bg-surface-container-lowest transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-on-surface">{merchant.name}</div>
                      <div className="text-[10px] text-on-surface-variant line-clamp-1">
                        {merchant.originalDescriptions.join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">{stats.count}</td>
                    <td className="px-6 py-4 text-sm font-medium">
                      ${(stats.totalCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{stats.lastDate}</td>
                    <td className="px-6 py-4">
                      {category ? (
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-bold">
                          {category.name}
                        </span>
                      ) : (
                        <span className="text-xs text-on-surface-variant italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => {
                            const newName = prompt('New merchant name:', merchant.name);
                            if (newName) handleRenameMerchant(merchant, newName);
                          }}
                          className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant"
                          title="Rename"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            // Logic to create rule from merchant
                            onNavigate('rules');
                          }}
                          className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant"
                          title="Create Rule"
                        >
                          <Filter size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            // Show transactions for this merchant
                            onNavigate('transactions');
                          }}
                          className="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant"
                          title="View Transactions"
                        >
                          <List size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredMerchants.length === 0 && (
            <div className="p-12 text-center text-on-surface-variant">
              No merchants found matching your search.
            </div>
          )}
        </div>
      </div>

      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-md rounded-3xl shadow-2xl border border-outline-variant p-6 space-y-6">
            <h3 className="text-xl font-bold">Merge Merchants</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Source Merchant (To be deleted)</label>
                <select 
                  value={mergeForm.sourceId}
                  onChange={e => setMergeForm({ ...mergeForm, sourceId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select Merchant</option>
                  {merchants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="flex justify-center text-on-surface-variant">
                <ArrowRight size={24} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Target Merchant (To keep)</label>
                <select 
                  value={mergeForm.targetId}
                  onChange={e => setMergeForm({ ...mergeForm, targetId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select Merchant</option>
                  {merchants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowMergeModal(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleMergeMerchants} className="btn btn-primary flex-1">Merge Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
