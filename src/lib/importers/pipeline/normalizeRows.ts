import { truncateDescription } from '../../importUtils';
import { recoverMalformedRow } from './columnRecovery';
import { parseDate } from './dates';
import { parseMoney } from './money';
import { isOpeningBalanceKind, matchStructuralKind } from './structural';
import type {
  ClassifiedRow,
  ColumnIndexMap,
  ImportProfile,
  NormalizedImportRow,
} from './types';

export interface NormalizeResult {
  rows: NormalizedImportRow[];
  ambiguousDates: { rowIndex: number; raw: string; candidates: string[] }[];
}

export function normalizeClassifiedRows(
  classified: ClassifiedRow[],
  columnMap: ColumnIndexMap,
  profile: ImportProfile
): NormalizeResult {
  const ambiguousDates: NormalizeResult['ambiguousDates'] = [];
  const out: NormalizedImportRow[] = [];
  const moneyOpts = {
    decimalSeparator: profile.decimalSeparator,
    thousandsSeparator: profile.thousandsSeparator,
  };
  const expectedWidth =
    Math.max(
      columnMap.date ?? 0,
      columnMap.description ?? 0,
      columnMap.amount ?? 0,
      columnMap.debit ?? 0,
      columnMap.credit ?? 0,
      columnMap.runningBalance ?? 0
    ) + 1;

  for (const row of classified) {
    if (row.kind === 'blank' || row.kind === 'header' || row.kind === 'metadata') continue;

    if (row.kind === 'footer') {
      out.push({
        kind: 'skipped',
        status: 'summary_metadata',
        postedDate: '',
        originalDescription: row.cells.join(',').slice(0, 200),
        displayDescription: truncateDescription(row.cells.join(' ')),
        sourceRowIndex: row.sourceRowIndex,
        rawCells: row.cells,
        recovered: false,
        warnings: ['Ignored footer/summary row'],
        include: false,
        structuralKind: row.structuralKind,
      });
      continue;
    }

    if (row.kind === 'structural_balance') {
      const desc = row.cells.join(' ');
      const balIdx = columnMap.runningBalance ?? columnMap.amount;
      const bal =
        balIdx != null
          ? parseMoney(row.cells[balIdx], moneyOpts)
          : parseMoney(row.cells[row.cells.length - 1], moneyOpts);
      const dateIdx = columnMap.date ?? 0;
      const dateParsed = parseDate(row.cells[dateIdx], profile.dateFormat);
      const opening = isOpeningBalanceKind(row.structuralKind);

      out.push({
        kind: opening ? 'opening_balance' : 'structural',
        status: opening ? 'opening_balance' : 'summary_metadata',
        postedDate: dateParsed.date ?? '',
        originalDescription: desc.trim(),
        displayDescription: truncateDescription(desc),
        amountCents: undefined,
        runningBalanceCents: bal.status === 'valid' ? bal.cents : undefined,
        sourceRowIndex: row.sourceRowIndex,
        rawCells: row.cells,
        recovered: false,
        warnings: [],
        include: opening && dateParsed.status === 'valid' && bal.status === 'valid',
        structuralKind: row.structuralKind,
      });
      continue;
    }

    // transaction / invalid / recovered candidates
    let cells = row.cells;
    let recovered = false;
    const warnings: string[] = [];

    if (cells.length !== expectedWidth) {
      const recovery = recoverMalformedRow(cells, columnMap, {
        dateFormats: profile.dateFormat,
        money: moneyOpts,
        expectedWidth,
      });
      if (recovery?.recovered) {
        cells = recovery.cells;
        recovered = true;
        if (recovery.warning) warnings.push(recovery.warning);
      } else if (cells.length !== expectedWidth) {
        out.push({
          kind: 'invalid',
          status: 'invalid',
          postedDate: '',
          originalDescription: cells.join(',').slice(0, 200),
          displayDescription: truncateDescription(cells.join(',')),
          sourceRowIndex: row.sourceRowIndex,
          rawCells: cells,
          recovered: false,
          warnings: [
            'Column count mismatch; refused to guess without unambiguous date/amount/balance',
          ],
          error: 'Malformed row: unexpected column count',
          include: false,
        });
        continue;
      }
    }

    const rawDate = columnMap.date != null ? cells[columnMap.date] : '';
    const rawDesc = columnMap.description != null ? cells[columnMap.description] ?? '' : '';
    const dateParsed = parseDate(rawDate, profile.dateFormat);

    if (dateParsed.status === 'ambiguous' && dateParsed.candidates) {
      ambiguousDates.push({
        rowIndex: row.sourceRowIndex,
        raw: String(rawDate),
        candidates: dateParsed.candidates,
      });
    }

    const amountCents = resolveAmount(cells, columnMap, profile, moneyOpts);
    const bal =
      columnMap.runningBalance != null
        ? parseMoney(cells[columnMap.runningBalance], moneyOpts)
        : { status: 'blank' as const };
    const desc = String(rawDesc);
    const structural = matchStructuralKind(desc, profile.structuralRowPatterns);

    if (structural && amountCents.status === 'blank' && bal.status === 'valid') {
      const opening = isOpeningBalanceKind(structural);
      out.push({
        kind: opening ? 'opening_balance' : 'structural',
        status: opening ? 'opening_balance' : 'summary_metadata',
        postedDate: dateParsed.date ?? '',
        originalDescription: desc,
        displayDescription: opening ? 'Opening balance' : truncateDescription(desc),
        runningBalanceCents: bal.cents,
        sourceRowIndex: row.sourceRowIndex,
        rawCells: cells,
        recovered,
        warnings,
        include: opening && dateParsed.status === 'valid',
        structuralKind: structural,
      });
      continue;
    }

    if (structural && (structural === 'total_credits' || structural === 'total_debits' || structural === 'ending_balance' || structural === 'totals')) {
      out.push({
        kind: 'skipped',
        status: 'summary_metadata',
        postedDate: dateParsed.date ?? '',
        originalDescription: desc,
        displayDescription: truncateDescription(desc),
        sourceRowIndex: row.sourceRowIndex,
        rawCells: cells,
        recovered,
        warnings: ['Skipped summary-like row in transaction section'],
        include: false,
        structuralKind: structural,
      });
      continue;
    }

    if (bal.status === 'blank' && columnMap.runningBalance != null) {
      warnings.push('Missing running balance');
    }

    const dateOk = dateParsed.status === 'valid';
    const amountOk = amountCents.status === 'valid';
    if (!dateOk || !amountOk || !desc.trim() || dateParsed.status === 'ambiguous') {
      out.push({
        kind: 'invalid',
        status: 'invalid',
        postedDate: dateParsed.date ?? '',
        originalDescription: desc,
        displayDescription: truncateDescription(desc || '(empty)'),
        amountCents: amountCents.status === 'valid' ? amountCents.cents : undefined,
        runningBalanceCents: bal.status === 'valid' ? bal.cents : undefined,
        sourceRowIndex: row.sourceRowIndex,
        rawCells: cells,
        recovered,
        warnings,
        error:
          dateParsed.error ||
          (amountCents.status === 'invalid' ? amountCents.warning : undefined) ||
          (!desc.trim() ? 'Missing description' : 'Invalid row'),
        include: false,
      });
      continue;
    }

    let cents = amountCents.cents!;
    if (profile.invertAmountSign) cents = -cents;

    out.push({
      kind: 'transaction',
      status: recovered ? 'recovered' : 'new',
      postedDate: dateParsed.date!,
      originalDescription: desc,
      displayDescription: truncateDescription(desc),
      amountCents: cents,
      runningBalanceCents: bal.status === 'valid' ? bal.cents : undefined,
      referenceNumber:
        columnMap.referenceNumber != null
          ? String(cells[columnMap.referenceNumber] ?? '').trim() || undefined
          : undefined,
      sourceRowIndex: row.sourceRowIndex,
      rawCells: cells,
      recovered,
      warnings,
      include: true,
    });
  }

  return { rows: out, ambiguousDates };
}

