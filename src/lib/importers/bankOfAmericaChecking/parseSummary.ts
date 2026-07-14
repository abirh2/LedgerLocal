import { parseCsvAmount, parseMMDDYYYY } from '../../importUtils';
import { AccountStatementSummary } from './types';

function lower(s: string): string {
  return s.toLowerCase().trim();
}

function extractDateFromLabel(text: string): string | undefined {
  const m = /as of\s+(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(text);
  if (!m) return undefined;
  const { date, isValid } = parseMMDDYYYY(m[1]);
  return isValid ? date : undefined;
}

/** Parse optional statement summary rows (not transactions). */
export function parseSummary(rows: string[][], summaryRowIndexes: number[]): AccountStatementSummary {
  const summary: AccountStatementSummary = {};

  for (const idx of summaryRowIndexes) {
    const row = rows[idx];
    if (!row) continue;
    const label = lower(String(row[0] ?? row[1] ?? ''));
    // Amount is typically last non-empty cell (Summary Amt. column)
    let amountRaw: string | undefined;
    for (let i = row.length - 1; i >= 0; i--) {
      const v = String(row[i] ?? '').trim();
      if (v !== '') {
        amountRaw = v;
        break;
      }
    }
    // If label cell also held the amount (unlikely), skip when label matches amount
    const labelCell = String(row[0] ?? '').trim();
    if (amountRaw === labelCell && row.length > 1) {
      amountRaw = undefined;
      for (let i = row.length - 1; i >= 1; i--) {
        const v = String(row[i] ?? '').trim();
        if (v !== '') {
          amountRaw = v;
          break;
        }
      }
    }

    const parsed = amountRaw ? parseCsvAmount(amountRaw) : { isValid: false as const, amountCents: 0, isBlank: true };

    if (label.includes('beginning balance as of')) {
      if (parsed.isValid) summary.beginningBalanceCents = parsed.amountCents;
      summary.beginningBalanceDate = extractDateFromLabel(labelCell) ?? extractDateFromLabel(label);
    } else if (label.includes('total credits')) {
      if (parsed.isValid) summary.totalCreditsCents = parsed.amountCents;
    } else if (label.includes('total debits')) {
      if (parsed.isValid) summary.totalDebitsCents = parsed.amountCents;
    } else if (label.includes('ending balance as of')) {
      if (parsed.isValid) summary.endingBalanceCents = parsed.amountCents;
      summary.endingBalanceDate = extractDateFromLabel(labelCell) ?? extractDateFromLabel(label);
    }
    // Extra unknown summary rows ignored deliberately
  }

  return summary;
}
