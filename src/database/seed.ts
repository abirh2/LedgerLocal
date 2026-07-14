import { dbApi } from './db';
import { Account, Category, Transaction, InvestmentTransaction, Holding, PriceSnapshot, AccountValuation } from '../models/types';
import { subDays, format } from 'date-fns';

export async function seedDemoData() {
  await dbApi.clearAll();

  const accounts: Account[] = [
    {
      id: 'acc_1',
      name: 'Bank of America Checking',
      institution: 'Bank of America',
      type: 'Checking',
      balanceCents: 432000,
      includeInNetWorth: true,
      isManual: false,
      lastImportedDate: format(new Date(), 'yyyy-MM-dd')
    },
    {
      id: 'acc_2',
      name: 'Bank of America Credit Card',
      institution: 'Bank of America',
      type: 'Credit Card',
      balanceCents: -104000,
      includeInNetWorth: true,
      isManual: false,
      lastImportedDate: format(new Date(), 'yyyy-MM-dd')
    },
    {
      id: 'acc_3',
      name: 'Chase Freedom',
      institution: 'Chase',
      type: 'Credit Card',
      balanceCents: -109000,
      includeInNetWorth: true,
      isManual: false,
      lastImportedDate: format(new Date(), 'yyyy-MM-dd')
    },
    {
      id: 'acc_4',
      name: 'Robinhood Brokerage',
      institution: 'Robinhood',
      type: 'Brokerage',
      balanceCents: 1852000,
      includeInNetWorth: true,
      isManual: true
    },
    {
      id: 'acc_5',
      name: 'Employer 401(k)',
      institution: 'Fidelity',
      type: 'Retirement',
      balanceCents: 1802000,
      includeInNetWorth: true,
      isManual: true
    }
  ];

  for (const acc of accounts) {
    await dbApi.putAccount(acc);
  }

  const categories: any[] = [
    { id: 'cat_income_salary', name: 'Salary', groupId: 'Income', isIncome: true, isFixed: false, isArchived: false, order: 0 },
    { id: 'cat_housing_rent', name: 'Rent', groupId: 'Housing', isIncome: false, isFixed: true, isArchived: false, order: 0 },
    { id: 'cat_food_groceries', name: 'Groceries', groupId: 'Food', isIncome: false, isFixed: false, isArchived: false, order: 0 },
    { id: 'cat_food_dining', name: 'Dining', groupId: 'Food', isIncome: false, isFixed: false, isArchived: false, order: 0 },
    { id: 'cat_transport_transit', name: 'Public Transit', groupId: 'Transportation', isIncome: false, isFixed: false, isArchived: false, order: 0 },
    { id: 'cat_financial_transfer', name: 'Transfer', groupId: 'Financial', isIncome: false, isFixed: false, isArchived: false, order: 0 },
    { id: 'cat_lifestyle_shopping', name: 'Shopping', groupId: 'Lifestyle', isIncome: false, isFixed: false, isArchived: false, order: 0 },
    { id: 'cat_housing_utilities', name: 'Utilities', groupId: 'Housing', isIncome: false, isFixed: true, isArchived: false, order: 0 }
  ];

  for (const cat of categories) {
    await dbApi.putCategory(cat);
  }

  const transactions: Transaction[] = [];
  const today = new Date();

  // Generate 40 mock transactions
  for (let i = 0; i < 40; i++) {
    const d = subDays(today, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    
    // Add a mix of transactions
    if (i % 14 === 0) {
      transactions.push({
        id: `tx_${i}_salary`,
        accountId: 'acc_1',
        postedDate: dateStr,
        originalDescription: 'PAYROLL DIRECT DEP',
        merchantName: 'Employer Payroll',
        amountCents: 342000,
        categoryId: 'cat_income_salary',
        excludedFromReports: false,
        isTransfer: false,
        createdAt: new Date().toISOString()
      });
    }

    if (i % 3 === 0) {
      transactions.push({
        id: `tx_${i}_groceries`,
        accountId: 'acc_2',
        postedDate: dateStr,
        originalDescription: 'TRADER JOES #123',
        merchantName: 'Trader Joe\'s',
        amountCents: - (5000 + Math.floor(Math.random() * 5000)), // -$50 to -$100
        categoryId: 'cat_food_groceries',
        excludedFromReports: false,
        isTransfer: false,
        createdAt: new Date().toISOString()
      });
    }

    if (i % 5 === 0) {
      transactions.push({
        id: `tx_${i}_transit`,
        accountId: 'acc_3',
        postedDate: dateStr,
        originalDescription: 'MTA NYCT PAYGO',
        merchantName: 'MTA',
        amountCents: -290, // -$2.90
        categoryId: 'cat_transport_transit',
        excludedFromReports: false,
        isTransfer: false,
        createdAt: new Date().toISOString()
      });
    }

    if (i % 8 === 0) {
       transactions.push({
        id: `tx_${i}_dining`,
        accountId: 'acc_3',
        postedDate: dateStr,
        originalDescription: 'STARBUCKS STORE 1234',
        merchantName: 'Starbucks',
        amountCents: - (400 + Math.floor(Math.random() * 400)), 
        categoryId: 'cat_food_dining',
        excludedFromReports: false,
        isTransfer: false,
        createdAt: new Date().toISOString()
      });
    }
  }

  await dbApi.putTransactions(transactions);

  // Investment Seed Data
  const investmentTxs: InvestmentTransaction[] = [
    {
      id: 'itx_1',
      accountId: 'acc_4',
      date: subDays(today, 30).toISOString().split('T')[0],
      symbol: 'VTI',
      type: 'Buy',
      quantity: 10,
      price: 24000, // $240.00
      fees: 0,
      amountCents: 240000,
      createdAt: new Date().toISOString()
    },
    {
      id: 'itx_2',
      accountId: 'acc_4',
      date: subDays(today, 25).toISOString().split('T')[0],
      symbol: 'VXUS',
      type: 'Buy',
      quantity: 20,
      price: 5500, // $55.00
      fees: 0,
      amountCents: 110000,
      createdAt: new Date().toISOString()
    },
    {
      id: 'itx_3',
      accountId: 'acc_5',
      date: subDays(today, 45).toISOString().split('T')[0],
      symbol: 'VTI',
      type: 'Buy',
      quantity: 100,
      price: 23500, // $235.00
      fees: 0,
      amountCents: 2350000,
      createdAt: new Date().toISOString()
    }
  ];

  const holdings: Holding[] = [
    {
      id: 'h_1',
      accountId: 'acc_4',
      symbol: 'VTI',
      name: 'Vanguard Total Stock Market ETF',
      targetAllocation: 60
    },
    {
      id: 'h_2',
      accountId: 'acc_4',
      symbol: 'VXUS',
      name: 'Vanguard Total International Stock ETF',
      targetAllocation: 40
    },
    {
      id: 'h_3',
      accountId: 'acc_5',
      symbol: 'VTI',
      name: 'Vanguard Total Stock Market ETF',
      targetAllocation: 100
    }
  ];

  const priceSnapshots: PriceSnapshot[] = [
    {
      id: 'ps_1',
      symbol: 'VTI',
      date: today.toISOString().split('T')[0],
      price: 25500, // $255.00
      createdAt: new Date().toISOString()
    },
    {
      id: 'ps_2',
      symbol: 'VXUS',
      date: today.toISOString().split('T')[0],
      price: 5800, // $58.00
      createdAt: new Date().toISOString()
    }
  ];

  const valuations: AccountValuation[] = [
    {
      id: 'av_1',
      accountId: 'acc_4',
      date: subDays(today, 30).toISOString().split('T')[0],
      valueCents: 1500000,
      createdAt: new Date().toISOString()
    },
    {
      id: 'av_2',
      accountId: 'acc_4',
      date: subDays(today, 15).toISOString().split('T')[0],
      valueCents: 1650000,
      createdAt: new Date().toISOString()
    },
    {
      id: 'av_3',
      accountId: 'acc_4',
      date: today.toISOString().split('T')[0],
      valueCents: 1852000,
      createdAt: new Date().toISOString()
    }
  ];

  await dbApi.putInvestmentTransactions(investmentTxs);
  await dbApi.putHoldings(holdings);
  await dbApi.putPriceSnapshots(priceSnapshots);
  for (const v of valuations) {
    await dbApi.putAccountValuation(v);
  }
}
