import { describe, it, expect, beforeEach } from 'vitest';
import { dbApi } from '../../../database/db';
import {
  createAccount,
  createBalanceSnapshot,
  createTransaction,
  createImportRecord,
} from '../../../test/factories/modelFactories';

describe('import batch undo', () => {
  beforeEach(async () => {
    await dbApi.clearAll();
  });

  it('removes transactions and snapshots for one importId', async () => {
    const account = createAccount({ id: 'acc_undo' });
    await dbApi.putAccount(account);

    const importId = 'imp_undo_1';
    await dbApi.putImport(createImportRecord({ id: importId, accountId: account.id }));
    await dbApi.putTransactions([
      createTransaction({
        id: 'tx_keep',
        accountId: account.id,
        importId: 'other',
        amountCents: -100,
      }),
      createTransaction({
        id: 'tx_imp',
        accountId: account.id,
        importId,
        amountCents: -200,
      }),
    ]);
    await dbApi.putBalanceSnapshots([
      createBalanceSnapshot({
        id: 'bs_imp',
        accountId: account.id,
        importId,
        balanceCents: 50000,
      }),
      createBalanceSnapshot({ id: 'bs_keep', accountId: account.id, balanceCents: 10000 }),
    ]);

    await dbApi.undoImportBatch(importId);

    const txs = await dbApi.getTransactions();
    const snaps = await dbApi.getBalanceSnapshots();
    const imports = await dbApi.getImports();

    expect(txs.map((t) => t.id)).toEqual(['tx_keep']);
    expect(snaps.map((s) => s.id)).toEqual(['bs_keep']);
    expect(imports.find((i) => i.id === importId)).toBeUndefined();
  });
});
