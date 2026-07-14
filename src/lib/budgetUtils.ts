import { Transaction, Budget, Category } from '../models/types';
import { format, parseISO } from 'date-fns';

export interface CategoryBudgetData {
  categoryId: string;
  name: string;
  group: string;
  spent: number;
  budgetAmount: number;
  baseBudgetAmount: number;
  rolloverAmount: number;
  remaining: number;
  percentUsed: number;
  status: 'on-track' | 'near-limit' | 'over-budget' | 'no-spending' | 'no-budget';
}

function monthKey(month: Date): string {
  return format(month, 'yyyy-MM');
}

export function calculateMonthSpending(transactions: Transaction[], month: Date): Record<string, number> {
  const key = monthKey(month);
  const spending: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.excludedFromReports || tx.isTransfer || !tx.categoryId) continue;
    // Compare YYYY-MM on the date-only string — avoid Date UTC/local day shift
    if (tx.postedDate.slice(0, 7) !== key) continue;
    if (!spending[tx.categoryId]) spending[tx.categoryId] = 0;
    spending[tx.categoryId] += -tx.amountCents;
  }

  return spending;
}

export function getCategoryBudgetData(
  categories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
  currentMonth: Date
): CategoryBudgetData[] {
  const currentMonthStr = monthKey(currentMonth);
  const prevMonth = parseISO(`${currentMonthStr}-01`);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevMonthStr = monthKey(prevMonth);

  const spendingByCategory = calculateMonthSpending(transactions, currentMonth);
  const prevMonthSpending = calculateMonthSpending(transactions, prevMonth);

  const currentMonthBudgets = budgets.filter((b) => b.month === currentMonthStr);
  const prevMonthBudgets = budgets.filter((b) => b.month === prevMonthStr);

  return categories.map(cat => {
    const budget = currentMonthBudgets.find(b => b.categoryId === cat.id);
    const spent = spendingByCategory[cat.id] || 0;
    let amountCents = budget?.amountCents || 0;
    
    const prevBudget = prevMonthBudgets.find(b => b.categoryId === cat.id);
    const prevSpent = prevMonthSpending[cat.id] || 0;
    let rolloverAmount = 0;

    if (budget?.rollover && prevBudget) {
      rolloverAmount = prevBudget.amountCents - prevSpent;
      // Note: Typically rollover only adds positive remaining budget, 
      // but some people want negative rollover (overspending carries over).
      // For this app, we'll carry over whatever is left (positive or negative).
      amountCents += rolloverAmount;
    }

    const remaining = amountCents - spent;
    const percentUsed = amountCents > 0 ? (spent / amountCents) * 100 : (spent > 0 ? 100 : 0);
    
    let status: CategoryBudgetData['status'] = 'no-budget';
    if (!budget && spent === 0) status = 'no-spending';
    else if (!budget && spent > 0) status = 'over-budget';
    else if (budget && spent === 0) status = 'no-spending';
    else if (percentUsed > 100) status = 'over-budget';
    else if (percentUsed >= 80) status = 'near-limit';
    else status = 'on-track';

    return {
      categoryId: cat.id,
      name: cat.name,
      group: cat.groupId, // Using groupId from model
      spent,
      budgetAmount: amountCents,
      baseBudgetAmount: budget?.amountCents || 0,
      rolloverAmount,
      remaining,
      percentUsed,
      status
    };
  });
}
