import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { formatCurrency, cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon, 
  Plus, Download, Upload, Filter, Search, History,
  ArrowUpRight, ArrowDownRight, Wallet, Activity,
  Briefcase, LineChart as LineChartIcon, Settings,
  AlertTriangle, MoreHorizontal, Edit2, Trash2, Save, X
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar
} from 'recharts';
import { PageHeader } from '../components/layout/PageHeader';
import { dbApi } from '../database/db';
import { 
  InvestmentTransaction, InvestmentTransactionType, 
  Holding, PriceSnapshot, AccountValuation, Account 
} from '../models/types';

export function InvestmentsPage({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { 
    accounts, investmentTransactions, holdings, 
    priceSnapshots, accountValuations, refreshData 
  } = useStore();

  const [activeTab, setActiveTab] = useState<'holdings' | 'transactions' | 'allocation' | 'performance' | 'prices'>('holdings');
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddPrice, setShowAddPrice] = useState(false);
  const [showAddValuation, setShowAddValuation] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [selectedTx, setSelectedTx] = useState<InvestmentTransaction | null>(null);

  // Form states
  const [holdingForm, setHoldingForm] = useState({ symbol: '', name: '', accountId: '', targetAllocation: '' });
  const [txForm, setTxForm] = useState({ 
    date: format(new Date(), 'yyyy-MM-dd'), 
    type: 'Buy' as InvestmentTransactionType, 
    symbol: '', 
    quantity: '', 
    price: '', 
    fees: '', 
    accountId: '', 
    notes: '' 
  });
  const [priceForm, setPriceForm] = useState({ symbol: '', date: format(new Date(), 'yyyy-MM-dd'), price: '' });
  const [valuationForm, setValuationForm] = useState({ accountId: '', date: format(new Date(), 'yyyy-MM-dd'), value: '' });

  const investmentAccounts = accounts.filter(acc => acc.type === 'Brokerage' || acc.type === 'Retirement');

  const handleAddHolding = async () => {
    if (!holdingForm.symbol || !holdingForm.accountId) return;
    const newHolding: Holding = {
      id: selectedHolding?.id || `h_${Date.now()}`,
      symbol: holdingForm.symbol.toUpperCase(),
      name: holdingForm.name || holdingForm.symbol.toUpperCase(),
      accountId: holdingForm.accountId,
      targetAllocation: parseFloat(holdingForm.targetAllocation) || 0
    };
    await dbApi.putHolding(newHolding);
    setShowAddHolding(false);
    setSelectedHolding(null);
    setHoldingForm({ symbol: '', name: '', accountId: '', targetAllocation: '' });
    refreshData();
  };

  const handleAddTx = async () => {
    if (!txForm.symbol || !txForm.accountId || !txForm.quantity) return;
    const qty = parseFloat(txForm.quantity);
    const price = parseFloat(txForm.price) * 100 || 0;
    const fees = parseFloat(txForm.fees) * 100 || 0;
    
    let amountCents = 0;
    if (txForm.type === 'Buy' || txForm.type === 'Reinvestment') {
      amountCents = (qty * price);
    } else if (txForm.type === 'Sell') {
      amountCents = (qty * price);
    } else if (txForm.type === 'Dividend' || txForm.type === 'Interest' || txForm.type === 'Deposit') {
      amountCents = parseFloat(txForm.price) * 100 || 0;
    } else if (txForm.type === 'Withdrawal' || txForm.type === 'Fee') {
      amountCents = parseFloat(txForm.price) * 100 || 0;
    }

    const newTx: InvestmentTransaction = {
      id: selectedTx?.id || `itx_${Date.now()}`,
      accountId: txForm.accountId,
      date: txForm.date,
      symbol: txForm.symbol.toUpperCase(),
      type: txForm.type,
      quantity: qty,
      price: price,
      fees: fees,
      amountCents: amountCents,
      notes: txForm.notes,
      createdAt: new Date().toISOString()
    };
    await dbApi.putInvestmentTransaction(newTx);
    setShowAddTx(false);
    setSelectedTx(null);
    refreshData();
  };

  const handleAddPrice = async () => {
    if (!priceForm.symbol || !priceForm.price) return;
    const newPrice: PriceSnapshot = {
      id: `ps_${Date.now()}`,
      symbol: priceForm.symbol.toUpperCase(),
      date: priceForm.date,
      price: parseFloat(priceForm.price) * 100,
      createdAt: new Date().toISOString()
    };
    await dbApi.putPriceSnapshot(newPrice);
    setShowAddPrice(false);
    refreshData();
  };

  const handleExportCSV = (type: 'holdings' | 'transactions') => {
    let csv = '';
    let filename = '';

    if (type === 'holdings') {
      csv = 'Symbol,Name,Account,Quantity,AvgCost,CurrentValue\n';
      calculations.holdingStats.forEach(h => {
        csv += `${h.symbol},${h.name},"${h.accounts.join('; ')}",${h.quantity},${h.avgCost / 100},${h.currentValue / 100}\n`;
      });
      filename = `holdings_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    } else {
      csv = 'Date,Type,Symbol,Quantity,Price,Fees,Total\n';
      investmentTransactions.forEach(tx => {
        csv += `${tx.date},${tx.type},${tx.symbol},${tx.quantity},${tx.price / 100},${tx.fees / 100},${tx.amountCents / 100}\n`;
      });
      filename = `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDeleteHolding = async (id: string) => {
    if (confirm('Are you sure you want to delete this holding?')) {
      await dbApi.deleteHolding(id);
      refreshData();
    }
  };

  const handleDeleteTx = async (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      await dbApi.deleteInvestmentTransaction(id);
      refreshData();
    }
  };

  const handleEditHolding = (h: Holding) => {
    setSelectedHolding(h);
    setHoldingForm({
      symbol: h.symbol,
      name: h.name,
      accountId: h.accountId,
      targetAllocation: h.targetAllocation?.toString() || '0'
    });
    setShowAddHolding(true);
  };

  const handleEditTx = (tx: InvestmentTransaction) => {
    setSelectedTx(tx);
    setTxForm({
      date: tx.date,
      type: tx.type,
      symbol: tx.symbol,
      quantity: tx.quantity.toString(),
      price: (tx.price / 100).toString(),
      fees: (tx.fees / 100).toString(),
      accountId: tx.accountId,
      notes: tx.notes || ''
    });
    setShowAddTx(true);
  };

  const handleAddValuation = async () => {
    if (!valuationForm.accountId || !valuationForm.value) return;
    const newValuation: AccountValuation = {
      id: `av_${Date.now()}`,
      accountId: valuationForm.accountId,
      date: valuationForm.date,
      valueCents: parseFloat(valuationForm.value) * 100,
      createdAt: new Date().toISOString()
    };
    await dbApi.putAccountValuation(newValuation);
    setShowAddValuation(false);
    refreshData();
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',');
      
      if (headers.includes('Type') || headers.includes('type')) {
        const newTxs: InvestmentTransaction[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          if (cols.length < 5) continue;
          
          newTxs.push({
            id: `itx_import_${Date.now()}_${i}`,
            date: cols[0],
            type: cols[1] as InvestmentTransactionType,
            symbol: cols[2].toUpperCase(),
            quantity: parseFloat(cols[3]),
            price: parseFloat(cols[4]) * 100,
            fees: parseFloat(cols[5] || '0') * 100,
            amountCents: parseFloat(cols[6] || '0') * 100,
            accountId: investmentAccounts[0]?.id || '',
            createdAt: new Date().toISOString()
          });
        }
        await dbApi.putInvestmentTransactions(newTxs);
      } else {
        const newHoldings: Holding[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          if (cols.length < 3) continue;
          
          newHoldings.push({
            id: `h_import_${Date.now()}_${i}`,
            symbol: cols[0].toUpperCase(),
            name: cols[1],
            accountId: investmentAccounts[0]?.id || '',
            targetAllocation: 0
          });
        }
        await dbApi.putHoldings(newHoldings);
      }
      refreshData();
    };
    reader.readAsText(file);
  };

  // Calculations
  const calculations = useMemo(() => {
    const symbols = Array.from(new Set(holdings.map(h => h.symbol)));
    
    const holdingStats = symbols.map(symbol => {
      const symbolTxs = investmentTransactions.filter(tx => tx.symbol === symbol);
      const symbolHoldings = holdings.filter(h => h.symbol === symbol);
      const latestPrice = priceSnapshots.find(p => p.symbol === symbol)?.price || 0;
      const latestPriceDate = priceSnapshots.find(p => p.symbol === symbol)?.date || '';

      let quantity = 0;
      let totalCostBasis = 0;
      let totalRealizedGain = 0;
      let dividends = 0;

      // Sort txs by date to calculate cost basis accurately (FIFO or Average Cost)
      const sortedTxs = [...symbolTxs].sort((a, b) => a.date.localeCompare(b.date));

      sortedTxs.forEach(tx => {
        if (tx.type === 'Buy' || tx.type === 'Reinvestment') {
          quantity += tx.quantity;
          totalCostBasis += tx.amountCents + tx.fees;
          if (tx.type === 'Reinvestment') {
            dividends += tx.amountCents;
          }
        } else if (tx.type === 'Sell') {
          const avgCostPerShare = quantity > 0 ? totalCostBasis / quantity : 0;
          const soldCostBasis = tx.quantity * avgCostPerShare;
          totalCostBasis -= soldCostBasis;
          quantity -= tx.quantity;
          totalRealizedGain += (tx.amountCents - tx.fees) - soldCostBasis;
        } else if (tx.type === 'Dividend' || tx.type === 'Interest') {
          dividends += tx.amountCents;
        } else if (tx.type === 'Split') {
          // tx.quantity is the multiplier (e.g. 2 for 2-for-1 split)
          quantity *= tx.quantity;
        }
      });

      const currentValue = quantity * latestPrice;
      const unrealizedGain = currentValue - totalCostBasis;
      const totalGain = unrealizedGain + totalRealizedGain + dividends;

      return {
        symbol,
        name: symbolHoldings[0]?.name || symbol,
        quantity,
        avgCost: quantity > 0 ? totalCostBasis / quantity : 0,
        totalCostBasis,
        currentValue,
        latestPrice,
        latestPriceDate,
        unrealizedGain,
        unrealizedGainPercent: totalCostBasis > 0 ? (unrealizedGain / totalCostBasis) * 100 : 0,
        totalRealizedGain,
        dividends,
        totalGain,
        accounts: symbolHoldings.map(h => accounts.find(acc => acc.id === h.accountId)?.name).filter(Boolean) as string[],
        targetAllocation: symbolHoldings.reduce((sum, h) => sum + (h.targetAllocation || 0), 0)
      };
    });

    const totalValue = holdingStats.reduce((sum, h) => sum + h.currentValue, 0);
    const totalCostBasis = holdingStats.reduce((sum, h) => sum + h.totalCostBasis, 0);
    const totalUnrealizedGain = totalValue - totalCostBasis;
    const totalDividends = holdingStats.reduce((sum, h) => sum + h.dividends, 0);
    
    const contributions = investmentTransactions
      .filter(tx => tx.type === 'Deposit')
      .reduce((sum, tx) => sum + tx.amountCents, 0);
    
    const withdrawals = investmentTransactions
      .filter(tx => tx.type === 'Withdrawal')
      .reduce((sum, tx) => sum + tx.amountCents, 0);

    return {
      holdingStats,
      totalValue,
      totalCostBasis,
      totalUnrealizedGain,
      totalDividends,
      contributions,
      withdrawals,
      netInvested: contributions - withdrawals
    };
  }, [investmentTransactions, holdings, priceSnapshots, accounts]);

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader title="Investments">
        <div className="flex gap-2">
          <label className="btn btn-secondary flex items-center gap-2 cursor-pointer">
            <Upload size={16} />
            Import CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>
          <button 
            onClick={() => handleExportCSV(activeTab === 'transactions' ? 'transactions' : 'holdings')}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button 
            onClick={() => setShowAddPrice(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <History size={16} />
            Update Prices
          </button>
          <button 
            onClick={() => setShowAddValuation(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Wallet size={16} />
            Add Valuation
          </button>
          <button 
            onClick={() => {
              setHoldingForm({ symbol: '', name: '', accountId: '', targetAllocation: '' });
              setSelectedHolding(null);
              setShowAddHolding(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Add Holding
          </button>
        </div>
      </PageHeader>

      {/* Modals */}
      {showAddHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">{selectedHolding ? 'Edit Holding' : 'Add New Holding'}</h3>
              <button onClick={() => setShowAddHolding(false)} className="p-2 hover:bg-surface-container rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Symbol</label>
                <input 
                  type="text" 
                  value={holdingForm.symbol}
                  onChange={e => setHoldingForm({ ...holdingForm, symbol: e.target.value })}
                  placeholder="e.g. AAPL, VTI"
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Name (Optional)</label>
                <input 
                  type="text" 
                  value={holdingForm.name}
                  onChange={e => setHoldingForm({ ...holdingForm, name: e.target.value })}
                  placeholder="e.g. Apple Inc."
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Account</label>
                <select 
                  value={holdingForm.accountId}
                  onChange={e => setHoldingForm({ ...holdingForm, accountId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select Account</option>
                  {investmentAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Target Allocation (%)</label>
                <input 
                  type="number" 
                  value={holdingForm.targetAllocation}
                  onChange={e => setHoldingForm({ ...holdingForm, targetAllocation: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddHolding(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleAddHolding} className="btn btn-primary flex-1">Save Holding</button>
            </div>
          </div>
        </div>
      )}

      {showAddTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl shadow-2xl border border-outline-variant p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">{selectedTx ? 'Edit Transaction' : 'Add Transaction'}</h3>
              <button onClick={() => setShowAddTx(false)} className="p-2 hover:bg-surface-container rounded-full"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Date</label>
                <input 
                  type="date" 
                  value={txForm.date}
                  onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Type</label>
                <select 
                  value={txForm.type}
                  onChange={e => setTxForm({ ...txForm, type: e.target.value as InvestmentTransactionType })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Buy">Buy</option>
                  <option value="Sell">Sell</option>
                  <option value="Dividend">Dividend</option>
                  <option value="Interest">Interest</option>
                  <option value="Reinvestment">Reinvestment</option>
                  <option value="Deposit">Deposit</option>
                  <option value="Withdrawal">Withdrawal</option>
                  <option value="Fee">Fee</option>
                  <option value="Split">Split</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Symbol</label>
                <input 
                  type="text" 
                  value={txForm.symbol}
                  onChange={e => setTxForm({ ...txForm, symbol: e.target.value })}
                  placeholder="e.g. VTI"
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Account</label>
                <select 
                  value={txForm.accountId}
                  onChange={e => setTxForm({ ...txForm, accountId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select Account</option>
                  {investmentAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Quantity</label>
                <input 
                  type="number" 
                  step="0.0001"
                  value={txForm.quantity}
                  onChange={e => setTxForm({ ...txForm, quantity: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Price / Amount</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={txForm.price}
                  onChange={e => setTxForm({ ...txForm, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddTx(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleAddTx} className="btn btn-primary flex-1">Save Transaction</button>
            </div>
          </div>
        </div>
      )}

      {showAddPrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Add Price Snapshot</h3>
              <button onClick={() => setShowAddPrice(false)} className="p-2 hover:bg-surface-container rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Symbol</label>
                <input 
                  type="text" 
                  value={priceForm.symbol}
                  onChange={e => setPriceForm({ ...priceForm, symbol: e.target.value })}
                  placeholder="e.g. VTI"
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Date</label>
                <input 
                  type="date" 
                  value={priceForm.date}
                  onChange={e => setPriceForm({ ...priceForm, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Price per Share ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={priceForm.price}
                  onChange={e => setPriceForm({ ...priceForm, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddPrice(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleAddPrice} className="btn btn-primary flex-1">Save Price</button>
            </div>
          </div>
        </div>
      )}

      {showAddValuation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Add Account Valuation</h3>
              <button onClick={() => setShowAddValuation(false)} className="p-2 hover:bg-surface-container rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Account</label>
                <select 
                  value={valuationForm.accountId}
                  onChange={e => setValuationForm({ ...valuationForm, accountId: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select Account</option>
                  {investmentAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Date</label>
                <input 
                  type="date" 
                  value={valuationForm.date}
                  onChange={e => setValuationForm({ ...valuationForm, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Total Account Value ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={valuationForm.value}
                  onChange={e => setValuationForm({ ...valuationForm, value: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 rounded-xl bg-surface border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAddValuation(false)} className="btn btn-secondary flex-1">Cancel</button>
              <button onClick={handleAddValuation} className="btn btn-primary flex-1">Save Valuation</button>
            </div>
          </div>
        </div>
      )}

      {/* Disclamer */}
      <div className="bg-surface-container-low px-4 py-2 rounded-lg flex items-center gap-2 text-xs text-on-surface-variant border border-outline-variant">
        <AlertTriangle size={14} className="text-primary" />
        <span>Investment values are based on data you enter or import. LedgerLocal does not provide live prices or financial advice.</span>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Total Value</span>
            <div className="bg-primary-container p-2 rounded-xl text-primary">
              <Wallet size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold font-tabular text-on-surface">{formatCurrency(calculations.totalValue)}</div>
          <div className="flex items-center gap-1 mt-1">
            <span className={cn(
              "text-xs font-bold flex items-center",
              calculations.totalUnrealizedGain >= 0 ? "text-primary" : "text-error"
            )}>
              {calculations.totalUnrealizedGain >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {formatCurrency(Math.abs(calculations.totalUnrealizedGain))}
            </span>
            <span className="text-xs text-on-surface-variant">unrealized</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Cost Basis</span>
            <div className="bg-secondary-container p-2 rounded-xl text-secondary">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold font-tabular text-on-surface">{formatCurrency(calculations.totalCostBasis)}</div>
          <div className="text-xs text-on-surface-variant mt-1">Total invested capital</div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Dividends</span>
            <div className="bg-tertiary-container p-2 rounded-xl text-tertiary">
              <Activity size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold font-tabular text-on-surface">{formatCurrency(calculations.totalDividends)}</div>
          <div className="text-xs text-on-surface-variant mt-1">Life-to-date income</div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Accounts</span>
            <div className="bg-surface-container-high p-2 rounded-xl text-on-surface-variant">
              <Briefcase size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold font-tabular text-on-surface">{investmentAccounts.length}</div>
          <div className="text-xs text-on-surface-variant mt-1">Investment accounts</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="flex border-b border-outline-variant">
          <button 
            onClick={() => setActiveTab('holdings')}
            className={cn(
              "px-6 py-4 text-sm font-bold transition-all relative",
              activeTab === 'holdings' ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            Holdings
            {activeTab === 'holdings' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('allocation')}
            className={cn(
              "px-6 py-4 text-sm font-bold transition-all relative",
              activeTab === 'allocation' ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            Allocation
            {activeTab === 'allocation' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('performance')}
            className={cn(
              "px-6 py-4 text-sm font-bold transition-all relative",
              activeTab === 'performance' ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            Performance
            {activeTab === 'performance' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            className={cn(
              "px-6 py-4 text-sm font-bold transition-all relative",
              activeTab === 'transactions' ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            Transactions
            {activeTab === 'transactions' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('prices')}
            className={cn(
              "px-6 py-4 text-sm font-bold transition-all relative",
              activeTab === 'prices' ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            Prices
            {activeTab === 'prices' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'holdings' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Current Holdings</h3>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search holdings..."
                      className="pl-9 pr-4 py-1.5 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Symbol</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Name</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">Quantity</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">Price</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">Avg Cost</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">Value</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">Gain/Loss</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    {calculations.holdingStats.map((h, i) => (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors group">
                        <td className="py-4">
                          <span className="font-mono font-bold text-sm bg-surface-container px-2 py-1 rounded text-primary">{h.symbol}</span>
                        </td>
                        <td className="py-4">
                          <div className="text-sm font-bold text-on-surface">{h.name}</div>
                          <div className="text-xs text-on-surface-variant">{h.accounts.join(', ')}</div>
                        </td>
                        <td className="py-4 text-right font-tabular text-sm">{h.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                        <td className="py-4 text-right font-tabular text-sm">
                          <div>{formatCurrency(h.latestPrice)}</div>
                          <div className="text-[10px] text-on-surface-variant">{h.latestPriceDate || 'No price'}</div>
                        </td>
                        <td className="py-4 text-right font-tabular text-sm">{formatCurrency(h.avgCost)}</td>
                        <td className="py-4 text-right font-tabular text-sm font-bold">{formatCurrency(h.currentValue)}</td>
                        <td className="py-4 text-right">
                          <div className={cn(
                            "text-sm font-bold font-tabular",
                            h.unrealizedGain >= 0 ? "text-primary" : "text-error"
                          )}>
                            {h.unrealizedGain >= 0 ? '+' : ''}{formatCurrency(h.unrealizedGain)}
                          </div>
                          <div className={cn(
                            "text-xs font-tabular",
                            h.unrealizedGain >= 0 ? "text-primary/70" : "text-error/70"
                          )}>
                            {h.unrealizedGain >= 0 ? '+' : ''}{h.unrealizedGainPercent.toFixed(2)}%
                          </div>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => {
                                // Find the holding by symbol. In a real app, we might have multiple holdings for same symbol in different accounts.
                                // For the overview, we'll just pick the first one matching the symbol.
                                const actualHolding = holdings.find(item => item.symbol === h.symbol);
                                if (actualHolding) handleEditHolding(actualHolding);
                              }}
                              className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-primary transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                const actualHolding = holdings.find(item => item.symbol === h.symbol);
                                if (actualHolding) handleDeleteHolding(actualHolding.id);
                              }}
                              className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-error transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {calculations.holdingStats.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                          <div className="flex flex-col items-center gap-2">
                            <Briefcase size={40} className="opacity-20" />
                            <p>No holdings found. Add a holding or import transactions to get started.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'allocation' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="text-lg font-bold">Asset Allocation</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={calculations.holdingStats}
                        dataKey="currentValue"
                        nameKey="symbol"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                      >
                        {calculations.holdingStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - index * 0.1})`} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'var(--outline-variant)', borderRadius: '12px' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-bold">Target vs Actual</h3>
                <div className="space-y-4">
                  {calculations.holdingStats.map((h, i) => {
                    const actualPercent = (h.currentValue / calculations.totalValue) * 100;
                    const diff = actualPercent - (h.targetAllocation || 0);
                    
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-sm font-bold">
                          <span>{h.symbol}</span>
                          <span>{actualPercent.toFixed(1)}% / {h.targetAllocation || 0}%</span>
                        </div>
                        <div className="h-2 bg-surface-container rounded-full overflow-hidden flex">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${actualPercent}%` }} 
                          />
                          <div 
                            className="h-full bg-outline-variant" 
                            style={{ width: `${Math.max(0, (h.targetAllocation || 0) - actualPercent)}%` }} 
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                          <span className={cn(
                            Math.abs(diff) < 2 ? "text-primary" : diff > 0 ? "text-primary" : "text-error"
                          )}>
                            {Math.abs(diff) < 2 ? 'On Target' : diff > 0 ? 'Above Target' : 'Below Target'}
                          </span>
                          <span className="text-on-surface-variant">{diff > 0 ? '+' : ''}{diff.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant">
                  <h4 className="text-xs font-bold uppercase text-on-surface-variant mb-2">Unrealized Gain/Loss</h4>
                  <div className={cn(
                    "text-2xl font-bold font-tabular",
                    calculations.totalUnrealizedGain >= 0 ? "text-primary" : "text-error"
                  )}>
                    {formatCurrency(calculations.totalUnrealizedGain)}
                  </div>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant">
                  <h4 className="text-xs font-bold uppercase text-on-surface-variant mb-2">Total Contributions</h4>
                  <div className="text-2xl font-bold font-tabular">
                    {formatCurrency(calculations.contributions)}
                  </div>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant">
                  <h4 className="text-xs font-bold uppercase text-on-surface-variant mb-2">Total Dividends</h4>
                  <div className="text-2xl font-bold font-tabular text-primary">
                    {formatCurrency(calculations.totalDividends)}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold">Portfolio Value History</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={accountValuations.sort((a,b) => a.date.localeCompare(b.date))}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" />
                      <XAxis 
                        dataKey="date" 
                        stroke="var(--on-surface-variant)" 
                        fontSize={12}
                        tickFormatter={(val) => format(parseISO(val), 'MMM d')}
                      />
                      <YAxis 
                        stroke="var(--on-surface-variant)" 
                        fontSize={12}
                        tickFormatter={(val) => `$${(val / 100000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => format(parseISO(label as string), 'MMMM d, yyyy')}
                        contentStyle={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'var(--outline-variant)', borderRadius: '12px' }}
                      />
                      <Area type="monotone" dataKey="valueCents" stroke="var(--primary)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-on-surface-variant text-center">
                  Values are based on manually entered account valuations and price snapshots.
                </p>
              </div>

              <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant overflow-hidden">
                <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low">
                  <h4 className="font-bold">Valuation History</h4>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="px-6 py-3 text-xs font-bold uppercase text-on-surface-variant">Date</th>
                      <th className="px-6 py-3 text-xs font-bold uppercase text-on-surface-variant">Account</th>
                      <th className="px-6 py-3 text-xs font-bold uppercase text-on-surface-variant text-right">Value</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    {accountValuations.sort((a,b) => b.date.localeCompare(a.date)).map(av => {
                      const acc = accounts.find(a => a.id === av.accountId);
                      return (
                        <tr key={av.id} className="text-sm hover:bg-surface-container-low transition-colors group">
                          <td className="px-6 py-3 font-tabular">{av.date}</td>
                          <td className="px-6 py-3">{acc?.name || av.accountId}</td>
                          <td className="px-6 py-3 text-right font-tabular font-bold">{formatCurrency(av.valueCents)}</td>
                          <td className="px-6 py-3 text-right">
                             <button 
                                onClick={async () => {
                                  if (confirm('Delete this valuation?')) {
                                    await dbApi.deleteAccountValuation(av.id);
                                    refreshData();
                                  }
                                }}
                                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-surface-container-high rounded text-error transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Recent Transactions</h3>
                <button 
                  onClick={() => {
                    setTxForm({ 
                      date: format(new Date(), 'yyyy-MM-dd'), 
                      type: 'Buy', 
                      symbol: '', 
                      quantity: '', 
                      price: '', 
                      fees: '', 
                      accountId: investmentAccounts[0]?.id || '', 
                      notes: '' 
                    });
                    setSelectedTx(null);
                    setShowAddTx(true);
                  }}
                  className="btn btn-secondary btn-sm flex items-center gap-2"
                >
                  <Plus size={14} />
                  Add Transaction
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Date</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Type</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Symbol</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">Quantity</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">Price</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">Fees</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">Total</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    {investmentTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-surface-container-low transition-colors group text-sm">
                        <td className="py-3 font-tabular">{tx.date}</td>
                        <td className="py-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            tx.type === 'Buy' ? "bg-primary/10 text-primary" :
                            tx.type === 'Sell' ? "bg-error/10 text-error" :
                            tx.type === 'Dividend' ? "bg-tertiary/10 text-tertiary" :
                            "bg-surface-container text-on-surface-variant"
                          )}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3 font-mono font-bold">{tx.symbol}</td>
                        <td className="py-3 text-right font-tabular">{tx.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                        <td className="py-3 text-right font-tabular">{tx.price > 0 ? formatCurrency(tx.price) : '-'}</td>
                        <td className="py-3 text-right font-tabular text-on-surface-variant">{tx.fees > 0 ? formatCurrency(tx.fees) : '-'}</td>
                        <td className="py-3 text-right font-tabular font-bold">{formatCurrency(tx.amountCents)}</td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => handleEditTx(tx)}
                              className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-primary transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteTx(tx.id)}
                              className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-error transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {investmentTransactions.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                          <div className="flex flex-col items-center gap-2">
                            <History size={40} className="opacity-20" />
                            <p>No investment transactions found.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'prices' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Price History</h3>
                <button 
                  onClick={() => {
                    setPriceForm({ symbol: '', date: format(new Date(), 'yyyy-MM-dd'), price: '' });
                    setShowAddPrice(true);
                  }}
                  className="btn btn-secondary btn-sm flex items-center gap-2"
                >
                  <Plus size={14} />
                  Add Price
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Date</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Symbol</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-right">Price</th>
                      <th className="pb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50">
                    {priceSnapshots.map((ps) => (
                      <tr key={ps.id} className="hover:bg-surface-container-low transition-colors group text-sm">
                        <td className="py-3 font-tabular">{ps.date}</td>
                        <td className="py-3 font-mono font-bold">{ps.symbol}</td>
                        <td className="py-3 text-right font-tabular">{formatCurrency(ps.price)}</td>
                        <td className="py-3 text-right">
                          <button 
                            onClick={async () => {
                              if (confirm('Delete this price snapshot?')) {
                                await dbApi.deletePriceSnapshot(ps.id);
                                refreshData();
                              }
                            }}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-surface-container-high rounded text-error transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {priceSnapshots.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-on-surface-variant">
                          <div className="flex flex-col items-center gap-2">
                            <History size={40} className="opacity-20" />
                            <p>No price snapshots found.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