function resolveAmount(
  cells: string[],
  map: ColumnIndexMap,
  profile: ImportProfile,
  moneyOpts: { decimalSeparator: '.' | ','; thousandsSeparator: ',' | '.' | ' ' | '' }
): { status: 'valid' | 'blank' | 'invalid'; cents?: number; warning?: string } {
  if (profile.amountMode === 'debit_credit' || (map.debit != null && map.credit != null && map.amount == null)) {
    const debit = map.debit != null ? parseMoney(cells[map.debit], moneyOpts) : { status: 'blank' as const };
    const credit = map.credit != null ? parseMoney(cells[map.credit], moneyOpts) : { status: 'blank' as const };
    if (debit.status === 'invalid' || credit.status === 'invalid') {
      return { status: 'invalid', warning: 'Invalid debit/credit amount' };
    }
    if (debit.status === 'blank' && credit.status === 'blank') {
      return { status: 'blank' };
    }
    const d = debit.status === 'valid' ? Math.abs(debit.cents!) : 0;
    const c = credit.status === 'valid' ? Math.abs(credit.cents!) : 0;
    // credit positive, debit negative
    return { status: 'valid', cents: c - d };
  }

  if (map.amount == null) return { status: 'blank' };
  const parsed = parseMoney(cells[map.amount], moneyOpts);
  if (parsed.status === 'valid') return { status: 'valid', cents: parsed.cents };
  if (parsed.status === 'blank') return { status: 'blank' };
  return { status: 'invalid', warning: parsed.warning };
}

export function normalizedToParsedRows(rows: NormalizedImportRow[]) {
  return rows
    .filter((r) => r.kind !== 'skipped')
    .map((r) => ({
      date: r.postedDate,
      description: r.originalDescription,
      amountCents: r.amountCents ?? 0,
      original: r.rawCells,
      isValid:
        r.kind === 'opening_balance'
          ? !!r.postedDate && r.runningBalanceCents != null
          : r.include,
      error: r.error,
      runningBalanceCents: r.runningBalanceCents,
      status: r.status,
      warnings: r.warnings,
    }));
}
