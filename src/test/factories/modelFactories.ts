import { Account, Transaction, Category, CategoryGroup, Budget, Rule, BalanceSnapshot, Holding, InvestmentTransaction, ImportRecord, Merchant, TransferMatch, UserProfile, PriceSnapshot, AccountValuation } from '../../models/types';

export const createAccount = (overrides: Partial<Account> = {}): Account => ({
  id: `acc_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Account',
  type: 'Checking',
  institution: 'Test Bank',
  balanceCents: 100000,
  includeInNetWorth: true,
  isManual: true,
  ...overrides,
});

export const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: `tx_${Math.random().toString(36).substr(2, 9)}`,
  accountId: 'acc_1',
  postedDate: '2026-07-01',
  originalDescription: 'Test Transaction',
  merchantName: 'Test Merchant',
  amountCents: -5000,
  categoryId: 'cat_1',
  excludedFromReports: false,
  isTransfer: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createCategory = (overrides: Partial<Category> = {}): Category => ({
  id: `cat_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Category',
  groupId: 'group_1',
  isIncome: false,
  isFixed: false,
  isArchived: false,
  order: 0,
  ...overrides,
});

export const createCategoryGroup = (overrides: Partial<CategoryGroup> = {}): CategoryGroup => ({
  id: `group_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Group',
  order: 0,
  ...overrides,
});

export const createBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: `budget_${Math.random().toString(36).substr(2, 9)}`,
  categoryId: 'cat_1',
  amountCents: 50000,
  month: '2026-07',
  rollover: false,
  ...overrides,
});

export const createRule = (overrides: Partial<Rule> = {}): Rule => ({
  id: `rule_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Rule',
  conditions: [{ field: 'merchant', operator: 'contains', value: 'Test' }],
  actions: [{ type: 'assign_category', value: 'cat_1' }],
  priority: 0,
  enabled: true,
  logic: 'AND',
  matchCount: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createBalanceSnapshot = (overrides: Partial<BalanceSnapshot> = {}): BalanceSnapshot => ({
  id: `bs_${Math.random().toString(36).substr(2, 9)}`,
  accountId: 'acc_1',
  date: '2026-07-01',
  balanceCents: 100000,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMerchant = (overrides: Partial<Merchant> = {}): Merchant => ({
  id: `mer_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Merchant',
  originalDescriptions: ['TEST MERCHANT 123'],
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createTransferMatch = (overrides: Partial<TransferMatch> = {}): TransferMatch => ({
  id: `tm_${Math.random().toString(36).substr(2, 9)}`,
  tx1Id: 'tx_1',
  tx2Id: 'tx_2',
  confidence: 1,
  status: 'confirmed',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: `prof_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Default Profile',
  createdAt: new Date().toISOString(),
  lastUsedAt: new Date().toISOString(),
  ...overrides,
});

export const createImportRecord = (overrides: Partial<ImportRecord> = {}): ImportRecord => ({
  id: `import_${Math.random().toString(36).substr(2, 9)}`,
  accountId: 'acc_1',
  fileName: 'test.csv',
  importDate: new Date().toISOString(),
  rowsProcessed: 10,
  rowsInserted: 10,
  duplicatesSkipped: 0,
  invalidRows: 0,
  ...overrides,
});

export const createHolding = (overrides: Partial<Holding> = {}): Holding => ({
  id: `h_${Math.random().toString(36).substr(2, 9)}`,
  symbol: 'AAPL',
  name: 'Apple Inc.',
  accountId: 'acc_1',
  targetAllocation: 0,
  ...overrides,
});

export const createInvestmentTransaction = (overrides: Partial<InvestmentTransaction> = {}): InvestmentTransaction => ({
  id: `itx_${Math.random().toString(36).substr(2, 9)}`,
  accountId: 'acc_1',
  date: '2026-07-01',
  symbol: 'AAPL',
  type: 'Buy',
  quantity: 10,
  price: 15000,
  fees: 0,
  amountCents: 150000,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createPriceSnapshot = (overrides: Partial<PriceSnapshot> = {}): PriceSnapshot => ({
  id: `ps_${Math.random().toString(36).substr(2, 9)}`,
  symbol: 'AAPL',
  date: '2026-07-01',
  price: 15000,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createAccountValuation = (overrides: Partial<AccountValuation> = {}): AccountValuation => ({
  id: `av_${Math.random().toString(36).substr(2, 9)}`,
  accountId: 'acc_1',
  date: '2026-07-01',
  valueCents: 1000000,
  createdAt: new Date().toISOString(),
  ...overrides,
});
