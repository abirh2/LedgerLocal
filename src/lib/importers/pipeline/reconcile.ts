import type {
  AccountStatementSummary,
  NormalizedImportRow,
  ReconciliationStatus,
  RunningBalanceValidation,
  SummaryValidation,
} from './types';

function runningStatus(v: Omit<RunningBalanceValidation, 'status'>): ReconciliationStatus {
  if (v.rowsChecked === 0) return 'not_enough_information';
  if (v.mismatchCount > 0) return 'mismatch_detected';
  if (v.rowsReconciled === v.rowsChecked) return 'fully_reconciled';
  return 'partially_reconciled';
}

function summaryStatus(v: Omit<SummaryValidation, 'status'>): ReconciliationStatus {
  const hasAny =
    v.arithmeticOk != null ||
    v.endingMatchesLastRunning != null ||
    v.lastRunningBalanceCents != null;
  if (!hasAny) return 'not_enough_information';
  if (v.arithmeticOk === false || v.endingMatchesLastRunning === false) {
    return 'mismatch_detected';
  }
  if (v.arithmeticOk === true && (v.endingMatchesLastRunning === true || v.endingMatchesLastRunning == null)) {
    return 'fully_reconciled';
  }
  if (v.arithmeticOk === true || v.endingMatchesLastRunning === true) {
    return 'partially_reconciled';
  }
  return 'not_enough_information';
}

/** previous balance + amount = current balance (integer cents). Advisory only. */
export function validateRunningBalances(rows: NormalizedImportRow[]): RunningBalanceValidation {
  let prior: number | undefined;
  let rowsChecked = 0;
  let rowsReconciled = 0;
  let mismatchCount = 0;
  let firstMismatch: RunningBalanceValidation['firstMismatch'];

  for (const row of rows) {
    if (row.kind === 'opening_balance' && row.runningBalanceCents != null) {
      prior = row.runningBalanceCents;
      continue;
    }
    if (row.kind !== 'transaction' || row.amountCents == null) continue;
    if (prior == null || row.runningBalanceCents == null) {
      if (row.runningBalanceCents != null) prior = row.runningBalanceCents;
      continue;
    }

    rowsChecked++;
    const expected = prior + row.amountCents;
    const actual = row.runningBalanceCents;
    if (expected === actual) {
      rowsReconciled++;
    } else {
      mismatchCount++;
      if (!firstMismatch) {
        firstMismatch = {
          rowIndex: row.sourceRowIndex,
          expectedCents: expected,
          actualCents: actual,
          differenceCents: actual - expected,
        };
      }
    }
    prior = actual;
  }

  const base = { rowsChecked, rowsReconciled, mismatchCount, firstMismatch };
  return { ...base, status: runningStatus(base) };
}

export function validateSummary(
  summary: AccountStatementSummary,
  rows: NormalizedImportRow[]
): SummaryValidation {
  const result: Omit<SummaryValidation, 'status'> = {};

  if (
    summary.beginningBalanceCents != null &&
    summary.totalCreditsCents != null &&
    summary.totalDebitsCents != null &&
    summary.endingBalanceCents != null
  ) {
    const expected =
      summary.beginningBalanceCents + summary.totalCreditsCents + summary.totalDebitsCents;
    result.expectedEndingCents = expected;
    result.actualEndingCents = summary.endingBalanceCents;
    result.arithmeticOk = expected === summary.endingBalanceCents;
  }

  const withBal = [...rows]
    .filter((r) => r.kind === 'transaction' || r.kind === 'opening_balance')
    .filter((r) => r.runningBalanceCents != null);

  const last = withBal[withBal.length - 1];
  if (last?.runningBalanceCents != null) {
    result.lastRunningBalanceCents = last.runningBalanceCents;
    if (summary.endingBalanceCents != null) {
      result.endingMatchesLastRunning = last.runningBalanceCents === summary.endingBalanceCents;
    }
  }

  const lastTx = [...rows].reverse().find((r) => r.kind === 'transaction' && r.postedDate);
  if (lastTx && summary.endingBalanceDate && lastTx.postedDate !== summary.endingBalanceDate) {
    result.endingDateDiffersFromLastTx = true;
  }

  return { ...result, status: summaryStatus(result) };
}
