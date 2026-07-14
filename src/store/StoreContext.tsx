import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Account, Transaction, Category, CategoryGroup, Budget, RecurringOverride, BalanceSnapshot, InvestmentTransaction, Holding, PriceSnapshot, AccountValuation, Rule, Merchant, TransferMatch, UserProfile, UserSettings } from '../models/types';
import { dbApi, switchProfile } from '../database/db';
import { seedDemoData } from '../database/seed';
import { systemApi, DEFAULT_SETTINGS } from '../database/systemDb';

export interface TransactionFilters {
  categoryId?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  isTransfer?: boolean;
}

interface StoreState {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  categoryGroups: CategoryGroup[];
  budgets: Budget[];
  recurringOverrides: RecurringOverride[];
  balanceSnapshots: BalanceSnapshot[];
  investmentTransactions: InvestmentTransaction[];
  holdings: Holding[];
  priceSnapshots: PriceSnapshot[];
  accountValuations: AccountValuation[];
  rules: Rule[];
  merchants: Merchant[];
  transferMatches: TransferMatch[];
  
  profiles: UserProfile[];
  currentProfileId: string;
  settings: UserSettings;
  
  isLoading: boolean;
  filters: TransactionFilters;
  setFilters: (f: TransactionFilters) => void;
  clearFilters: () => void;
  refreshData: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  
  changeProfile: (id: string) => Promise<void>;
  updateSettings: (s: Partial<UserSettings>) => Promise<void>;
  createProfile: (name: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  renameProfile: (id: string, name: string) => Promise<void>;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringOverrides, setRecurringOverrides] = useState<RecurringOverride[]>([]);
  const [balanceSnapshots, setBalanceSnapshots] = useState<BalanceSnapshot[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentTransaction[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [priceSnapshots, setPriceSnapshots] = useState<PriceSnapshot[]>([]);
  const [accountValuations, setAccountValuations] = useState<AccountValuation[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [transferMatches, setTransferMatches] = useState<TransferMatch[]>([]);
  
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string>('default');
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<TransactionFilters>({});

  const clearFilters = () => setFilters({});

  const loadData = async () => {
    setIsLoading(true);
    
    const profileId = await systemApi.getCurrentProfileId();
    setCurrentProfileId(profileId);
    
    const allProfiles = await systemApi.getProfiles();
    setProfiles(allProfiles);
    
    const userSettings = await systemApi.getSettings(profileId);
    setSettings(userSettings);

    const acc = await dbApi.getAccounts();
    const tx = await dbApi.getTransactions();
    let cat = await dbApi.getCategories();
    let cg = await dbApi.getCategoryGroups();

    if (cg.length === 0) {
      const defaultGroups: CategoryGroup[] = [
        { id: 'Income', name: 'Income', order: 0 },
        { id: 'Housing', name: 'Housing', order: 1 },
        { id: 'Food', name: 'Food', order: 2 },
        { id: 'Transportation', name: 'Transportation', order: 3 },
        { id: 'Financial', name: 'Financial', order: 4 },
        { id: 'Lifestyle', name: 'Lifestyle', order: 5 }
      ];
      await dbApi.putCategoryGroups(defaultGroups);
      cg = defaultGroups;
    }

    if (cat.length === 0) {
      const defaultCategories: Category[] = [
        { id: 'cat_income_salary', name: 'Salary', groupId: 'Income', isIncome: true, isFixed: false, isArchived: false, order: 0 },
        { id: 'cat_housing_rent', name: 'Rent', groupId: 'Housing', isIncome: false, isFixed: true, isArchived: false, order: 0 },
        { id: 'cat_food_groceries', name: 'Groceries', groupId: 'Food', isIncome: false, isFixed: false, isArchived: false, order: 0 },
        { id: 'cat_food_dining', name: 'Dining', groupId: 'Food', isIncome: false, isFixed: false, isArchived: false, order: 0 },
        { id: 'cat_transport_transit', name: 'Public Transit', groupId: 'Transportation', isIncome: false, isFixed: false, isArchived: false, order: 0 },
        { id: 'cat_financial_transfer', name: 'Transfer', groupId: 'Financial', isIncome: false, isFixed: false, isArchived: false, order: 0 },
        { id: 'cat_lifestyle_shopping', name: 'Shopping', groupId: 'Lifestyle', isIncome: false, isFixed: false, isArchived: false, order: 0 },
        { id: 'cat_housing_utilities', name: 'Utilities', groupId: 'Housing', isIncome: false, isFixed: true, isArchived: false, order: 0 }
      ];
      for (const c of defaultCategories) {
        await dbApi.putCategory(c);
      }
      cat = defaultCategories;
    }

    const bg = await dbApi.getBudgets();
    const ro = await dbApi.getRecurringOverrides();
    const snaps = await dbApi.getBalanceSnapshots();
    const itx = await dbApi.getInvestmentTransactions();
    const h = await dbApi.getHoldings();
    const ps = await dbApi.getPriceSnapshots();
    const av = await dbApi.getAccountValuations();
    const rl = await dbApi.getRules();
    const m = await dbApi.getMerchants();
    const tm = await dbApi.getTransferMatches();
    
    // Sort transactions descending by date
    tx.sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
    // Sort snapshots ascending by date
    snaps.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // Sort investment transactions descending by date
    itx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // Sort price snapshots descending by date
    ps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // Sort account valuations ascending by date
    av.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // Sort rules by priority
    rl.sort((a, b) => a.priority - b.priority);

    setAccounts(acc);
    setTransactions(tx);
    setCategories(cat);
    setCategoryGroups(cg);
    setBudgets(bg);
    setRecurringOverrides(ro);
    setBalanceSnapshots(snaps);
    setInvestmentTransactions(itx);
    setHoldings(h);
    setPriceSnapshots(ps);
    setAccountValuations(av);
    setRules(rl);
    setMerchants(m);
    setTransferMatches(tm);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshData = async () => {
    await loadData();
  };

  const resetDemoData = async () => {
    await dbApi.clearAll();
    await seedDemoData();
    await loadData();
  };

  const changeProfile = async (id: string) => {
    await systemApi.setCurrentProfileId(id);
    await switchProfile(id);
    await loadData();
  };

  const updateSettings = async (s: Partial<UserSettings>) => {
    const newSettings = { ...settings, ...s };
    setSettings(newSettings);
    await systemApi.putSettings(currentProfileId, newSettings);
  };

  const createProfile = async (name: string) => {
    const newProfile: UserProfile = {
      id: `p_${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString()
    };
    await systemApi.putProfile(newProfile);
    await changeProfile(newProfile.id);
  };

  const deleteProfile = async (id: string) => {
    if (id === 'default') return; // Cannot delete default profile
    await systemApi.deleteProfile(id);
    if (currentProfileId === id) {
      await changeProfile('default');
    } else {
      const allProfiles = await systemApi.getProfiles();
      setProfiles(allProfiles);
    }
  };

  const renameProfile = async (id: string, name: string) => {
    const profile = profiles.find(p => p.id === id);
    if (profile) {
      const updated = { ...profile, name };
      await systemApi.putProfile(updated);
      setProfiles(profiles.map(p => p.id === id ? updated : p));
    }
  };

  return (
    <StoreContext.Provider value={{ 
      accounts, transactions, categories, categoryGroups, budgets, recurringOverrides, balanceSnapshots, 
      investmentTransactions, holdings, priceSnapshots, accountValuations,
      rules, merchants, transferMatches,
      profiles, currentProfileId, settings,
      isLoading, filters, setFilters, clearFilters, refreshData, resetDemoData,
      changeProfile, updateSettings, createProfile, deleteProfile, renameProfile
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
