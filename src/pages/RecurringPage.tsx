import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency } from '../lib/utils';
import { format, differenceInDays, addDays, addMonths, addYears, parseISO } from 'date-fns';
import { PageHeader } from '../components/layout/PageHeader';
import { Search, Filter, AlertCircle, CheckCircle2, XCircle, Settings2, RefreshCw } from 'lucide-react';
import { dbApi } from '../database/db';
import { Transaction, RecurringOverride, RecurringFrequency } from '../models/types';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface RecurringPageProps {
  onNavigate: (view: string) => void;
}

interface RecurringGroup {
  id: string; // group id
  merchantName: string;
  accountId: string;
  categoryId?: string;
  isDebit: boolean;
  transactions: Transaction[];
  avgAmount: number;
  minAmount: number;
  maxAmount: number;
  avgIntervalDays: number;
  frequency: RecurringFrequency;
  lastOccurrence: Date;
  nextOccurrence: Date;
  confidence: 'High' | 'Medium' | 'Low';
}

export function RecurringPage({ onNavigate }: RecurringPageProps) {
  const { transactions, accounts, categories, recurringOverrides, refreshData } = useStore();
  const [filterFrequency, setFilterFrequency] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Ignored'>('Active');
  
  const normalizeMerchant = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  };

  const detectedRecurring = useMemo(() => {
    // 1. Group transactions
    const groups = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      if (tx.isTransfer) continue;
      const norm = normalizeMerchant(tx.merchantName);
      if (!norm) continue;
      const isDebit = tx.amountCents < 0;
      const key = `${norm}_${tx.accountId}_${isDebit ? 'out' : 'in'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }

    const results: RecurringGroup[] = [];

    // 2. Analyze each group
    for (const [key, txs] of groups.entries()) {
      if (txs.length < 2) continue;
      
      // Sort ascending by date
      txs.sort((a, b) => new Date(a.postedDate).getTime() - new Date(b.postedDate).getTime());

      let sumAmount = 0;
      let minAmount = Infinity;
      let maxAmount = -Infinity;
      
      for (const tx of txs) {
        const amt = Math.abs(tx.amountCents);
        sumAmount += amt;
        if (amt < minAmount) minAmount = amt;
        if (amt > maxAmount) maxAmount = amt;
      }
      
      const avgAmount = sumAmount / txs.length;
      
      // Amount variance check (max 25% variance for High/Medium confidence)
      const amountVariance = avgAmount > 0 ? (maxAmount - minAmount) / avgAmount : 0;
      if (amountVariance > 0.5 && txs.length < 4) continue; // too much variance and too few transactions

      // Calculate intervals
      let sumInterval = 0;
      const intervals: number[] = [];
      for (let i = 1; i < txs.length; i++) {
        const d1 = parseISO(txs[i-1].postedDate);
        const d2 = parseISO(txs[i].postedDate);
        const diff = differenceInDays(d2, d1);
        intervals.push(diff);
        sumInterval += diff;
      }
      
      const avgIntervalDays = sumInterval / intervals.length;
      
      let frequency: RecurringFrequency = 'Irregular';
      let confidence: 'High' | 'Medium' | 'Low' = 'Low';

      if (avgIntervalDays >= 5 && avgIntervalDays <= 9) frequency = 'Weekly';
      else if (avgIntervalDays >= 12 && avgIntervalDays <= 16) frequency = 'Biweekly';
      else if (avgIntervalDays >= 25 && avgIntervalDays <= 35) frequency = 'Monthly';
      else if (avgIntervalDays >= 85 && avgIntervalDays <= 95) frequency = 'Quarterly';
      else if (avgIntervalDays >= 350 && avgIntervalDays <= 380) frequency = 'Yearly';

      // Confidence heuristic
      if (frequency !== 'Irregular' && amountVariance < 0.1 && txs.length >= 3) {
        confidence = 'High';
      } else if (frequency !== 'Irregular' && amountVariance < 0.25) {
        confidence = 'Medium';
      } else if (frequency === 'Irregular' && amountVariance < 0.05 && txs.length >= 3) {
        confidence = 'Medium'; // extremely regular amounts but irregular timing
      }

      // If confidence is Low and irregular, might just be a frequent vendor (like coffee shop) rather than a bill
      if (confidence === 'Low' && frequency === 'Irregular' && amountVariance > 0.2) continue;

      const lastTx = txs[txs.length - 1];
      const lastOccurrence = parseISO(lastTx.postedDate);
      
      let nextOccurrence = new Date();
      if (frequency === 'Weekly') nextOccurrence = addDays(lastOccurrence, 7);
      else if (frequency === 'Biweekly') nextOccurrence = addDays(lastOccurrence, 14);
      else if (frequency === 'Monthly') nextOccurrence = addMonths(lastOccurrence, 1);
      else if (frequency === 'Quarterly') nextOccurrence = addMonths(lastOccurrence, 3);
      else if (frequency === 'Yearly') nextOccurrence = addYears(lastOccurrence, 1);
      else nextOccurrence = addDays(lastOccurrence, Math.round(avgIntervalDays));

      results.push({
        id: key,
        merchantName: lastTx.merchantName,
        accountId: lastTx.accountId,
        categoryId: lastTx.categoryId,
        isDebit: lastTx.amountCents < 0,
        transactions: txs,
        avgAmount,
        minAmount,
        maxAmount,
        avgIntervalDays,
        frequency,
        lastOccurrence,
        nextOccurrence,
        confidence
      });
    }

    return results;
  }, [transactions]);

  // Apply overrides
  const recurringData = useMemo(() => {
    let data = detectedRecurring.map(item => {
      const override = recurringOverrides.find(o => o.id === item.id);
      if (override) {
        return {
          ...item,
          frequency: override.frequency || item.frequency,
          avgAmount: override.expectedAmountCents || item.avgAmount,
          categoryId: override.categoryId || item.categoryId,
          isIgnored: override.isIgnored,
          isEssential: override.isEssential,
          isConfirmed: true,
        };
      }
      return {
        ...item,
        isIgnored: false,
        isEssential: false,
        isConfirmed: false,
      };
    });

    // Filtering
    if (filterStatus === 'Active') {
      data = data.filter(d => !d.isIgnored);
    } else if (filterStatus === 'Ignored') {
      data = data.filter(d => d.isIgnored);
    }

    if (filterFrequency !== 'All') {
      data = data.filter(d => d.frequency === filterFrequency);
    }

    // Sort by next occurrence
    data.sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime());

    return data;
  }, [detectedRecurring, recurringOverrides, filterFrequency, filterStatus]);

  // Calculate summaries
  const summaries = useMemo(() => {
    let monthly = 0;
    let annual = 0;
    let essential = 0;
    let optional = 0;
    let upcomingThisMonth = 0;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    for (const item of recurringData) {
      if (item.isIgnored || !item.isDebit) continue; // Only count expenses
      
      let monthlyAmt = 0;
      if (item.frequency === 'Weekly') monthlyAmt = (item.avgAmount * 52) / 12;
      else if (item.frequency === 'Biweekly') monthlyAmt = (item.avgAmount * 26) / 12;
      else if (item.frequency === 'Monthly') monthlyAmt = item.avgAmount;
      else if (item.frequency === 'Quarterly') monthlyAmt = item.avgAmount / 3;
      else if (item.frequency === 'Yearly') monthlyAmt = item.avgAmount / 12;
      
      monthly += monthlyAmt;
      annual += monthlyAmt * 12;

      if (item.isEssential) essential += monthlyAmt;
      else optional += monthlyAmt;

      if (item.nextOccurrence.getMonth() === currentMonth && item.nextOccurrence.getFullYear() === currentYear) {
        upcomingThisMonth += item.avgAmount;
      }
    }

    return { monthly, annual, essential, optional, upcomingThisMonth };
  }, [recurringData]);
  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto space-y-6">
      <PageHeader title="Recurring Transactions" onImportClick={() => onNavigate('imports')} />
      
      <div className="flex-1 overflow-y-auto pb-8 space-y-8">
        
        {/* Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="card-raised p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Est. Monthly</div>
            <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(summaries.monthly)}</div>
          </div>
          <div className="card-raised p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Est. Annual</div>
            <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(summaries.annual)}</div>
          </div>
          <div className="card-raised p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Essential</div>
            <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(summaries.essential)}</div>
          </div>
          <div className="card-raised p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Optional</div>
            <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(summaries.optional)}</div>
          </div>
          <div className="card-raised p-5 bg-primary-container text-on-primary-container border-none shadow-md">
            <div className="text-xs font-bold uppercase tracking-wide mb-1 opacity-80">Upcoming This Month</div>
            <div className="text-xl font-bold font-tabular">{formatCurrency(summaries.upcomingThisMonth)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center justify-between border-b border-surface-variant pb-4">
          <div className="flex items-center gap-4">
            <div className="flex bg-surface-container rounded-lg p-1">
              {['Active', 'Ignored', 'All'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status as any)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                    filterStatus === status ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            
            <select 
              className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm shadow-sm outline-none font-medium text-on-surface-variant focus:text-on-surface"
              value={filterFrequency}
              onChange={e => setFilterFrequency(e.target.value)}
            >
              <option value="All">All Frequencies</option>
              <option value="Weekly">Weekly</option>
              <option value="Biweekly">Biweekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Yearly">Yearly</option>
              <option value="Irregular">Irregular</option>
            </select>
          </div>
        </div>

        {/* List */}
        <div className="card-raised flex flex-col divide-y divide-surface-container-low">
          {recurringData.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <RefreshCw size={32} className="text-on-surface-variant mb-4" />
              <p className="text-base font-bold text-on-surface">No recurring transactions found</p>
              <p className="text-sm text-on-surface-variant mt-1">Adjust your filters or import more data.</p>
            </div>
          ) : (
            recurringData.map(item => (
              <div key={item.id} className={`p-4 flex flex-col gap-3 transition-colors ${item.isIgnored ? 'opacity-60 bg-surface-container-lowest' : 'hover:bg-surface-container-low'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-on-surface">{item.merchantName}</span>
                      {item.confidence === 'High' && !item.isConfirmed && (
                        <span className="px-1.5 py-0.5 rounded bg-primary-container text-on-primary-container text-[10px] font-bold uppercase tracking-wide">High Confidence</span>
                      )}
                      {item.isEssential && (
                        <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase tracking-wide">Essential</span>
                      )}
                      {!item.isDebit && (
                        <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase tracking-wide">Income</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant font-medium">
                      <span>{item.frequency}</span>
                      <span>•</span>
                      <span>Next: {format(item.nextOccurrence, 'MMM d')} (Est)</span>
                      <span>•</span>
                      <span>{item.transactions.length} payments</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className={`text-base font-tabular font-bold ${!item.isDebit ? 'text-on-surface' : 'text-on-surface'}`}>
                        {formatCurrency(item.avgAmount)}
                      </div>
                      <div className="text-xs text-on-surface-variant font-medium font-tabular mt-0.5">
                        {formatCurrency(item.minAmount)} - {formatCurrency(item.maxAmount)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={async () => {
                          const override: RecurringOverride = {
                            id: item.id,
                            merchantName: item.merchantName,
                            accountId: item.accountId,
                            isIgnored: item.isIgnored,
                            isEssential: !item.isEssential,
                            frequency: item.frequency,
                            expectedAmountCents: item.avgAmount,
                            categoryId: item.categoryId
                          };
                          await dbApi.putRecurringOverride(override);
                          refreshData();
                        }}
                        className={`p-1.5 rounded-lg border transition-colors ${item.isEssential ? 'bg-primary-container border-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}
                        title={item.isEssential ? "Mark Optional" : "Mark Essential"}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button 
                        onClick={async () => {
                          const override: RecurringOverride = {
                            id: item.id,
                            merchantName: item.merchantName,
                            accountId: item.accountId,
                            isIgnored: !item.isIgnored,
                            isEssential: item.isEssential,
                            frequency: item.frequency,
                            expectedAmountCents: item.avgAmount,
                            categoryId: item.categoryId
                          };
                          await dbApi.putRecurringOverride(override);
                          refreshData();
                        }}
                        className={`p-1.5 rounded-lg border transition-colors ${item.isIgnored ? 'bg-surface border-outline-variant text-on-surface-variant hover:text-on-surface' : 'bg-surface-container text-on-surface hover:bg-error-container hover:text-error hover:border-error-container'}`}
                        title={item.isIgnored ? "Restore" : "Ignore"}
                      >
                        {item.isIgnored ? <RefreshCw size={16} /> : <XCircle size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
