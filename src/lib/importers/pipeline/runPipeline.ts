import { findExactDuplicate, findPossibleDuplicate } from '../../importUtils';
import type { Transaction } from '../../../models/types';
import { detectBuiltInImporter } from '../registry';
import { classifyRows } from './classifyRows';
import { detectEncodingFromBytes, detectEncodingFromText } from './encoding';
import { discoverHeaderCandidates, selectBestHeader } from './headerDiscovery';
import { normalizeClassifiedRows, normalizedToParsedRows } from './normalizeRows';
import { parseCsvMatrix } from './parseMatrix';
import { parseSummaryFromClassified } from './parseSummaryGeneric';
import { createDefaultImportProfile } from './profiles';
import { validateRunningBalances, validateSummary } from './reconcile';
import type {
  ImportPipelineResult,
  ImportProfile,
  PipelineStageResult,
} from './types';

export interface RunPipelineOptions {
  text?: string;
  bytes?: ArrayBuffer;
  profile?: Partial<ImportProfile>;
  headerOverrideIndex?: number;
  preferBuiltIn?: boolean;
  accountId?: string;
  existingTransactions?: Transaction[];
  /** When built-in importer handles the file, skip generic normalize for those rows. */
  useBuiltInWhenDetected?: boolean;
}

function stage(
  id: PipelineStageResult['id'],
  label: string,
  ok: boolean,
  detail?: string,
  data?: unknown,
  start?: number
): PipelineStageResult {
  return {
    id,
    label,
    ok,
    detail,
    data,
    durationMs: start != null ? Math.round(performance.now() - start) : undefined,
  };
}

/**
 * Explicit staged CSV import pipeline. Each stage is inspectable (Fixture Lab).
 * Built-in institution importers still win when detected unless preference says otherwise.
 */
