import type { FieldAliasRole, HeaderAliasSet } from './types';
import { isRunningBalanceHeader, normalizeHeaderName } from '../../importUtils';

/** Default field aliases for generic header discovery. */
export const DEFAULT_HEADER_ALIASES: HeaderAliasSet = {
  date: ['date', 'posted date', 'posting date', 'trans date', 'trn date'],
  posted_date: ['posted date', 'posting date', 'post date'],
  transaction_date: ['transaction date', 'trans date', 'txn date', 'purchase date'],
  description: ['description', 'desc', 'narrative', 'payee'],
  details: ['details', 'detail', 'transaction details'],
  merchant: ['merchant', 'merchant name', 'vendor', 'name'],
  memo: ['memo', 'notes', 'note', 'comment'],
  amount: ['amount', 'amt', 'value', 'transaction amount', 'sum'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'debit amount', 'money out'],
  credit: ['credit', 'deposit', 'deposits', 'credit amount', 'money in'],
  withdrawal: ['withdrawal', 'withdrawals'],
  deposit: ['deposit', 'deposits'],
  running_balance: ['running bal', 'running balance', 'running bal.', 'ledger balance'],
  balance: ['balance', 'bal', 'current balance'],
  transaction_type: ['type', 'transaction type', 'trn type', 'trans type'],
  reference_number: ['reference', 'ref', 'ref number', 'reference number', 'check number', 'check #'],
};

export const REQUIRED_ROLES: FieldAliasRole[] = ['date', 'description', 'amount'];
export const OPTIONAL_ROLES: FieldAliasRole[] = [
  'posted_date',
  'transaction_date',
  'details',
  'merchant',
  'memo',
  'debit',
  'credit',
  'running_balance',
  'balance',
  'transaction_type',
  'reference_number',
];

export function mergeAliases(overrides?: HeaderAliasSet): HeaderAliasSet {
  if (!overrides) return { ...DEFAULT_HEADER_ALIASES };
  const out: HeaderAliasSet = { ...DEFAULT_HEADER_ALIASES };
  for (const [k, v] of Object.entries(overrides)) {
    out[k] = [...new Set([...(out[k] ?? []), ...v])];
  }
  return out;
}

export function headerMatchesAlias(normalizedHeader: string, aliases: string[]): boolean {
  const h = normalizeHeaderName(normalizedHeader);
  const compact = h.replace(/[.\s]+/g, '');
  if (aliases.some((a) => normalizeHeaderName(a) === h)) return true;
  if (isRunningBalanceHeader(h) && aliases.some((a) => a.includes('running'))) return true;
  return aliases.some((a) => {
    const na = normalizeHeaderName(a);
    const ca = na.replace(/[.\s]+/g, '');
    return h === na || compact === ca || h.includes(na) || na.includes(h);
  });
}

/** Map a role to the first matching column index, or -1. */
export function findRoleIndex(
  normalizedHeaders: string[],
  role: string,
  aliases: HeaderAliasSet
): number {
  const list = aliases[role] ?? [];
  return normalizedHeaders.findIndex((h) => headerMatchesAlias(h, list));
}
