import { Transaction, TransferMatch } from '../models/types';
import { differenceInDays, parseISO } from 'date-fns';

export interface TransferCandidate {
  tx1: Transaction;
  tx2: Transaction;
  confidence: number;
}

export function findTransferCandidates(transactions: Transaction[], existingMatches: TransferMatch[] = []): TransferCandidate[] {
  const candidates: TransferCandidate[] = [];
  const matchedIds = new Set<string>();
  
  existingMatches.forEach(m => {
    if (m.status === 'confirmed') {
      matchedIds.add(m.tx1Id);
      matchedIds.add(m.tx2Id);
    }
  });

  // Filter out already matched and transfers marked as not transfers
  const potentialTxs = transactions.filter(tx => !matchedIds.has(tx.id) && !tx.excludedFromReports);

  for (let i = 0; i < potentialTxs.length; i++) {
    const tx1 = potentialTxs[i];
    
    for (let j = i + 1; j < potentialTxs.length; j++) {
      const tx2 = potentialTxs[j];

      // Must be in different accounts
      if (tx1.accountId === tx2.accountId) continue;

      // Must have opposite amounts
      if (tx1.amountCents !== -tx2.amountCents) continue;

      // Must be within a reasonable date range (e.g., 7 days)
      const daysDiff = Math.abs(differenceInDays(parseISO(tx1.postedDate), parseISO(tx2.postedDate)));
      if (daysDiff > 7) continue;

      let confidence = 50; // Base confidence for same amount, different accounts, close date

      // Description clues
      const desc1 = tx1.originalDescription.toLowerCase();
      const desc2 = tx2.originalDescription.toLowerCase();
      
      const transferKeywords = ['transfer', 'payment', 'pmt', 'credit card', 'venmo', 'zelle'];
      const hasClue1 = transferKeywords.some(k => desc1.includes(k));
      const hasClue2 = transferKeywords.some(k => desc2.includes(k));

      if (hasClue1 || hasClue2) confidence += 20;
      if (hasClue1 && hasClue2) confidence += 20;

      // Date closeness bonus
      if (daysDiff === 0) confidence += 10;
      else if (daysDiff <= 2) confidence += 5;

      if (confidence >= 60) {
        candidates.push({ tx1, tx2, confidence });
      }
    }
  }

  return candidates;
}
