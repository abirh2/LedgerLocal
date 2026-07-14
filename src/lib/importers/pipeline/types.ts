import type { AccountStatementSummary } from '../../../models/types';
import type { ImportRowStatus, ParsedRow } from '../../importUtils';

export type { AccountStatementSummary, ImportRowStatus, ParsedRow };

/** Deterministic money parse result — invalid is never silently zero. */
export type ParsedMoney = {
  cents?: number;
  status: 'valid' | 'blank' | 'invalid';
  normalizedInput?: string;
  warning?: string;
};

export type DateFormatId =
  | 'YYYY-MM-DD'
  | 'MM/DD/YYYY'
  | 'DD/MM/YYYY'
  | 'M/D/YYYY'
  | 'D/M/YYYY';

export type ParsedDate = {
  date?: string;
  status: 'valid' | 'blank' | 'invalid' | 'ambiguous';
  candidates?: string[];
  formatUsed?: DateFormatId;
  error?: string;
};

export type AmountMode = 'signed' | 'debit_credit' | 'absolute_invert';

export type OpeningBalanceBehavior = 'snapshot' | 'ignore' | 'validate_only';

export type HeaderDiscoveryStrategy = 'alias_score' | 'fixed_row' | 'skip_rows';

export type CsvRowKind =
  | 'metadata'
  | 'header'
  | 'transaction'
  | 'structural_balance'
  | 'footer'
  | 'invalid'
  | 'recovered'
  | 'blank';

export type StructuralBalanceKind =
  | 'beginning_balance'
  | 'ending_balance'
  | 'available_balance'
  | 'statement_balance'
  | 'total_credits'
  | 'total_debits'
  | 'totals'
  | 'pending_balance';

export type ReconciliationStatus =
  | 'fully_reconciled'
  | 'partially_reconciled'
  | 'not_enough_information'
  | 'mismatch_detected';

export type FieldAliasRole =
  | 'date'
  | 'posted_date'
  | 'transaction_date'
  | 'description'
  | 'details'
  | 'merchant'
  | 'memo'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'withdrawal'
  | 'deposit'
  | 'running_balance'
  | 'balance'
  | 'transaction_type'
  | 'reference_number';

export interface HeaderAliasSet {
  [role: string]: string[];
}

export interface ImportProfile {
  id: string;
  name: string;
  version: number;
  accountId?: string;
  createdAt: string;
  updatedAt: string;

  headerDiscoveryStrategy: HeaderDiscoveryStrategy;
  headerAliases: HeaderAliasSet;
  /** When strategy is fixed_row or skip_rows. */
  headerRowIndex?: number;
  skipRows?: number;
  dateFormat: DateFormatId | DateFormatId[];
  amountMode: AmountMode;
  /** Multiply signed amounts by -1 (credit-card style). */
  invertAmountSign: boolean;
  debitColumnAlias?: string;
  creditColumnAlias?: string;
  decimalSeparator: '.' | ',';
  thousandsSeparator: ',' | '.' | ' ' | '';
  structuralRowPatterns: string[];
  openingBalanceBehavior: OpeningBalanceBehavior;
  runningBalanceColumnAlias?: string;
  referenceNumberColumnAlias?: string;
  delimiter?: ',' | ';' | '\t' | '|';
  footerHandling: 'ignore' | 'classify';
  createBalanceSnapshots: boolean;
}

export const IMPORT_PROFILE_SCHEMA_VERSION = 1;

export interface ColumnIndexMap {
  date?: number;
  description?: number;
  amount?: number;
  debit?: number;
  credit?: number;
  runningBalance?: number;
  referenceNumber?: number;
  transactionType?: number;
}

export interface HeaderCandidateScore {
  rowIndex: number;
  score: number;
  confidence: number;
  requiredCoverage: number;
  optionalCoverage: number;
  uniqueMappedFields: number;
  followingShapeMatches: number;
  sampleParseOk: number;
  columnMap: ColumnIndexMap;
  headers: string[];
}

export interface ClassifiedRow {
  sourceRowIndex: number;
  kind: CsvRowKind;
  structuralKind?: StructuralBalanceKind;
  cells: string[];
  rawLineShape: string;
}

export interface NormalizedImportRow {
  kind: 'transaction' | 'opening_balance' | 'structural' | 'invalid' | 'skipped';
  status: ImportRowStatus;
  postedDate: string;
  originalDescription: string;
  displayDescription: string;
  amountCents?: number;
  runningBalanceCents?: number;
  referenceNumber?: string;
  sourceRowIndex: number;
  rawCells: string[];
  recovered: boolean;
  warnings: string[];
  error?: string;
  include: boolean;
  structuralKind?: StructuralBalanceKind;
}

export interface RunningBalanceValidation {
  rowsChecked: number;
  rowsReconciled: number;
  mismatchCount: number;
  status: ReconciliationStatus;
  firstMismatch?: {
    rowIndex: number;
    expectedCents: number;
    actualCents: number;
    differenceCents: number;
  };
}

export interface SummaryValidation {
  arithmeticOk?: boolean;
  endingMatchesLastRunning?: boolean;
  expectedEndingCents?: number;
  actualEndingCents?: number;
  lastRunningBalanceCents?: number;
  endingDateDiffersFromLastTx?: boolean;
  status: ReconciliationStatus;
}

export type PipelineStageId =
  | 'read_bytes'
  | 'detect_encoding'
  | 'detect_delimiter'
  | 'parse_rows'
  | 'discover_headers'
  | 'classify_regions'
  | 'select_importer'
  | 'map_columns'
  | 'normalize'
  | 'validate'
  | 'structural'
  | 'reconcile'
  | 'duplicates'
  | 'preview'
  | 'commit';

export interface PipelineStageResult {
  id: PipelineStageId;
  label: string;
  ok: boolean;
  detail?: string;
  data?: unknown;
  durationMs?: number;
}

export interface ImportPipelineResult {
  stages: PipelineStageResult[];
  text: string;
  encoding: { encoding: string; bom: boolean };
  delimiter: string;
  rows: string[][];
  headerCandidates: HeaderCandidateScore[];
  selectedHeader?: HeaderCandidateScore;
  headerOverrideIndex?: number;
  classified: ClassifiedRow[];
  columnMap: ColumnIndexMap;
  profile: ImportProfile;
  importerId?: string;
  importerDisplayName?: string;
  summary: AccountStatementSummary;
  normalized: NormalizedImportRow[];
  parsedRows: ParsedRow[];
  runningBalanceValidation: RunningBalanceValidation;
  summaryValidation: SummaryValidation;
  warnings: string[];
  ambiguousDates: { rowIndex: number; raw: string; candidates: string[] }[];
}

export interface SanitizedImportDiagnostic {
  importerId?: string;
  headerNames: string[];
  headerRowIndex?: number;
  rowCounts: {
    total: number;
    metadata: number;
    transaction: number;
    structural: number;
    footer: number;
    invalid: number;
    recovered: number;
  };
  errorCodes: string[];
  sampleShapes: string[];
  delimiter: string;
  dateFormat: string | string[];
  amountMode: AmountMode;
  reconciliation: {
    running: ReconciliationStatus;
    summary: ReconciliationStatus;
  };
}
