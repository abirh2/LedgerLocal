import {
  isRunningBalanceHeader,
  normalizeHeaderName,
  parseCsvAmount,
  parseMMDDYYYY,
  truncateDescription,
} from '../../importUtils';
import { BofANormalizedRow } from './types';

export interface ColumnMap {
  date: number;
  description: number;
  amount: number;
  runningBal: number;
}

export function mapHeaderColumns(headerRow: string[]): ColumnMap | null {
  const normalized = headerRow.map((c) => normalizeHeaderName(String(c ?? '')));
  const find = (pred: (h: string) => boolean): number => normalized.findIndex(pred);
  const date = find((h) => h === 'date');
  const description = find((h) => h === 'description');
  const amount = find((h) => h === 'amount');
  const runningBal = find((h) => isRunningBalanceHeader(h) || h === 'running bal');
  if (date < 0 || description < 0 || amount < 0 || runningBal < 0) return null;
  return { date, description, amount, runningBal };
}

function isAmountLike(raw: string): boolean {
  if (!raw.trim()) return false;
  return parseCsvAmount(raw).isValid;
}

function isOpeningBalanceDescription(desc: string): boolean {
  return /^beginning balance as of/i.test(desc.trim());
}

/**
 * Conservative recovery when Papa splits a messy quoted description into extra columns.
 * Requires: first mapped-date cell is a valid date; last two amount-like cells identified.
 */
export function recoverMalformedRow(
  cells: string[],
  cols: ColumnMap
): { cells: string[]; recovered: boolean; warning?: string } | null {
  if (cells.length === cols.runningBal + 1) {
    return { cells, recovered: false };
  }

  // Prefer absolute positions: date in col.date, then trailing amount + running bal
  const dateCell = String(cells[cols.date] ?? '').trim();
  const dateOk = parseMMDDYYYY(dateCell).isValid;
  if (!dateOk) return null;

  // Find last two amount-like values from the end
  const amountish: { i: number; v: string }[] = [];
  for (let i = cells.length - 1; i > cols.date; i--) {
    const v = String(cells[i] ?? '').trim();
    if (v === '') continue;
    if (isAmountLike(v) || (amountish.length === 1 && v === '')) {
      if (isAmountLike(v)) amountish.push({ i, v });
    }
    if (amountish.length >= 2) break;
  }

  // Opening balance: one trailing balance, blank amount
  if (amountish.length === 1) {
    const balIdx = amountish[0].i;
    const middle = cells.slice(cols.date + 1, balIdx).map((c) => String(c ?? '').trim());
    const desc = middle.join(',').replace(/^"+|"+$/g, '').trim();
    if (!isOpeningBalanceDescription(desc) && middle.length === 0) return null;
    const rebuilt = [...cells];
    // Build canonical 4-field row aligned to cols max index
    const width = Math.max(cols.runningBal + 1, 4);
    const out = Array.from({ length: width }, () => '');
    out[cols.date] = dateCell;
    out[cols.description] = desc || middle.join(',');
    out[cols.amount] = '';
    out[cols.runningBal] = amountish[0].v;
    return {
      cells: out,
      recovered: true,
      warning: 'Recovered malformed row (opening balance with irregular columns)',
    };
  }

  if (amountish.length < 2) return null;

  const balIdx = amountish[0].i;
  const amtIdx = amountish[1].i;
  if (amtIdx >= balIdx) return null;

  const middle = cells.slice(cols.date + 1, amtIdx);
  const desc = middle
    .map((c) => String(c ?? ''))
    .join(',')
    .replace(/\s+/g, ' ')
    .trim();

  const width = Math.max(cols.runningBal + 1, 4);
  const out = Array.from({ length: width }, () => '');
  out[cols.date] = dateCell;
  out[cols.description] = desc;
  out[cols.amount] = amountish[1].v;
  out[cols.runningBal] = amountish[0].v;

  return {
    cells: out,
    recovered: true,
    warning: 'Recovered malformed quoted description; columns realigned with warning',
  };
}

