import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Account, Transaction, Category, CategoryGroup, Budget, ImportRecord, RecurringOverride, BalanceSnapshot, InvestmentTransaction, Holding, PriceSnapshot, AccountValuation, Rule, Merchant, TransferMatch, UserSettings } from '../models/types';

interface LedgerDB extends DBSchema {
  accounts: {
    key: string;
    value: Account;
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: {
      'by-account': string;
      'by-date': string;
    };
  };
  categories: {
    key: string;
    value: Category;
    indexes: {
      'by-group': string;
    };
  };
  category_groups: {
    key: string;
    value: CategoryGroup;
  };
  budgets: {
    key: string;
    value: Budget;
    indexes: {
      'by-month': string;
    };
  };
  rules: {
    key: string;
    value: Rule;
    indexes: {
      'by-priority': number;
    };
  };
  merchants: {
    key: string;
    value: Merchant;
  };
  transfer_matches: {
    key: string;
    value: TransferMatch;
    indexes: {
      'by-tx1': string;
      'by-tx2': string;
    };
  };
  imports: {
    key: string;
    value: ImportRecord;
  };
  recurring_overrides: {
    key: string;
    value: RecurringOverride;
  };
  balance_snapshots: {
    key: string;
    value: BalanceSnapshot;
    indexes: {
      'by-account': string;
      'by-date': string;
    };
  };
  investment_transactions: {
    key: string;
    value: InvestmentTransaction;
    indexes: {
      'by-account': string;
      'by-date': string;
      'by-symbol': string;
    };
  };
  holdings: {
    key: string;
    value: Holding;
    indexes: {
      'by-account': string;
      'by-symbol': string;
    };
  };
  price_snapshots: {
    key: string;
    value: PriceSnapshot;
    indexes: {
      'by-symbol': string;
      'by-date': string;
    };
  };
  account_valuations: {
    key: string;
    value: AccountValuation;
    indexes: {
      'by-account': string;
      'by-date': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<LedgerDB>> | null = null;
let currentProfileId: string | null = null;

export async function switchProfile(profileId: string) {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = null;
  currentProfileId = profileId;
  return initDB(profileId);
}

export function initDB(profileId?: string) {
  const targetId = profileId || currentProfileId || 'default';
  
  if (!dbPromise || targetId !== currentProfileId) {
    currentProfileId = targetId;
    dbPromise = openDB<LedgerDB>(`ledger-local-profile-${targetId}`, 5, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 1) {
          db.createObjectStore('accounts', { keyPath: 'id' });
          
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('by-account', 'accountId');
          txStore.createIndex('by-date', 'postedDate');

          const catStore = db.createObjectStore('categories', { keyPath: 'id' });
          catStore.createIndex('by-group', 'group');

          const budgetStore = db.createObjectStore('budgets', { keyPath: 'id' });
          budgetStore.createIndex('by-month', 'month');

          db.createObjectStore('imports', { keyPath: 'id' });
        }
        
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('recurring_overrides')) {
            db.createObjectStore('recurring_overrides', { keyPath: 'id' });
          }
        }

        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('balance_snapshots')) {
            const snapStore = db.createObjectStore('balance_snapshots', { keyPath: 'id' });
            snapStore.createIndex('by-account', 'accountId');
            snapStore.createIndex('by-date', 'date');
          }
        }

        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains('investment_transactions')) {
            const invTxStore = db.createObjectStore('investment_transactions', { keyPath: 'id' });
            invTxStore.createIndex('by-account', 'accountId');
            invTxStore.createIndex('by-date', 'date');
            invTxStore.createIndex('by-symbol', 'symbol');
          }
          if (!db.objectStoreNames.contains('holdings')) {
            const holdingStore = db.createObjectStore('holdings', { keyPath: 'id' });
            holdingStore.createIndex('by-account', 'accountId');
            holdingStore.createIndex('by-symbol', 'symbol');
          }
          if (!db.objectStoreNames.contains('price_snapshots')) {
            const priceStore = db.createObjectStore('price_snapshots', { keyPath: 'id' });
            priceStore.createIndex('by-symbol', 'symbol');
            priceStore.createIndex('by-date', 'date');
          }
          if (!db.objectStoreNames.contains('account_valuations')) {
            const valStore = db.createObjectStore('account_valuations', { keyPath: 'id' });
            valStore.createIndex('by-account', 'accountId');
            valStore.createIndex('by-date', 'date');
          }
        }

        if (oldVersion < 5) {
          if (!db.objectStoreNames.contains('category_groups')) {
            db.createObjectStore('category_groups', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('rules')) {
            const ruleStore = db.createObjectStore('rules', { keyPath: 'id' });
            ruleStore.createIndex('by-priority', 'priority');
          }
          if (!db.objectStoreNames.contains('merchants')) {
            db.createObjectStore('merchants', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('transfer_matches')) {
            const transferStore = db.createObjectStore('transfer_matches', { keyPath: 'id' });
            transferStore.createIndex('by-tx1', 'tx1Id');
            transferStore.createIndex('by-tx2', 'tx2Id');
          }
        }
      },
    });
  }
  return dbPromise;
}

