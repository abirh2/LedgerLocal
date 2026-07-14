import { redactForDiagnostics } from '../../importUtils';

/**
 * Safe diagnostic string for developer tools — never emit raw bank descriptions.
 * Callers must not console.log raw CSV rows.
 */
export function describeRowForDiagnostics(opts: {
  sourceRowIndex: number;
  kind: string;
  error?: string;
  warningCount: number;
}): string {
  return `row=${opts.sourceRowIndex} kind=${opts.kind} warnings=${opts.warningCount}${
    opts.error ? ` error=${redactForDiagnostics(opts.error)}` : ''
  }`;
}
