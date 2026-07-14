import { describe, it, expect } from 'vitest';
import { calculateMonthSpending, getCategoryBudgetData } from './budgetUtils';
import { Transaction, Budget, Category } from '../models/types';

describe('budgetUtils', () => {
  const categories: Category[] = [
    { id: 'cat1', name: 'Food', groupId: 'Food', isIncome: false, isFixed: false, isArchived: false, order: 0 }
  ];

  const transactions: Transaction[] = [
    {
      id: 'tx1',
      accountId: 'acc1',
      postedDate: '2026-07-15',
      originalDescription: 'Grocery Store',
      merchantName: 'Groceries',
      amountCents: -5000,
      categoryId: 'cat1',
      excludedFromReports: false,
      isTransfer: false,
      createdAt: new Date().toISOString(),
    }
  ];

  const currentMonth = new Date(2026, 6, 1); // July 2026, local — avoid UTC date-only shift

  describe('calculateMonthSpending', () => {
    it('calculates spending for the correct month', () => {
      const spending = calculateMonthSpending(transactions, currentMonth);
      expect(spending['cat1']).toBe(5000);
    });

    it('ignores transactions in other months', () => {
      const otherMonthTx: Transaction = {
        ...transactions[0],
        id: 'tx2',
        postedDate: '2026-06-30'
      };
      const spending = calculateMonthSpending([otherMonthTx], currentMonth);
      expect(spending['cat1']).toBeUndefined();
    });
  });

  describe('getCategoryBudgetData', () => {
    it('calculates budget data without rollover', () => {
      const budgets: Budget[] = [
        { id: 'b1', categoryId: 'cat1', amountCents: 10000, month: '2026-07', rollover: false }
      ];
      const data = getCategoryBudgetData(categories, budgets, transactions, currentMonth);
      expect(data[0].spent).toBe(5000);
      expect(data[0].remaining).toBe(5000);
      expect(data[0].status).toBe('on-track');
    });

    it('handles over-budget state', () => {
      const budgets: Budget[] = [
        { id: 'b1', categoryId: 'cat1', amountCents: 3000, month: '2026-07', rollover: false }
      ];
      const data = getCategoryBudgetData(categories, budgets, transactions, currentMonth);
      expect(data[0].status).toBe('over-budget');
    });

    it('handles rollover from previous month', () => {
      const budgets: Budget[] = [
        { id: 'b1', categoryId: 'cat1', amountCents: 10000, month: '2026-07', rollover: true },
        { id: 'b2', categoryId: 'cat1', amountCents: 10000, month: '2026-06', rollover: false }
      ];
      // Prev month: budget 10000, spent 0 (no tx in June). Rollover should be 10000.
      const data = getCategoryBudgetData(categories, budgets, transactions, currentMonth);
      expect(data[0].budgetAmount).toBe(20000);
      expect(data[0].rolloverAmount).toBe(10000);
    });
  });
});
