import { describe, it, expect } from 'vitest';
import { detectRecurringTransactions } from './recurringUtils';
import { Transaction } from '../models/types';

describe('recurringUtils', () => {
  const transactions: Transaction[] = [
    {
      id: 'tx1',
      accountId: 'acc1',
      postedDate: '2026-05-01',
      originalDescription: 'NETFLIX',
      merchantName: 'Netflix',
      amountCents: -1599,
      categoryId: 'entertainment',
      excludedFromReports: false,
      isTransfer: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx2',
      accountId: 'acc1',
      postedDate: '2026-06-01',
      originalDescription: 'NETFLIX',
      merchantName: 'Netflix',
      amountCents: -1599,
      categoryId: 'entertainment',
      excludedFromReports: false,
      isTransfer: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx3',
      accountId: 'acc1',
      postedDate: '2026-07-01',
      originalDescription: 'NETFLIX',
      merchantName: 'Netflix',
      amountCents: -1599,
      categoryId: 'entertainment',
      excludedFromReports: false,
      isTransfer: false,
      createdAt: new Date().toISOString(),
    }
  ];

  it('detects monthly recurring transactions with high confidence', () => {
    const results = detectRecurringTransactions(transactions);
    expect(results).toHaveLength(1);
    expect(results[0].merchantName).toBe('Netflix');
    expect(results[0].frequency).toBe('Monthly');
    expect(results[0].confidence).toBe('High');
  });

  it('ignores one-off transactions', () => {
    const oneOff = { ...transactions[0], id: 'tx4', merchantName: 'Unique Store' };
    const results = detectRecurringTransactions([oneOff]);
    expect(results).toHaveLength(0);
  });

  it('detects weekly recurring transactions', () => {
    const weeklyTxs: Transaction[] = [
      { ...transactions[0], id: 'w1', postedDate: '2026-07-01' },
      { ...transactions[0], id: 'w2', postedDate: '2026-07-08' },
      { ...transactions[0], id: 'w3', postedDate: '2026-07-15' },
    ];
    const results = detectRecurringTransactions(weeklyTxs);
    expect(results).toHaveLength(1);
    expect(results[0].frequency).toBe('Weekly');
  });

  it('detects biweekly and quarterly frequencies', () => {
    const biweeklyTxs: Transaction[] = [
      { ...transactions[0], id: 'b1', postedDate: '2026-07-01' },
      { ...transactions[0], id: 'b2', postedDate: '2026-07-15' },
    ];
    const resultsBi = detectRecurringTransactions(biweeklyTxs);
    expect(resultsBi[0].frequency).toBe('Biweekly');

    const quarterlyTxs: Transaction[] = [
      { ...transactions[0], id: 'q1', postedDate: '2026-01-01' },
      { ...transactions[0], id: 'q2', postedDate: '2026-04-01' },
    ];
    const resultsQu = detectRecurringTransactions(quarterlyTxs);
    expect(resultsQu[0].frequency).toBe('Quarterly');
  });

  it('handles irregular transactions with varying amounts', () => {
    const irregularTxs: Transaction[] = [
      { ...transactions[0], id: 'i1', postedDate: '2026-07-01', amountCents: -1000 },
      { ...transactions[0], id: 'i2', postedDate: '2026-07-20', amountCents: -1200 },
      { ...transactions[0], id: 'i3', postedDate: '2026-08-15', amountCents: -1100 },
    ];
    const results = detectRecurringTransactions(irregularTxs);
    expect(results[0].frequency).toBe('Irregular');
    expect(results[0].confidence).toBe('Low');
  });
});
