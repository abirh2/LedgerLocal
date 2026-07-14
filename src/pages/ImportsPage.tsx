import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertCircle, HelpCircle, Undo2 } from 'lucide-react';
import { dbApi } from '../database/db';
import { format } from 'date-fns';
import { PageHeader } from '../components/layout/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { processTransactionWithRules } from '../lib/ruleEngine';
import { normalizeMerchantName } from '../lib/merchantManager';
import { BalanceSnapshot, ImportRecord, Transaction } from '../models/types';
import {
  findExactDuplicate,
  findPossibleDuplicate,
  ParsedRow,
  processCsvData,
  truncateDescription,
} from '../lib/importUtils';
import { detectBuiltInImporter } from '../lib/importers/registry';
import type { BofAParseResult, BofANormalizedRow } from '../lib/importers/bankOfAmericaChecking';
import { formatCurrency } from '../lib/utils';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'success';
type OpeningBalanceAction = 'snapshot' | 'ignore' | 'validate_only';

interface ImportsPageProps {
  onNavigate: (view: string) => void;
}

interface ImportCompletionStats {
  normalImported: number;
  snapshotsCreated: number;
  exactDuplicatesSkipped: number;
  possibleDuplicatesIncluded: number;
  possibleDuplicatesExcluded: number;
  invalidExcluded: number;
  recoveredImported: number;
  runningBalanceMismatches: number;
  endingBalanceCents?: number;
  dateRange?: { start: string; end: string };
  importId: string;
}

function statusLabel(status: string | undefined): string {
  switch (status) {
    case 'exact_duplicate':
      return 'Exact duplicate';
    case 'possible_duplicate':
      return 'Possible duplicate';
    case 'invalid':
      return 'Invalid';
    case 'recovered':
      return 'Recovered with warning';
    case 'opening_balance':
      return 'Opening balance';
    case 'summary_metadata':
      return 'Summary metadata';
    default:
      return 'New transaction';
  }
}

