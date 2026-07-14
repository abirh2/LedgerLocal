import type { BalanceSnapshot, ImportRecord, Rule, Transaction } from '../../../models/types';
import { processTransactionWithRules } from '../../ruleEngine';
import { normalizeMerchantName } from '../../merchantManager';
import type { OpeningBalanceBehavior, ParsedRow } from './types';

export interface CommitImportInput {
  importId: string;
  accountId: string;
  fileName: string;
  importDate: string;
  parsedRows: ParsedRow[];
  openingBalanceAction: OpeningBalanceBehavior;
  includePossibleDuplicates: boolean;
  createBalanceSnapshots: boolean;
  rules: Rule[];
  importerId?: string;
  statementSummary?: ImportRecord['statementSummary'];
  /** Retain raw cells when settings allow — stored separately by db layer. */
  retainRawRows?: boolean;
}

export interface CommitImportPayload {
  importId: string;
  transactions: Transaction[];
  snapshots: BalanceSnapshot[];
  record: ImportRecord;
  rawRows?: { importId: string; rows: unknown[] };
  stats: {
    normalImported: number;
    snapshotsCreated: number;
    exactDuplicatesSkipped: number;
    possibleDuplicatesIncluded: number;
    possibleDuplicatesExcluded: number;
    invalidExcluded: number;
    recoveredImported: number;
  };
}

/**
 * Pure preparation of an atomic commit payload.
 * Persistence is `dbApi.commitImportBatch` — one IDB transaction.
 */
export function prepareImportCommit(input: CommitImportInput): CommitImportPayload {
  const now = new Date().toISOString();
  const snapshotIds: string[] = [];
  let snapshotsCreated = 0;
  let exactDuplicatesSkipped = 0;
  let possibleDuplicatesIncluded = 0;
  let possibleDuplicatesExcluded = 0;
  let invalidExcluded = 0;
  let recoveredImported = 0;
  let normalImported = 0;

  const transactions: Transaction[] = [];
  const snapshots: BalanceSnapshot[] = [];
  const createSnaps =
    input.createBalanceSnapshots &&
    (input.openingBalanceAction === 'snapshot');

  for (let i = 0; i < input.parsedRows.length; i++) {
    const r = input.parsedRows[i];

    if (r.status === 'opening_balance') {
      if (createSnaps && r.runningBalanceCents != null && r.date) {
        const id = `bs_${input.importId}_${i}`;
        snapshotIds.push(id);
        snapshots.push({
          id,
          accountId: input.accountId,
          date: r.date,
          balanceCents: r.runningBalanceCents,
          note: 'Opening balance from import',
          importId: input.importId,
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

    if (r.status === 'possible_duplicate' && !input.includePossibleDuplicates) {
      possibleDuplicatesExcluded++;
      continue;
    }
    if (r.status === 'possible_duplicate' && input.includePossibleDuplicates) {
      possibleDuplicatesIncluded++;
    }

    if (r.status === 'recovered') recoveredImported++;

    const initialTx: Transaction = {
      id: `${input.importId}_${i}`,
      accountId: input.accountId,
      importId: input.importId,
      postedDate: r.date,
      originalDescription: r.description,
      merchantName: normalizeMerchantName(r.description),
      amountCents: r.amountCents,
      excludedFromReports: false,
      isTransfer: false,
      createdAt: now,
    };
    const { transaction } = processTransactionWithRules(initialTx, input.rules);
    transactions.push(transaction);
    normalImported++;
  }

  const dates = transactions.map((t) => t.postedDate).sort();
  const record: ImportRecord = {
    id: input.importId,
    accountId: input.accountId,
    fileName: input.fileName,
    importDate: input.importDate,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    rowsProcessed: input.parsedRows.length,
    rowsInserted: normalImported,
    duplicatesSkipped: exactDuplicatesSkipped + possibleDuplicatesExcluded,
    invalidRows: invalidExcluded,
    importerId: input.importerId,
    statementSummary: input.statementSummary,
    snapshotIds,
  };

  const rawRows =
    input.retainRawRows
      ? {
          importId: input.importId,
          rows: input.parsedRows.map((r) => r.original),
        }
      : undefined;

  return {
    importId: input.importId,
    transactions,
    snapshots,
    record,
    rawRows,
    stats: {
      normalImported,
      snapshotsCreated,
      exactDuplicatesSkipped,
      possibleDuplicatesIncluded,
      possibleDuplicatesExcluded,
      invalidExcluded,
      recoveredImported,
    },
  };
}
