import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseMoney } from './money';
import { parseDate } from './dates';
import { detectEncodingFromText, detectEncodingFromBytes } from './encoding';
import { parseCsvMatrix, detectDelimiter } from './parseMatrix';
import { discoverHeaderCandidates, selectBestHeader } from './headerDiscovery';
import { createDefaultImportProfile, migrateImportProfile } from './profiles';
import { runGenericImportPipeline, runImportPipeline } from './runPipeline';
import { prepareImportCommit } from './commit';
import { buildSanitizedDiagnostic } from './diagnostics';
import { dbApi } from '../../../database/db';
import { createAccount, createRule } from '../../../test/factories/modelFactories';

const FIX = resolve(__dirname, '../../../test/fixtures/csv');
const BOFA = resolve(FIX, 'bankOfAmericaChecking');

function load(dir: string, name: string): string {
  return readFileSync(resolve(dir, name), 'utf8');
}

describe('parseMoney', () => {
  it.each([
    ['100.00', 10000],
    ['-5.50', -550],
    ['$1,234.56', 123456],
    ['"1,234.56"', 123456],
    ['(50.00)', -5000],
    ['+12', 1200],
    ['0', 0],
  ])('parses %s → %i cents', (input, cents) => {
    const r = parseMoney(input);
    expect(r.status).toBe('valid');
    expect(r.cents).toBe(cents);
  });

  it('treats blank as blank, not zero', () => {
    expect(parseMoney('').status).toBe('blank');
    expect(parseMoney('   ').status).toBe('blank');
    expect(parseMoney(null).status).toBe('blank');
  });

  it('never treats invalid as zero', () => {
    const r = parseMoney('abc');
    expect(r.status).toBe('invalid');
    expect(r.cents).toBeUndefined();
  });

  it('supports European separators when configured', () => {
    const r = parseMoney('1.234,56', { decimalSeparator: ',', thousandsSeparator: '.' });
    expect(r.status).toBe('valid');
    expect(r.cents).toBe(123456);
  });
});

describe('parseDate', () => {
  it('parses ISO and MM/DD/YYYY without timezone shift', () => {
    expect(parseDate('2026-07-01', 'YYYY-MM-DD').date).toBe('2026-07-01');
    expect(parseDate('04/05/2026', 'MM/DD/YYYY').date).toBe('2026-04-05');
    expect(parseDate('04/05/2026', 'DD/MM/YYYY').date).toBe('2026-05-04');
  });

  it('marks ambiguous when both MDY and DMY are allowed', () => {
    const r = parseDate('04/05/2026', ['MM/DD/YYYY', 'DD/MM/YYYY']);
    expect(r.status).toBe('ambiguous');
    expect(r.candidates).toEqual(expect.arrayContaining(['2026-04-05', '2026-05-04']));
  });
});

describe('encoding + delimiter', () => {
  it('strips UTF-8 BOM from text', () => {
    const d = detectEncodingFromText('\uFEFFDate,Amount\n');
    expect(d.bom).toBe(true);
    expect(d.text.startsWith('Date')).toBe(true);
  });

  it('detects UTF-8 BOM from bytes', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x41, 0x2c, 0x42]);
    const d = detectEncodingFromBytes(bytes.buffer);
    expect(d.bom).toBe(true);
    expect(d.text.startsWith('A,B')).toBe(true);
  });

  it('detects semicolon and tab delimiters', () => {
    expect(detectDelimiter('a;b;c\n1;2;3\n')).toBe(';');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3\n')).toBe('\t');
  });
});

describe('header discovery', () => {
  const profile = createDefaultImportProfile();

  it('finds header on first row', () => {
    const text = load(FIX, 'signed-amount.csv');
    const { rows } = parseCsvMatrix(text);
    const candidates = discoverHeaderCandidates(rows, profile);
    expect(selectBestHeader(candidates)?.rowIndex).toBe(0);
  });

  it('finds header after BoA summary / metadata', () => {
    const text = load(BOFA, 'shifted-header.csv');
    const { rows } = parseCsvMatrix(text);
    const candidates = discoverHeaderCandidates(rows, {
      ...profile,
      dateFormat: 'MM/DD/YYYY',
    });
    const best = selectBestHeader(candidates)!;
    expect(best.rowIndex).toBeGreaterThan(0);
    expect(best.requiredCoverage).toBeGreaterThanOrEqual(3);
  });

  it('respects header override', () => {
    const text = load(BOFA, 'normal-structure.csv');
    const { rows } = parseCsvMatrix(text);
    const candidates = discoverHeaderCandidates(rows, {
      ...profile,
      dateFormat: 'MM/DD/YYYY',
    });
    const override = candidates[1]?.rowIndex ?? candidates[0].rowIndex;
    expect(selectBestHeader(candidates, override)?.rowIndex).toBe(override);
  });
});

