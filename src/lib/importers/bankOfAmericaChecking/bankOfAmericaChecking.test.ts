import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  parseBankOfAmericaCheckingCsv,
  detectFromText,
  BOFA_CHECKING_IMPORTER_ID,
} from './index';
import { describeRowForDiagnostics } from './privacy';
import { redactForDiagnostics } from '../../importUtils';

const FIX = resolve(__dirname, '../../../test/fixtures/csv/bankOfAmericaChecking');

function load(name: string): string {
  return readFileSync(resolve(FIX, name), 'utf8');
}

describe('Bank of America Checking importer (observed format)', () => {
  it('detects normal structure with summary + transaction header', () => {
    const detection = detectFromText(load('normal-structure.csv'));
    expect(detection).not.toBeNull();
    expect(detection!.id).toBe(BOFA_CHECKING_IMPORTER_ID);
    expect(detection!.dateFormat).toBe('MM/DD/YYYY');
    expect(detection!.amountConvention).toBe('signed');
    expect(detection!.headerRowIndex).toBeGreaterThan(0);
    expect(detection!.summaryRows.length).toBeGreaterThan(0);
    expect(detection!.delimiter).toBe(',');
  });

  it('does not detect generic Date/Amount CSVs without BoA summary signals', () => {
    const generic = 'Date,Description,Amount,Running Bal.\n01/01/2026,Coffee,-4.50,100.00\n';
    expect(detectFromText(generic)).toBeNull();
  });

  it('does not identify solely from a BofA filename (structure only)', () => {
    // Filename is irrelevant — empty/generic content must not match
    expect(detectFromText('not,a,bank,file\n1,2,3,4\n')).toBeNull();
  });

  it('parses normal structure without creating transactions from summary totals', () => {
    const result = parseBankOfAmericaCheckingCsv(load('normal-structure.csv'))!;
    expect(result.summary.beginningBalanceCents).toBe(100000);
    expect(result.summary.totalCreditsCents).toBe(250000);
    expect(result.summary.totalDebitsCents).toBe(-35025);
    expect(result.summary.endingBalanceCents).toBe(314975);
    expect(result.rows.some((r) => /total credits/i.test(r.originalDescription) && r.kind === 'transaction')).toBe(false);
    expect(result.stats.openingBalanceCount).toBe(1);
    expect(result.stats.validNormalCount).toBeGreaterThan(0);
    expect(result.runningBalanceValidation.mismatchCount).toBe(0);
    expect(result.summaryValidation.arithmeticOk).toBe(true);
    expect(result.summaryValidation.endingMatchesLastRunning).toBe(true);
  });

  it('handles summary, blank line, and transaction header', () => {
    const result = parseBankOfAmericaCheckingCsv(load('summary-blank-header.csv'))!;
    expect(result.detection.headerRowIndex).toBeGreaterThan(4);
    expect(result.stats.validNormalCount).toBe(2);
  });

  it('finds header when shifted by extra metadata', () => {
    const result = parseBankOfAmericaCheckingCsv(load('shifted-header.csv'))!;
    expect(result.detection.headerRowIndex).toBeGreaterThan(6);
    expect(result.stats.validNormalCount).toBe(2);
  });

  it('parses quoted thousands separators into exact integer cents', () => {
    const result = parseBankOfAmericaCheckingCsv(load('quoted-thousands.csv'))!;
    expect(result.summary.beginningBalanceCents).toBe(123456);
    const credit = result.rows.find((r) => r.originalDescription.includes('QUOTED CREDITS'));
    const debit = result.rows.find((r) => r.originalDescription.includes('QUOTED DEBITS'));
    expect(credit?.amountCents).toBe(200000);
    expect(debit?.amountCents).toBe(-123456);
    expect(result.runningBalanceValidation.mismatchCount).toBe(0);
  });

  it('treats blank opening-balance amount as marker, not income', () => {
    const result = parseBankOfAmericaCheckingCsv(load('opening-balance-only.csv'))!;
    expect(result.stats.openingBalanceCount).toBe(1);
    expect(result.stats.validNormalCount).toBe(0);
    const opening = result.rows.find((r) => r.kind === 'opening_balance')!;
    expect(opening.amountCents).toBeUndefined();
    expect(opening.runningBalanceCents).toBe(80000);
    expect(opening.status).toBe('opening_balance');
  });

  it('preserves positive credits and negative debits', () => {
    const result = parseBankOfAmericaCheckingCsv(load('long-and-comma-desc.csv'))!;
    const credit = result.rows.find((r) => r.originalDescription === 'INFLOW CREDIT EXAMPLE');
    const debit = result.rows.find((r) => r.originalDescription.includes('STORE NAME'));
    expect(credit?.amountCents).toBe(2500);
    expect(debit?.amountCents).toBe(-500);
  });

  it('preserves long descriptions and commas inside quoted fields', () => {
    const result = parseBankOfAmericaCheckingCsv(load('long-and-comma-desc.csv'))!;
    const long = result.rows.find((r) => r.originalDescription.startsWith('LONG DESC'));
    const comma = result.rows.find((r) => r.originalDescription.includes('STORE NAME'));
    expect(long!.originalDescription.length).toBeGreaterThan(80);
    expect(comma!.originalDescription).toContain(',');
    expect(result.runningBalanceValidation.mismatchCount).toBe(0);
  });

  it('recovers or warns on imperfect quotation marks without silent column shift', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = parseBankOfAmericaCheckingCsv(load('malformed-quotes.csv'))!;
    const problem = result.rows.find(
      (r) =>
        r.originalDescription.toLowerCase().includes('broken') ||
        r.originalDescription.toLowerCase().includes('quote') ||
        r.recovered ||
        r.kind === 'invalid'
    );
    expect(problem).toBeTruthy();
    if (problem?.kind === 'transaction') {
      expect(problem.amountCents === 2000 || problem.recovered).toBe(true);
    }
    // Never log raw descriptions
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('warns on missing running balance without treating blank amount as zero income', () => {
    const result = parseBankOfAmericaCheckingCsv(load('missing-running-balance.csv'))!;
    const missing = result.rows.find((r) => r.originalDescription.includes('WITHOUT BALANCE'));
    expect(missing?.warnings.some((w) => /missing running balance/i.test(w))).toBe(true);
    expect(missing?.amountCents).toBe(1000);
  });

  it('reports running-balance mismatch without blocking parse', () => {
    const result = parseBankOfAmericaCheckingCsv(load('running-balance-mismatch.csv'))!;
    expect(result.runningBalanceValidation.mismatchCount).toBeGreaterThan(0);
    expect(result.runningBalanceValidation.firstMismatch).toBeDefined();
    expect(result.stats.validNormalCount).toBeGreaterThan(0);
  });

  it('reports summary reconciliation mismatch', () => {
    const result = parseBankOfAmericaCheckingCsv(load('summary-mismatch.csv'))!;
    expect(result.summaryValidation.arithmeticOk).toBe(false);
    expect(result.summaryValidation.endingMatchesLastRunning).toBe(false);
  });

  it('handles empty transaction section', () => {
    const result = parseBankOfAmericaCheckingCsv(load('empty-transactions.csv'))!;
    expect(result.stats.validNormalCount).toBe(0);
    expect(result.summary.beginningBalanceCents).toBe(10000);
  });

  it('parses overlapping duplicate export rows for later duplicate checks', () => {
    const result = parseBankOfAmericaCheckingCsv(load('overlapping-duplicate.csv'))!;
    expect(result.stats.validNormalCount).toBe(1);
    expect(result.rows.find((r) => r.kind === 'transaction')?.amountCents).toBe(2500);
  });

  it('ignores extra unknown summary rows', () => {
    const result = parseBankOfAmericaCheckingCsv(load('extra-summary-rows.csv'))!;
    expect(result.summary.endingBalanceCents).toBe(12500);
    expect(result.stats.validNormalCount).toBe(1);
  });

  it('supports CRLF line endings', () => {
    const result = parseBankOfAmericaCheckingCsv(load('crlf-line-endings.csv'))!;
    expect(result.stats.validNormalCount).toBe(2);
  });

  it('supports UTF-8 BOM', () => {
    const result = parseBankOfAmericaCheckingCsv(load('with-bom.csv'))!;
    expect(result.detection).toBeTruthy();
    expect(result.stats.validNormalCount).toBe(2);
  });

  it('redacts identifiers in diagnostics and never embeds raw sensitive text helpers incorrectly', () => {
    const redacted = redactForDiagnostics('PAYROLL CONF 12345678 for JANE DOE #9999');
    expect(redacted).not.toMatch(/12345678/);
    expect(redacted).not.toMatch(/#9999/);
    const diag = describeRowForDiagnostics({
      sourceRowIndex: 3,
      kind: 'invalid',
      error: 'bad CONF 998877',
      warningCount: 1,
    });
    expect(diag).toContain('row=3');
    expect(diag).not.toMatch(/998877/);
  });
});
