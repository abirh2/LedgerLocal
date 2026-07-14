import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency, cn, exportToCsv } from '../lib/utils';
import { PageHeader } from '../components/layout/PageHeader';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie, AreaChart as ReAreaChart
} from 'recharts';
import { format, subMonths, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isAfter, isBefore, formatISO } from 'date-fns';
import { Filter, X, Download, Plus, Trash2, Edit2, Upload, History, Save } from 'lucide-react';
import { Transaction, Account, Category, BalanceSnapshot } from '../models/types';
import { dbApi } from '../database/db';

// Extract helpers
const getSpendingByMonth = (txs: Transaction[], categories: Category[]) => {
  const map: Record<string, number> = {};
  txs.forEach(tx => {
    if (tx.isTransfer) return;
    const cat = categories.find(c => c.id === tx.categoryId);
    if (cat?.groupId.toLowerCase() === 'income') return;
    
    const month = tx.postedDate.substring(0, 7);
    if (!map[month]) map[month] = 0;
    map[month] -= tx.amountCents; // Subtract makes expenses (+) and refunds (-)
  });
  return Object.keys(map).sort().map(k => ({ month: k, amount: map[k] })).filter(m => m.amount > 0);
};

const getCategorySpending = (txs: Transaction[], categories: Category[]) => {
  const map: Record<string, number> = {};
  txs.forEach(tx => {
    if (tx.isTransfer) return;
    const cat = categories.find(c => c.id === tx.categoryId);
    if (cat?.groupId.toLowerCase() === 'income') return;
    
    const catId = tx.categoryId || 'uncategorized';
    if (!map[catId]) map[catId] = 0;
    map[catId] -= tx.amountCents;
  });
  return Object.keys(map).map(catId => {
    const cat = categories.find(c => c.id === catId);
    return { name: cat ? cat.name : 'Uncategorized', amount: map[catId], id: catId };
  }).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
};

interface ReportsPageProps {
  onNavigate: (view: string) => void;
}

type ReportTab = 'spending' | 'income' | 'cashflow' | 'category' | 'merchant' | 'monthly' | 'fixed' | 'account' | 'networth' | 'savings';

