import { Transaction } from '../models/types';
import { parseDate } from './importers/pipeline/dates';
import { parseMoney } from './importers/pipeline/money';

export interface ParsedRow {
  date: string;
  description: string;
  amountCents: number;
  original: Record<string, unknown> | string[];
  isValid: boolean;
  error?: string;
  runningBalanceCents?: number;
  status?: ImportRowStatus;
  warnings?: string[];
}

export type ImportRowStatus =
  | 'new'
  | 'exact_duplicate'
  | 'possible_duplicate'
  | 'invalid'
  | 'recovered'
  | 'opening_balance'
  | 'summary_metadata';

export type { ParsedMoney } from './importers/pipeline/types';

/** Strip surrounding quotes and thousands separators; blank is missing, not zero. Integer cents only. */
export function parseCsvAmount(rawAmount: unknown): {
  amountCents: number;
  isValid: boolean;
  isBlank: boolean;
  error?: string;
} {
  const parsed = parseMoney(rawAmount);
  if (parsed.status === 'blank') {
    return { amountCents: 0, isValid: false, isBlank: true, error: 'Missing amount' };
  }
  if (parsed.status === 'invalid') {
    return { amountCents: 0, isValid: false, isBlank: false, error: parsed.warning ?? 'Invalid amount' };
  }
  return { amountCents: parsed.cents!, isValid: true, isBlank: false };
}

/** Parse common bank dates without timezone day-shift. Prefer ISO or MM/DD/YYYY. */
export function parseCsvDate(rawDate: unknown): { date: string; isValid: boolean; error?: string } {
  const parsed = parseDate(rawDate, ['YYYY-MM-DD', 'MM/DD/YYYY']);
  if (parsed.status === 'valid' && parsed.date) {
    return { date: parsed.date, isValid: true };
  }
  return { date: '', isValid: false, error: parsed.error ?? 'Invalid date' };
}

/** Strict MM/DD/YYYY → YYYY-MM-DD with no Date timezone conversion. */
export function parseMMDDYYYY(rawDate: unknown): { date: string; isValid: boolean; error?: string } {
  const parsed = parseDate(rawDate, 'MM/DD/YYYY');
  if (parsed.status === 'valid' && parsed.date) {
    return { date: parsed.date, isValid: true };
  }
  return { date: '', isValid: false, error: parsed.error ?? 'Invalid date' };
}

export function processCsvData(
  rawData: Record<string, unknown>[],
  mapping: {
    dateCol: string;
    descCol: string;
    amountCol?: string;
    debitCol?: string;
    creditCol?: string;
    invertSign?: boolean;
  }
): ParsedRow[] {
  return rawData.map((row) => {
    let amountCents = 0;
    let isAmountValid = false;
    let amountError: string | undefined;

    if (mapping.debitCol || mapping.creditCol) {
      const debit = mapping.debitCol ? parseCsvAmount(row[mapping.debitCol]) : null;
      const credit = mapping.creditCol ? parseCsvAmount(row[mapping.creditCol]) : null;
      if (debit && !debit.isBlank && !debit.isValid) {
        amountError = debit.error;
      } else if (credit && !credit.isBlank && !credit.isValid) {
        amountError = credit.error;
      } else {
        const d = debit && debit.isValid ? Math.abs(debit.amountCents) : 0;
        const c = credit && credit.isValid ? Math.abs(credit.amountCents) : 0;
        if ((debit && !debit.isBlank && debit.isValid) || (credit && !credit.isBlank && credit.isValid)) {
          amountCents = c - d;
          isAmountValid = true;
        } else {
          amountError = 'Missing amount';
        }
      }
    } else {
      const parsed = parseCsvAmount(row[mapping.amountCol!]);
      amountCents = parsed.amountCents;
      isAmountValid = parsed.isValid;
      amountError = parsed.error;
    }

    if (isAmountValid && mapping.invertSign) {
      amountCents = -amountCents;
    }

    const { date, isValid: isDateValid, error: dateError } = parseCsvDate(row[mapping.dateCol]);
    const rawDesc = row[mapping.descCol] ?? '';

    const isValid = isAmountValid && isDateValid && !!String(rawDesc).trim();
    const error =
      amountError || dateError || (!String(rawDesc).trim() ? 'Missing description' : undefined);

    return {
      date,
      description: String(rawDesc),
      amountCents,
      original: row,
      isValid,
      error,
      status: isValid ? ('new' as const) : ('invalid' as const),
    };
  });
}

/** Exact duplicate: same account, date, amountCents, and originalDescription. */
export function findExactDuplicate(
  row: { date: string; amountCents: number; description: string },
  existing: Transaction[],
  accountId: string
): Transaction | undefined {
  return existing.find(
    (t) =>
      t.accountId === accountId &&
      t.postedDate === row.date &&
      t.amountCents === row.amountCents &&
      t.originalDescription === row.description
  );
}

/** Possible duplicate: same account + amount within ±3 days, similar description. */
export function findPossibleDuplicate(
  row: { date: string; amountCents: number; description: string },
  existing: Transaction[],
  accountId: string
): Transaction | undefined {
  const target = Date.parse(row.date + 'T00:00:00');
  if (Number.isNaN(target)) return undefined;
  const windowMs = 3 * 24 * 60 * 60 * 1000;
  const descKey = row.description.trim().toLowerCase().slice(0, 40);

  return existing.find((t) => {
    if (t.accountId !== accountId || t.amountCents !== row.amountCents) return false;
    if (t.postedDate === row.date && t.originalDescription === row.description) return false;
    const other = Date.parse(t.postedDate + 'T00:00:00');
    if (Number.isNaN(other) || Math.abs(other - target) > windowMs) return false;
    const otherKey = t.originalDescription.trim().toLowerCase().slice(0, 40);
    return otherKey === descKey || otherKey.includes(descKey) || descKey.includes(otherKey);
  });
}

export function truncateDescription(text: string, maxLen = 64): string {
  const s = text.trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '…';
}

/** Redact likely identifiers for developer diagnostics — never log raw bank text. */
export function redactForDiagnostics(text: string): string {
  return text
    .replace(/\b\d{4,}\b/g, '[ID]')
    .replace(/[#*][A-Za-z0-9_-]+/g, '[REF]')
    .replace(/\b[A-Z]{2,}\d{6,}\b/gi, '[REF]')
    .replace(/\b(?:confirmation|conf|auth|txn|trans(?:action)?)\s*[#:.]?\s*\S+/gi, '$1 [REDACTED]');
}

export function normalizeHeaderName(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '.')
    .replace(/\.$/, '');
}

/** Match Running Bal. and punctuation variants after normalization. */
export function isRunningBalanceHeader(normalized: string): boolean {
  const n = normalized.replace(/[.\s]+/g, '');
  return n === 'runningbal' || n === 'runningbalance' || n === 'runningbal.';
}
