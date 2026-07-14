import { parseDate } from './dates';
import { isMoneyLike, type MoneyParseOptions } from './money';
import { matchStructuralKind } from './structural';
import type { ColumnIndexMap, DateFormatId } from './types';

export interface RecoveryResult {
  cells: string[];
  recovered: boolean;
  warning?: string;
}

/**
 * Recover malformed rows when a known schema expects Date + Description + Amount [+ Balance]
 * and quotes split the description into extra fragments.
 * Only recovers when unambiguous; never puts description fragments into amount fields.
 */
export function recoverMalformedRow(
  cells: string[],
  cols: ColumnIndexMap,
  options: {
    dateFormats: DateFormatId | DateFormatId[];
    money?: MoneyParseOptions;
    expectedWidth?: number;
  }
): RecoveryResult | null {
  const dateIdx = cols.date;
  const descIdx = cols.description;
  const amountIdx = cols.amount;
  const balIdx = cols.runningBalance;

  if (dateIdx == null || descIdx == null) return null;

  const expectedWidth =
    options.expectedWidth ??
    Math.max(dateIdx, descIdx, amountIdx ?? 0, balIdx ?? 0) + 1;

  if (cells.length === expectedWidth) {
    return { cells, recovered: false };
  }

  const dateCell = String(cells[dateIdx] ?? '').trim();
  const dateOk = parseDate(dateCell, options.dateFormats).status === 'valid';
  if (!dateOk) return null;

  const moneyOpts = options.money;
  const amountish: { i: number; v: string }[] = [];
  for (let i = cells.length - 1; i > dateIdx; i--) {
    const v = String(cells[i] ?? '').trim();
    if (!v) continue;
    if (isMoneyLike(v, moneyOpts)) {
      amountish.push({ i, v });
    }
    if (amountish.length >= 2) break;
  }

  // Opening / structural balance: one trailing money field, blank amount
  if (amountish.length === 1 && balIdx != null) {
    const balanceIndex = amountish[0].i;
    const middle = cells.slice(dateIdx + 1, balanceIndex).map((c) => String(c ?? '').trim());
    const desc = middle.join(',').replace(/^"+|"+$/g, '').trim();
    const structural = matchStructuralKind(desc);
    if (!structural && middle.length === 0) return null;

    const out = Array.from({ length: Math.max(expectedWidth, balIdx + 1) }, () => '');
    out[dateIdx] = dateCell;
    out[descIdx] = desc || middle.join(',');
    if (amountIdx != null) out[amountIdx] = '';
    out[balIdx] = amountish[0].v;
    return {
      cells: out,
      recovered: true,
      warning: 'Recovered malformed structural/balance row with irregular columns',
    };
  }

  if (amountish.length < 1) return null;

  // With running balance: last two money-like = amount, balance
  if (balIdx != null && amountIdx != null) {
    if (amountish.length < 2) return null;
    const balCellIdx = amountish[0].i;
    const amtCellIdx = amountish[1].i;
    if (amtCellIdx >= balCellIdx) return null;

    const middle = cells.slice(dateIdx + 1, amtCellIdx);
    const desc = middle
      .map((c) => String(c ?? ''))
      .join(',')
      .replace(/\s+/g, ' ')
      .trim();

    const out = Array.from({ length: Math.max(expectedWidth, balIdx + 1) }, () => '');
    out[dateIdx] = dateCell;
    out[descIdx] = desc;
    out[amountIdx] = amountish[1].v;
    out[balIdx] = amountish[0].v;
    return {
      cells: out,
      recovered: true,
      warning: 'Recovered malformed quoted description; columns realigned with warning',
    };
  }

  // Amount only (no running balance): last money-like is amount
  if (amountIdx != null && balIdx == null && amountish.length >= 1) {
    const amtCellIdx = amountish[0].i;
    const middle = cells.slice(dateIdx + 1, amtCellIdx);
    const desc = middle
      .map((c) => String(c ?? ''))
      .join(',')
      .replace(/\s+/g, ' ')
      .trim();
    if (!desc) return null;

    const out = Array.from({ length: Math.max(expectedWidth, amountIdx + 1) }, () => '');
    out[dateIdx] = dateCell;
    out[descIdx] = desc;
    out[amountIdx] = amountish[0].v;
    return {
      cells: out,
      recovered: true,
      warning: 'Recovered malformed row; amount taken from trailing money-like field',
    };
  }

  return null;
}
