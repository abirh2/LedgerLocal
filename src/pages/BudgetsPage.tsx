import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency } from '../lib/utils';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { PageHeader } from '../components/layout/PageHeader';
import { ChevronLeft, ChevronRight, Plus, Copy, Trash2, Edit2, AlertCircle, CheckCircle2, Search, Filter } from 'lucide-react';
import { dbApi } from '../database/db';
import { Budget } from '../models/types';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface BudgetsPageProps {
  onNavigate: (view: string) => void;
}

export function BudgetsPage({ onNavigate }: BudgetsPageProps) {
  const { categories, budgets, transactions, refreshData } = useStore();
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const [isGrouped, setIsGrouped] = useState(true);
  const [hideNoSpending, setHideNoSpending] = useState(false);
  const [showOnlyOverBudget, setShowOnlyOverBudget] = useState(false);
  const [sortOrder, setSortOrder] = useState<'category' | 'amountSpent' | 'remaining' | 'percentUsed'>('category');

  const currentMonthStr = format(currentDate, 'yyyy-MM');
  const prevMonthStr = format(subMonths(currentDate, 1), 'yyyy-MM');

  // Filter transactions for current month, exclude transfers and excluded from reports
  const monthTransactions = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return transactions.filter(tx => {
      if (tx.excludedFromReports || tx.isTransfer) return false;
      const txDate = new Date(tx.postedDate);
      return txDate >= start && txDate <= end;
    });
  }, [transactions, currentDate]);

  // Calculate actual spending per category (negative amounts are expenses, positive are refunds)
  // We'll treat net negative as positive spending. Net positive (income) will be negative spending.
  const spendingByCategory = useMemo(() => {
    const spending: Record<string, number> = {};
    for (const tx of monthTransactions) {
      if (!tx.categoryId) continue;
      if (!spending[tx.categoryId]) spending[tx.categoryId] = 0;
      spending[tx.categoryId] += -tx.amountCents; // Invert so positive means we spent money
    }
    return spending;
  }, [monthTransactions]);

  const currentMonthBudgets = useMemo(() => {
    return budgets.filter(b => b.month === currentMonthStr);
  }, [budgets, currentMonthStr]);
  
  // Previous month spending and budget (for rollover and comparison)
  const prevMonthTransactions = useMemo(() => {
    const start = startOfMonth(subMonths(currentDate, 1));
    const end = endOfMonth(subMonths(currentDate, 1));
    return transactions.filter(tx => {
      if (tx.excludedFromReports || tx.isTransfer) return false;
      const txDate = new Date(tx.postedDate);
      return txDate >= start && txDate <= end;
    });
  }, [transactions, currentDate]);

  const prevMonthSpending = useMemo(() => {
    const spending: Record<string, number> = {};
    for (const tx of prevMonthTransactions) {
      if (!tx.categoryId) continue;
      if (!spending[tx.categoryId]) spending[tx.categoryId] = 0;
      spending[tx.categoryId] += -tx.amountCents;
    }
    return spending;
  }, [prevMonthTransactions]);

  const prevMonthBudgets = useMemo(() => {
    return budgets.filter(b => b.month === prevMonthStr);
  }, [budgets, prevMonthStr]);

  const categoryData = useMemo(() => {
    let data = categories.map(cat => {
      const budget = currentMonthBudgets.find(b => b.categoryId === cat.id);
      const spent = spendingByCategory[cat.id] || 0;
      let amountCents = budget?.amountCents || 0;
      
      const prevBudget = prevMonthBudgets.find(b => b.categoryId === cat.id);
      const prevSpent = prevMonthSpending[cat.id] || 0;
      let rolloverAmount = 0;

      if (budget?.rollover && prevBudget) {
        rolloverAmount = prevBudget.amountCents - prevSpent;
        amountCents += rolloverAmount;
      }

      const remaining = amountCents - spent;
      const percentUsed = amountCents > 0 ? (spent / amountCents) * 100 : (spent > 0 ? 100 : 0);
      
      let status: 'on-track' | 'near-limit' | 'over-budget' | 'no-spending' | 'no-budget' = 'no-budget';
      if (!budget && spent === 0) status = 'no-spending';
      else if (!budget && spent > 0) status = 'over-budget';
      else if (budget && spent === 0) status = 'no-spending';
      else if (percentUsed > 100) status = 'over-budget';
      else if (percentUsed >= 80) status = 'near-limit';
      else status = 'on-track';

      return {
        ...cat,
        group: cat.groupId,
        budget,
        spent,
        budgetAmount: amountCents,
        baseBudgetAmount: budget?.amountCents || 0,
        rolloverAmount,
        remaining,
        percentUsed,
        status,
        prevSpent
      };
    });

    if (hideNoSpending) {
      data = data.filter(d => d.spent !== 0 || d.budget);
    }
    if (showOnlyOverBudget) {
      data = data.filter(d => d.status === 'over-budget');
    }

    data.sort((a, b) => {
      if (sortOrder === 'category') return a.name.localeCompare(b.name);
      if (sortOrder === 'amountSpent') return b.spent - a.spent;
      if (sortOrder === 'remaining') return a.remaining - b.remaining;
      if (sortOrder === 'percentUsed') return b.percentUsed - a.percentUsed;
      return 0;
    });

    return data;
  }, [categories, currentMonthBudgets, spendingByCategory, prevMonthBudgets, prevMonthSpending, hideNoSpending, showOnlyOverBudget, sortOrder]);

  const totalBudgeted = categoryData.reduce((sum, c) => sum + c.budgetAmount, 0);
  const totalSpent = categoryData.reduce((sum, c) => sum + c.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const totalPercentUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const overBudgetCount = categoryData.filter(c => c.status === 'over-budget').length;

  const groupedData = useMemo(() => {
    const groups: Record<string, typeof categoryData> = {};
    for (const item of categoryData) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    
    // Sort groups in specific order
    const groupOrder = ['Housing', 'Food', 'Transportation', 'Lifestyle', 'Financial', 'Other'];
    return Object.keys(groups).sort((a, b) => {
      const idxA = groupOrder.indexOf(a);
      const idxB = groupOrder.indexOf(b);
      if (idxA === -1 && idxB === -1) return a.localeCompare(b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    }).map(g => ({ group: g, items: groups[g] }));
  }, [categoryData]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<{ categoryId: string, amountStr: string, rollover: boolean } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, isDestructive?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const handleSaveBudget = async () => {
    if (!editingBudget) return;
    const amountCents = Math.round(parseFloat(editingBudget.amountStr) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const existingId = currentMonthBudgets.find(b => b.categoryId === editingBudget.categoryId)?.id;
    
    const budget: Budget = {
      id: existingId || crypto.randomUUID(),
      categoryId: editingBudget.categoryId,
      amountCents,
      month: currentMonthStr,
      rollover: editingBudget.rollover
    };

    await dbApi.putBudget(budget);
    await refreshData();
    setIsDialogOpen(false);
    setEditingBudget(null);
  };

  const handleCopyPrevious = () => {
    if (prevMonthBudgets.length === 0) {
      alert("No budgets found in the previous month.");
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Copy Previous Budgets',
      message: `Are you sure you want to copy ${prevMonthBudgets.length} budgets from ${format(subMonths(currentDate, 1), 'MMMM')}? This will overwrite any existing budgets for those categories in the current month.`,
      isDestructive: false,
      onConfirm: async () => {
        for (const prevB of prevMonthBudgets) {
          const existingId = currentMonthBudgets.find(b => b.categoryId === prevB.categoryId)?.id;
          const newBudget: Budget = {
            id: existingId || crypto.randomUUID(),
            categoryId: prevB.categoryId,
            amountCents: prevB.amountCents,
            month: currentMonthStr,
            rollover: prevB.rollover
          };
          await dbApi.putBudget(newBudget);
        }
        await refreshData();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleClearMonth = () => {
    if (currentMonthBudgets.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Budgets',
      message: 'Are you sure you want to clear all budgets for this month?',
      isDestructive: true,
      onConfirm: async () => {
        await dbApi.clearBudgetsForMonth(currentMonthStr);
        await refreshData();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <PageHeader title="Budgets" onImportClick={() => onNavigate('imports')}>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyPrevious} className="btn-physical px-3 py-1.5 rounded bg-surface-container text-on-surface-variant font-semibold text-xs hover:text-on-surface border border-outline-variant flex items-center gap-2">
              <Copy size={14} /> Copy Prev
            </button>
            <button onClick={handleClearMonth} className="btn-physical px-3 py-1.5 rounded bg-surface-container text-on-surface-variant font-semibold text-xs hover:text-error border border-outline-variant flex items-center gap-2">
              <Trash2 size={14} /> Clear
            </button>
            <button 
              onClick={() => {
                setEditingBudget({ categoryId: categories[0]?.id || '', amountStr: '', rollover: false });
                setIsDialogOpen(true);
              }} 
              className="btn-physical px-4 py-1.5 rounded bg-primary text-on-primary font-bold text-sm flex items-center gap-2 ml-2"
            >
              <Plus size={16} /> Add Budget
            </button>
          </div>
        </PageHeader>
        <div className="flex items-center gap-4 bg-surface-container-low px-4 py-2 rounded-lg border border-outline-variant shadow-sm mb-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 rounded hover:bg-surface-container text-on-surface-variant transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-on-surface min-w-[120px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 rounded hover:bg-surface-container text-on-surface-variant transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8 space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-raised p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Budgeted</div>
            <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(totalBudgeted)}</div>
          </div>
          <div className="card-raised p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Spent</div>
            <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(totalSpent)}</div>
          </div>
          <div className="card-raised p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Remaining</div>
            <div className={`text-xl font-bold font-tabular ${totalRemaining < 0 ? 'text-error' : 'text-primary'}`}>
              {formatCurrency(totalRemaining)}
            </div>
          </div>
          <div className="card-raised p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Status</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div 
                  className={`h-full ${totalPercentUsed > 100 ? 'bg-error' : totalPercentUsed > 80 ? 'bg-error/70' : 'bg-primary'}`} 
                  style={{ width: `${Math.min(totalPercentUsed, 100)}%` }} 
                />
              </div>
              <span className="text-sm font-bold text-on-surface font-tabular">{Math.round(totalPercentUsed)}%</span>
            </div>
            {overBudgetCount > 0 && (
              <div className="text-xs text-error font-medium mt-2 flex items-center gap-1">
                <AlertCircle size={12} /> {overBudgetCount} over budget
              </div>
            )}
          </div>
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap gap-4 items-center justify-between border-b border-surface-variant pb-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
              <input 
                type="checkbox" 
                checked={hideNoSpending}
                onChange={e => setHideNoSpending(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
              />
              Hide zero spending
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
              <input 
                type="checkbox" 
                checked={showOnlyOverBudget}
                onChange={e => setShowOnlyOverBudget(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
              />
              Only over budget
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-on-surface-variant flex items-center gap-1">
              <Filter size={14} /> Sort by
            </span>
            <select 
              className="bg-surface-container-low border border-outline-variant rounded p-1 text-sm shadow-sm outline-none"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as any)}
            >
              <option value="category">Category</option>
              <option value="amountSpent">Amount Spent</option>
              <option value="remaining">Remaining</option>
              <option value="percentUsed">% Used</option>
            </select>
          </div>
        </div>

        {/* List of budgets */}
        <div className="space-y-6">
          {groupedData.map(group => (
            <div key={group.group} className="space-y-3">
              <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wide px-2">{group.group}</h3>
              <div className="card-raised flex flex-col divide-y divide-surface-container-low">
                {group.items.map(item => (
                  <div key={item.id} className="p-4 flex flex-col gap-3 hover:bg-surface-container-lowest transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-on-surface">{item.name}</span>
                        {item.status === 'over-budget' && <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container text-[10px] font-bold uppercase tracking-wide flex items-center gap-1"><AlertCircle size={10} /> Over</span>}
                        {item.status === 'near-limit' && <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase tracking-wide">Near limit</span>}
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-xs text-on-surface-variant mr-2">Spent: <span className="font-tabular font-medium text-on-surface">{formatCurrency(item.spent)}</span></span>
                          <span className="text-xs text-on-surface-variant mr-2">of</span>
                          <span className="text-sm font-tabular font-bold text-on-surface">{formatCurrency(item.budgetAmount)}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setEditingBudget({
                              categoryId: item.id,
                              amountStr: item.budget ? (item.budget.amountCents / 100).toString() : '',
                              rollover: item.budget?.rollover || false
                            });
                            setIsDialogOpen(true);
                          }}
                          className="text-on-surface-variant hover:text-primary transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        {item.budget && (
                          <button 
                            onClick={async () => {
                              await dbApi.deleteBudget(item.budget!.id);
                              await refreshData();
                            }}
                            className="text-on-surface-variant hover:text-error transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    {item.budgetAmount > 0 && (
                      <div className="w-full flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${item.status === 'over-budget' ? 'bg-error' : item.status === 'near-limit' ? 'bg-error/70' : 'bg-primary'}`} 
                            style={{ width: `${Math.min(item.percentUsed, 100)}%` }} 
                          />
                        </div>
                        <span className={`text-xs font-tabular font-medium w-16 text-right ${item.remaining < 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                          {formatCurrency(item.remaining)} left
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {isDialogOpen && editingBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-on-surface">{currentMonthBudgets.find(b => b.categoryId === editingBudget.categoryId) ? 'Edit Budget' : 'Add Budget'}</h3>
              <button onClick={() => setIsDialogOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                &times;
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wide">Category</label>
                <select 
                  id="budget-category"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={editingBudget.categoryId}
                  onChange={e => setEditingBudget({ ...editingBudget, categoryId: e.target.value })}
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat.groupId})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wide">Monthly Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-on-surface-variant font-medium">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full pl-7 pr-3 py-2 bg-surface-container-lowest border border-outline-variant rounded text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none font-tabular"
                    placeholder="0.00"
                    value={editingBudget.amountStr}
                    onChange={e => setEditingBudget({ ...editingBudget, amountStr: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveBudget();
                    }}
                  />
                </div>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={editingBudget.rollover}
                  onChange={e => setEditingBudget({ ...editingBudget, rollover: e.target.checked })}
                  className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-sm font-medium text-on-surface">Enable Rollover</span>
              </label>
              <p className="text-xs text-on-surface-variant pl-6 -mt-2">
                Unspent budget from the previous month will be added to this month's budget limit.
              </p>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-surface-container">
              <button 
                onClick={() => setIsDialogOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveBudget}
                disabled={!editingBudget.categoryId || !editingBudget.amountStr}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Save Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