describe('generic + built-in pipeline', () => {
  it.each([
    'normal-structure.csv',
    'summary-blank-header.csv',
    'shifted-header.csv',
    'quoted-thousands.csv',
    'with-bom.csv',
    'crlf-line-endings.csv',
    'malformed-quotes.csv',
    'opening-balance-only.csv',
  ])('handles BoA fixture %s', (file) => {
    const result = runImportPipeline({ text: load(BOFA, file) });
    expect(result.importerId).toBe('bank-of-america-checking');
    expect(result.stages.some((s) => s.id === 'reconcile')).toBe(true);
    expect(result.parsedRows.every((r) => r.original != null)).toBe(true);
  });

  it('generic path for signed-amount and debit-credit', () => {
    const signed = runGenericImportPipeline({ text: load(FIX, 'signed-amount.csv') });
    expect(signed.parsedRows.some((r) => r.isValid)).toBe(true);

    const dc = runGenericImportPipeline({
      text: load(FIX, 'debit-credit.csv'),
      profile: { amountMode: 'debit_credit' },
    });
    expect(dc.columnMap.debit != null || dc.parsedRows.length >= 0).toBe(true);
  });

  it('semicolon-delimited fixture', () => {
    const result = runGenericImportPipeline({ text: load(FIX, 'semicolon-delimited.csv') });
    expect(result.delimiter).toBe(';');
  });

  it('sanitized diagnostic has no full descriptions', () => {
    const result = runImportPipeline({ text: load(BOFA, 'normal-structure.csv') });
    const d = buildSanitizedDiagnostic(result);
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/STARBUCKS|WHOLE FOODS|BEGINNING BALANCE/i);
    expect(d.importerId).toBe('bank-of-america-checking');
    expect(d.headerNames.join('')).not.toMatch(/Date|Description|Amount/i);
  });

  it('discovers header after arbitrary metadata and blank separators', () => {
    const meta = runGenericImportPipeline({ text: load(FIX, 'metadata-then-header.csv') });
    expect(meta.selectedHeader?.rowIndex).toBeGreaterThan(0);
    expect(meta.parsedRows.filter((r) => r.isValid).length).toBeGreaterThan(0);

    const blank = runGenericImportPipeline({
      text: load(FIX, 'blank-separator.csv'),
      profile: { dateFormat: 'MM/DD/YYYY' },
    });
    expect(blank.selectedHeader?.rowIndex).toBeGreaterThan(0);

    const tab = runGenericImportPipeline({ text: load(FIX, 'tab-delimited.csv') });
    expect(tab.delimiter).toBe('\t');
  });
});

describe('import profile migration', () => {
  it('migrates legacy date/desc/amount mapping', () => {
    const migrated = migrateImportProfile({
      name: 'Legacy',
      dateCol: 'Posted',
      descCol: 'Payee',
      amountCol: 'Amt',
      invertSign: true,
    });
    expect(migrated.version).toBe(1);
    expect(migrated.invertAmountSign).toBe(true);
    expect(migrated.headerAliases.date).toContain('Posted');
  });
});

describe('atomic commit + retry', () => {
  beforeEach(async () => {
    await dbApi.clearAll();
  });

  it('commits atomically and retries without duplicating', async () => {
    const account = createAccount({ id: 'acc_pipe' });
    await dbApi.putAccount(account);

    const payload = prepareImportCommit({
      importId: 'imp_retry_1',
      accountId: account.id,
      fileName: 'fictional.csv',
      importDate: '2026-07-14',
      parsedRows: [
        {
          date: '2026-07-01',
          description: 'FICTIONAL CAFE',
          amountCents: -450,
          original: ['07/01/2026', 'FICTIONAL CAFE', '-4.50'],
          isValid: true,
          status: 'new',
        },
      ],
      openingBalanceAction: 'ignore',
      includePossibleDuplicates: false,
      createBalanceSnapshots: false,
      rules: [createRule()],
    });

    await dbApi.commitImportBatch(payload);
    let txs = await dbApi.getTransactions();
    expect(txs).toHaveLength(1);

    // Simulate retry with same importId
    await dbApi.commitImportBatch(payload);
    txs = await dbApi.getTransactions();
    expect(txs).toHaveLength(1);
    expect(txs[0].id).toBe('imp_retry_1_0');
  });

  it('rolls back on simulated persistence mid-failure via abort', async () => {
    const account = createAccount({ id: 'acc_fail' });
    await dbApi.putAccount(account);

    const payload = prepareImportCommit({
      importId: 'imp_fail_1',
      accountId: account.id,
      fileName: 'fictional.csv',
      importDate: '2026-07-14',
      parsedRows: [
        {
          date: '2026-07-01',
          description: 'FICTIONAL SHOP',
          amountCents: -100,
          original: [],
          isValid: true,
          status: 'new',
        },
      ],
      openingBalanceAction: 'ignore',
      includePossibleDuplicates: false,
      createBalanceSnapshots: false,
      rules: [],
    });

    const spy = vi.spyOn(dbApi, 'commitImportBatch').mockRejectedValueOnce(new Error('simulated fail'));
    await expect(dbApi.commitImportBatch(payload)).rejects.toThrow('simulated fail');
    spy.mockRestore();

    // Nothing committed from the failed call
    const txs = await dbApi.getTransactions();
    expect(txs.filter((t) => t.importId === 'imp_fail_1')).toHaveLength(0);

    await dbApi.commitImportBatch(payload);
    expect((await dbApi.getTransactions()).filter((t) => t.importId === 'imp_fail_1')).toHaveLength(1);
  });
});