export function runImportPipeline(options: RunPipelineOptions): ImportPipelineResult {
  const stages: PipelineStageResult[] = [];
  const profile = createDefaultImportProfile(options.profile);
  const warnings: string[] = [];

  // 1–2. Read + encoding
  let t0 = performance.now();
  let text: string;
  let encoding: { encoding: string; bom: boolean };
  if (options.bytes) {
    const det = detectEncodingFromBytes(options.bytes);
    text = det.text;
    encoding = { encoding: det.encoding, bom: det.bom };
    stages.push(stage('read_bytes', 'Read file bytes', true, `${options.bytes.byteLength} bytes`, undefined, t0));
  } else {
    const det = detectEncodingFromText(options.text ?? '');
    text = det.text;
    encoding = { encoding: det.encoding, bom: det.bom };
    stages.push(stage('read_bytes', 'Read file bytes', true, 'text input', undefined, t0));
  }
  t0 = performance.now();
  stages.push(
    stage(
      'detect_encoding',
      'Detect encoding / BOM',
      true,
      `${encoding.encoding}${encoding.bom ? ' (BOM)' : ''}`,
      encoding,
      t0
    )
  );

  // 3–4. Delimiter + parse
  t0 = performance.now();
  const matrix = parseCsvMatrix(text, profile.delimiter);
  stages.push(
    stage(
      'detect_delimiter',
      'Detect delimiter',
      true,
      matrix.delimiter === '\t' ? 'TAB' : matrix.delimiter,
      { delimiter: matrix.delimiter },
      t0
    )
  );
  t0 = performance.now();
  stages.push(
    stage('parse_rows', 'Parse rows conservatively', true, `${matrix.rows.length} rows`, undefined, t0)
  );

  // 7 early: built-in detection (select importer)
  t0 = performance.now();
  const builtIn =
    options.useBuiltInWhenDetected !== false && options.preferBuiltIn !== false
      ? detectBuiltInImporter(text)
      : null;
  stages.push(
    stage(
      'select_importer',
      'Select importer / profile',
      true,
      builtIn
        ? `${builtIn.importer.displayName} (${(builtIn.detection.confidence * 100).toFixed(0)}%)`
        : `Custom profile: ${profile.name}`,
      builtIn
        ? { importerId: builtIn.importer.id, confidence: builtIn.detection.confidence }
        : { profileId: profile.id },
      t0
    )
  );

  // If built-in parses successfully, adapt into pipeline result
  if (builtIn) {
    const parsed = builtIn.importer.parse(text);
    if (parsed) {
      return adaptBuiltInToPipelineResult({
        stages,
        text,
        encoding,
        delimiter: matrix.delimiter,
        rows: matrix.rows,
        profile,
        builtInId: builtIn.importer.id,
        builtInName: builtIn.importer.displayName,
        parsed,
        headerOverrideIndex: options.headerOverrideIndex,
        accountId: options.accountId,
        existingTransactions: options.existingTransactions,
        warnings,
      });
    }
    warnings.push('Built-in detection matched but parse failed; falling back to generic pipeline');
  }

  // 5. Header discovery
  t0 = performance.now();
  const headerCandidates = discoverHeaderCandidates(matrix.rows, profile);
  const selectedHeader = selectBestHeader(headerCandidates, options.headerOverrideIndex);
  stages.push(
    stage(
      'discover_headers',
      'Discover candidate header rows',
      !!selectedHeader && (selectedHeader.requiredCoverage >= 3 || selectedHeader.confidence >= 0.4),
      selectedHeader
        ? `Row ${selectedHeader.rowIndex + 1} · confidence ${(selectedHeader.confidence * 100).toFixed(0)}%`
        : 'No header candidate',
      { candidates: headerCandidates.slice(0, 5), selected: selectedHeader },
      t0
    )
  );

  if (!selectedHeader) {
    return emptyFailure({
      stages,
      text,
      encoding,
      delimiter: matrix.delimiter,
      rows: matrix.rows,
      profile,
      headerCandidates,
      warnings: [...warnings, 'Could not discover a transaction header row'],
    });
  }

  const columnMap = selectedHeader.columnMap;

  // 6. Classify regions
  t0 = performance.now();
  const classified = classifyRows(
    matrix.rows,
    selectedHeader.rowIndex,
    columnMap,
    profile.structuralRowPatterns,
    profile.footerHandling
  );
  stages.push(
    stage(
      'classify_regions',
      'Identify metadata / summary regions',
      true,
      `${classified.filter((c) => c.kind === 'metadata').length} metadata, ${classified.filter((c) => c.kind === 'transaction').length} transaction-shaped`,
      undefined,
      t0
    )
  );

  // 8. Map columns
  t0 = performance.now();
  stages.push(
    stage(
      'map_columns',
      'Map columns',
      columnMap.date != null && columnMap.description != null,
      Object.entries(columnMap)
        .map(([k, v]) => `${k}=${(v as number) + 1}`)
        .join(', '),
      columnMap,
      t0
    )
  );

  // 9–11. Normalize + structural
  t0 = performance.now();
  const { rows: normalized, ambiguousDates } = normalizeClassifiedRows(
    classified,
    columnMap,
    profile
  );
  stages.push(
    stage(
      'normalize',
      'Normalize values',
      true,
      `${normalized.filter((r) => r.kind === 'transaction').length} transactions`,
      undefined,
      t0
    )
  );
  t0 = performance.now();
  stages.push(
    stage(
      'validate',
      'Validate rows',
      true,
      `${normalized.filter((r) => r.kind === 'invalid').length} invalid`,
      undefined,
      t0
    )
  );
  t0 = performance.now();
  stages.push(
    stage(
      'structural',
      'Detect structural rows',
      true,
      `${normalized.filter((r) => r.kind === 'opening_balance' || r.kind === 'structural').length} structural`,
      undefined,
      t0
    )
  );

  const summary = parseSummaryFromClassified(classified, profile);

  // 12. Reconcile
  t0 = performance.now();
  const runningBalanceValidation = validateRunningBalances(normalized);
  const summaryValidation = validateSummary(summary, normalized);
  stages.push(
    stage(
      'reconcile',
      'Reconcile balances',
      runningBalanceValidation.status !== 'mismatch_detected',
      `running=${runningBalanceValidation.status}; summary=${summaryValidation.status}`,
      { runningBalanceValidation, summaryValidation },
      t0
    )
  );

  let parsedRows = normalizedToParsedRows(normalized);

  // 13. Duplicates
  t0 = performance.now();
  if (options.accountId && options.existingTransactions) {
    parsedRows = parsedRows.map((row) => {
      if (!row.isValid || row.status === 'opening_balance' || row.status === 'summary_metadata') {
        return row;
      }
      if (findExactDuplicate(row, options.existingTransactions!, options.accountId!)) {
        return { ...row, status: 'exact_duplicate' as const };
      }
      if (findPossibleDuplicate(row, options.existingTransactions!, options.accountId!)) {
        return { ...row, status: 'possible_duplicate' as const };
      }
      return row;
    });
  }
  stages.push(
    stage(
      'duplicates',
      'Detect duplicates',
      true,
      `${parsedRows.filter((r) => r.status === 'exact_duplicate').length} exact / ${parsedRows.filter((r) => r.status === 'possible_duplicate').length} possible`,
      undefined,
      t0
    )
  );

  stages.push(stage('preview', 'Preview ready', true, `${parsedRows.length} preview rows`));

  if (ambiguousDates.length) {
    warnings.push(`${ambiguousDates.length} ambiguous date(s) require format confirmation`);
  }

  return {
    stages,
    text,
    encoding,
    delimiter: matrix.delimiter,
    rows: matrix.rows,
    headerCandidates,
    selectedHeader,
    headerOverrideIndex: options.headerOverrideIndex,
    classified,
    columnMap,
    profile,
    summary,
    normalized,
    parsedRows,
    runningBalanceValidation,
    summaryValidation,
    warnings,
    ambiguousDates,
  };
}