export function normalizeTransactionRows(
  rows: string[][],
  headerRowIndex: number,
  cols: ColumnMap
): BofANormalizedRow[] {
  const out: BofANormalizedRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    let cells = rows[i].map((c) => String(c ?? ''));
    if (cells.every((c) => c.trim() === '')) continue;

    const warnings: string[] = [];
    let recovered = false;

    const expectedWidth = cols.runningBal + 1;
    if (cells.length !== expectedWidth) {
      const recovery = recoverMalformedRow(cells, cols);
      if (recovery?.recovered) {
        cells = recovery.cells;
        recovered = true;
        if (recovery.warning) warnings.push(recovery.warning);
      } else if (cells.length > expectedWidth || cells.length < expectedWidth) {
        // Still try if we have date + enough fields
        const recovery2 = recoverMalformedRow(cells, cols);
        if (recovery2?.recovered) {
          cells = recovery2.cells;
          recovered = true;
          if (recovery2.warning) warnings.push(recovery2.warning);
        } else {
          out.push({
            kind: 'invalid',
            status: 'invalid',
            postedDate: '',
            originalDescription: cells.join(',').slice(0, 200),
            displayDescription: truncateDescription(cells.join(',')),
            sourceRowIndex: i,
            rawCells: cells,
            recovered: false,
            warnings: ['Column count mismatch; refused to guess without unambiguous date/amount/balance'],
            error: 'Malformed row: unexpected column count',
            include: false,
          });
          continue;
        }
      }
    }

    const rawDate = cells[cols.date];
    const rawDesc = cells[cols.description] ?? '';
    const rawAmount = cells[cols.amount];
    const rawBal = cells[cols.runningBal];

    const { date, isValid: dateOk, error: dateError } = parseMMDDYYYY(rawDate);
    const amount = parseCsvAmount(rawAmount);
    const balance = parseCsvAmount(rawBal);
    const desc = String(rawDesc);

    if (isOpeningBalanceDescription(desc) && amount.isBlank && balance.isValid) {
      out.push({
        kind: 'opening_balance',
        status: 'opening_balance',
        postedDate: dateOk ? date : '',
        originalDescription: desc,
        displayDescription: 'Opening balance',
        amountCents: undefined,
        runningBalanceCents: balance.amountCents,
        sourceRowIndex: i,
        rawCells: cells,
        recovered,
        warnings,
        error: dateOk ? undefined : dateError,
        include: dateOk,
      });
      continue;
    }

    // Do not treat summary totals that leaked below header as transactions
    if (/^(total credits|total debits|ending balance as of)/i.test(desc.trim())) {
      out.push({
        kind: 'skipped',
        status: 'summary_metadata',
        postedDate: dateOk ? date : '',
        originalDescription: desc,
        displayDescription: truncateDescription(desc),
        sourceRowIndex: i,
        rawCells: cells,
        recovered,
        warnings: ['Skipped summary-like row in transaction section'],
        include: false,
      });
      continue;
    }

    const missingBal = balance.isBlank;
    if (missingBal) warnings.push('Missing running balance');

    if (!dateOk || amount.isBlank || !amount.isValid || !desc.trim()) {
      out.push({
        kind: 'invalid',
        status: 'invalid',
        postedDate: dateOk ? date : '',
        originalDescription: desc,
        displayDescription: truncateDescription(desc || '(empty)'),
        amountCents: amount.isValid ? amount.amountCents : undefined,
        runningBalanceCents: balance.isValid ? balance.amountCents : undefined,
        sourceRowIndex: i,
        rawCells: cells,
        recovered,
        warnings,
        error: dateError || amount.error || (!desc.trim() ? 'Missing description' : 'Invalid row'),
        include: false,
      });
      continue;
    }

    out.push({
      kind: 'transaction',
      status: recovered ? 'recovered' : 'new',
      postedDate: date,
      originalDescription: desc,
      displayDescription: truncateDescription(desc),
      amountCents: amount.amountCents,
      runningBalanceCents: balance.isValid ? balance.amountCents : undefined,
      sourceRowIndex: i,
      rawCells: cells,
      recovered,
      warnings,
      include: true,
    });
  }

  return out;
}
