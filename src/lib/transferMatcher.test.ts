import { describe, it, expect } from 'vitest';
import { findTransferCandidates } from './transferMatcher';
import { Transaction } from '../models/types';

describe('transferMatcher', () => {
  const tx1: Transaction = {
    id: 'tx1',
    accountId: 'bank_acc',
    postedDate: '2026-07-01',
    originalDescription: 'TRANSFER TO CREDIT CARD',
    merchantName: 'Transfer',
    amountCents: -100000,
    excludedFromReports: false,
    isTransfer: false,
    createdAt: new Date().toISOString(),
  };

  const tx2: Transaction = {
    id: 'tx2',
    accountId: 'cc_acc',
    postedDate: '2026-07-02',
    originalDescription: 'PAYMENT RECEIVED',
    merchantName: 'Payment',
    amountCents: 100000,
    excludedFromReports: false,
    isTransfer: false,
    createdAt: new Date().toISOString(),
  };

  it('matches opposite amounts in different accounts within date range', () => {
    const candidates = findTransferCandidates([tx1, tx2]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toBeGreaterThanOrEqual(60);
  });

  it('does not match same account transactions', () => {
    const tx2SameAcc = { ...tx2, accountId: 'bank_acc' };
    const candidates = findTransferCandidates([tx1, tx2SameAcc]);
    expect(candidates).toHaveLength(0);
  });

  it('does not match different amounts', () => {
    const tx2DiffAmount = { ...tx2, amountCents: 100001 };
    const candidates = findTransferCandidates([tx1, tx2DiffAmount]);
    expect(candidates).toHaveLength(0);
  });

  it('does not match transactions far apart in time', () => {
    const tx2FarDate = { ...tx2, postedDate: '2026-07-15' };
    const candidates = findTransferCandidates([tx1, tx2FarDate]);
    expect(candidates).toHaveLength(0);
  });
});