export const dbApi = {
  // Accounts
  async getAccounts() {
    const db = await initDB();
    return db.getAll('accounts');
  },
  async putAccount(account: Account) {
    const db = await initDB();
    await db.put('accounts', account);
  },
  
  // Transactions
  async getTransactions() {
    const db = await initDB();
    return db.getAllFromIndex('transactions', 'by-date'); // sorted by date (ascending, we'll reverse in UI)
  },
  async putTransaction(transaction: Transaction) {
    const db = await initDB();
    await db.put('transactions', transaction);
  },
  async putTransactions(transactions: Transaction[]) {
    const db = await initDB();
    const tx = db.transaction('transactions', 'readwrite');
    for (const t of transactions) {
      tx.store.put(t);
    }
    await tx.done;
  },
  async deleteTransaction(id: string) {
    const db = await initDB();
    await db.delete('transactions', id);
  },
  async deleteTransactionsByImportId(importId: string) {
    const db = await initDB();
    const all = await db.getAll('transactions');
    const tx = db.transaction('transactions', 'readwrite');
    for (const t of all) {
      if (t.importId === importId) {
        await tx.store.delete(t.id);
      }
    }
    await tx.done;
  },

  // Categories
  async getCategories() {
    const db = await initDB();
    return db.getAll('categories');
  },
  async putCategory(category: Category) {
    const db = await initDB();
    await db.put('categories', category);
  },
  async putCategories(categories: Category[]) {
    const db = await initDB();
    const tx = db.transaction('categories', 'readwrite');
    for (const c of categories) {
      tx.store.put(c);
    }
    await tx.done;
  },
  async deleteCategory(id: string) {
    const db = await initDB();
    await db.delete('categories', id);
  },

  // Category Groups
  async getCategoryGroups() {
    const db = await initDB();
    return db.getAll('category_groups');
  },
  async putCategoryGroup(group: CategoryGroup) {
    const db = await initDB();
    await db.put('category_groups', group);
  },
  async putCategoryGroups(groups: CategoryGroup[]) {
    const db = await initDB();
    const tx = db.transaction('category_groups', 'readwrite');
    for (const g of groups) {
      tx.store.put(g);
    }
    await tx.done;
  },
  async deleteCategoryGroup(id: string) {
    const db = await initDB();
    await db.delete('category_groups', id);
  },

  // Rules
  async getRules() {
    const db = await initDB();
    return db.getAllFromIndex('rules', 'by-priority');
  },
  async putRule(rule: Rule) {
    const db = await initDB();
    await db.put('rules', rule);
  },
  async deleteRule(id: string) {
    const db = await initDB();
    await db.delete('rules', id);
  },

  // Merchants
  async getMerchants() {
    const db = await initDB();
    return db.getAll('merchants');
  },
  async putMerchant(merchant: Merchant) {
    const db = await initDB();
    await db.put('merchants', merchant);
  },
  async putMerchants(merchants: Merchant[]) {
    const db = await initDB();
    const tx = db.transaction('merchants', 'readwrite');
    for (const m of merchants) {
      tx.store.put(m);
    }
    await tx.done;
  },
  async deleteMerchant(id: string) {
    const db = await initDB();
    await db.delete('merchants', id);
  },

  // Transfer Matches
  async getTransferMatches() {
    const db = await initDB();
    return db.getAll('transfer_matches');
  },
  async putTransferMatch(match: TransferMatch) {
    const db = await initDB();
    await db.put('transfer_matches', match);
  },
  async deleteTransferMatch(id: string) {
    const db = await initDB();
    await db.delete('transfer_matches', id);
  },

  // Budgets
  async getBudgets(month?: string) {
    const db = await initDB();
    if (month) {
      return db.getAllFromIndex('budgets', 'by-month', month);
    }
    return db.getAll('budgets');
  },
  async putBudget(budget: Budget) {
    const db = await initDB();
    await db.put('budgets', budget);
  },
  async deleteBudget(id: string) {
    const db = await initDB();
    await db.delete('budgets', id);
  },
  async clearBudgetsForMonth(month: string) {
    const db = await initDB();
    const tx = db.transaction('budgets', 'readwrite');
    const index = tx.store.index('by-month');
    const keys = await index.getAllKeys(month);
    for (const key of keys) {
      await tx.store.delete(key);
    }
    await tx.done;
  },

  // Recurring Overrides
  async getRecurringOverrides() {
    const db = await initDB();
    return db.getAll('recurring_overrides');
  },
  async putRecurringOverride(override: RecurringOverride) {
    const db = await initDB();
    await db.put('recurring_overrides', override);
  },

  // Balance Snapshots
  async getBalanceSnapshots() {
    const db = await initDB();
    return db.getAllFromIndex('balance_snapshots', 'by-date');
  },
  async putBalanceSnapshot(snapshot: BalanceSnapshot) {
    const db = await initDB();
    await db.put('balance_snapshots', snapshot);
  },
  async deleteBalanceSnapshot(id: string) {
    const db = await initDB();
    await db.delete('balance_snapshots', id);
  },
  async putBalanceSnapshots(snapshots: BalanceSnapshot[]) {
    const db = await initDB();
    const tx = db.transaction('balance_snapshots', 'readwrite');
    for (const s of snapshots) {
      tx.store.put(s);
    }
    await tx.done;
  },
  async deleteBalanceSnapshotsByImportId(importId: string) {
    const db = await initDB();
    const all = await db.getAll('balance_snapshots');
    const tx = db.transaction('balance_snapshots', 'readwrite');
    for (const s of all) {
      if (s.importId === importId) {
        await tx.store.delete(s.id);
      }
    }
    await tx.done;
  },

  // Imports
  async getImports() {
    const db = await initDB();
    return db.getAll('imports');
  },
  async putImport(record: ImportRecord) {
    const db = await initDB();
    await db.put('imports', record);
  },
  async deleteImport(id: string) {
    const db = await initDB();
    await db.delete('imports', id);
  },
  /** Undo one import batch: transactions + balance snapshots + import record. */
  async undoImportBatch(importId: string) {
    await this.deleteTransactionsByImportId(importId);
    await this.deleteBalanceSnapshotsByImportId(importId);
    await this.deleteImport(importId);
  },

  // Investments
  async getInvestmentTransactions() {
    const db = await initDB();
    return db.getAllFromIndex('investment_transactions', 'by-date');
  },
  async putInvestmentTransaction(itx: InvestmentTransaction) {
    const db = await initDB();
    await db.put('investment_transactions', itx);
  },
  async putInvestmentTransactions(itxs: InvestmentTransaction[]) {
    const db = await initDB();
    const tx = db.transaction('investment_transactions', 'readwrite');
    for (const t of itxs) {
      tx.store.put(t);
    }
    await tx.done;
  },
  async deleteInvestmentTransaction(id: string) {
    const db = await initDB();
    await db.delete('investment_transactions', id);
  },

  async getHoldings() {
    const db = await initDB();
    return db.getAll('holdings');
  },
  async putHolding(holding: Holding) {
    const db = await initDB();
    await db.put('holdings', holding);
  },
  async putHoldings(holdings: Holding[]) {
    const db = await initDB();
    const tx = db.transaction('holdings', 'readwrite');
    for (const h of holdings) {
      tx.store.put(h);
    }
    await tx.done;
  },
  async deleteHolding(id: string) {
    const db = await initDB();
    await db.delete('holdings', id);
  },

  async getPriceSnapshots() {
    const db = await initDB();
    return db.getAllFromIndex('price_snapshots', 'by-date');
  },
  async putPriceSnapshot(snapshot: PriceSnapshot) {
    const db = await initDB();
    await db.put('price_snapshots', snapshot);
  },
  async putPriceSnapshots(snapshots: PriceSnapshot[]) {
    const db = await initDB();
    const tx = db.transaction('price_snapshots', 'readwrite');
    for (const s of snapshots) {
      tx.store.put(s);
    }
    await tx.done;
  },
  async deletePriceSnapshot(id: string) {
    const db = await initDB();
    await db.delete('price_snapshots', id);
  },

  async getAccountValuations() {
    const db = await initDB();
    return db.getAllFromIndex('account_valuations', 'by-date');
  },
  async putAccountValuation(valuation: AccountValuation) {
    const db = await initDB();
    await db.put('account_valuations', valuation);
  },
  async deleteAccountValuation(id: string) {
    const db = await initDB();
    await db.delete('account_valuations', id);
  },

  // Data Management
  async clearAll() {
    const db = await initDB();
    const stores = [
      'accounts', 'transactions', 'categories', 'category_groups', 'budgets', 'rules', 'merchants', 'transfer_matches', 'imports', 
      'recurring_overrides', 'balance_snapshots', 'investment_transactions', 
      'holdings', 'price_snapshots', 'account_valuations'
    ] as any;
    const tx = db.transaction(stores, 'readwrite');
    for (const store of (stores as string[])) {
      await tx.objectStore(store as any).clear();
    }
    await tx.done;
  },

  // Diagnostics
  async getDiagnostics() {
    try {
      const db = await initDB();
      const accountsCount = await db.count('accounts');
      const transactionsCount = await db.count('transactions');
      const categoriesCount = await db.count('categories');
      const budgetsCount = await db.count('budgets');
      const rulesCount = await db.count('rules');
      const merchantsCount = await db.count('merchants');
      const importsCount = await db.count('imports');
      
      let storageEstimate = { usage: 0, quota: 0 };
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        storageEstimate = {
          usage: est.usage || 0,
          quota: est.quota || 0
        };
      }
      
      return {
        indexedDBAvailable: true,
        schemaVersion: db.version,
        accountsCount,
        transactionsCount,
        categoriesCount,
        budgetsCount,
        rulesCount,
        merchantsCount,
        importsCount,
        storageUsage: storageEstimate.usage,
        storageQuota: storageEstimate.quota,
        lastImport: 'N/A' 
      };
    } catch (e) {
      return {
        indexedDBAvailable: false,
        schemaVersion: 0,
        accountsCount: 0,
        transactionsCount: 0,
        categoriesCount: 0,
        budgetsCount: 0,
        rulesCount: 0,
        merchantsCount: 0,
        importsCount: 0,
        storageUsage: 0,
        storageQuota: 0,
        lastImport: 'N/A'
      };
    }
  },

  async exportData(settings?: UserSettings) {
    const db = await initDB();
    const data = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      settings: settings || {},
      accounts: await db.getAll('accounts'),
      transactions: await db.getAll('transactions'),
      categories: await db.getAll('categories'),
      category_groups: await db.getAll('category_groups'),
      budgets: await db.getAll('budgets'),
      rules: await db.getAll('rules'),
      merchants: await db.getAll('merchants'),
      transfer_matches: await db.getAll('transfer_matches'),
      imports: await db.getAll('imports'),
      recurring_overrides: await db.getAll('recurring_overrides'),
      balance_snapshots: await db.getAll('balance_snapshots'),
      investment_transactions: await db.getAll('investment_transactions'),
      holdings: await db.getAll('holdings'),
      price_snapshots: await db.getAll('price_snapshots'),
      account_valuations: await db.getAll('account_valuations'),
    };
    return JSON.stringify(data, null, 2);
  },

  async restoreData(jsonData: string, mode: 'replace' | 'merge' = 'replace') {
    const data = JSON.parse(jsonData);
    const db = await initDB();
    const stores = [
      'accounts', 'transactions', 'categories', 'category_groups', 'budgets', 'rules', 'merchants', 'transfer_matches', 'imports', 
      'recurring_overrides', 'balance_snapshots', 'investment_transactions', 
      'holdings', 'price_snapshots', 'account_valuations'
    ] as any;
    
    const tx = db.transaction(stores, 'readwrite');
    
    for (const store of (stores as string[])) {
      if (mode === 'replace') {
        await tx.objectStore(store as any).clear();
      }
      
      const items = data[store] || [];
      for (const item of items) {
        if (mode === 'merge') {
          // For merge, we could do more complex duplicate checking
          // but for now simple put (overwrite if ID matches)
          await tx.objectStore(store as any).put(item);
        } else {
          await tx.objectStore(store as any).put(item);
        }
      }
    }

    await tx.done;
    return data.settings as UserSettings | undefined;
  },

  async deleteImportHistory() {
    const db = await initDB();
    await db.clear('imports');
  }
};
