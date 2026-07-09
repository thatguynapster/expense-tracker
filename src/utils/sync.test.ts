import { describe, expect, it } from 'vitest';
import type { Account, AppData, Category, DisciplineState, Transaction } from '@/lib/types';
import {
  applyPullResult,
  applyPushResult,
  collectDirtyRecords,
  hasDirtyRecords,
  toWirePayload,
} from './sync';

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc_1',
  name: 'Salary',
  type: 'spendable',
  balance: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const category = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat_1',
  name: 'Food',
  monthlyBudget: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx_1',
  type: 'expense',
  amount: 20,
  date: '2026-01-02T00:00:00.000Z',
  categoryId: 'cat_1',
  fromAccountId: 'acc_1',
  toAccountId: null,
  note: null,
  reason: null,
  savingsAccountId: null,
  savingsAmount: null,
  countsAsDebtRepayment: false,
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const disciplineState = (overrides: Partial<DisciplineState> = {}): DisciplineState => ({
  id: 'discipline_main',
  totalWithdrawnFromSavings: 0,
  totalExtraSavings: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const appData = (overrides: Partial<AppData> = {}): AppData => ({
  accounts: [],
  categories: [],
  transactions: [],
  disciplineState: disciplineState(),
  ...overrides,
});

describe('collectDirtyRecords', () => {
  it('includes only records with syncedAt: null', () => {
    const dirtyAccount = account({ id: 'acc_dirty', syncedAt: null });
    const cleanAccount = account({ id: 'acc_clean', syncedAt: '2026-01-05T00:00:00.000Z' });

    const payload = collectDirtyRecords(
      appData({ accounts: [dirtyAccount, cleanAccount] }),
    );

    expect(payload.accounts).toEqual([dirtyAccount]);
  });

  it('filters each of the four collections independently', () => {
    const data = appData({
      accounts: [account({ syncedAt: null })],
      categories: [category({ syncedAt: '2026-01-05T00:00:00.000Z' })],
      transactions: [transaction({ syncedAt: null }), transaction({ id: 'tx_2', syncedAt: '2026-01-05T00:00:00.000Z' })],
      disciplineState: disciplineState({ syncedAt: '2026-01-05T00:00:00.000Z' }),
    });

    const payload = collectDirtyRecords(data);

    expect(payload.accounts).toHaveLength(1);
    expect(payload.categories).toHaveLength(0);
    expect(payload.transactions).toHaveLength(1);
    expect(payload.disciplineState).toBeNull();
  });

  it('includes disciplineState when it is dirty', () => {
    const dirty = disciplineState({ syncedAt: null });
    const payload = collectDirtyRecords(appData({ disciplineState: dirty }));

    expect(payload.disciplineState).toEqual(dirty);
  });

  it('returns an entirely empty payload when nothing is dirty', () => {
    const payload = collectDirtyRecords(
      appData({ disciplineState: disciplineState({ syncedAt: '2026-01-05T00:00:00.000Z' }) }),
    );

    expect(payload).toEqual({
      accounts: [],
      categories: [],
      transactions: [],
      disciplineState: null,
    });
  });
});

describe('hasDirtyRecords', () => {
  it('is false for an entirely empty payload', () => {
    expect(
      hasDirtyRecords({ accounts: [], categories: [], transactions: [], disciplineState: null }),
    ).toBe(false);
  });

  it('is true when any single collection has an entry', () => {
    expect(
      hasDirtyRecords({ accounts: [account()], categories: [], transactions: [], disciplineState: null }),
    ).toBe(true);
  });

  it('is true when only disciplineState is dirty', () => {
    expect(
      hasDirtyRecords({ accounts: [], categories: [], transactions: [], disciplineState: disciplineState() }),
    ).toBe(true);
  });
});

describe('applyPushResult', () => {
  const syncedAt = '2026-01-10T00:00:00.000Z';

  it('marks pushed, non-deleted records as synced', () => {
    const dirty = account({ id: 'acc_dirty', syncedAt: null });
    const data = appData({ accounts: [dirty] });
    const pushed = { accounts: [dirty], categories: [], transactions: [], disciplineState: null };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.accounts).toEqual([{ ...dirty, syncedAt }]);
  });

  it('purges pushed, deleted (tombstoned) records entirely', () => {
    const tombstoned = category({ id: 'cat_gone', syncedAt: null, deletedAt: '2026-01-09T00:00:00.000Z' });
    const data = appData({ categories: [tombstoned] });
    const pushed = { accounts: [], categories: [tombstoned], transactions: [], disciplineState: null };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.categories).toEqual([]);
  });

  it('leaves records that were not part of the push untouched', () => {
    const pushedRecord = account({ id: 'acc_pushed', syncedAt: null });
    const untouchedRecord = account({ id: 'acc_untouched', syncedAt: null });
    const data = appData({ accounts: [pushedRecord, untouchedRecord] });
    const pushed = { accounts: [pushedRecord], categories: [], transactions: [], disciplineState: null };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.accounts).toEqual([
      { ...pushedRecord, syncedAt },
      untouchedRecord,
    ]);
  });

  it('marks disciplineState synced when it was part of the push', () => {
    const dirty = disciplineState({ syncedAt: null });
    const data = appData({ disciplineState: dirty });
    const pushed = { accounts: [], categories: [], transactions: [], disciplineState: dirty };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.disciplineState).toEqual({ ...dirty, syncedAt });
  });

  it('leaves disciplineState untouched when it was not part of the push', () => {
    const clean = disciplineState({ syncedAt: '2026-01-01T00:00:00.000Z' });
    const data = appData({ disciplineState: clean });
    const pushed = { accounts: [], categories: [], transactions: [], disciplineState: null };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.disciplineState).toEqual(clean);
  });

  it('handles a mix: some pushed-and-synced, some pushed-and-deleted, some untouched', () => {
    const synced = account({ id: 'acc_synced', syncedAt: null });
    const deleted = account({ id: 'acc_deleted', syncedAt: null, deletedAt: '2026-01-09T00:00:00.000Z' });
    const untouched = account({ id: 'acc_untouched', syncedAt: null });
    const data = appData({ accounts: [synced, deleted, untouched] });
    const pushed = {
      accounts: [synced, deleted],
      categories: [],
      transactions: [],
      disciplineState: null,
    };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.accounts).toEqual([{ ...synced, syncedAt }, untouched]);
  });
});

