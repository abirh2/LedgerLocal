import { describe, it, expect } from 'vitest';
import { calculateIncomeVsSpending, calculateCategoryBreakdown } from './reportUtils';
import { Transaction } from '../models/types';

describe('reportUtils', () => {
  const transactions: Transaction[] = [
    {
      id: 'tx1',
      accountId: 'acc1',
      postedDate: '2026-07-15',
      originalDescription: 'Salary',
      merchantName: 'Employer',
      amountCents: 500000, // $5000 income
      categoryId: 'cat_income',
      excludedFromReports: false,
      isTransfer: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx2',
      accountId: 'acc1',
      postedDate: '2026-07-20',
      originalDescription: 'Rent',
      merchantName: 'Landlord',
      amountCents: -150000, // $1500 expense
      categoryId: 'cat_rent',
      excludedFromReports: false,
      isTransfer: false,
      createdAt: new Date().toISOString(),
    }
  ];

  describe('calculateIncomeVsSpending', () => {
    it('calculates correctly for a given month', () => {
      const start = new Date(2026, 6, 1);
      const end = new Date(2026, 6, 31);
      const results = calculateIncomeVsSpending(transactions, start, end);
      
      expect(results).toHaveLength(1);
      expect(results[0].income).toBe(5000);
      expect(results[0].spending).toBe(1500);
      expect(results[0].savings).toBe(3500);
    });
  });

  describe('calculateCategoryBreakdown', () => {
    it('aggregates expenses by category', () => {
      const categories = { 'cat_rent': 'Rent', 'cat_income': 'Income' };
      const results = calculateCategoryBreakdown(transactions, categories, false);
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Rent');
      expect(results[0].value).toBe(1500);
    });

    it('aggregates income by category', () => {
      const categories = { 'cat_rent': 'Rent', 'cat_income': 'Income' };
      const results = calculateCategoryBreakdown(transactions, categories, true);
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Income');
      expect(results[0].value).toBe(5000);
    });
  });
});
