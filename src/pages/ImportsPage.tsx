import React, { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertCircle, HelpCircle, Undo2, Copy } from 'lucide-react';
import { dbApi } from '../database/db';
import { format } from 'date-fns';
import { PageHeader } from '../components/layout/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import {
  findExactDuplicate,
  findPossibleDuplicate,
  ParsedRow,
  processCsvData,
  truncateDescription,
} from '../lib/importUtils';
import {
  buildSanitizedDiagnostic,
  formatSanitizedDiagnostic,
  prepareImportCommit,
  runGenericImportPipeline,
  runImportPipeline,
  type ImportPipelineResult,
  type OpeningBalanceBehavior,
} from '../lib/importers/pipeline';
import { formatCurrency } from '../lib/utils';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'success';
type PreviewFilter =
  | 'all'
  | 'transactions'
  | 'balance_snapshots'
  | 'duplicates'
  | 'recovered'
  | 'invalid'
  | 'metadata'
  | 'summary';

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

function applyDuplicateFlags(
  rows: ParsedRow[],
  accountId: string,
  transactions: Parameters<typeof findExactDuplicate>[1]
): ParsedRow[] {
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
}

export function ImportsPage({ onNavigate }: ImportsPageProps) {
  const { accounts, rules, transactions, refreshData, settings } = useStore();
  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [useCustomMapping, setUseCustomMapping] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [dateCol, setDateCol] = useState('');
  const [descCol, setDescCol] = useState('');
  const [amountCol, setAmountCol] = useState('');
  const [debitCol, setDebitCol] = useState('');
  const [creditCol, setCreditCol] = useState('');
  const [invertSign, setInvertSign] = useState(false);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [pipelineResult, setPipelineResult] = useState<ImportPipelineResult | null>(null);
  const [headerOverride, setHeaderOverride] = useState<number | undefined>(undefined);
  const [openingBalanceAction, setOpeningBalanceAction] =
    useState<OpeningBalanceBehavior>('snapshot');
  const [createBalanceSnapshots, setCreateBalanceSnapshots] = useState(true);
  const [includePossibleDuplicates, setIncludePossibleDuplicates] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');
  const [completion, setCompletion] = useState<ImportCompletionStats | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [pendingPayloadImportId, setPendingPayloadImportId] = useState<string | null>(null);

  const [errorDialog, setErrorDialog] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: '',
  });

  const resetUpload = () => {
    setFileName('');
    setCsvText('');
    setRawData([]);
    setParsedRows([]);
    setPipelineResult(null);
    setHeaderOverride(undefined);
    setUseCustomMapping(false);
    setCompletion(null);
    setCommitError(null);
    setPendingPayloadImportId(null);
    setPreviewFilter('all');
    setStep('upload');
  };

  const runPipelineFromText = (
    text: string,
    accountId: string,
    opts?: { genericOnly?: boolean; headerRow?: number }
  ) => {
    const runner = opts?.genericOnly ? runGenericImportPipeline : runImportPipeline;
    const result = runner({
      text,
      accountId: accountId || undefined,
      existingTransactions: transactions,
      headerOverrideIndex: opts?.headerRow ?? headerOverride,
      profile: {
        createBalanceSnapshots,
        openingBalanceBehavior: openingBalanceAction,
        invertAmountSign: invertSign,
        amountMode: debitCol && creditCol ? 'debit_credit' : 'signed',
      },
    });
    setPipelineResult(result);
    if (result.selectedHeader && result.profile.createBalanceSnapshots && result.selectedHeader.confidence >= 0.7) {
      setCreateBalanceSnapshots(true);
    }
    setParsedRows(result.parsedRows);
    return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setCommitError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const result = runImportPipeline({
        bytes: buffer,
        accountId: selectedAccountId || undefined,
        existingTransactions: transactions,
        profile: {
          createBalanceSnapshots,
          openingBalanceBehavior: openingBalanceAction,
        },
      });
      setCsvText(result.text);
      setPipelineResult(result);
      setParsedRows(result.parsedRows);
      setHeaderOverride(undefined);
      setUseCustomMapping(false);
      setStep('mapping');
    };
    reader.readAsArrayBuffer(file);
  };

  const processMapping = () => {
    if (!selectedAccountId) {
      setErrorDialog({ isOpen: true, message: 'Please select a destination account.' });
      return;
    }

    if (pipelineResult && !useCustomMapping) {
      const refreshed = runPipelineFromText(csvText, selectedAccountId, {
        headerRow: headerOverride,
      });
      setParsedRows(
        applyDuplicateFlags(refreshed.parsedRows, selectedAccountId, transactions)
      );
      setStep('preview');
      return;
    }

    const rows = applyDuplicateFlags(
      processCsvData(rawData, {
        dateCol,
        descCol,
        amountCol: amountCol || undefined,
        debitCol: debitCol || undefined,
        creditCol: creditCol || undefined,
        invertSign,
      }),
      selectedAccountId,
      transactions
    );
    setParsedRows(rows);
    setStep('preview');
  };

  const confirmImport = async () => {
    if (!selectedAccountId) {
      setErrorDialog({ isOpen: true, message: 'Please select a destination account.' });
      return;
    }

    const importId = pendingPayloadImportId ?? `imp_${Date.now()}`;
    setPendingPayloadImportId(importId);
    setCommitError(null);

    const payload = prepareImportCommit({
      importId,
      accountId: selectedAccountId,
      fileName,
      importDate: format(new Date(), 'yyyy-MM-dd'),
      parsedRows,
      openingBalanceAction,
      includePossibleDuplicates,
      createBalanceSnapshots:
        createBalanceSnapshots && openingBalanceAction === 'snapshot',
      rules,
      importerId: pipelineResult?.importerId,
      statementSummary: pipelineResult?.summary,
      retainRawRows: settings.retainRawImportRows,
    });

    // Preserve date range from pipeline when no txs
    if (!payload.record.startDate && pipelineResult?.normalized) {
      const dates = pipelineResult.normalized
        .filter((r) => r.kind === 'transaction' && r.postedDate)
        .map((r) => r.postedDate)
        .sort();
      if (dates.length) {
        payload.record.startDate = dates[0];
        payload.record.endDate = dates[dates.length - 1];
      }
    }

    const acc = accounts.find((a) => a.id === selectedAccountId);
    const accountUpdate = acc
      ? { ...acc, lastImportedDate: format(new Date(), 'yyyy-MM-dd') }
      : undefined;

    try {
      await dbApi.commitImportBatch(payload, accountUpdate);
      await refreshData();
      setPendingPayloadImportId(null);
      setCompletion({
        ...payload.stats,
        runningBalanceMismatches: pipelineResult?.runningBalanceValidation.mismatchCount ?? 0,
        endingBalanceCents: pipelineResult?.summary.endingBalanceCents,
        dateRange:
          payload.record.startDate && payload.record.endDate
            ? { start: payload.record.startDate, end: payload.record.endDate }
            : undefined,
        importId,
      });
      setStep('success');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Import failed. Preview was preserved — you can retry without duplicating.';
      setCommitError(message);
      setErrorDialog({ isOpen: true, message });
    }
  };

  const undoLastImport = async () => {
    if (!completion?.importId) return;
    await dbApi.undoImportBatch(completion.importId);
    await refreshData();
    resetUpload();
  };

  const copyDiagnostic = async () => {
    if (!pipelineResult) return;
    const text = formatSanitizedDiagnostic(buildSanitizedDiagnostic(pipelineResult));
    await navigator.clipboard.writeText(text);
  };

  const isPipelineFlow = !!pipelineResult && !useCustomMapping;

  const filteredRows = useMemo(() => {
    return parsedRows.filter((row) => {
      switch (previewFilter) {
        case 'transactions':
          return (
            row.status === 'new' ||
            row.status === 'recovered' ||
            row.status === 'possible_duplicate' ||
            (!row.status && row.isValid)
          );
        case 'balance_snapshots':
          return row.status === 'opening_balance';
        case 'duplicates':
          return row.status === 'exact_duplicate' || row.status === 'possible_duplicate';
        case 'recovered':
          return row.status === 'recovered';
        case 'invalid':
          return row.status === 'invalid' || !row.isValid;
        case 'metadata':
        case 'summary':
          return row.status === 'summary_metadata';
        default:
          return true;
      }
    });
  }, [parsedRows, previewFilter]);

  const showRawNormalized = previewFilter === 'invalid' || previewFilter === 'recovered';

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
              Header discovery, metadata regions, and balance rows are handled locally.
              <br />
              <span className="font-semibold flex items-center justify-center gap-1 mt-2">
                Processed locally. Never leaves your device.
              </span>
            </p>
            <input
              id="file-upload"
              type="file"
              accept=".csv,text/csv"
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
                  if (pipelineResult && !useCustomMapping && csvText) {
                    const refreshed = runPipelineFromText(csvText, id, {
                      headerRow: headerOverride,
                    });
                    setParsedRows(applyDuplicateFlags(refreshed.parsedRows, id, transactions));
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

            {pipelineResult && (
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4 space-y-3">
                <div className="text-sm font-bold text-on-surface">
                  {pipelineResult.importerDisplayName
                    ? `Detected: ${pipelineResult.importerDisplayName}`
                    : 'Generic CSV pipeline'}
                </div>
                {pipelineResult.selectedHeader && (
                  <p className="text-xs text-on-surface-variant">
                    Header row {pipelineResult.selectedHeader.rowIndex + 1} · confidence{' '}
                    {(pipelineResult.selectedHeader.confidence * 100).toFixed(0)}% · delimiter{' '}
                    {pipelineResult.delimiter === '\t' ? 'TAB' : pipelineResult.delimiter}
                    {pipelineResult.encoding.bom ? ' · BOM' : ''}
                  </p>
                )}
                {pipelineResult.warnings.length > 0 && (
                  <ul className="text-xs text-on-surface-variant list-disc pl-4">
                    {pipelineResult.warnings.slice(0, 4).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}

                {pipelineResult.headerCandidates.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1">
                      Header row override
                    </label>
                    <select
                      className="w-full max-w-md bg-surface-bright border border-outline-variant rounded p-2 text-sm"
                      value={headerOverride ?? pipelineResult.selectedHeader?.rowIndex ?? 0}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        setHeaderOverride(idx);
                        if (csvText) {
                          runPipelineFromText(csvText, selectedAccountId, {
                            genericOnly: !pipelineResult.importerId || useCustomMapping,
                            headerRow: idx,
                          });
                        }
                      }}
                    >
                      {pipelineResult.headerCandidates.slice(0, 12).map((c) => (
                        <option key={c.rowIndex} value={c.rowIndex}>
                          Row {c.rowIndex + 1} · {(c.confidence * 100).toFixed(0)}% ·{' '}
                          {c.headers.filter(Boolean).slice(0, 4).join(' | ')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                            setAmountCol(guessField(['amount', 'value']));
                            setDebitCol(guessField(['debit', 'withdrawal']));
                            setCreditCol(guessField(['credit', 'deposit']));
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

            {(!isPipelineFlow || useCustomMapping) && (
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
                  {(
                    [
                      ['Date', dateCol, setDateCol],
                      ['Description', descCol, setDescCol],
                      ['Amount', amountCol, setAmountCol],
                      ['Debit', debitCol, setDebitCol],
                      ['Credit', creditCol, setCreditCol],
                    ] as const
                  ).map(([field, val, setVal]) => {
                    const csvFields = Object.keys(rawData[0] || {});
                    return (
                      <div
                        key={field}
                        className="flex items-center gap-6 p-4 rounded-lg border border-outline-variant bg-surface-container-low"
                      >
                        <div className="w-32 text-sm font-semibold text-on-surface">
                          {field}{' '}
                          {(field === 'Date' || field === 'Description') && (
                            <span className="text-error">*</span>
                          )}
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
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={invertSign}
                      onChange={(e) => setInvertSign(e.target.checked)}
                    />
                    Invert amount signs (credit-card style)
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-base font-bold text-on-surface">Balance rows</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createBalanceSnapshots}
                  onChange={(e) => setCreateBalanceSnapshots(e.target.checked)}
                />
                Create balance snapshots from recognized balance rows
              </label>
              <div className="space-y-2 text-sm">
                {(
                  [
                    ['snapshot', 'Import opening balance as snapshot'],
                    ['ignore', 'Ignore opening balance rows'],
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

            <div>
              <button
                type="button"
                className="text-xs font-semibold text-on-surface-variant hover:text-on-surface"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? 'Hide' : 'Show'} advanced import settings
              </button>
              {showAdvanced && pipelineResult && (
                <div className="mt-3 text-xs font-mono bg-surface-container-lowest border border-outline-variant rounded-lg p-3 space-y-1 text-on-surface-variant">
                  <div>amountMode: {pipelineResult.profile.amountMode}</div>
                  <div>
                    dateFormat: {String(pipelineResult.profile.dateFormat)}
                  </div>
                  <div>
                    decimal / thousands: {pipelineResult.profile.decimalSeparator} /{' '}
                    {pipelineResult.profile.thousandsSeparator || '(none)'}
                  </div>
                  <div>
                    header strategy: {pipelineResult.profile.headerDiscoveryStrategy}
                  </div>
                  <div>footer: {pipelineResult.profile.footerHandling}</div>
                  <p className="pt-2 normal-case font-sans">
                    Edit via Import Fixture Lab (Settings → Diagnostics) or saved import profiles.
                  </p>
                </div>
              )}
            </div>

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
                  (useCustomMapping &&
                    (!dateCol || !descCol || (!amountCol && !(debitCol || creditCol))))
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
                    {parsedRows.filter(
                      (r) =>
                        r.isValid &&
                        r.status !== 'exact_duplicate' &&
                        r.status !== 'opening_balance'
                    ).length}{' '}
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
                    {commitError ? 'Retry import' : 'Import'}
                  </button>
                </div>
              </div>

              {pipelineResult && isPipelineFlow && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-on-surface-variant">
                  <div>Format: {pipelineResult.importerDisplayName ?? 'Generic'}</div>
                  <div>
                    Header row: {(pipelineResult.selectedHeader?.rowIndex ?? 0) + 1}
                  </div>
                  <div>
                    Reconcile:{' '}
                    {pipelineResult.runningBalanceValidation.status.replace(/_/g, ' ')}
                  </div>
                  <div>
                    Summary: {pipelineResult.summaryValidation.status.replace(/_/g, ' ')}
                  </div>
                  <div>
                    Beginning:{' '}
                    {pipelineResult.summary.beginningBalanceCents != null
                      ? formatCurrency(pipelineResult.summary.beginningBalanceCents)
                      : '—'}
                  </div>
                  <div>
                    Ending:{' '}
                    {pipelineResult.summary.endingBalanceCents != null
                      ? formatCurrency(pipelineResult.summary.endingBalanceCents)
                      : '—'}
                  </div>
                  <div>
                    Recovered:{' '}
                    {pipelineResult.normalized.filter((r) => r.recovered).length}
                  </div>
                  <div>
                    Invalid:{' '}
                    {pipelineResult.normalized.filter((r) => r.kind === 'invalid').length}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-center">
                {(
                  [
                    ['all', 'All'],
                    ['transactions', 'Transactions'],
                    ['balance_snapshots', 'Balance snapshots'],
                    ['summary', 'Statement summary'],
                    ['duplicates', 'Duplicates'],
                    ['recovered', 'Recovered'],
                    ['invalid', 'Invalid'],
                    ['metadata', 'Ignored metadata'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPreviewFilter(id)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold border ${
                      previewFilter === id
                        ? 'bg-primary text-on-primary border-primary'
                        : 'border-outline-variant text-on-surface-variant'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 items-center">
                <label className="flex items-center gap-2 text-xs text-on-surface">
                  <input
                    type="checkbox"
                    checked={includePossibleDuplicates}
                    onChange={(e) => setIncludePossibleDuplicates(e.target.checked)}
                  />
                  Include possible duplicates
                </label>
                {pipelineResult && (
                  <button
                    type="button"
                    onClick={copyDiagnostic}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
                  >
                    <Copy size={12} />
                    Copy sanitized diagnostic
                  </button>
                )}
              </div>
              {commitError && (
                <p className="text-xs text-error">
                  Last commit failed. Preview preserved — retry will not duplicate (same import id).
                </p>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-surface-container-low sticky top-0 shadow-[0_1px_0_var(--color-surface-container)] z-10">
                  <tr className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    {showRawNormalized && <th className="py-3 px-4">Raw</th>}
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {filteredRows.map((row, i) => (
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
                      {showRawNormalized && (
                        <td className="py-2 px-4 text-[11px] text-on-surface-variant font-mono truncate max-w-[10rem]">
                          {Array.isArray(row.original)
                            ? truncateDescription(row.original.join('|'), 40)
                            : truncateDescription(JSON.stringify(row.original), 40)}
                        </td>
                      )}
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
        title={commitError ? 'Import Failed' : 'Validation Error'}
        message={errorDialog.message}
        isDestructive={true}
        confirmLabel="OK"
        onConfirm={() => setErrorDialog((prev) => ({ ...prev, isOpen: false }))}
        onCancel={() => setErrorDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
