import { Transaction } from '../models/types';
import { startOfMonth, endOfMonth, eachMonthOfInterval, format, parseISO } from 'date-fns';

export interface ReportDataPoint {
  date: string;
  income: number;
  spending: number;
  savings: number;
}

export function calculateIncomeVsSpending(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): ReportDataPoint[] {
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  
  return months.map(month => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthStr = format(month, 'MMM yyyy');
    
    let income = 0;
    let spending = 0;
    
    transactions.forEach(tx => {
      if (tx.excludedFromReports || tx.isTransfer) return;
      
      const txDate = parseISO(tx.postedDate);
      if (txDate >= monthStart && txDate <= monthEnd) {
        if (tx.amountCents > 0) {
          income += tx.amountCents;
        } else {
          spending += Math.abs(tx.amountCents);
        }
      }
    });
    
    return {
      date: monthStr,
      income: income / 100,
      spending: spending / 100,
      savings: (income - spending) / 100
    };
  });
}

export function calculateCategoryBreakdown(
  transactions: Transaction[],
  categories: Record<string, string>, // id -> name
  isIncome: boolean
): { name: string; value: number }[] {
  const breakdown: Record<string, number> = {};
  
  transactions.forEach(tx => {
    if (tx.excludedFromReports || tx.isTransfer || !tx.categoryId) return;
    
    const amount = isIncome ? tx.amountCents : -tx.amountCents;
    if (amount <= 0) return;
    
    const catName = categories[tx.categoryId] || 'Other';
    breakdown[catName] = (breakdown[catName] || 0) + amount;
  });
  
  return Object.entries(breakdown)
    .map(([name, value]) => ({ name, value: value / 100 }))
    .sort((a, b) => b.value - a.value);
}