describe('applyPullResult', () => {
  const syncedAt = '2026-01-10T00:00:00.000Z';
  const fallbackDisciplineState = disciplineState({ id: 'discipline_main' });

  it('marks every pulled record as synced at the given timestamp', () => {
    const pulledAccount = account({ syncedAt: null });
    const pulledCategory = category({ syncedAt: null });
    const pulledTransaction = transaction({ syncedAt: null });
    const pulledDisciplineState = disciplineState({ syncedAt: null });

    const result = applyPullResult(
      {
        accounts: [pulledAccount],
        categories: [pulledCategory],
        transactions: [pulledTransaction],
        disciplineState: pulledDisciplineState,
      },
      syncedAt,
      fallbackDisciplineState,
    );

    expect(result.accounts).toEqual([{ ...pulledAccount, syncedAt }]);
    expect(result.categories).toEqual([{ ...pulledCategory, syncedAt }]);
    expect(result.transactions).toEqual([{ ...pulledTransaction, syncedAt }]);
    expect(result.disciplineState).toEqual({ ...pulledDisciplineState, syncedAt });
  });

  it('uses the fallback disciplineState (marked synced) when the server has none yet', () => {
    const result = applyPullResult(
      { accounts: [], categories: [], transactions: [], disciplineState: null },
      syncedAt,
      fallbackDisciplineState,
    );

    expect(result.disciplineState).toEqual({ ...fallbackDisciplineState, syncedAt });
  });
});

describe('toWirePayload', () => {
  // syncedAt is purely local bookkeeping — the server's Prisma schema has
  // no such field, and Prisma's strict argument validation rejects unknown
  // fields outright ("Unknown argument `syncedAt`"). Every record sent
  // over the wire must have it stripped first.
  it('strips syncedAt from every account, category, and transaction', () => {
    const wire = toWirePayload({
      accounts: [account({ syncedAt: null })],
      categories: [category({ syncedAt: null })],
      transactions: [transaction({ syncedAt: null })],
      disciplineState: null,
    });

    expect(wire.accounts[0]).not.toHaveProperty('syncedAt');
    expect(wire.categories[0]).not.toHaveProperty('syncedAt');
    expect(wire.transactions[0]).not.toHaveProperty('syncedAt');
  });

  it('strips syncedAt from disciplineState when present', () => {
    const wire = toWirePayload({
      accounts: [],
      categories: [],
      transactions: [],
      disciplineState: disciplineState({ syncedAt: null }),
    });

    expect(wire.disciplineState).not.toHaveProperty('syncedAt');
  });

  it('passes disciplineState: null through unchanged', () => {
    const wire = toWirePayload({
      accounts: [],
      categories: [],
      transactions: [],
      disciplineState: null,
    });

    expect(wire.disciplineState).toBeNull();
  });

  it('preserves every other field, including deletedAt (the server does understand that one)', () => {
    const tombstoned = account({ syncedAt: null, deletedAt: '2026-01-09T00:00:00.000Z' });

    const wire = toWirePayload({
      accounts: [tombstoned],
      categories: [],
      transactions: [],
      disciplineState: null,
    });

    const { syncedAt: _omitted, ...expected } = tombstoned;
    expect(wire.accounts[0]).toEqual(expected);
  });
});
