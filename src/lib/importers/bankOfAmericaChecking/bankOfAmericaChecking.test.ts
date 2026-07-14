import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import {
  parseBankOfAmericaCheckingCsv,
  detectFromText,
  BOFA_CHECKING_IMPORTER_ID,
} from './index';
import { describeRowForDiagnostics } from './privacy';
import { redactForDiagnostics } from '../../importUtils';
import { runImportPipeline } from '../pipeline/runPipeline';
import { prepareImportCommit } from '../pipeline/commit';
import { buildSanitizedDiagnostic } from '../pipeline/diagnostics';
import { dbApi } from '../../../database/db';
import { createAccount } from '../../../test/factories/modelFactories';

const FIX = resolve(__dirname, '../../../test/fixtures/csv/bankOfAmericaChecking');

function load(name: string): string {
  return readFileSync(resolve(FIX, name), 'utf8');
}

function loadExpected(name: string) {
  return JSON.parse(readFileSync(resolve(FIX, 'expected', `${name}.json`), 'utf8'));
}

type FixtureCase = {
  fixture: string;
  format: 'MM/DD/YYYY';
  headerRowIndex: number;
  summaryRowCount: number;
  validNormalCount: number;
  openingBalanceCount: number;
  invalidCount: number;
  recoveredCount: number;
  reconciliationStatus: 'ok' | 'mismatch';
};

const FIXTURE_TABLE: FixtureCase[] = [
  {
    fixture: 'standard.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 6,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 0,
    reconciliationStatus: 'ok',
  },
  {
    fixture: 'shifted-header.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 10,
    summaryRowCount: 9,
    validNormalCount: 2,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 0,
    reconciliationStatus: 'ok',
  },
  {
    fixture: 'quoted-commas.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 2,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 0,
    reconciliationStatus: 'ok',
  },
  {
    fixture: 'malformed-description-quote.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 2,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 1,
    reconciliationStatus: 'ok',
  },
  {
    fixture: 'opening-balance-only.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 0,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 0,
    reconciliationStatus: 'ok',
  },
  {
    fixture: 'missing-running-balance.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 2,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 0,
    // Missing running balance breaks the chain; follow-up row cannot reconcile silently.
    reconciliationStatus: 'mismatch',
  },
  {
    fixture: 'running-balance-mismatch.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 2,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 0,
    reconciliationStatus: 'mismatch',
  },
  {
    fixture: 'summary-mismatch.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 2,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 0,
    reconciliationStatus: 'mismatch',
  },
  {
    fixture: 'duplicate-period-a.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 4,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 0,
    reconciliationStatus: 'ok',
  },
  {
    fixture: 'duplicate-period-b.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 5,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 0,
    reconciliationStatus: 'ok',
  },
  {
    fixture: 'empty-transactions.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 0,
    openingBalanceCount: 0,
    invalidCount: 0,
    recoveredCount: 0,
    reconciliationStatus: 'ok',
  },
  {
    fixture: 'utf8-bom.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 2,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 0,
    reconciliationStatus: 'ok',
  },
  {
    fixture: 'windows-line-endings.csv',
    format: 'MM/DD/YYYY',
    headerRowIndex: 6,
    summaryRowCount: 5,
    validNormalCount: 2,
    openingBalanceCount: 1,
    invalidCount: 0,
    recoveredCount: 0,
    reconciliationStatus: 'ok',
  },
];

function reconciliationStatus(result: NonNullable<ReturnType<typeof parseBankOfAmericaCheckingCsv>>) {
  const ok =
    result.runningBalanceValidation.mismatchCount === 0 &&
    result.summaryValidation.arithmeticOk !== false &&
    result.summaryValidation.endingMatchesLastRunning !== false;
  return ok ? 'ok' : 'mismatch';
}

