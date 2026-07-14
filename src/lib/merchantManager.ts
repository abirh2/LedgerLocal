import { Transaction, Merchant } from '../models/types';

export function normalizeMerchantName(description: string): string {
  // Basic normalization: remove dates, common prefixes/suffixes, extra spaces
  let name = description.toUpperCase();
  
  // Remove common suffixes like "Inc", "Co", "LLC"
  name = name.replace(/\b(INC|CO|LLC|LTD|CORP|PTE|INTL)\b/g, '');
  
  // Remove common transaction noise
  name = name.replace(/\b(CHECKCARD|PURCHASE|RECURRING|DEBIT|CREDIT|ATM|POS|WEB)\b/g, '');
  
  // Remove dates (MM/DD, DD/MM, YYYY-MM-DD etc)
  name = name.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '');
  name = name.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '');
  
  // Remove ID numbers or terminal IDs (e.g. #1234567, *8888)
  name = name.replace(/[#*]\d+/g, '');
  
  // Remove locations (City, State) - very simple heuristic
  // Usually at the end of the string
  
  // Final cleanup
  name = name.replace(/\s+/g, ' ').trim();
  
  return name || description;
}

export function generateMerchantsFromTransactions(transactions: Transaction[], existingMerchants: Merchant[] = []): Merchant[] {
  const merchantMap = new Map<string, Merchant>();
  
  // Add existing
  existingMerchants.forEach(m => merchantMap.set(m.name.toLowerCase(), m));

  transactions.forEach(tx => {
    const normalized = normalizeMerchantName(tx.originalDescription);
    const key = normalized.toLowerCase();
    
    if (merchantMap.has(key)) {
      const m = merchantMap.get(key)!;
      if (!m.originalDescriptions.includes(tx.originalDescription)) {
        m.originalDescriptions.push(tx.originalDescription);
      }
    } else {
      merchantMap.set(key, {
        id: `m_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: normalized,
        originalDescriptions: [tx.originalDescription],
        createdAt: new Date().toISOString()
      });
    }
  });

  return Array.from(merchantMap.values());
}
