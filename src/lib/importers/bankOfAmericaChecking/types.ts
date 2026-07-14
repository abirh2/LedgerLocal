import { AccountStatementSummary } from '../../../models/types';
import { ImportRowStatus } from '../../importUtils';

export const BOFA_CHECKING_IMPORTER_ID = 'bank-of-america-checking';
export const BOFA_CHECKING_DISPLAY_NAME = 'Bank of America Checking';

export type { AccountStatementSummary };

export interface ImporterDetection {
  id: typeof BOFA_CHECKING_IMPORTER_ID;
  displayName: string;
  confidence: number;
  headerRowIndex: number;
  summaryRows: number[];
  delimiter: string;
  dateFormat: 'MM/DD/YYYY';
  amountConvention: 'signed';
  warnings: string[];
}

export interface RunningBalanceValidation {
  rowsChecked: number;
  rowsReconciled: number;
  mismatchCount: number;
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
}

export type NormalizedRowKind = 'transaction' | 'opening_balance' | 'invalid' | 'skipped';

export interface BofANormalizedRow {
  kind: NormalizedRowKind;
  status: ImportRowStatus;
  postedDate: string;
  originalDescription: string;
  displayDescription: string;
  amountCents?: number;
  runningBalanceCents?: number;
  sourceRowIndex: number;
  rawCells: string[];
  recovered: boolean;
  warnings: string[];
  error?: string;
  include: boolean;
}

export interface BofAParseResult {
  detection: ImporterDetection;
  summary: AccountStatementSummary;
  rows: BofANormalizedRow[];
  runningBalanceValidation: RunningBalanceValidation;
  summaryValidation: SummaryValidation;
  stats: {
    summaryRowCount: number;
    transactionRowCount: number;
    openingBalanceCount: number;
    validNormalCount: number;
    invalidCount: number;
    recoveredCount: number;
    dateRange?: { start: string; end: string };
  };
}
