import {
  isRunningBalanceHeader,
  normalizeHeaderName,
} from '../../importUtils';
import {
  BOFA_CHECKING_DISPLAY_NAME,
  BOFA_CHECKING_IMPORTER_ID,
  ImporterDetection,
} from './types';

const SCAN_LIMIT = 60;

function cell(row: string[], i: number): string {
  return (row[i] ?? '').replace(/^\uFEFF/, '').trim();
}

function rowText(row: string[]): string {
  return row.map((c) => String(c ?? '')).join(' ').toLowerCase();
}

export function findTransactionHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const normalized = rows[i].map((c) => normalizeHeaderName(String(c ?? '')));
    if (normalized.length < 4) continue;

    const hasDate = normalized.some((h) => h === 'date');
    const hasDesc = normalized.some((h) => h === 'description');
    const hasAmount = normalized.some((h) => h === 'amount');
    const hasRunning = normalized.some((h) => isRunningBalanceHeader(h) || h === 'running bal');

    if (hasDate && hasDesc && hasAmount && hasRunning) {
      return i;
    }
  }
  return -1;
}

function looksLikeSummaryHeader(row: string[]): boolean {
  const normalized = row.map((c) => normalizeHeaderName(String(c ?? '')));
  const joined = normalized.join('|');
  return (
    normalized.includes('description') &&
    (joined.includes('summary amt') ||
      joined.includes('summary amt.') ||
      normalized.some((h) => h.startsWith('summary amt')))
  );
}

function summaryLabelSignals(rows: string[][], beforeIndex: number): number {
  let hits = 0;
  for (let i = 0; i < beforeIndex; i++) {
    const t = rowText(rows[i]);
    if (t.includes('beginning balance as of')) hits++;
    if (t.includes('total credits')) hits++;
    if (t.includes('total debits')) hits++;
    if (t.includes('ending balance as of')) hits++;
  }
  return hits;
}

/**
 * Detect the observed Bank of America checking CSV structure from row arrays.
 * Does not use filename. Returns null when signals are insufficient — caller falls back to custom mapping.
 */
export function detect(rows: string[][], delimiter = ','): ImporterDetection | null {
  if (!rows.length) return null;

  const headerRowIndex = findTransactionHeaderRow(rows);
  if (headerRowIndex < 0) return null;

  const warnings: string[] = [];
  let confidence = 0.55;

  const before = rows.slice(0, headerRowIndex);
  const hasSummaryHeader = before.some(looksLikeSummaryHeader);
  const labelHits = summaryLabelSignals(rows, headerRowIndex);

  if (hasSummaryHeader) confidence += 0.2;
  if (labelHits >= 2) confidence += 0.15;
  if (labelHits >= 4) confidence += 0.1;

  // Need meaningful BoA signals — not every Date/Description/Amount/Running file
  if (!hasSummaryHeader && labelHits < 2) {
    return null;
  }

  const summaryRows: number[] = [];
  for (let i = 0; i < headerRowIndex; i++) {
    const t = rowText(rows[i]);
    const blank = rows[i].every((c) => String(c ?? '').trim() === '');
    if (blank) continue;
    if (
      looksLikeSummaryHeader(rows[i]) ||
      t.includes('beginning balance as of') ||
      t.includes('total credits') ||
      t.includes('total debits') ||
      t.includes('ending balance as of') ||
      (cell(rows[i], 0) !== '' && labelHits > 0 && i < headerRowIndex)
    ) {
      summaryRows.push(i);
    }
  }

  // Include all non-blank non-header rows before header as summary candidates
  if (summaryRows.length === 0 && headerRowIndex > 0) {
    for (let i = 0; i < headerRowIndex; i++) {
      if (!rows[i].every((c) => String(c ?? '').trim() === '')) summaryRows.push(i);
    }
  }

  if (!hasSummaryHeader && labelHits < 3) {
    warnings.push(
      'Partial match for the observed Bank of America checking layout. You can fall back to custom column mapping.'
    );
    confidence = Math.min(confidence, 0.75);
  }

  confidence = Math.min(1, confidence);

  return {
    id: BOFA_CHECKING_IMPORTER_ID,
    displayName: BOFA_CHECKING_DISPLAY_NAME,
    confidence,
    headerRowIndex,
    summaryRows,
    delimiter,
    dateFormat: 'MM/DD/YYYY',
    amountConvention: 'signed',
    warnings,
  };
}