export function ImportsPage({ onNavigate }: ImportsPageProps) {
  const { accounts, rules, transactions, refreshData } = useStore();
  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [useCustomMapping, setUseCustomMapping] = useState(false);

  const [dateCol, setDateCol] = useState('');
  const [descCol, setDescCol] = useState('');
  const [amountCol, setAmountCol] = useState('');

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [bofaResult, setBofaResult] = useState<BofAParseResult | null>(null);
  const [detectedFormatNote, setDetectedFormatNote] = useState<string | null>(null);
  const [openingBalanceAction, setOpeningBalanceAction] =
    useState<OpeningBalanceAction>('snapshot');
  const [includePossibleDuplicates, setIncludePossibleDuplicates] = useState(false);
  const [completion, setCompletion] = useState<ImportCompletionStats | null>(null);

  const [errorDialog, setErrorDialog] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: '',
  });

  const resetUpload = () => {
    setFileName('');
    setCsvText('');
    setRawData([]);
    setParsedRows([]);
    setBofaResult(null);
    setDetectedFormatNote(null);
    setUseCustomMapping(false);
    setCompletion(null);
    setStep('upload');
  };

  const applyDuplicateFlags = (rows: ParsedRow[], accountId: string): ParsedRow[] => {
    if (!accountId) return rows;
    return rows.map((row) => {
      if (!row.isValid || row.status === 'opening_balance' || row.status === 'summary_metadata') {
        return row;
      }
      if (findExactDuplicate(row, transactions, accountId)) {
        return { ...row, status: 'exact_duplicate' as const };
      }
      if (findPossibleDuplicate(row, transactions, accountId)) {
        return { ...row, status: 'possible_duplicate' as const };
      }
      return row;
    });
  };

  const bofaRowsToParsed = (result: BofAParseResult, accountId: string): ParsedRow[] => {
    const rows: ParsedRow[] = result.rows
      .filter((r) => r.kind !== 'skipped')
      .map((r: BofANormalizedRow) => {
        const base: ParsedRow = {
          date: r.postedDate,
          description: r.originalDescription,
          amountCents: r.amountCents ?? 0,
          original: r.rawCells,
          isValid: r.kind === 'opening_balance' ? !!r.postedDate && r.runningBalanceCents != null : r.include,
          error: r.error,
          runningBalanceCents: r.runningBalanceCents,
          status: r.status,
          warnings: r.warnings,
        };
        return base;
      });
    return applyDuplicateFlags(rows, accountId);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setCsvText(text);

      const detected = detectBuiltInImporter(text);
      if (detected && !useCustomMapping) {
        const parsed = detected.importer.parse(text);
        if (parsed) {
          setBofaResult(parsed);
          setDetectedFormatNote(detected.importer.formatNote);
          setParsedRows(bofaRowsToParsed(parsed, selectedAccountId));
          setStep('mapping');
          return;
        }
      }

      setBofaResult(null);
      setDetectedFormatNote(null);
      Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setRawData(results.data);
          const fields = results.meta.fields || [];
          const guessField = (keywords: string[]) =>
            fields.find((f) => keywords.some((k) => f.toLowerCase().includes(k))) || '';
          setDateCol(guessField(['date', 'posted']));
          setDescCol(guessField(['description', 'payee', 'merchant', 'name']));
          setAmountCol(guessField(['amount', 'value']));
          setStep('mapping');
        },
      });
    };
    reader.readAsText(file);
  };

  const processMapping = () => {
    if (bofaResult && !useCustomMapping) {
      setParsedRows(bofaRowsToParsed(bofaResult, selectedAccountId));
      setStep('preview');
      return;
    }
    const rows = applyDuplicateFlags(
      processCsvData(rawData, { dateCol, descCol, amountCol }),
      selectedAccountId
    );
    setParsedRows(rows);
    setStep('preview');
  };

  const confirmImport = async () => {
    if (!selectedAccountId) {
      setErrorDialog({ isOpen: true, message: 'Please select a destination account.' });
      return;
    }

    const importId = `imp_${Date.now()}`;
    const now = new Date().toISOString();
    const snapshotIds: string[] = [];
    let snapshotsCreated = 0;
    let exactDuplicatesSkipped = 0;
    let possibleDuplicatesIncluded = 0;
    let possibleDuplicatesExcluded = 0;
    let invalidExcluded = 0;
    let recoveredImported = 0;
    let normalImported = 0;

    const newTx: Transaction[] = [];
    const snapshots: BalanceSnapshot[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const r = parsedRows[i];

      if (r.status === 'opening_balance') {
        if (openingBalanceAction === 'snapshot' && r.runningBalanceCents != null && r.date) {
          const id = `bs_${importId}_${i}`;
          snapshotIds.push(id);
          snapshots.push({
            id,
            accountId: selectedAccountId,
            date: r.date,
            balanceCents: r.runningBalanceCents,
            note: 'Opening balance from import',
            importId,
            createdAt: now,
          });
          snapshotsCreated++;
        }
        continue;
      }

      if (r.status === 'summary_metadata') continue;

      if (!r.isValid || r.status === 'invalid') {
        invalidExcluded++;
        continue;
      }

      if (r.status === 'exact_duplicate') {
        exactDuplicatesSkipped++;
        continue;
      }

      if (r.status === 'possible_duplicate' && !includePossibleDuplicates) {
        possibleDuplicatesExcluded++;
        continue;
      }
      if (r.status === 'possible_duplicate' && includePossibleDuplicates) {
        possibleDuplicatesIncluded++;
      }

      if (r.status === 'recovered') recoveredImported++;

      const initialTx: Transaction = {
        id: `${importId}_${i}`,
        accountId: selectedAccountId,
        importId,
        postedDate: r.date,
        originalDescription: r.description,
        merchantName: normalizeMerchantName(r.description),
        amountCents: r.amountCents,
        excludedFromReports: false,
        isTransfer: false,
        createdAt: now,
      };
      const { transaction } = processTransactionWithRules(initialTx, rules);
      newTx.push(transaction);
      normalImported++;
    }

    if (newTx.length) await dbApi.putTransactions(newTx);
    if (snapshots.length) await dbApi.putBalanceSnapshots(snapshots);

    const dates = newTx.map((t) => t.postedDate).sort();
    const record: ImportRecord = {
      id: importId,
      accountId: selectedAccountId,
      fileName,
      importDate: format(new Date(), 'yyyy-MM-dd'),
      startDate: dates[0] ?? bofaResult?.stats.dateRange?.start,
      endDate: dates[dates.length - 1] ?? bofaResult?.stats.dateRange?.end,
      rowsProcessed: parsedRows.length,
      rowsInserted: normalImported,
      duplicatesSkipped: exactDuplicatesSkipped + possibleDuplicatesExcluded,
      invalidRows: invalidExcluded,
      importerId: bofaResult?.detection.id,
      statementSummary: bofaResult?.summary,
      snapshotIds,
    };
    await dbApi.putImport(record);

    const acc = accounts.find((a) => a.id === selectedAccountId);
    if (acc) {
      acc.lastImportedDate = format(new Date(), 'yyyy-MM-dd');
      await dbApi.putAccount(acc);
    }

    await refreshData();

    setCompletion({
      normalImported,
      snapshotsCreated,
      exactDuplicatesSkipped,
      possibleDuplicatesIncluded,
      possibleDuplicatesExcluded,
      invalidExcluded,
      recoveredImported,
      runningBalanceMismatches: bofaResult?.runningBalanceValidation.mismatchCount ?? 0,
      endingBalanceCents: bofaResult?.summary.endingBalanceCents,
      dateRange: record.startDate && record.endDate
        ? { start: record.startDate, end: record.endDate }
        : undefined,
      importId,
    });
    setStep('success');
  };

  const undoLastImport = async () => {
    if (!completion?.importId) return;
    await dbApi.undoImportBatch(completion.importId);
    await refreshData();
    resetUpload();
  };

  const isBofaFlow = !!bofaResult && !useCustomMapping;

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      <PageHeader title="Import Transactions">
        <div className="flex items-center gap-1.5 ml-4">
          <div
            className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
              step === 'upload' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            1. Upload
          </div>
          <div className="w-4 h-[1px] bg-outline-variant"></div>
          <div
            className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
              step === 'mapping' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            2. Map
          </div>
          <div className="w-4 h-[1px] bg-outline-variant"></div>
          <div
            className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
              step === 'preview' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            3. Review
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto pb-8">
        {step === 'upload' && (
          <div
            className="card-raised rounded-xl p-16 flex flex-col items-center justify-center border-dashed border-2 border-outline-variant hover:border-primary hover:bg-surface-container-low transition-colors text-center space-y-4 cursor-pointer"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const droppedFile = e.dataTransfer.files[0];
              if (droppedFile) {
                handleFileUpload({ target: { files: [droppedFile] } } as React.ChangeEvent<HTMLInputElement>);
              }
            }}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center text-on-surface-variant mb-2">
              <UploadCloud size={32} />
            </div>
            <h3 className="text-lg font-bold text-on-surface">Drag & drop your CSV file here</h3>
            <p className="text-sm text-on-surface-variant max-w-sm">
              We support standard bank exports and an observed Bank of America checking format.
              <br />
              <span className="font-semibold flex items-center justify-center gap-1 mt-2">
                Processed locally. Never leaves your device.
              </span>
            </p>
            <input
              id="file-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {step === 'mapping' && (
          <div className="card-raised rounded-xl p-8 space-y-8">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wide">
                Destination Account
              </label>
              <select
                id="import-account"
                className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-md p-2.5 text-sm shadow-sm"
                value={selectedAccountId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedAccountId(id);
                  if (bofaResult && !useCustomMapping) {
                    setParsedRows(bofaRowsToParsed(bofaResult, id));
                  }
                }}
              >
                <option value="">Select an account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {bofaResult && (
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4 space-y-2">
                <div className="text-sm font-bold text-on-surface">
                  Detected: {bofaResult.detection.displayName}
                </div>
                <p className="text-xs text-on-surface-variant">{detectedFormatNote}</p>
                <p className="text-xs text-on-surface-variant">
                  Confidence {(bofaResult.detection.confidence * 100).toFixed(0)}% · Header row{' '}
                  {bofaResult.detection.headerRowIndex + 1} ·{' '}
                  {bofaResult.detection.dateFormat} · signed amounts
                </p>
                <label className="flex items-center gap-2 text-sm text-on-surface mt-2">
                  <input
                    type="checkbox"
                    checked={useCustomMapping}
                    onChange={(e) => {
                      const custom = e.target.checked;
                      setUseCustomMapping(custom);
                      if (custom && csvText) {
                        Papa.parse<Record<string, unknown>>(csvText, {
                          header: true,
                          skipEmptyLines: true,
                          complete: (results) => {
                            setRawData(results.data);
                            const fields = results.meta.fields || [];
                            const guessField = (keywords: string[]) =>
                              fields.find((f) =>
                                keywords.some((k) => f.toLowerCase().includes(k))
                              ) || '';
                            setDateCol(guessField(['date', 'posted']));
                            setDescCol(guessField(['description', 'payee', 'merchant', 'name']));
                            setAmountCol(guessField(['amount', 'value', 'running']));
                          },
                        });
                      }
                    }}
                  />
                  Use custom column mapping instead
                </label>
              </div>
            )}

            <hr className="border-surface-variant" />

            {(!isBofaFlow || useCustomMapping) && (
              <div>
                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                  <h3 className="text-base font-bold text-on-surface">Map Columns</h3>
                  <button
                    onClick={() => {
                      sessionStorage.setItem('guide_section_anchor', 'understand-mapping');
                      onNavigate('guide');
                    }}
                    className="px-2.5 py-1 text-xs text-on-surface-variant hover:text-on-surface bg-surface hover:bg-surface-container rounded-md flex items-center gap-1.5 transition-all border border-outline-variant font-semibold"
                    title="View column mapping details"
                  >
                    <HelpCircle size={13} />
                    <span>Mapping Guide</span>
                  </button>
                </div>
                <p className="text-sm text-on-surface-variant mb-6">
                  We found {rawData.length} rows. Match your CSV columns to LedgerLocal fields.
                </p>

                <div className="space-y-4 max-w-xl">
                  {(['Date', 'Description', 'Amount'] as const).map((field) => {
                    const csvFields = Object.keys(rawData[0] || {});
                    const val = field === 'Date' ? dateCol : field === 'Description' ? descCol : amountCol;
                    const setVal =
                      field === 'Date' ? setDateCol : field === 'Description' ? setDescCol : setAmountCol;

                    return (
                      <div
                        key={field}
                        className="flex items-center gap-6 p-4 rounded-lg border border-outline-variant bg-surface-container-low"
                      >
                        <div className="w-32 text-sm font-semibold text-on-surface">
                          {field} <span className="text-error">*</span>
                        </div>
                        <select
                          id={`map-${field.toLowerCase()}`}
                          className="flex-1 bg-surface-bright border border-outline-variant rounded p-2 text-sm shadow-sm"
                          value={val}
                          onChange={(e) => setVal(e.target.value)}
                        >
                          <option value="">-- Select Column --</option>
                          {csvFields.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isBofaFlow && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-on-surface">Opening balance rows</h3>
                <p className="text-sm text-on-surface-variant">
                  Rows labeled “Beginning balance as of…” with a blank amount are not income or spending.
                </p>
                <div className="space-y-2 text-sm">
                  {(
                    [
                      ['snapshot', 'Import as balance snapshot'],
                      ['ignore', 'Ignore'],
                      ['validate_only', 'Use only to validate the imported period'],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="opening-balance-action"
                        checked={openingBalanceAction === value}
                        onChange={() => setOpeningBalanceAction(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-6 border-t border-surface-variant">
              <button
                onClick={resetUpload}
                className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
              >
                Back
              </button>
              <button
                onClick={processMapping}
                disabled={
                  !selectedAccountId ||
                  (!isBofaFlow && (!dateCol || !descCol || !amountCol))
                }
                className="btn-physical px-6 py-2 rounded-lg text-primary text-sm font-bold disabled:opacity-50"
              >
                Preview Data
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="card-raised flex flex-col h-[640px] overflow-hidden">
            <div className="p-6 border-b border-surface-variant shrink-0 space-y-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base font-bold text-on-surface">Review Import</h3>
                  </div>
                  <p className="text-sm text-on-surface-variant mt-1">
                    {parsedRows.filter((r) => r.isValid && r.status !== 'exact_duplicate' && r.status !== 'opening_balance').length}{' '}
                    ready · {parsedRows.filter((r) => r.status === 'invalid' || !r.isValid).length}{' '}
                    issues
                  </p>
                </div>
                <div className="flex gap-4 items-center">
                  <button
                    onClick={() => setStep('mapping')}
                    className="text-sm font-semibold text-on-surface-variant hover:text-on-surface"
                  >
                    Back
                  </button>
                  <button
                    onClick={confirmImport}
                    className="btn-physical px-6 py-2 rounded-lg text-primary text-sm font-bold"
                  >
                    Import
                  </button>
                </div>
              </div>

              {bofaResult && isBofaFlow && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-on-surface-variant">
                  <div>Format: {bofaResult.detection.displayName}</div>
                  <div>Header row: {bofaResult.detection.headerRowIndex + 1}</div>
                  <div>Summary rows: {bofaResult.stats.summaryRowCount}</div>
                  <div>Tx rows: {bofaResult.stats.transactionRowCount}</div>
                  <div>
                    Date range:{' '}
                    {bofaResult.stats.dateRange
                      ? `${bofaResult.stats.dateRange.start} → ${bofaResult.stats.dateRange.end}`
                      : '—'}
                  </div>
                  <div>
                    Beginning:{' '}
                    {bofaResult.summary.beginningBalanceCents != null
                      ? formatCurrency(bofaResult.summary.beginningBalanceCents)
                      : '—'}
                  </div>
                  <div>
                    Ending:{' '}
                    {bofaResult.summary.endingBalanceCents != null
                      ? formatCurrency(bofaResult.summary.endingBalanceCents)
                      : '—'}
                  </div>
                  <div>
                    Credits:{' '}
                    {bofaResult.summary.totalCreditsCents != null
                      ? formatCurrency(bofaResult.summary.totalCreditsCents)
                      : '—'}
                  </div>
                  <div>
                    Debits:{' '}
                    {bofaResult.summary.totalDebitsCents != null
                      ? formatCurrency(bofaResult.summary.totalDebitsCents)
                      : '—'}
                  </div>
                  <div>Opening markers: {bofaResult.stats.openingBalanceCount}</div>
                  <div>Valid normal: {bofaResult.stats.validNormalCount}</div>
                  <div>Invalid: {bofaResult.stats.invalidCount}</div>
                  <div>Recovered: {bofaResult.stats.recoveredCount}</div>
                  <div>
                    Running bal:{' '}
                    {bofaResult.runningBalanceValidation.mismatchCount === 0
                      ? `OK (${bofaResult.runningBalanceValidation.rowsReconciled}/${bofaResult.runningBalanceValidation.rowsChecked})`
                      : `${bofaResult.runningBalanceValidation.mismatchCount} mismatch(es)`}
                  </div>
                  <div>
                    Summary math:{' '}
                    {bofaResult.summaryValidation.arithmeticOk == null
                      ? '—'
                      : bofaResult.summaryValidation.arithmeticOk
                        ? 'OK'
                        : 'Mismatch'}
                  </div>
                  <div>
                    End vs last run:{' '}
                    {bofaResult.summaryValidation.endingMatchesLastRunning == null
                      ? '—'
                      : bofaResult.summaryValidation.endingMatchesLastRunning
                        ? 'OK'
                        : 'Mismatch'}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-on-surface">
                <input
                  type="checkbox"
                  checked={includePossibleDuplicates}
                  onChange={(e) => setIncludePossibleDuplicates(e.target.checked)}
                />
                Include possible duplicates
              </label>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-surface-container-low sticky top-0 shadow-[0_1px_0_var(--color-surface-container)] z-10">
                  <tr className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {parsedRows.map((row, i) => (
                    <tr
                      key={i}
                      className={`h-10 ${
                        row.status === 'invalid' || !row.isValid
                          ? 'bg-error-container/10'
                          : 'hover:bg-surface-container-low'
                      }`}
                    >
                      <td className="py-2 px-4 text-xs whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {row.status === 'invalid' || !row.isValid ? (
                            <AlertCircle size={14} className="text-error" title={row.error} />
                          ) : (
                            <CheckCircle2 size={14} className="text-primary" />
                          )}
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="py-2 px-4 tabular-nums text-on-surface-variant">
                        {row.date || '—'}
                      </td>
                      <td className="py-2 px-4 font-medium truncate max-w-sm">
                        {truncateDescription(row.description, 72)}
                      </td>
                      <td
                        className={`py-2 px-4 text-right tabular-nums ${
                          row.amountCents < 0 ? 'text-on-surface' : 'text-primary font-medium'
                        }`}
                      >
                        {row.status === 'opening_balance'
                          ? row.runningBalanceCents != null
                            ? formatCurrency(row.runningBalanceCents)
                            : '—'
                          : row.isValid
                            ? formatCurrency(row.amountCents)
                            : 'Invalid'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 'success' && completion && (
          <div className="card-raised rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-primary-container/20 rounded-full flex items-center justify-center text-primary mb-2">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-on-surface">Import Complete</h3>
            <ul className="text-sm text-on-surface-variant text-left space-y-1 max-w-md">
              <li>Normal transactions imported: {completion.normalImported}</li>
              <li>Opening balance snapshots created: {completion.snapshotsCreated}</li>
              <li>Exact duplicates skipped: {completion.exactDuplicatesSkipped}</li>
              <li>
                Possible duplicates: {completion.possibleDuplicatesIncluded} included /{' '}
                {completion.possibleDuplicatesExcluded} excluded
              </li>
              <li>Invalid rows excluded: {completion.invalidExcluded}</li>
              <li>Recovered rows imported: {completion.recoveredImported}</li>
              <li>
                Running-balance validation:{' '}
                {completion.runningBalanceMismatches === 0
                  ? 'OK'
                  : `${completion.runningBalanceMismatches} mismatch(es)`}
              </li>
              {completion.endingBalanceCents != null && (
                <li>Ending balance: {formatCurrency(completion.endingBalanceCents)}</li>
              )}
              {completion.dateRange && (
                <li>
                  Date range: {completion.dateRange.start} → {completion.dateRange.end}
                </li>
              )}
            </ul>
            <div className="flex flex-wrap gap-4 mt-6 justify-center">
              <button
                onClick={undoLastImport}
                className="px-6 py-2 rounded-lg bg-surface-container text-on-surface font-semibold border border-outline-variant inline-flex items-center gap-2"
              >
                <Undo2 size={16} />
                Undo import
              </button>
              <button
                onClick={resetUpload}
                className="px-6 py-2 rounded-lg bg-surface-container text-on-surface font-semibold border border-outline-variant"
              >
                Import Another
              </button>
              <button
                onClick={() => onNavigate('transactions')}
                className="btn-physical px-6 py-2 rounded-lg text-primary font-bold"
              >
                View Transactions
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={errorDialog.isOpen}
        title="Validation Error"
        message={errorDialog.message}
        isDestructive={true}
        confirmLabel="OK"
        onConfirm={() => setErrorDialog((prev) => ({ ...prev, isOpen: false }))}
        onCancel={() => setErrorDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