const SpendingOverviewTab = ({ txs, categories, onNavigate, filters }: { txs: Transaction[], categories: Category[], onNavigate: (view: string) => void, filters: any }) => {
  const { setFilters } = useStore();
  const categoryData = useMemo(() => getCategorySpending(txs, categories), [txs, categories]);
  const monthlyData = useMemo(() => getSpendingByMonth(txs, categories), [txs, categories]);
  
  const totalSpending = categoryData.reduce((sum, cat) => sum + cat.amount, 0);
  const avgMonthly = monthlyData.length > 0 ? totalSpending / monthlyData.length : 0;
  
  let highestMonth = { month: '', amount: 0 };
  monthlyData.forEach(d => {
    if (d.amount > highestMonth.amount) highestMonth = d;
  });

  const largestCategory = categoryData[0] || { name: 'None', amount: 0 };

  const merchantData = useMemo(() => {
    const map: Record<string, number> = {};
    txs.forEach(tx => {
      const cat = categories.find(c => c.id === tx.categoryId);
      if (cat?.groupId.toLowerCase() === 'income') return;
      
      const name = tx.merchantName || 'Unknown';
      if (!map[name]) map[name] = 0;
      map[name] -= tx.amountCents;
    });
    return Object.keys(map).map(name => ({ name, amount: map[name] })).filter(m => m.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [txs, categories]);
  
  const largestMerchant = merchantData[0] || { name: 'None', amount: 0 };

  const recentLarge = useMemo(() => {
    return [...txs]
      .filter(tx => {
        const cat = categories.find(c => c.id === tx.categoryId);
        return cat?.groupId.toLowerCase() !== 'income' && tx.amountCents < -10000;
      })
      .sort((a, b) => b.postedDate > a.postedDate ? 1 : -1)
      .slice(0, 5);
  }, [txs, categories]);

  if (totalSpending === 0) {
    return <div className="text-center py-12 text-on-surface-variant">No spending data in selected range.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-raised p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Total Spending</div>
          <div className="text-2xl font-bold font-tabular text-on-surface">{formatCurrency(totalSpending)}</div>
        </div>
        <div className="card-raised p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Avg Monthly</div>
          <div className="text-2xl font-bold font-tabular text-on-surface">{formatCurrency(avgMonthly)}</div>
        </div>
        <div className="card-raised p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Largest Category</div>
          <div className="text-lg font-bold text-on-surface truncate">{largestCategory.name}</div>
          <div className="text-sm font-medium font-tabular text-on-surface-variant">{formatCurrency(largestCategory.amount)}</div>
        </div>
        <div className="card-raised p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Largest Merchant</div>
          <div className="text-lg font-bold text-on-surface truncate">{largestMerchant.name}</div>
          <div className="text-sm font-medium font-tabular text-on-surface-variant">{formatCurrency(largestMerchant.amount)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-raised p-5 flex flex-col min-h-[300px]">
          <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4">Monthly Spending</h3>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="month" tickFormatter={(val) => {
                  try { return format(parseISO(val + '-01'), 'MMM yy'); } catch { return val; }
                }} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => `$${val/100}`} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <RechartsTooltip formatter={(val: number) => formatCurrency(val)} labelFormatter={(val) => {
                  try { return format(parseISO(val + '-01'), 'MMMM yyyy'); } catch { return val; }
                }} />
                <Bar dataKey="amount" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-raised p-5 flex flex-col min-h-[300px]">
          <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4">Top Categories</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {categoryData.slice(0, 10).map((cat, i) => (
              <div key={cat.id} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-on-surface truncate mr-2">{cat.name}</span>
                  <span className="font-tabular font-bold text-on-surface shrink-0">{formatCurrency(cat.amount)}</span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(cat.amount / largestCategory.amount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-raised p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4">Recent Large Transactions</h3>
        <div className="divide-y divide-surface-container-low">
          {recentLarge.map(tx => (
            <div 
              key={tx.id} 
              className="py-2 flex justify-between items-center cursor-pointer hover:bg-surface-container-low px-2 rounded -mx-2 transition-colors"
              onClick={() => {
                setFilters({ ...filters, search: tx.merchantName });
                onNavigate('transactions');
              }}
            >
              <div>
                <div className="font-bold text-sm text-on-surface">{tx.merchantName}</div>
                <div className="text-xs text-on-surface-variant">{tx.postedDate} • {categories.find(c => c.id === tx.categoryId)?.name || 'Uncategorized'}</div>
              </div>
              <div className="font-tabular font-bold text-on-surface">
                {formatCurrency(Math.abs(tx.amountCents))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CashFlowTab = ({ txs, categories }: { txs: Transaction[], categories: Category[] }) => {
  const [inflows, setInflows] = useState(0);
  const [operatingOutflows, setOperatingOutflows] = useState(0);
  const [investments, setInvestments] = useState(0);
  const [debtPayments, setDebtPayments] = useState(0);
  
  useEffect(() => {
    let inflowsAcc = 0;
    let operatingAcc = 0;
    let investmentsAcc = 0;
    let debtAcc = 0;

    txs.forEach(tx => {
      // Ignore transfers if already filtered, but just in case:
      if (tx.isTransfer) return;

      const cat = categories.find(c => c.id === tx.categoryId);
      const group = (cat?.groupId || '').toLowerCase();

      if (tx.amountCents > 0) {
        inflowsAcc += tx.amountCents;
      } else {
        const amt = Math.abs(tx.amountCents);
        if (group.includes('invest') || group.includes('saving') || group.includes('retirement')) {
          investmentsAcc += amt;
        } else if (group.includes('debt') || group.includes('loan')) {
          debtAcc += amt;
        } else {
          operatingAcc += amt;
        }
      }
    });

    setInflows(inflowsAcc);
    setOperatingOutflows(operatingAcc);
    setInvestments(investmentsAcc);
    setDebtPayments(debtAcc);
  }, [txs, categories]);

  const netRemaining = inflows - operatingOutflows - investments - debtPayments;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card-raised p-6 flex flex-col justify-between">
          <div className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-2">Operating Inflows</div>
          <div className="text-3xl font-bold font-tabular text-primary">{formatCurrency(inflows)}</div>
        </div>
        <div className="card-raised p-6 flex flex-col justify-between">
          <div className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-2">Operating Outflows</div>
          <div className="text-3xl font-bold font-tabular text-error">{formatCurrency(operatingOutflows)}</div>
        </div>
        <div className="card-raised p-6 flex flex-col justify-between">
          <div className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-2">Investment Contribs</div>
          <div className="text-3xl font-bold font-tabular text-on-surface">{formatCurrency(investments)}</div>
        </div>
        <div className="card-raised p-6 flex flex-col justify-between">
          <div className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-2">Debt Payments</div>
          <div className="text-3xl font-bold font-tabular text-on-surface">{formatCurrency(debtPayments)}</div>
        </div>
        <div className="card-raised p-6 flex flex-col justify-between bg-surface-container-high border-none shadow-sm">
          <div className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-2">Net Remaining Cash</div>
          <div className={`text-3xl font-bold font-tabular ${netRemaining >= 0 ? 'text-primary' : 'text-error'}`}>
            {formatCurrency(netRemaining)}
          </div>
        </div>
      </div>
    </div>
  );
};

const MonthlyComparisonTab = ({ txs, categories }: { txs: Transaction[], categories: Category[] }) => {
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string, income: number, expense: number, categories: Record<string, number>, maxExpense: number, maxExpenseName: string }> = {};
    
    txs.forEach(tx => {
      if (tx.isTransfer) return;
      const month = tx.postedDate.substring(0, 7);
      if (!map[month]) map[month] = { month, income: 0, expense: 0, categories: {}, maxExpense: 0, maxExpenseName: '' };
      
      if (tx.amountCents > 0) {
        map[month].income += tx.amountCents;
      } else {
        const amt = Math.abs(tx.amountCents);
        map[month].expense += amt;
        
        const catId = tx.categoryId || 'uncategorized';
        if (!map[month].categories[catId]) map[month].categories[catId] = 0;
        map[month].categories[catId] += amt;
        
        if (amt > map[month].maxExpense) {
          map[month].maxExpense = amt;
          map[month].maxExpenseName = tx.merchantName;
        }
      }
    });
    
    return Object.keys(map).sort().map(month => {
      const d = map[month];
      let maxCatAmt = 0;
      let maxCatName = 'None';
      for (const [cId, amt] of Object.entries(d.categories)) {
        if (amt > maxCatAmt) {
          maxCatAmt = amt;
          const cat = categories.find(c => c.id === cId);
          maxCatName = cat ? cat.name : 'Uncategorized';
        }
      }
      
      const net = d.income - d.expense;
      const savingsRate = d.income > 0 ? (net / d.income) * 100 : 0;
      
      return {
        month,
        income: d.income,
        expense: d.expense,
        net,
        savingsRate: Math.max(0, savingsRate),
        largestCategory: maxCatName,
        largestExpenseName: d.maxExpenseName,
        largestExpenseAmount: d.maxExpense
      };
    });
  }, [txs, categories]);

  if (monthlyData.length === 0) return <div className="text-center py-12 text-on-surface-variant">No data to compare.</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="card-raised p-5 min-h-[300px]">
        <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4">Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="month" tickFormatter={(val) => {
              try { return format(parseISO(val + '-01'), 'MMM yy'); } catch { return val; }
            }} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(val) => `$${val/100}`} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
            <Legend />
            <Line type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="expense" name="Spending" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="net" name="Net Cash Flow" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card-raised overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                <th className="p-3 font-bold">Month</th>
                <th className="p-3 font-bold text-right">Income</th>
                <th className="p-3 font-bold text-right">Spending</th>
                <th className="p-3 font-bold text-right">Net Flow</th>
                <th className="p-3 font-bold text-right">Savings Rate</th>
                <th className="p-3 font-bold">Largest Category</th>
                <th className="p-3 font-bold">Largest Expense</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {monthlyData.map(d => (
                <tr key={d.month} className="hover:bg-surface-container-lowest transition-colors">
                  <td className="p-3 font-medium text-sm text-on-surface">
                    {(() => { try { return format(parseISO(d.month + '-01'), 'MMM yyyy'); } catch { return d.month; } })()}
                  </td>
                  <td className="p-3 text-sm font-tabular font-bold text-on-surface text-right">{formatCurrency(d.income)}</td>
                  <td className="p-3 text-sm font-tabular font-bold text-on-surface text-right">{formatCurrency(d.expense)}</td>
                  <td className={`p-3 text-sm font-tabular font-bold text-right ${d.net >= 0 ? 'text-primary' : 'text-error'}`}>
                    {formatCurrency(d.net)}
                  </td>
                  <td className="p-3 text-sm font-tabular text-on-surface-variant text-right">{d.savingsRate.toFixed(1)}%</td>
                  <td className="p-3 text-sm text-on-surface-variant">{d.largestCategory}</td>
                  <td className="p-3 text-sm text-on-surface-variant">{d.largestExpenseName} ({formatCurrency(d.largestExpenseAmount)})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const FixedVariableTab = ({ txs, categories, recurringOverrides }: { txs: Transaction[], categories: Category[], recurringOverrides: any[] }) => {
  const expenseTxs = txs.filter(tx => tx.amountCents < 0 && !tx.isTransfer);

  const data = useMemo(() => {
    let fixed = 0;
    let variable = 0;
    
    // To track monthly average
    const months = new Set<string>();

    expenseTxs.forEach(tx => {
      months.add(tx.postedDate.substring(0, 7));
      const amt = Math.abs(tx.amountCents);
      
      const cat = categories.find(c => c.id === tx.categoryId);
      const group = (cat?.groupId || '').toLowerCase();
      const override = recurringOverrides.find(r => r.merchantName === tx.merchantName || r.id === tx.merchantName);

      const isFixedCategory = group.includes('housing') || group.includes('utilities') || group.includes('insurance') || group.includes('debt') || group.includes('loan');
      const isFixedOverride = override ? override.isEssential : false;

      if (isFixedCategory || isFixedOverride) {
        fixed += amt;
      } else {
        variable += amt;
      }
    });

    const monthCount = months.size || 1;
    return {
      fixed,
      variable,
      avgFixed: fixed / monthCount,
      avgVariable: variable / monthCount
    };
  }, [expenseTxs, categories, recurringOverrides]);

  const total = data.fixed + data.variable;
  const fixedPercentage = total > 0 ? (data.fixed / total) * 100 : 0;
  const variablePercentage = total > 0 ? (data.variable / total) * 100 : 0;

  if (expenseTxs.length === 0) return <div className="text-center py-12 text-on-surface-variant">No spending data.</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-raised p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-bold uppercase tracking-wide text-on-surface-variant">Fixed Costs</div>
            <div className="text-xs font-bold bg-surface-container px-2 py-1 rounded text-on-surface-variant">{fixedPercentage.toFixed(0)}%</div>
          </div>
          <div className="text-3xl font-bold font-tabular text-on-surface mb-1">{formatCurrency(data.fixed)}</div>
          <div className="text-sm font-medium text-on-surface-variant">Avg: {formatCurrency(data.avgFixed)} / mo</div>
        </div>
        <div className="card-raised p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-bold uppercase tracking-wide text-on-surface-variant">Variable Costs</div>
            <div className="text-xs font-bold bg-surface-container px-2 py-1 rounded text-on-surface-variant">{variablePercentage.toFixed(0)}%</div>
          </div>
          <div className="text-3xl font-bold font-tabular text-on-surface mb-1">{formatCurrency(data.variable)}</div>
          <div className="text-sm font-medium text-on-surface-variant">Avg: {formatCurrency(data.avgVariable)} / mo</div>
        </div>
      </div>

      <div className="card-raised p-5 min-h-[300px]">
         <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4">Composition</h3>
         <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={[{ name: 'Fixed', amount: data.fixed }, { name: 'Variable', amount: data.variable }]} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                <Cell fill="#0f172a" />
                <Cell fill="#94a3b8" />
              </Pie>
              <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
      </div>
    </div>
  );
};

const CategoryBreakdownTab = ({ txs, categories, onNavigate, filters }: { txs: Transaction[], categories: Category[], onNavigate: (view: string) => void, filters: any }) => {
  const { setFilters } = useStore();
  const categoryData = useMemo(() => {
    const map: Record<string, { count: number, amount: number, months: Set<string> }> = {};
    
    // First pass to accumulate net amounts
    txs.forEach(tx => {
      const cat = categories.find(c => c.id === tx.categoryId);
      // Skip pure income categories to focus on spending
      if (cat?.groupId.toLowerCase() === 'income') return;
      
      const catId = tx.categoryId || 'uncategorized';
      if (!map[catId]) map[catId] = { count: 0, amount: 0, months: new Set() };
      
      map[catId].count++;
      // Subtract amountCents to make expenses positive and refunds negative
      map[catId].amount -= tx.amountCents; 
      map[catId].months.add(tx.postedDate.substring(0, 7));
    });
    
    let totalSpending = 0;
    const items = Object.keys(map).map(catId => {
      const data = map[catId];
      if (data.amount <= 0) return null; // Net positive or 0 (more refunds than spending)
      
      totalSpending += data.amount;
      const cat = categories.find(c => c.id === catId);
      return {
        id: catId,
        name: cat ? cat.name : 'Uncategorized',
        group: cat ? cat.groupId : 'Other',
        amount: data.amount,
        count: data.count,
        monthsCount: data.months.size
      };
    }).filter(Boolean) as any[];

    return items.map(item => ({
      ...item,
      avgMonthly: item.monthsCount > 0 ? item.amount / item.monthsCount : 0,
      percentage: totalSpending > 0 ? (item.amount / totalSpending) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);
  }, [txs, categories]);

  const totalSpending = categoryData.reduce((sum, item) => sum + item.amount, 0);

  if (categoryData.length === 0) return <div className="text-center py-12 text-on-surface-variant">No spending data in selected range.</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="card-raised p-5 flex flex-col min-h-[350px]">
        <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4">Category Composition</h3>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryData.slice(0, 10)} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {categoryData.slice(0, 10).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={[`#0f172a`, `#334155`, `#475569`, `#64748b`, `#94a3b8`][index % 5]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="card-raised overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
              <th className="p-3 font-bold">Category</th>
              <th className="p-3 font-bold">Group</th>
              <th className="p-3 font-bold text-right">Total</th>
              <th className="p-3 font-bold text-right">%</th>
              <th className="p-3 font-bold text-right">Avg Monthly</th>
              <th className="p-3 font-bold text-right">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low">
            {categoryData.map(cat => (
              <tr 
                key={cat.id} 
                className="hover:bg-surface-container-lowest transition-colors group cursor-pointer" 
                onClick={() => {
                  setFilters({ ...filters, categoryId: cat.id });
                  onNavigate('transactions');
                }}
              >
                <td className="p-3 font-medium text-sm text-on-surface">{cat.name}</td>
                <td className="p-3 text-sm text-on-surface-variant">{cat.groupId}</td>
                <td className="p-3 text-sm font-tabular font-bold text-on-surface text-right">{formatCurrency(cat.amount)}</td>
                <td className="p-3 text-sm font-tabular text-on-surface-variant text-right">{cat.percentage.toFixed(1)}%</td>
                <td className="p-3 text-sm font-tabular text-on-surface-variant text-right">{formatCurrency(cat.avgMonthly)}</td>
                <td className="p-3 text-sm font-tabular text-on-surface-variant text-right">{cat.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MerchantBreakdownTab = ({ txs, categories, onNavigate, filters }: { txs: Transaction[], categories: Category[], onNavigate: (view: string) => void, filters: any }) => {
  const { setFilters } = useStore();
  const merchantData = useMemo(() => {
    const map: Record<string, { count: number, amount: number, lastDate: string, categoryId: string }> = {};
    txs.forEach(tx => {
      const cat = categories.find(c => c.id === tx.categoryId);
      if (cat?.groupId.toLowerCase() === 'income') return;

      const name = tx.merchantName || 'Unknown';
      if (!map[name]) map[name] = { count: 0, amount: 0, lastDate: '', categoryId: tx.categoryId || '' };
      map[name].count++;
      map[name].amount -= tx.amountCents; // expenses are negative, refunds positive. Net is positive.
      if (!map[name].lastDate || tx.postedDate > map[name].lastDate) {
        map[name].lastDate = tx.postedDate;
        map[name].categoryId = tx.categoryId || map[name].categoryId;
      }
    });
    
    return Object.keys(map).map(name => {
      const data = map[name];
      const cat = categories.find(c => c.id === data.categoryId);
      return {
        name,
        amount: data.amount,
        count: data.count,
        avgAmount: data.amount / data.count,
        lastDate: data.lastDate,
        categoryName: cat ? cat.name : 'Uncategorized'
      };
    }).filter(m => m.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [txs, categories]);

  if (merchantData.length === 0) return <div className="text-center py-12 text-on-surface-variant">No spending data in selected range.</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="card-raised overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
              <th className="p-3 font-bold">Merchant</th>
              <th className="p-3 font-bold">Category</th>
              <th className="p-3 font-bold text-right">Total</th>
              <th className="p-3 font-bold text-right">Avg Tx</th>
              <th className="p-3 font-bold text-right">Count</th>
              <th className="p-3 font-bold text-right">Last Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low">
            {merchantData.map((m, i) => (
              <tr 
                key={i} 
                className="hover:bg-surface-container-lowest transition-colors group cursor-pointer" 
                onClick={() => {
                  setFilters({ ...filters, search: m.name });
                  onNavigate('transactions');
                }}
              >
                <td className="p-3 font-medium text-sm text-on-surface">{m.name}</td>
                <td className="p-3 text-sm text-on-surface-variant">{m.categoryName}</td>
                <td className="p-3 text-sm font-tabular font-bold text-on-surface text-right">{formatCurrency(m.amount)}</td>
                <td className="p-3 text-sm font-tabular text-on-surface-variant text-right">{formatCurrency(m.avgAmount)}</td>
                <td className="p-3 text-sm font-tabular text-on-surface-variant text-right">{m.count}</td>
                <td className="p-3 text-sm font-tabular text-on-surface-variant text-right">{m.lastDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const IncomeExpensesTab = ({ txs }: { txs: Transaction[] }) => {
  const incomeTxs = txs.filter(tx => tx.amountCents > 0);
  const expenseTxs = txs.filter(tx => tx.amountCents < 0);

  const totalIncome = incomeTxs.reduce((sum, tx) => sum + tx.amountCents, 0);
  const totalExpenses = expenseTxs.reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
  const netDifference = totalIncome - totalExpenses;

  const monthlyMap: Record<string, { month: string, income: number, expense: number }> = {};
  txs.forEach(tx => {
    const month = tx.postedDate.substring(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { month, income: 0, expense: 0 };
    if (tx.amountCents > 0) {
      monthlyMap[month].income += tx.amountCents;
    } else {
      monthlyMap[month].expense += Math.abs(tx.amountCents);
    }
  });

  const monthlyData = Object.keys(monthlyMap).sort().map(k => monthlyMap[k]);
  
  const avgIncome = monthlyData.length > 0 ? totalIncome / monthlyData.length : 0;
  const avgExpense = monthlyData.length > 0 ? totalExpenses / monthlyData.length : 0;

  if (txs.length === 0) {
    return <div className="text-center py-12 text-on-surface-variant">No data in selected range.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card-raised p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Total Income</div>
          <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="card-raised p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Total Expenses</div>
          <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(totalExpenses)}</div>
        </div>
        <div className="card-raised p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Net Difference</div>
          <div className={`text-xl font-bold font-tabular ${netDifference >= 0 ? 'text-primary' : 'text-error'}`}>
            {formatCurrency(netDifference)}
          </div>
        </div>
        <div className="card-raised p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Avg Monthly Income</div>
          <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(avgIncome)}</div>
        </div>
        <div className="card-raised p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Avg Monthly Expenses</div>
          <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(avgExpense)}</div>
        </div>
      </div>

      <div className="card-raised p-5 flex flex-col min-h-[400px]">
        <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4">Monthly Income vs Expenses</h3>
        <div className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="month" tickFormatter={(val) => {
                try { return format(parseISO(val + '-01'), 'MMM yy'); } catch { return val; }
              }} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(val) => `$${val/100}`} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <RechartsTooltip formatter={(val: number) => formatCurrency(val)} labelFormatter={(val) => {
                try { return format(parseISO(val + '-01'), 'MMMM yyyy'); } catch { return val; }
              }} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const AccountActivityTab = ({ txs, accounts, onNavigate, filters }: { txs: Transaction[], accounts: Account[], onNavigate: (view: string) => void, filters: any }) => {
  const { setFilters } = useStore();
  const accountData = useMemo(() => {
    return accounts.map(acc => {
      const accTxs = txs.filter(tx => tx.accountId === acc.id);
      let inflows = 0;
      let outflows = 0;
      let transfers = 0;
      let fees = 0;

      accTxs.forEach(tx => {
        if (tx.isTransfer) {
          transfers += Math.abs(tx.amountCents);
        } else if (tx.amountCents > 0) {
          inflows += tx.amountCents;
        } else {
          outflows += Math.abs(tx.amountCents);
          if (tx.originalDescription.toLowerCase().includes('fee')) {
            fees += Math.abs(tx.amountCents);
          }
        }
      });

      return {
        ...acc,
        inflows,
        outflows,
        transfers,
        fees,
        txCount: accTxs.length
      };
    });
  }, [txs, accounts]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="card-raised overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
              <th className="p-3 font-bold">Account</th>
              <th className="p-3 font-bold">Type</th>
              <th className="p-3 font-bold text-right">Inflows</th>
              <th className="p-3 font-bold text-right">Outflows</th>
              <th className="p-3 font-bold text-right">Transfers</th>
              <th className="p-3 font-bold text-right">Fees</th>
              <th className="p-3 font-bold text-right">Tx Count</th>
              <th className="p-3 font-bold text-right">Last Import</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low">
            {accountData.map(acc => (
              <tr 
                key={acc.id} 
                className="hover:bg-surface-container-lowest transition-colors group cursor-pointer" 
                onClick={() => {
                  setFilters({ ...filters, accountId: acc.id });
                  onNavigate('transactions');
                }}
              >
                <td className="p-3 font-medium text-sm text-on-surface">{acc.name}</td>
                <td className="p-3 text-sm text-on-surface-variant">{acc.type}</td>
                <td className="p-3 text-sm font-tabular font-bold text-primary text-right">{formatCurrency(acc.inflows)}</td>
                <td className="p-3 text-sm font-tabular font-bold text-error text-right">{formatCurrency(acc.outflows)}</td>
                <td className="p-3 text-sm font-tabular text-on-surface-variant text-right">{formatCurrency(acc.transfers)}</td>
                <td className="p-3 text-sm font-tabular text-on-surface-variant text-right">{formatCurrency(acc.fees)}</td>
                <td className="p-3 text-sm font-tabular text-on-surface-variant text-right">{acc.txCount}</td>
                <td className="p-3 text-sm font-tabular text-on-surface-variant text-right">{acc.lastImportedDate || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const NetWorthTab = ({ accounts, balanceSnapshots }: { accounts: Account[], balanceSnapshots: BalanceSnapshot[] }) => {
  const { refreshData } = useStore();
  const [showManager, setShowManager] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<BalanceSnapshot | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    accountId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    balanceCents: 0,
    note: ''
  });

  const handleAddSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId || !formData.date) return;

    const snapshot: BalanceSnapshot = {
      id: editingSnapshot?.id || `snap_${Date.now()}`,
      accountId: formData.accountId,
      date: formData.date,
      balanceCents: formData.balanceCents,
      note: formData.note,
      createdAt: editingSnapshot?.createdAt || new Date().toISOString()
    };

    await dbApi.putBalanceSnapshot(snapshot);
    await refreshData();
    resetForm();
  };

  const resetForm = () => {
    setEditingSnapshot(null);
    setFormData({
      accountId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      balanceCents: 0,
      note: ''
    });
  };

  const startEdit = (snap: BalanceSnapshot) => {
    setEditingSnapshot(snap);
    setFormData({
      accountId: snap.accountId,
      date: snap.date,
      balanceCents: snap.balanceCents,
      note: snap.note || ''
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this snapshot?')) return;
    await dbApi.deleteBalanceSnapshot(id);
    await refreshData();
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const snapshots: BalanceSnapshot[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const entry: any = {};
        header.forEach((h, idx) => { entry[h] = values[idx]; });
        
        // Expected columns: date, account_name, balance
        // We need to find the accountId by name
        const acc = accounts.find(a => a.name.toLowerCase() === entry.account?.toLowerCase() || a.name.toLowerCase() === entry.account_name?.toLowerCase());
        if (!acc || !entry.date || !entry.balance) continue;

        snapshots.push({
          id: `snap_import_${Date.now()}_${i}`,
          accountId: acc.id,
          date: entry.date,
          balanceCents: Math.round(parseFloat(entry.balance) * 100),
          note: entry.note || 'Imported from CSV',
          createdAt: new Date().toISOString()
        });
      }

      if (snapshots.length > 0) {
        await dbApi.putBalanceSnapshots(snapshots);
        await refreshData();
        alert(`Imported ${snapshots.length} snapshots.`);
      }
    };
    reader.readAsText(file);
  };

  // Current Breakdown
  const nwAccounts = accounts.filter(a => a.includeInNetWorth);
  
  let currentAssets = 0;
  let currentLiabilities = 0;

  const assetsList: Account[] = [];
  const liabilitiesList: Account[] = [];

  nwAccounts.forEach(acc => {
    if (acc.balanceCents >= 0 || acc.type !== 'Credit Card') {
      if (acc.balanceCents < 0 && acc.type === 'Credit Card') {
        currentLiabilities += Math.abs(acc.balanceCents);
        liabilitiesList.push(acc);
      } else if (acc.balanceCents < 0) {
         currentLiabilities += Math.abs(acc.balanceCents);
         liabilitiesList.push(acc);
      } else {
        currentAssets += acc.balanceCents;
        assetsList.push(acc);
      }
    } else {
       currentLiabilities += Math.abs(acc.balanceCents);
       liabilitiesList.push(acc);
    }
  });

  const currentNetWorth = currentAssets - currentLiabilities;

  // History Chart
  const historyData = useMemo(() => {
    if (!balanceSnapshots || balanceSnapshots.length === 0) return [];

    // Get unique dates
    const dates = Array.from(new Set(balanceSnapshots.map(s => s.date))).sort();
    
    const data = [];
    const latestBalances: Record<string, number> = {};

    for (const date of dates) {
      // Update latest balances for this date
      const snapsOnDate = balanceSnapshots.filter(s => s.date === date);
      snapsOnDate.forEach(s => {
        latestBalances[s.accountId] = s.balanceCents;
      });

      // Calculate total for this date using included accounts only
      let ast = 0;
      let lia = 0;
      
      nwAccounts.forEach(acc => {
        const bal = latestBalances[acc.id] !== undefined ? latestBalances[acc.id] : 0;
        if (bal < 0) {
          lia += Math.abs(bal);
        } else {
          ast += bal;
        }
      });

      data.push({
        date,
        assets: ast,
        liabilities: lia,
        netWorth: ast - lia
      });
    }

    return data;
  }, [balanceSnapshots, nwAccounts]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-on-surface">Net Worth Report</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowManager(!showManager)}
            className={cn(
              "btn-secondary flex items-center gap-2 py-1.5 px-3 text-sm",
              showManager ? "bg-surface-container-high" : ""
            )}
          >
            {showManager ? <History size={16} /> : <Edit2 size={16} />}
            {showManager ? 'Show Dashboard' : 'Manage Snapshots'}
          </button>
        </div>
      </div>

      {!showManager ? (
        <>
          <div className="card-raised p-6 text-center">
             <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-2">Current Net Worth</h3>
             <div className={`text-5xl font-bold font-tabular mb-6 ${currentNetWorth >= 0 ? 'text-primary' : 'text-error'}`}>
               {formatCurrency(currentNetWorth)}
             </div>
             <div className="flex justify-center gap-12">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Assets</div>
                  <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(currentAssets)}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Liabilities</div>
                  <div className="text-xl font-bold font-tabular text-error">{formatCurrency(currentLiabilities)}</div>
                </div>
             </div>
          </div>

          {historyData.length > 0 ? (
            <div className="card-raised p-5 min-h-[300px]">
              <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4">History</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={(val) => {
                    try { return format(parseISO(val), 'MMM d, yy'); } catch { return val; }
                  }} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(val) => `$${val/100}`} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                  <Legend />
                  <Area type="stepAfter" dataKey="assets" name="Assets" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                  <Area type="stepAfter" dataKey="liabilities" name="Liabilities" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} />
                  <Area type="stepAfter" dataKey="netWorth" name="Net Worth" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-surface-container p-4 rounded-lg text-sm text-on-surface-variant text-center">
              No balance snapshots available for historical chart.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-raised p-6">
              <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4 border-b border-surface-container-low pb-2">Assets</h3>
              <div className="space-y-3">
                {assetsList.sort((a,b) => b.balanceCents - a.balanceCents).map(acc => (
                  <div key={acc.id} className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-on-surface">{acc.name}</div>
                      <div className="text-xs text-on-surface-variant">{acc.type}</div>
                    </div>
                    <div className="font-tabular font-bold text-on-surface">
                      {formatCurrency(acc.balanceCents)}
                    </div>
                  </div>
                ))}
                {assetsList.length === 0 && <div className="text-sm text-on-surface-variant">No asset accounts.</div>}
              </div>
            </div>

            <div className="card-raised p-6">
              <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4 border-b border-surface-container-low pb-2">Liabilities</h3>
              <div className="space-y-3">
                {liabilitiesList.sort((a,b) => a.balanceCents - b.balanceCents).map(acc => (
                  <div key={acc.id} className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-on-surface">{acc.name}</div>
                      <div className="text-xs text-on-surface-variant">{acc.type}</div>
                    </div>
                    <div className="font-tabular font-bold text-error">
                      {formatCurrency(Math.abs(acc.balanceCents))}
                    </div>
                  </div>
                ))}
                {liabilitiesList.length === 0 && <div className="text-sm text-on-surface-variant">No liability accounts.</div>}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="card-raised p-6">
              <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4">
                {editingSnapshot ? 'Edit Snapshot' : 'Add Manual Snapshot'}
              </h3>
              <form onSubmit={handleAddSnapshot} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Account</label>
                  <select 
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-sm"
                    value={formData.accountId}
                    onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                    required
                  >
                    <option value="">Select Account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Date</label>
                  <input 
                    type="date"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-sm"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Balance (Cents)</label>
                  <input 
                    type="number"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-sm"
                    value={formData.balanceCents}
                    onChange={e => setFormData({ ...formData, balanceCents: parseInt(e.target.value) || 0 })}
                    required
                  />
                  <div className="text-[10px] text-on-surface-variant mt-1">Example: 10000 = $100.00</div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Note (Optional)</label>
                  <input 
                    type="text"
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 text-sm"
                    value={formData.note}
                    onChange={e => setFormData({ ...formData, note: e.target.value })}
                    placeholder="e.g., Month-end statement"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 btn-primary py-2 text-sm font-bold flex items-center justify-center gap-2">
                    {editingSnapshot ? <Save size={16} /> : <Plus size={16} />}
                    {editingSnapshot ? 'Update' : 'Add Snapshot'}
                  </button>
                  {editingSnapshot && (
                    <button type="button" onClick={resetForm} className="btn-secondary px-4 py-2 text-sm font-bold">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="card-raised p-6">
              <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-4">Bulk Actions</h3>
              <div className="space-y-3">
                <label className="btn-secondary w-full py-2 flex items-center justify-center gap-2 cursor-pointer text-sm">
                  <Upload size={16} />
                  Import CSV
                  <input type="file" className="hidden" accept=".csv" onChange={handleImportCsv} />
                </label>
                <div className="text-[10px] text-on-surface-variant text-center px-2">
                  CSV should have columns: Date, Account, Balance
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card-raised overflow-hidden">
              <div className="p-4 border-b border-surface-container-low flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant">Snapshot History</h3>
                <span className="text-xs text-on-surface-variant">{balanceSnapshots.length} total</span>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low sticky top-0 z-10 shadow-sm">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      <th className="p-3">Date</th>
                      <th className="p-3">Account</th>
                      <th className="p-3 text-right">Balance</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    {[...balanceSnapshots].sort((a,b) => b.date.localeCompare(a.date)).map(snap => {
                      const acc = accounts.find(a => a.id === snap.accountId);
                      return (
                        <tr key={snap.id} className="hover:bg-surface-container-lowest transition-colors group">
                          <td className="p-3 text-sm text-on-surface font-tabular">{snap.date}</td>
                          <td className="p-3">
                            <div className="text-sm font-medium text-on-surface">{acc?.name || 'Unknown'}</div>
                            {snap.note && <div className="text-[10px] text-on-surface-variant truncate max-w-[150px]">{snap.note}</div>}
                          </td>
                          <td className={cn(
                            "p-3 text-sm font-bold font-tabular text-right",
                            snap.balanceCents >= 0 ? "text-primary" : "text-error"
                          )}>
                            {formatCurrency(snap.balanceCents)}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEdit(snap)} className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDelete(snap.id)} className="p-1.5 rounded hover:bg-error-container hover:text-error text-on-surface-variant">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {balanceSnapshots.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-on-surface-variant italic">No snapshots yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SavingsRateTab = ({ txs, categories }: { txs: Transaction[], categories: Category[] }) => {
  const data = useMemo(() => {
    let income = 0;
    let operatingExpenses = 0;

    txs.forEach(tx => {
      if (tx.isTransfer) return;

      const cat = categories.find(c => c.id === tx.categoryId);
      const group = (cat?.groupId || '').toLowerCase();

      // Exclude investment account internal movements (heuristic)
      if (group.includes('investment') && tx.isTransfer) return;

      if (tx.amountCents > 0) {
        income += tx.amountCents;
      } else {
        const amt = Math.abs(tx.amountCents);
        if (!group.includes('invest') && !group.includes('saving') && !group.includes('retirement') && !group.includes('debt') && !group.includes('loan')) {
          operatingExpenses += amt;
        }
      }
    });

    const netOperating = income - operatingExpenses;
    const rate = income > 0 ? (netOperating / income) * 100 : 0;

    return { income, operatingExpenses, netOperating, rate: Math.max(0, rate) };
  }, [txs, categories]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl mx-auto mt-8">
      <div className="card-raised p-8 text-center">
        <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant mb-6">Savings Rate</h3>
        <div className="text-7xl font-bold font-tabular text-primary mb-8">{data.rate.toFixed(1)}%</div>
        
        <div className="grid grid-cols-3 gap-4 border-t border-surface-container-low pt-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Total Income</div>
            <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(data.income)}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Operating Exp</div>
            <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(data.operatingExpenses)}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">Net Operating</div>
            <div className="text-xl font-bold font-tabular text-on-surface">{formatCurrency(data.netOperating)}</div>
          </div>
        </div>
      </div>
      
      <div className="bg-surface-container p-4 rounded-lg text-sm text-on-surface-variant flex items-start gap-3">
        <div className="font-bold shrink-0 mt-0.5">Formula:</div>
        <div>
          <p className="mb-2"><strong>(Net Operating Cash Flow) / (Total Income)</strong></p>
          <p>This calculates how much of your income is retained after standard living expenses. It strictly excludes transfers, credit card payments, debt payoff, and investment contributions to give a true picture of operational efficiency.</p>
        </div>
      </div>
    </div>
  );
};

export function ReportsPage({ onNavigate }: ReportsPageProps) {
  const { transactions, accounts, categories, budgets, balanceSnapshots, recurringOverrides } = useStore();
  
  const [activeTab, setActiveTab] = useState<ReportTab>('spending');
  
  // Global Filters
  const [dateRange, setDateRange] = useState<'this-month' | 'last-month' | 'last-3' | 'last-6' | 'ytd' | 'last-year' | 'all'>('this-month');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [includeTransfers, setIncludeTransfers] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);

  // Compute actual dates for the range
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    let start = new Date(0);
    let end = today;

    if (dateRange === 'this-month') {
      start = startOfMonth(today);
      end = endOfMonth(today);
    } else if (dateRange === 'last-month') {
      start = startOfMonth(subMonths(today, 1));
      end = endOfMonth(subMonths(today, 1));
    } else if (dateRange === 'last-3') {
      start = startOfMonth(subMonths(today, 2));
      end = endOfMonth(today);
    } else if (dateRange === 'last-6') {
      start = startOfMonth(subMonths(today, 5));
      end = endOfMonth(today);
    } else if (dateRange === 'ytd') {
      start = startOfYear(today);
      end = endOfMonth(today);
    } else if (dateRange === 'last-year') {
      start = startOfYear(subYears(today, 1));
      end = endOfYear(subYears(today, 1));
    }

    return { startDate: start, endDate: end };
  }, [dateRange]);

  // Filtered transactions
  const filteredTxs = useMemo(() => {
    return transactions.filter(tx => {
      if (!includeHidden && tx.excludedFromReports) return false;
      if (!includeTransfers && tx.isTransfer) return false;
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId) return false;
      if (selectedCategoryId !== 'all' && tx.categoryId !== selectedCategoryId) return false;
      
      if (dateRange !== 'all') {
        const d = parseISO(tx.postedDate);
        if (isBefore(d, startDate) || isAfter(d, endDate)) return false;
      }
      
      return true;
    });
  }, [transactions, includeHidden, includeTransfers, selectedAccountId, selectedCategoryId, dateRange, startDate, endDate]);

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'spending', label: 'Spending' },
    { id: 'income', label: 'Income vs Exp' },
    { id: 'cashflow', label: 'Cash Flow' },
    { id: 'category', label: 'Categories' },
    { id: 'merchant', label: 'Merchants' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'fixed', label: 'Fixed vs Var' },
    { id: 'account', label: 'Account Act.' },
    { id: 'networth', label: 'Net Worth' },
    { id: 'savings', label: 'Savings Rate' },
  ];

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <PageHeader title="Reports" onImportClick={() => onNavigate('imports')} />
        <button
          onClick={() => {
            if (activeTab === 'networth') {
               const data = balanceSnapshots.map(s => {
                 const acc = accounts.find(a => a.id === s.accountId);
                 return {
                   Date: s.date,
                   Account: acc?.name || 'Unknown',
                   Type: acc?.type || 'Unknown',
                   Balance: s.balanceCents / 100
                 };
               });
               exportToCsv(`net_worth_snapshots.csv`, data);
            } else {
              const data = filteredTxs.map(tx => {
                const cat = categories.find(c => c.id === tx.categoryId);
                const acc = accounts.find(a => a.id === tx.accountId);
                return {
                  Date: tx.postedDate,
                  Account: acc?.name || 'Unknown',
                  Description: tx.merchantName || tx.originalDescription,
                  Category: cat?.name || 'Uncategorized',
                  Group: cat?.groupId || '',
                  Amount: tx.amountCents / 100,
                  Type: tx.amountCents >= 0 ? 'Credit' : 'Debit'
                };
              });
              exportToCsv(`export_${dateRange}.csv`, data);
            }
          }}
          className="btn-secondary py-1.5 px-3 mb-2 flex items-center gap-2 text-sm"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        {/* Sidebar/Tabs Navigation */}
        <div className="w-48 shrink-0 flex flex-col gap-1 overflow-y-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                activeTab === tab.id 
                  ? "bg-primary text-on-primary shadow-sm" 
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-surface-bright rounded-2xl border border-outline-variant shadow-sm">
          {/* Filters Bar */}
          <div className="p-4 border-b border-surface-variant bg-surface flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-on-surface-variant" />
              <span className="text-sm font-bold text-on-surface-variant">Filters:</span>
            </div>
            
            <select 
              className="bg-surface-container-low border border-outline-variant rounded-md px-2 py-1 text-sm outline-none"
              value={dateRange}
              onChange={e => setDateRange(e.target.value as any)}
            >
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="last-3">Last 3 Months</option>
              <option value="last-6">Last 6 Months</option>
              <option value="ytd">Year to Date</option>
              <option value="last-year">Last Year</option>
              <option value="all">All Time</option>
            </select>

            <select 
              className="bg-surface-container-low border border-outline-variant rounded-md px-2 py-1 text-sm outline-none"
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
            >
              <option value="all">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>

            <select 
              className="bg-surface-container-low border border-outline-variant rounded-md px-2 py-1 text-sm outline-none"
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm font-medium text-on-surface-variant cursor-pointer ml-auto">
              <input type="checkbox" checked={includeTransfers} onChange={e => setIncludeTransfers(e.target.checked)} className="rounded border-outline-variant text-primary" />
              Transfers
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-on-surface-variant cursor-pointer">
              <input type="checkbox" checked={includeHidden} onChange={e => setIncludeHidden(e.target.checked)} className="rounded border-outline-variant text-primary" />
              Hidden
            </label>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'spending' && (
              <SpendingOverviewTab txs={filteredTxs} categories={categories} onNavigate={onNavigate} filters={{ startDate: formatISO(startDate, { representation: 'date' }), endDate: formatISO(endDate, { representation: 'date' }) }} />
            )}
            {activeTab === 'income' && (
              <IncomeExpensesTab txs={filteredTxs} />
            )}
            {activeTab === 'cashflow' && (
              <CashFlowTab txs={filteredTxs} categories={categories} />
            )}
            {activeTab === 'category' && (
              <CategoryBreakdownTab txs={filteredTxs} categories={categories} onNavigate={onNavigate} filters={{ startDate: formatISO(startDate, { representation: 'date' }), endDate: formatISO(endDate, { representation: 'date' }) }} />
            )}
            {activeTab === 'merchant' && (
              <MerchantBreakdownTab txs={filteredTxs} categories={categories} onNavigate={onNavigate} filters={{ startDate: formatISO(startDate, { representation: 'date' }), endDate: formatISO(endDate, { representation: 'date' }) }} />
            )}
            {activeTab === 'monthly' && (
              <MonthlyComparisonTab txs={filteredTxs} categories={categories} />
            )}
            {activeTab === 'fixed' && (
              <FixedVariableTab txs={filteredTxs} categories={categories} recurringOverrides={recurringOverrides} />
            )}
            {activeTab === 'account' && (
              <AccountActivityTab txs={filteredTxs} accounts={accounts} onNavigate={onNavigate} filters={{ startDate: formatISO(startDate, { representation: 'date' }), endDate: formatISO(endDate, { representation: 'date' }) }} />
            )}
            {activeTab === 'networth' && (
              <NetWorthTab accounts={accounts} balanceSnapshots={balanceSnapshots} />
            )}
            {activeTab === 'savings' && (
              <SavingsRateTab txs={filteredTxs} categories={categories} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
