import type {
  ImportPipelineResult,
  SanitizedImportDiagnostic,
} from './types';

/** Local-only sanitized diagnostic — no names, IDs, account values, or full descriptions. */
export function buildSanitizedDiagnostic(result: ImportPipelineResult): SanitizedImportDiagnostic {
  const classified = result.classified;
  const errorCodes = [
    ...new Set(
      result.normalized
        .filter((r) => r.error)
        .map((r) => classifyErrorCode(r.error!))
    ),
  ];

  const sampleShapes = classified
    .filter((c) => c.kind === 'transaction' || c.kind === 'invalid' || c.kind === 'recovered')
    .slice(0, 5)
    .map((c) => c.rawLineShape);

  return {
    importerId: result.importerId,
    headerNames: (result.selectedHeader?.headers ?? []).map((h) =>
      String(h).replace(/[A-Za-z0-9]/g, (ch) => (/[A-Za-z]/.test(ch) ? 'X' : /\d/.test(ch) ? '0' : ch))
    ),
    headerRowIndex: result.selectedHeader?.rowIndex,
    rowCounts: {
      total: result.rows.length,
      metadata: classified.filter((c) => c.kind === 'metadata').length,
      transaction: result.normalized.filter((r) => r.kind === 'transaction').length,
      structural: result.normalized.filter(
        (r) => r.kind === 'opening_balance' || r.kind === 'structural'
      ).length,
      footer: classified.filter((c) => c.kind === 'footer').length,
      invalid: result.normalized.filter((r) => r.kind === 'invalid').length,
      recovered: result.normalized.filter((r) => r.recovered).length,
    },
    errorCodes,
    sampleShapes,
    delimiter: result.delimiter === '\t' ? 'TAB' : result.delimiter,
    dateFormat: result.profile.dateFormat,
    amountMode: result.profile.amountMode,
    reconciliation: {
      running: result.runningBalanceValidation.status,
      summary: result.summaryValidation.status,
    },
  };
}

function classifyErrorCode(error: string): string {
  const e = error.toLowerCase();
  if (e.includes('column count')) return 'COL_COUNT';
  if (e.includes('ambiguous')) return 'AMBIGUOUS_DATE';
  if (e.includes('date')) return 'BAD_DATE';
  if (e.includes('amount')) return 'BAD_AMOUNT';
  if (e.includes('description')) return 'MISSING_DESC';
  return 'OTHER';
}

export function formatSanitizedDiagnostic(d: SanitizedImportDiagnostic): string {
  return JSON.stringify(d, null, 2);
}
