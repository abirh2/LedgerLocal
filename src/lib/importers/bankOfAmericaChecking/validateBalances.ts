import { AccountStatementSummary, BofANormalizedRow, RunningBalanceValidation, SummaryValidation } from './types';

export function validateRunningBalances(rows: BofANormalizedRow[]): RunningBalanceValidation {
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

  return { rowsChecked, rowsReconciled, mismatchCount, firstMismatch };
}

export function validateSummary(
  summary: AccountStatementSummary,
  rows: BofANormalizedRow[]
): SummaryValidation {
  const result: SummaryValidation = {};

  if (
    summary.beginningBalanceCents != null &&
    summary.totalCreditsCents != null &&
    summary.totalDebitsCents != null &&
    summary.endingBalanceCents != null
  ) {
    // Observed format: total debits already negative
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

  return result;
}
