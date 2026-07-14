import Papa from 'papaparse';
import { detect } from './detect';
import { mapHeaderColumns, normalizeTransactionRows } from './normalize';
import { parseSummary } from './parseSummary';
import { validateRunningBalances, validateSummary } from './validateBalances';
import {
  BOFA_CHECKING_DISPLAY_NAME,
  BOFA_CHECKING_IMPORTER_ID,
  BofAParseResult,
  ImporterDetection,
} from './types';

export {
  BOFA_CHECKING_DISPLAY_NAME,
  BOFA_CHECKING_IMPORTER_ID,
  detect,
  parseSummary,
  validateRunningBalances,
  validateSummary,
};
export type {
  AccountStatementSummary,
  BofANormalizedRow,
  BofAParseResult,
  ImporterDetection,
  RunningBalanceValidation,
  SummaryValidation,
} from './types';

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

/** Parse raw CSV text into string[][] with Papa's robust quoted-field mode. */
export function parseCsvMatrix(text: string): { rows: string[][]; delimiter: string } {
  const cleaned = stripBom(text);
  const result = Papa.parse<string[]>(cleaned, {
    header: false,
    skipEmptyLines: false,
    dynamicTyping: false,
    quoteChar: '"',
    escapeChar: '"',
  });

  const rows = (result.data || []).map((row) =>
    (Array.isArray(row) ? row : [String(row)]).map((c) => String(c ?? ''))
  );
  const delimiter = result.meta.delimiter || ',';
  return { rows, delimiter };
}

export function detectFromText(text: string): ImporterDetection | null {
  const { rows, delimiter } = parseCsvMatrix(text);
  return detect(rows, delimiter);
}

export function parseBankOfAmericaCheckingCsv(text: string): BofAParseResult | null {
  const { rows, delimiter } = parseCsvMatrix(text);
  const detection = detect(rows, delimiter);
  if (!detection) return null;

  const cols = mapHeaderColumns(rows[detection.headerRowIndex] || []);
  if (!cols) {
    detection.warnings.push('Transaction header found but columns could not be mapped');
    return null;
  }

  const summary = parseSummary(rows, detection.summaryRows);
  const normalized = normalizeTransactionRows(rows, detection.headerRowIndex, cols);
  const runningBalanceValidation = validateRunningBalances(normalized);
  const summaryValidation = validateSummary(summary, normalized);

  if (runningBalanceValidation.mismatchCount > 0) {
    detection.warnings.push(
      `Running balance mismatches: ${runningBalanceValidation.mismatchCount} (import not blocked)`
    );
  }
  if (summaryValidation.arithmeticOk === false) {
    detection.warnings.push('Summary beginning + credits + debits does not equal ending balance');
  }
  if (summaryValidation.endingMatchesLastRunning === false) {
    detection.warnings.push('Summary ending balance does not match last running balance');
  }

  const txs = normalized.filter((r) => r.kind === 'transaction');
  const dates = txs.map((r) => r.postedDate).filter(Boolean).sort();
  const openingBalanceCount = normalized.filter((r) => r.kind === 'opening_balance').length;

  return {
    detection: {
      ...detection,
      displayName: BOFA_CHECKING_DISPLAY_NAME,
      id: BOFA_CHECKING_IMPORTER_ID,
    },
    summary,
    rows: normalized,
    runningBalanceValidation,
    summaryValidation,
    stats: {
      summaryRowCount: detection.summaryRows.length,
      transactionRowCount: txs.length + openingBalanceCount,
      openingBalanceCount,
      validNormalCount: txs.filter((r) => r.include).length,
      invalidCount: normalized.filter((r) => r.kind === 'invalid').length,
      recoveredCount: normalized.filter((r) => r.recovered).length,
      dateRange: dates.length
        ? { start: dates[0], end: dates[dates.length - 1] }
        : undefined,
    },
  };
}
