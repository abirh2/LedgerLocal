import { describe, it, expect } from 'vitest';
import { calculateHoldings } from './investmentUtils';
import { InvestmentTransaction, Holding, PriceSnapshot } from '../models/types';

describe('investmentUtils', () => {
  const holdings: Holding[] = [
    { id: 'h1', symbol: 'AAPL', name: 'Apple', accountId: 'acc1', targetAllocation: 100 }
  ];

  const transactions: InvestmentTransaction[] = [
    {
      id: 'itx1',
      accountId: 'acc1',
      date: '2026-01-01',
      symbol: 'AAPL',
      type: 'Buy',
      quantity: 10,
      price: 15000, // $150
      fees: 0,
      amountCents: 150000, // $1500
      createdAt: new Date().toISOString()
    }
  ];

  const prices: PriceSnapshot[] = [
    { id: 'ps1', symbol: 'AAPL', date: '2026-07-01', price: 17500, createdAt: new Date().toISOString() }
  ];

  it('calculates holdings correctly for a buy transaction', () => {
    const stats = calculateHoldings(holdings, transactions, prices);
    expect(stats).toHaveLength(1);
    expect(stats[0].symbol).toBe('AAPL');
    expect(stats[0].quantity).toBe(10);
    expect(stats[0].currentValue).toBe(175000);
    expect(stats[0].unrealizedGain).toBe(25000);
  });

  it('calculates realized gains after a sell', () => {
    const sellTx: InvestmentTransaction = {
      id: 'itx2',
      accountId: 'acc1',
      date: '2026-02-01',
      symbol: 'AAPL',
      type: 'Sell',
      quantity: 5,
      price: 16000, // $160
      fees: 0,
      amountCents: 80000,
      createdAt: new Date().toISOString()
    };
    const stats = calculateHoldings(holdings, [...transactions, sellTx], prices);
    expect(stats[0].quantity).toBe(5);
    expect(stats[0].totalRealizedGain).toBe(5000); // 5 shares * ($160 - $150)
  });

  it('handles stock splits', () => {
    const splitTx: InvestmentTransaction = {
      id: 'itx3',
      accountId: 'acc1',
      date: '2026-03-01',
      symbol: 'AAPL',
      type: 'Split',
      quantity: 2, // 2-for-1
      price: 0,
      fees: 0,
      amountCents: 0,
      createdAt: new Date().toISOString()
    };
    const stats = calculateHoldings(holdings, [...transactions, splitTx], prices);
    expect(stats[0].quantity).toBe(20);
  });
});