function emptyFailure(partial: {
  stages: PipelineStageResult[];
  text: string;
  encoding: { encoding: string; bom: boolean };
  delimiter: string;
  rows: string[][];
  profile: ImportProfile;
  headerCandidates: ImportPipelineResult['headerCandidates'];
  warnings: string[];
}): ImportPipelineResult {
  const emptyRunning = {
    rowsChecked: 0,
    rowsReconciled: 0,
    mismatchCount: 0,
    status: 'not_enough_information' as const,
  };
  const emptySummary = { status: 'not_enough_information' as const };
  return {
    stages: partial.stages,
    text: partial.text,
    encoding: partial.encoding,
    delimiter: partial.delimiter,
    rows: partial.rows,
    headerCandidates: partial.headerCandidates,
    classified: [],
    columnMap: {},
    profile: partial.profile,
    summary: {},
    normalized: [],
    parsedRows: [],
    runningBalanceValidation: emptyRunning,
    summaryValidation: emptySummary,
    warnings: partial.warnings,
    ambiguousDates: [],
  };
}

function adaptBuiltInToPipelineResult(args: {
  stages: PipelineStageResult[];
  text: string;
  encoding: { encoding: string; bom: boolean };
  delimiter: string;
  rows: string[][];
  profile: ImportProfile;
  builtInId: string;
  builtInName: string;
  parsed: import('../bankOfAmericaChecking').BofAParseResult;
  headerOverrideIndex?: number;
  accountId?: string;
  existingTransactions?: Transaction[];
  warnings: string[];
}): ImportPipelineResult {
  const { parsed } = args;
  const stages = [...args.stages];

  const headerCandidates = discoverHeaderCandidates(args.rows, {
    ...args.profile,
    headerDiscoveryStrategy: 'fixed_row',
    headerRowIndex: parsed.detection.headerRowIndex,
    dateFormat: 'MM/DD/YYYY',
  });
  const selectedHeader = selectBestHeader(headerCandidates, args.headerOverrideIndex) ?? {
    rowIndex: parsed.detection.headerRowIndex,
    score: 100,
    confidence: parsed.detection.confidence,
    requiredCoverage: 3,
    optionalCoverage: 1,
    uniqueMappedFields: 4,
    followingShapeMatches: parsed.stats.validNormalCount,
    sampleParseOk: parsed.stats.validNormalCount,
    columnMap: {
      date: 0,
      description: 1,
      amount: 2,
      runningBalance: 3,
    },
    headers: args.rows[parsed.detection.headerRowIndex] ?? [],
  };

  stages.push(
    stage(
      'discover_headers',
      'Discover candidate header rows',
      true,
      `Row ${parsed.detection.headerRowIndex + 1} (built-in)`,
      { selected: selectedHeader }
    )
  );

  const classified = classifyRows(
    args.rows,
    parsed.detection.headerRowIndex,
    selectedHeader.columnMap,
    args.profile.structuralRowPatterns
  );
  stages.push(
    stage(
      'classify_regions',
      'Identify metadata / summary regions',
      true,
      `${parsed.detection.summaryRows.length} summary rows`
    )
  );
  stages.push(stage('map_columns', 'Map columns', true, 'built-in Date/Description/Amount/Running Bal.'));
  stages.push(
    stage(
      'normalize',
      'Normalize values',
      true,
      `${parsed.stats.validNormalCount} transactions`
    )
  );
  stages.push(stage('validate', 'Validate rows', true, `${parsed.stats.invalidCount} invalid`));
  stages.push(
    stage('structural', 'Detect structural rows', true, `${parsed.stats.openingBalanceCount} opening`)
  );

  const normalized = parsed.rows.map((r) => ({
    kind: r.kind === 'skipped' ? ('skipped' as const) : r.kind,
    status: r.status,
    postedDate: r.postedDate,
    originalDescription: r.originalDescription,
    displayDescription: r.displayDescription,
    amountCents: r.amountCents,
    runningBalanceCents: r.runningBalanceCents,
    sourceRowIndex: r.sourceRowIndex,
    rawCells: r.rawCells,
    recovered: r.recovered,
    warnings: r.warnings,
    error: r.error,
    include: r.include,
  }));

  const runningBalanceValidation = {
    ...parsed.runningBalanceValidation,
    status: validateRunningBalances(normalized).status,
  };
  const summaryValidation = {
    ...parsed.summaryValidation,
    status: validateSummary(parsed.summary, normalized).status,
  };

  stages.push(
    stage(
      'reconcile',
      'Reconcile balances',
      runningBalanceValidation.status !== 'mismatch_detected',
      `running=${runningBalanceValidation.status}; summary=${summaryValidation.status}`
    )
  );

  let parsedRows = normalizedToParsedRows(normalized);
  if (args.accountId && args.existingTransactions) {
    parsedRows = parsedRows.map((row) => {
      if (!row.isValid || row.status === 'opening_balance' || row.status === 'summary_metadata') {
        return row;
      }
      if (findExactDuplicate(row, args.existingTransactions!, args.accountId!)) {
        return { ...row, status: 'exact_duplicate' as const };
      }
      if (findPossibleDuplicate(row, args.existingTransactions!, args.accountId!)) {
        return { ...row, status: 'possible_duplicate' as const };
      }
      return row;
    });
  }
  stages.push(
    stage(
      'duplicates',
      'Detect duplicates',
      true,
      `${parsedRows.filter((r) => r.status === 'exact_duplicate').length} exact`
    )
  );
  stages.push(stage('preview', 'Preview ready', true));

  return {
    stages,
    text: args.text,
    encoding: args.encoding,
    delimiter: args.delimiter,
    rows: args.rows,
    headerCandidates,
    selectedHeader,
    headerOverrideIndex: args.headerOverrideIndex,
    classified,
    columnMap: selectedHeader.columnMap,
    profile: {
      ...args.profile,
      dateFormat: 'MM/DD/YYYY',
      amountMode: 'signed',
      delimiter: (parsed.detection.delimiter as ImportProfile['delimiter']) || ',',
      openingBalanceBehavior: args.profile.openingBalanceBehavior,
      createBalanceSnapshots: args.profile.createBalanceSnapshots,
    },
    importerId: args.builtInId,
    importerDisplayName: args.builtInName,
    summary: parsed.summary,
    normalized,
    parsedRows,
    runningBalanceValidation,
    summaryValidation,
    warnings: [...args.warnings, ...parsed.detection.warnings],
    ambiguousDates: [],
  };
}

/** Re-run generic path only (for header override after built-in). */
export function runGenericImportPipeline(
  options: Omit<RunPipelineOptions, 'useBuiltInWhenDetected' | 'preferBuiltIn'>
): ImportPipelineResult {
  return runImportPipeline({
    ...options,
    useBuiltInWhenDetected: false,
    preferBuiltIn: false,
  });
}
