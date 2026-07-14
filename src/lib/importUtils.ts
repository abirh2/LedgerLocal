import { Transaction } from '../models/types';

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

/** Strip surrounding quotes and thousands separators; blank is missing, not zero. Integer cents only. */
export function parseCsvAmount(rawAmount: unknown): {
  amountCents: number;
  isValid: boolean;
  isBlank: boolean;
  error?: string;
} {
  if (rawAmount == null) {
    return { amountCents: 0, isValid: false, isBlank: true, error: 'Missing amount' };
  }

  let s = String(rawAmount).trim();
  if (s === '') {
    return { amountCents: 0, isValid: false, isBlank: true, error: 'Missing amount' };
  }

  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (s === '') {
    return { amountCents: 0, isValid: false, isBlank: true, error: 'Missing amount' };
  }

  s = s.replace(/\$/g, '').replace(/,/g, '').trim();

  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }

  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return { amountCents: 0, isValid: false, isBlank: false, error: 'Invalid amount' };
  }

  const [whole, frac = ''] = s.split('.');
  const cents = Number.parseInt(whole, 10) * 100 + Number.parseInt((frac + '00').slice(0, 2), 10);
  return { amountCents: negative ? -cents : cents, isValid: true, isBlank: false };
}

/** Parse common bank dates without timezone day-shift. Prefer ISO or MM/DD/YYYY. */
export function parseCsvDate(rawDate: unknown): { date: string; isValid: boolean; error?: string } {
  if (rawDate == null || String(rawDate).trim() === '') {
    return { date: '', isValid: false, error: 'Missing date' };
  }

  const s = String(rawDate).trim().replace(/^"|"$/g, '');

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { date: s, isValid: true };
    }
    return { date: '', isValid: false, error: 'Invalid date' };
  }

  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (mdy) {
    const m = Number(mdy[1]);
    const d = Number(mdy[2]);
    const y = Number(mdy[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return {
        date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        isValid: true,
      };
    }
    return { date: '', isValid: false, error: 'Invalid date' };
  }

  return { date: '', isValid: false, error: 'Invalid date' };
}

/** Strict MM/DD/YYYY → YYYY-MM-DD with no Date timezone conversion. */
export function parseMMDDYYYY(rawDate: unknown): { date: string; isValid: boolean; error?: string } {
  if (rawDate == null || String(rawDate).trim() === '') {
    return { date: '', isValid: false, error: 'Missing date' };
  }
  const s = String(rawDate).trim().replace(/^"|"$/g, '');
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!mdy) {
    return { date: '', isValid: false, error: 'Invalid date' };
  }
  const m = Number(mdy[1]);
  const d = Number(mdy[2]);
  const y = Number(mdy[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { date: '', isValid: false, error: 'Invalid date' };
  }
  return {
    date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    isValid: true,
  };
}

export function processCsvData(
  rawData: Record<string, unknown>[],
  mapping: { dateCol: string; descCol: string; amountCol: string }
): ParsedRow[] {
  return rawData.map((row) => {
    const { amountCents, isValid: isAmountValid, error: amountError } = parseCsvAmount(
      row[mapping.amountCol]
    );
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
