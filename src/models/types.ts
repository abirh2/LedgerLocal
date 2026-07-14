export type AccountType = 'Checking' | 'Credit Card' | 'Brokerage' | 'Retirement' | 'Other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  balanceCents: number; // For manual accounts this is the manual balance, for imported it's computed or latest snapshot
  lastImportedDate?: string;
  includeInNetWorth: boolean;
  isManual: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  importId?: string;
  postedDate: string; // YYYY-MM-DD
  transactionDate?: string;
  originalDescription: string;
  merchantName: string;
  amountCents: number;
  categoryId?: string;
  transactionType?: string;
  notes?: string;
  excludedFromReports: boolean;
  isTransfer: boolean;
  transferId?: string; // Links to the other side of a transfer
  isRefund?: boolean;
  refundOfId?: string; // Links to the original purchase
  tags?: string[];
  ruleId?: string; // Rule provenance
  manualEdit?: boolean; // Whether the transaction was manually edited
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  groupId: string; // Reference to CategoryGroup
  icon?: string;
  description?: string;
  isIncome: boolean;
  isFixed: boolean;
  isArchived: boolean;
  order: number;
  parentId?: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  order: number;
}

export interface Budget {
  id: string;
  categoryId: string;
  amountCents: number;
  month: string; // YYYY-MM
  rollover: boolean;
}

export interface AccountStatementSummary {
  beginningBalanceCents?: number;
  beginningBalanceDate?: string;
  totalCreditsCents?: number;
  totalDebitsCents?: number;
  endingBalanceCents?: number;
  endingBalanceDate?: string;
}

export interface ImportRecord {
  id: string;
  accountId: string;
  fileName: string;
  importDate: string;
  startDate?: string;
  endDate?: string;
  rowsProcessed: number;
  rowsInserted: number;
  duplicatesSkipped: number;
  invalidRows: number;
  importerId?: string;
  statementSummary?: AccountStatementSummary;
  snapshotIds?: string[];
}

export interface BalanceSnapshot {
  id: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  balanceCents: number;
  note?: string;
  importId?: string;
  createdAt: string;
}

export type RecurringFrequency = 'Weekly' | 'Biweekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Irregular';

export interface RecurringOverride {
  id: string; // usually merchantName or a hash of merchant+account
  merchantName: string;
  accountId: string;
  isIgnored: boolean;
  isEssential: boolean;
  frequency?: RecurringFrequency;
  expectedAmountCents?: number;
  categoryId?: string;
}

export type InvestmentTransactionType = 
  | 'Buy' 
  | 'Sell' 
  | 'Dividend' 
  | 'Interest' 
  | 'Deposit' 
  | 'Withdrawal' 
  | 'Fee' 
  | 'Split' 
  | 'Reinvestment';

export interface InvestmentTransaction {
  id: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  symbol: string;
  type: InvestmentTransactionType;
  quantity: number; // Support decimals
  price: number; // in cents
  fees: number; // in cents
  amountCents: number; // Total impact on cash
  notes?: string;
  createdAt: string;
}

export interface Holding {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  targetAllocation?: number; // 0-100
}

export interface PriceSnapshot {
  id: string;
  symbol: string;
  date: string; // YYYY-MM-DD
  price: number; // in cents
  createdAt: string;
}

export interface AccountValuation {
  id: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  valueCents: number;
  createdAt: string;
}

// Rule System
export type RuleConditionOperator = 
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'equals'
  | 'gt' | 'lt' | 'matches' | 'is_empty' | 'is_not_empty';

export type RuleConditionField = 
  | 'description' | 'merchant' | 'account' | 'category' | 'amount' 
  | 'type' | 'date' | 'debit_credit' | 'notes';

export interface RuleCondition {
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: any;
}

export interface RuleAction {
  type: 'rename_merchant' | 'assign_category' | 'add_tag' | 'remove_tag' | 'mark_transfer' | 'mark_refund' | 'exclude_reports' | 'include_reports' | 'add_note_prefix';
  value: any;
}

export interface Rule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: (RuleCondition | RuleGroup)[];
  actions: RuleAction[];
  logic: 'AND' | 'OR';
  lastRunDate?: string;
  matchCount: number;
  createdAt: string;
}

export interface RuleGroup {
  logic: 'AND' | 'OR';
  conditions: (RuleCondition | RuleGroup)[];
}

// Merchant System
export interface Merchant {
  id: string;
  name: string;
  defaultCategoryId?: string;
  originalDescriptions: string[]; // List of descriptions that map to this merchant
  createdAt: string;
}

// Transfer Matching
export interface TransferMatch {
  id: string;
  tx1Id: string;
  tx2Id: string;
  confidence: number;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: string;
}

// Settings & Profiles
export interface UserSettings {
  currency: string;
  locale: string;
  dateFormat: string;
  numberFormat: string;
  firstDayOfWeek: number; // 0-6
  defaultReportingPeriod: 'this_month' | 'last_month' | 'this_year' | 'last_30_days';
  fiscalYearStartMonth: number; // 1-12
  
  density: 'comfortable' | 'compact';
  sidebarCollapsed: boolean;
  defaultTransactionColumns: string[];
  reducedMotion: boolean;
  theme: 'light'; // Only light supported for now

  importDuplicates: 'skip' | 'allow' | 'merge';
  retainRawImportRows: boolean;
  retainSourceFile: boolean;
  defaultDuplicateBehavior: 'skip' | 'overwrite';
  requireImportConfirmation: boolean;
  
  lastBackupDate?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface AppState {
  currentProfileId: string;
  profiles: UserProfile[];
}
