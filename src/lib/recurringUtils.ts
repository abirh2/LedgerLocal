import { Transaction, RecurringFrequency } from '../models/types';
import { differenceInDays, parseISO, addDays, addMonths, addYears } from 'date-fns';

export interface RecurringGroup {
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

export function normalizeMerchantForRecurring(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

export function detectRecurringTransactions(transactions: Transaction[]): RecurringGroup[] {
  const groups = new Map<string, Transaction[]>();
  
  for (const tx of transactions) {
    if (tx.isTransfer) continue;
    const norm = normalizeMerchantForRecurring(tx.merchantName);
    if (!norm) continue;
    const isDebit = tx.amountCents < 0;
    const key = `${norm}_${tx.accountId}_${isDebit ? 'out' : 'in'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const results: RecurringGroup[] = [];

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
    const amountVariance = avgAmount > 0 ? (maxAmount - minAmount) / avgAmount : 0;
    
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
      confidence = 'Medium';
    }

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
}
