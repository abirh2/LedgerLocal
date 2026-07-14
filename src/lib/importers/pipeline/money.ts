import type { ParsedMoney } from './types';

export interface MoneyParseOptions {
  decimalSeparator?: '.' | ',';
  thousandsSeparator?: ',' | '.' | ' ' | '';
}

/**
 * Deterministic money parser. Never treats invalid input as zero.
 * Supports quotes, currency symbols, parentheses negatives, thousands separators.
 */
export function parseMoney(
  raw: unknown,
  options: MoneyParseOptions = {}
): ParsedMoney {
  const decimalSeparator = options.decimalSeparator ?? '.';
  const thousandsSeparator =
    options.thousandsSeparator === undefined ? (decimalSeparator === '.' ? ',' : '.') : options.thousandsSeparator;

  if (raw == null) {
    return { status: 'blank' };
  }

  let s = String(raw).trim();
  if (s === '') return { status: 'blank' };

  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (s === '') return { status: 'blank' };

  // Strip currency symbols / letters commonly used as currency codes around amounts
  s = s.replace(/[$€£¥]/g, '').replace(/\b(?:USD|EUR|GBP|CAD)\b/gi, '').trim();
  if (s === '') return { status: 'blank' };

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

  if (thousandsSeparator) {
    const esc =
      thousandsSeparator === ' ' ? '\\s' : thousandsSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(esc, 'g'), '');
  }

  if (decimalSeparator !== '.') {
    // Only treat the last decimal separator as fractional
    const last = s.lastIndexOf(decimalSeparator);
    if (last >= 0) {
      s = s.slice(0, last).replace(new RegExp(`\\${decimalSeparator}`, 'g'), '') + '.' + s.slice(last + 1);
    }
  }

  s = s.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return { status: 'invalid', normalizedInput: s, warning: 'Invalid amount' };
  }

  const [whole, frac = ''] = s.split('.');
  const cents =
    Number.parseInt(whole, 10) * 100 + Number.parseInt((frac + '00').slice(0, 2), 10);
  return {
    cents: negative ? -cents : cents,
    status: 'valid',
    normalizedInput: s,
  };
}

/** True when the cell looks like a monetary value (for column recovery). */
export function isMoneyLike(raw: string, options?: MoneyParseOptions): boolean {
  if (!raw.trim()) return false;
  return parseMoney(raw, options).status === 'valid';
}
