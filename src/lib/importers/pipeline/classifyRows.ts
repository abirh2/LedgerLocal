import { matchStructuralKind } from './structural';
import type { ClassifiedRow, ColumnIndexMap } from './types';

function rowText(cells: string[]): string {
  return cells.map((c) => String(c ?? '')).join(' ').trim();
}

function isBlank(cells: string[]): boolean {
  return cells.every((c) => String(c ?? '').trim() === '');
}

/**
 * Classify rows relative to a chosen header index.
 * Metadata/footer must not become transactions.
 */
export function classifyRows(
  rows: string[][],
  headerRowIndex: number,
  columnMap: ColumnIndexMap,
  structuralPatterns: string[] = [],
  footerHandling: 'ignore' | 'classify' = 'classify'
): ClassifiedRow[] {
  const out: ClassifiedRow[] = [];
  const expectedWidth = estimateExpectedWidth(columnMap);

  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] || []).map((c) => String(c ?? ''));
    const shape = cells.map((c) => (c.trim() ? (looksMoney(c) ? 'M' : looksDate(c) ? 'D' : 'T') : '_')).join('');

    if (isBlank(cells)) {
      out.push({ sourceRowIndex: i, kind: 'blank', cells, rawLineShape: shape });
      continue;
    }

    if (i === headerRowIndex) {
      out.push({ sourceRowIndex: i, kind: 'header', cells, rawLineShape: shape });
      continue;
    }

    const text = rowText(cells);
    const structural = matchStructuralKind(text, structuralPatterns);

    if (i < headerRowIndex) {
      out.push({
        sourceRowIndex: i,
        kind: structural ? 'structural_balance' : 'metadata',
        structuralKind: structural ?? undefined,
        cells,
        rawLineShape: shape,
      });
      continue;
    }

    // After header
    if (structural) {
      const isFooterLike =
        structural === 'ending_balance' ||
        structural === 'total_credits' ||
        structural === 'total_debits' ||
        structural === 'totals' ||
        structural === 'statement_balance';
      out.push({
        sourceRowIndex: i,
        kind: isFooterLike && footerHandling === 'classify' ? 'footer' : 'structural_balance',
        structuralKind: structural,
        cells,
        rawLineShape: shape,
      });
      continue;
    }

    // Trailing legal/notice rows: few columns, no date
    const dateIdx = columnMap.date ?? 0;
    const dateCell = String(cells[dateIdx] ?? '').trim();
    if (!looksDate(dateCell) && cells.filter((c) => c.trim()).length <= 1 && i > headerRowIndex + 3) {
      // could be footer notice
      if (/^(confidential|page\s+\d|end of|thanks|notice)/i.test(text)) {
        out.push({ sourceRowIndex: i, kind: 'footer', cells, rawLineShape: shape });
        continue;
      }
    }

    if (!looksDate(dateCell) && cells.length < Math.max(2, expectedWidth - 1)) {
      out.push({ sourceRowIndex: i, kind: 'invalid', cells, rawLineShape: shape });
      continue;
    }

    out.push({ sourceRowIndex: i, kind: 'transaction', cells, rawLineShape: shape });
  }

  return out;
}

function estimateExpectedWidth(map: ColumnIndexMap): number {
  const idxs = Object.values(map).filter((v): v is number => v != null);
  return idxs.length ? Math.max(...idxs) + 1 : 3;
}

function looksDate(s: string): boolean {
  return /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(s.trim());
}

function looksMoney(s: string): boolean {
  return /^[$€£(]?\s*-?\d/.test(s.trim());
}
