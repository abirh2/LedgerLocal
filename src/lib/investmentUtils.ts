import { InvestmentTransaction, Holding, PriceSnapshot } from '../models/types';

export interface HoldingStat {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  totalCostBasis: number;
  currentValue: number;
  latestPrice: number;
  latestPriceDate: string;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  totalRealizedGain: number;
  dividends: number;
  totalGain: number;
}

export function calculateHoldings(
  holdings: Holding[],
  transactions: InvestmentTransaction[],
  prices: PriceSnapshot[]
): HoldingStat[] {
  const symbols = Array.from(new Set(holdings.map(h => h.symbol)));
  
  return symbols.map(symbol => {
    const symbolTxs = transactions.filter(tx => tx.symbol === symbol);
    const symbolHoldings = holdings.filter(h => h.symbol === symbol);
    const latestPriceObj = prices.filter(p => p.symbol === symbol).sort((a, b) => b.date.localeCompare(a.date))[0];
    const latestPrice = latestPriceObj?.price || 0;
    const latestPriceDate = latestPriceObj?.date || '';

    let quantity = 0;
    let totalCostBasis = 0;
    let totalRealizedGain = 0;
    let dividends = 0;

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
      totalGain
    };
  });
}