describe('Bank of America Checking importer (observed format)', () => {
  it.each(FIXTURE_TABLE)(
    'pipeline table: $fixture',
    ({
      fixture,
      format,
      headerRowIndex,
      summaryRowCount,
      validNormalCount,
      openingBalanceCount,
      invalidCount,
      recoveredCount,
      reconciliationStatus: expectedRecon,
    }) => {
      const text = load(fixture);
      const detection = detectFromText(text);
      expect(detection).not.toBeNull();
      expect(detection!.id).toBe(BOFA_CHECKING_IMPORTER_ID);
      expect(detection!.dateFormat).toBe(format);
      expect(detection!.amountConvention).toBe('signed');
      expect(detection!.headerRowIndex).toBe(headerRowIndex);

      const parsed = parseBankOfAmericaCheckingCsv(text)!;
      expect(parsed.stats.summaryRowCount).toBe(summaryRowCount);
      expect(parsed.stats.validNormalCount).toBe(validNormalCount);
      expect(parsed.stats.openingBalanceCount).toBe(openingBalanceCount);
      expect(parsed.stats.invalidCount).toBe(invalidCount);
      expect(parsed.stats.recoveredCount).toBe(recoveredCount);
      expect(reconciliationStatus(parsed)).toBe(expectedRecon);

      const pipeline = runImportPipeline({ text });
      expect(pipeline.importerId).toBe(BOFA_CHECKING_IMPORTER_ID);
      expect(pipeline.stages.some((s) => s.id === 'reconcile')).toBe(true);
    }
  );

  it('matches expected normalization for standard fixture', () => {
    const result = parseBankOfAmericaCheckingCsv(load('standard.csv'))!;
    const expected = loadExpected('standard');

    expect(result.summary).toEqual(expected.summary);
    expect(result.detection.headerRowIndex).toBe(expected.headerRowIndex);
    expect(result.stats.openingBalanceCount).toBe(expected.openingBalanceCount);
    expect(result.stats.validNormalCount).toBe(expected.validNormalCount);
    expect(result.stats.invalidCount).toBe(0);
    expect(reconciliationStatus(result)).toBe('ok');

    const opening = result.rows.find((r) => r.kind === 'opening_balance')!;
    expect(opening.amountCents).toBeUndefined();
    expect(opening.runningBalanceCents).toBe(100000);
    expect(opening.status).toBe('opening_balance');

    const txs = result.rows.filter((r) => r.kind === 'transaction');
    expect(txs).toHaveLength(6);
    expect(txs.map((t) => t.postedDate)).toEqual(expected.transactions.map((t: { postedDate: string }) => t.postedDate));
    expect(txs.map((t) => t.amountCents)).toEqual(expected.transactions.map((t: { amountCents: number }) => t.amountCents));
    expect(txs.map((t) => t.runningBalanceCents)).toEqual(
      expected.transactions.map((t: { runningBalanceCents: number }) => t.runningBalanceCents)
    );
    expect(txs.every((t) => t.postedDate.match(/^\d{4}-\d{2}-\d{2}$/))).toBe(true);
    expect(txs.every((t) => Number.isInteger(t.amountCents))).toBe(true);
    expect(txs.some((t) => (t.amountCents ?? 0) > 0)).toBe(true);
    expect(txs.some((t) => (t.amountCents ?? 0) < 0)).toBe(true);
  });

  it('matches expected JSON for shifted-header, quoted-commas, malformed-description-quote', () => {
    for (const name of ['shifted-header', 'quoted-commas', 'malformed-description-quote'] as const) {
      const result = parseBankOfAmericaCheckingCsv(load(`${name}.csv`))!;
      const expected = loadExpected(name);
      expect(result.detection.headerRowIndex).toBe(expected.headerRowIndex);
      expect(result.stats.summaryRowCount).toBe(expected.summaryRowCount);
      expect(result.stats.validNormalCount).toBe(expected.validNormalCount);
      expect(result.stats.openingBalanceCount).toBe(expected.openingBalanceCount);
      expect(result.stats.invalidCount).toBe(expected.invalidCount);
      expect(result.stats.recoveredCount).toBe(expected.recoveredCount);
      expect(result.summary).toEqual(expected.summary);
      expect(reconciliationStatus(result)).toBe(expected.reconciliationStatus);
    }
  });

  it('does not detect generic Date/Amount CSVs without BoA summary signals', () => {
    const generic = 'Date,Description,Amount,Running Bal.\n01/01/2026,Coffee,-4.50,100.00\n';
    expect(detectFromText(generic)).toBeNull();
  });

  it('does not identify solely from a BofA filename (structure only)', () => {
    expect(detectFromText('not,a,bank,file\n1,2,3,4\n')).toBeNull();
  });

  it('discovers header semantically when metadata shifts the table', () => {
    const result = parseBankOfAmericaCheckingCsv(load('shifted-header.csv'))!;
    expect(result.detection.headerRowIndex).toBeGreaterThan(6);
    expect(result.stats.validNormalCount).toBe(2);
  });

  it('keeps commas inside quoted descriptions and thousands separators in money', () => {
    const result = parseBankOfAmericaCheckingCsv(load('quoted-commas.csv'))!;
    const merchant = result.rows.find((r) => r.originalDescription.includes('MAIN STREET'))!;
    const store = result.rows.find((r) => r.originalDescription.includes('AISLE 3'))!;
    expect(merchant.originalDescription).toBe('EXAMPLE MERCHANT, MAIN STREET');
    expect(merchant.amountCents).toBe(200000);
    expect(store.originalDescription).toContain(',');
    expect(store.amountCents).toBe(-123456);
    expect(result.runningBalanceValidation.mismatchCount).toBe(0);
  });

  it('recovers or invalidates malformed quotes — never silent corruption', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = parseBankOfAmericaCheckingCsv(load('malformed-description-quote.csv'))!;
    const problem = result.rows.find((r) => r.recovered || r.kind === 'invalid');
    expect(problem).toBeTruthy();
    if (problem!.kind === 'transaction') {
      expect(problem!.recovered).toBe(true);
      expect(problem!.warnings.some((w) => /recovered|warning/i.test(w))).toBe(true);
      expect(problem!.amountCents).toBe(2000);
      expect(problem!.runningBalanceCents).toBe(7000);
    } else {
      expect(problem!.kind).toBe('invalid');
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('treats opening-balance marker as non-income, non-spending structural row', () => {
    const result = parseBankOfAmericaCheckingCsv(load('opening-balance-only.csv'))!;
    expect(result.stats.openingBalanceCount).toBe(1);
    expect(result.stats.validNormalCount).toBe(0);
    const opening = result.rows.find((r) => r.kind === 'opening_balance')!;
    expect(opening.amountCents).toBeUndefined();
    expect(opening.runningBalanceCents).toBe(80000);
    expect(opening.status).toBe('opening_balance');

    const preview = runImportPipeline({ text: load('opening-balance-only.csv') });
    expect(preview.parsedRows.some((r) => r.status === 'opening_balance')).toBe(true);
    expect(preview.parsedRows.filter((r) => r.isValid && r.status !== 'opening_balance')).toHaveLength(0);
  });

  it('reports exact running-balance mismatch (1 cent) without blocking review', () => {
    const result = parseBankOfAmericaCheckingCsv(load('running-balance-mismatch.csv'))!;
    expect(result.runningBalanceValidation.mismatchCount).toBe(1);
    expect(result.runningBalanceValidation.firstMismatch).toEqual({
      rowIndex: 9,
      expectedCents: 14000,
      actualCents: 14001,
      differenceCents: 1,
    });
    expect(result.stats.validNormalCount).toBe(2);
    const mismatched = result.rows.find((r) => r.sourceRowIndex === 9)!;
    expect(mismatched.kind).toBe('transaction');
    expect(mismatched.include).toBe(true);
  });

  it('distinguishes summary reconciliation from row reconciliation', () => {
    const result = parseBankOfAmericaCheckingCsv(load('summary-mismatch.csv'))!;
    expect(result.runningBalanceValidation.mismatchCount).toBe(0);
    expect(result.summaryValidation.arithmeticOk).toBe(false);
    expect(result.summaryValidation.endingMatchesLastRunning).toBe(false);
    expect(result.stats.validNormalCount).toBe(2);
  });

  it('handles overlapping exports: exact duplicates, new rows, same-day repeats', () => {
    const periodA = parseBankOfAmericaCheckingCsv(load('duplicate-period-a.csv'))!;
    const aTxs = periodA.rows.filter((r) => r.kind === 'transaction');
    expect(aTxs.filter((r) => r.originalDescription === 'EXAMPLE CAFE')).toHaveLength(2);
    expect(aTxs.filter((r) => r.postedDate === '2026-12-05')).toHaveLength(2);

    const existing = aTxs.map((r, i) => ({
      id: `a_${i}`,
      accountId: 'acc_dup',
      importId: 'imp_a',
      postedDate: r.postedDate,
      originalDescription: r.originalDescription,
      merchantName: r.originalDescription,
      amountCents: r.amountCents!,
      excludedFromReports: false,
      isTransfer: false,
      createdAt: '2026-12-10T00:00:00.000Z',
    }));

    const pipelineB = runImportPipeline({
      text: load('duplicate-period-b.csv'),
      accountId: 'acc_dup',
      existingTransactions: existing,
    });

    const statuses = pipelineB.parsedRows.map((r) => r.status);
    expect(statuses.filter((s) => s === 'exact_duplicate').length).toBeGreaterThanOrEqual(3);
    expect(statuses.filter((s) => s === 'opening_balance')).toHaveLength(1);
    expect(pipelineB.parsedRows.filter((r) => r.status === 'new' || r.status === 'recovered').length).toBeGreaterThanOrEqual(2);

    const cafes = pipelineB.parsedRows.filter(
      (r) => r.description === 'EXAMPLE CAFE' && r.status === 'exact_duplicate'
    );
    expect(cafes.length).toBe(2);
  });

  it('warns on missing running balance without treating blank amount as zero income', () => {
    const result = parseBankOfAmericaCheckingCsv(load('missing-running-balance.csv'))!;
    const missing = result.rows.find((r) => r.originalDescription.includes('WITHOUT BALANCE'));
    expect(missing?.warnings.some((w) => /missing running balance/i.test(w))).toBe(true);
    expect(missing?.amountCents).toBe(1000);
  });
});

describe('Bank of America Checking privacy', () => {
  const FORBIDDEN_FIXTURE_SUBSTRINGS = [
    // Guardrail: never commit strings that look like real uploaded bank export content.
    'STARBUCKS',
    'WHOLE FOODS',
    'JANE DOE',
    'JOHN DOE',
    'SSN',
    'xxxx',
    '****',
  ];

  it('fixtures stay fictional and omit forbidden real-looking strings', () => {
    const files = readdirSync(FIX).filter((f) => f.endsWith('.csv'));
    for (const file of files) {
      const text = load(file);
      for (const bad of FORBIDDEN_FIXTURE_SUBSTRINGS) {
        expect(text.toUpperCase()).not.toContain(bad);
      }
      const merchants = text
        .split(/\r?\n/)
        .filter((line) => /^\d{2}\/\d{2}\/\d{4},/.test(line))
        .map((line) => line.slice(11));
      for (const m of merchants) {
        if (/beginning balance as of/i.test(m)) continue;
        expect(m.toUpperCase()).toMatch(/EXAMPLE|BOM |CRLF /);
      }
    }
  });

  it('does not write raw descriptions to console on successful import parse', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    parseBankOfAmericaCheckingCsv(load('standard.csv'));
    runImportPipeline({ text: load('standard.csv') });
    for (const spy of [log, info, warn]) {
      for (const call of spy.mock.calls) {
        const joined = call.map(String).join(' ');
        expect(joined).not.toMatch(/EXAMPLE EMPLOYER PAYROLL|EXAMPLE GROCERY STORE/);
      }
    }
    log.mockRestore();
    info.mockRestore();
    warn.mockRestore();
  });

  it('keeps raw descriptions out of sanitized diagnostics and redacts long IDs', () => {
    const result = runImportPipeline({ text: load('standard.csv') });
    const d = buildSanitizedDiagnostic(result);
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/EXAMPLE EMPLOYER PAYROLL|EXAMPLE GROCERY STORE/i);
    expect(d.headerNames.join('')).not.toMatch(/Date|Description|Amount/i);

    const redacted = redactForDiagnostics('PAYROLL CONF 12345678 for EXAMPLE PERSON #9999');
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

  it('does not retain source CSV rows unless retainRawRows is enabled', async () => {
    await dbApi.clearAll();
    const account = createAccount({ id: 'acc_privacy' });
    await dbApi.putAccount(account);

    const pipeline = runImportPipeline({ text: load('standard.csv') });
    const without = prepareImportCommit({
      importId: 'imp_no_raw',
      accountId: account.id,
      fileName: 'standard.csv',
      importDate: '2026-07-14',
      parsedRows: pipeline.parsedRows,
      openingBalanceAction: 'ignore',
      includePossibleDuplicates: false,
      createBalanceSnapshots: false,
      rules: [],
      retainRawRows: false,
    });
    expect(without.rawRows).toBeUndefined();
    await dbApi.commitImportBatch(without);
    expect(await dbApi.getImportRawRows('imp_no_raw')).toBeUndefined();

    const withRaw = prepareImportCommit({
      importId: 'imp_with_raw',
      accountId: account.id,
      fileName: 'standard.csv',
      importDate: '2026-07-14',
      parsedRows: pipeline.parsedRows,
      openingBalanceAction: 'ignore',
      includePossibleDuplicates: false,
      createBalanceSnapshots: false,
      rules: [],
      retainRawRows: true,
    });
    expect(withRaw.rawRows).toBeDefined();
    await dbApi.commitImportBatch(withRaw);
    const stored = await dbApi.getImportRawRows('imp_with_raw');
    expect(stored).toBeDefined();
  });
});

describe('Bank of America Checking import integration', () => {
  beforeEach(async () => {
    await dbApi.clearAll();
  });

  it('create account → preview → snapshot opening balance → import → verify → undo', async () => {
    const account = createAccount({
      id: 'acc_bofa_int',
      name: 'Example Checking',
      type: 'Checking',
      institution: 'Example Bank',
    });
    await dbApi.putAccount(account);

    const text = load('standard.csv');
    const detection = detectFromText(text);
    expect(detection?.id).toBe(BOFA_CHECKING_IMPORTER_ID);

    const pipeline = runImportPipeline({ text, accountId: account.id, existingTransactions: [] });
    expect(pipeline.importerId).toBe(BOFA_CHECKING_IMPORTER_ID);
    expect(pipeline.summary?.beginningBalanceCents).toBe(100000);
    expect(pipeline.summary?.endingBalanceCents).toBe(290000);

    const previewTxs = pipeline.parsedRows.filter(
      (r) => r.isValid && r.status !== 'opening_balance' && r.status !== 'summary_metadata'
    );
    expect(previewTxs).toHaveLength(6);
    expect(pipeline.parsedRows.some((r) => r.status === 'opening_balance')).toBe(true);

    const incomeCents = previewTxs.filter((r) => r.amountCents > 0).reduce((s, r) => s + r.amountCents, 0);
    const spendingCents = previewTxs.filter((r) => r.amountCents < 0).reduce((s, r) => s + r.amountCents, 0);
    expect(incomeCents).toBe(250000);
    expect(spendingCents).toBe(-60000);

    const importId = 'imp_bofa_standard';
    const payload = prepareImportCommit({
      importId,
      accountId: account.id,
      fileName: 'standard.csv',
      importDate: '2026-07-14',
      parsedRows: pipeline.parsedRows,
      openingBalanceAction: 'snapshot',
      includePossibleDuplicates: false,
      createBalanceSnapshots: true,
      rules: [],
      importerId: BOFA_CHECKING_IMPORTER_ID,
      statementSummary: pipeline.summary,
      retainRawRows: false,
    });

    expect(payload.stats.normalImported).toBe(6);
    expect(payload.stats.snapshotsCreated).toBe(1);
    expect(payload.transactions.every((t) => !/beginning balance/i.test(t.originalDescription))).toBe(true);

    await dbApi.commitImportBatch(payload);

    const txs = await dbApi.getTransactions();
    const snaps = await dbApi.getBalanceSnapshots();
    expect(txs).toHaveLength(6);
    expect(txs.reduce((s, t) => s + (t.amountCents > 0 ? t.amountCents : 0), 0)).toBe(250000);
    expect(txs.reduce((s, t) => s + (t.amountCents < 0 ? t.amountCents : 0), 0)).toBe(-60000);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].balanceCents).toBe(100000);
    expect(snaps[0].importId).toBe(importId);
    expect(await dbApi.getImportRawRows(importId)).toBeUndefined();

    await dbApi.undoImportBatch(importId);
    expect(await dbApi.getTransactions()).toHaveLength(0);
    expect(await dbApi.getBalanceSnapshots()).toHaveLength(0);
    expect((await dbApi.getImports()).find((i) => i.id === importId)).toBeUndefined();
  });
});
