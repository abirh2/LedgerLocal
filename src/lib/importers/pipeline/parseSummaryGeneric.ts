import { parseMoney } from './money';
import { matchStructuralKind } from './structural';
import type { AccountStatementSummary, ClassifiedRow, ImportProfile } from './types';

/** Extract statement summary from metadata/structural rows (generic, amount-on-right heuristic). */
export function parseSummaryFromClassified(
  classified: ClassifiedRow[],
  profile: Pick<ImportProfile, 'decimalSeparator' | 'thousandsSeparator'>
): AccountStatementSummary {
  const moneyOpts = {
    decimalSeparator: profile.decimalSeparator,
    thousandsSeparator: profile.thousandsSeparator,
  };
  const summary: AccountStatementSummary = {};

  for (const row of classified) {
    if (row.kind !== 'metadata' && row.kind !== 'structural_balance' && row.kind !== 'footer') {
      continue;
    }
    const text = row.cells.join(' ');
    const kind = row.structuralKind ?? matchStructuralKind(text);
    if (!kind) continue;

    const amount = findLastMoney(row.cells, moneyOpts);
    if (amount == null) continue;

    switch (kind) {
      case 'beginning_balance':
        summary.beginningBalanceCents = amount;
        break;
      case 'ending_balance':
      case 'statement_balance':
        summary.endingBalanceCents = amount;
        break;
      case 'total_credits':
        summary.totalCreditsCents = Math.abs(amount);
        break;
      case 'total_debits':
        summary.totalDebitsCents = amount > 0 ? -amount : amount;
        break;
      default:
        break;
    }
  }

  return summary;
}

function findLastMoney(
  cells: string[],
  moneyOpts: { decimalSeparator: '.' | ','; thousandsSeparator: ',' | '.' | ' ' | '' }
): number | undefined {
  for (let i = cells.length - 1; i >= 0; i--) {
    const p = parseMoney(cells[i], moneyOpts);
    if (p.status === 'valid') return p.cents;
  }
  return undefined;
}
