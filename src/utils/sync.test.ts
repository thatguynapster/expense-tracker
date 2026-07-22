import { describe, expect, it } from 'vitest';
import type { Account, Budget, Category, DisciplineState, Loan, LoanPayment, Transaction } from '@/lib/types';
import {
  applyPullResult,
  applyPushResult,
  collectDirtyRecords,
  hasDirtyRecords,
  isEmptyPullResult,
  toWirePayload,
  type SyncedAppData,
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
  type: 'expense',
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
  safeToSpendWarningThreshold: 50,
  customDailyBudget: null,
  loanRepaymentBalanceCorrectionAppliedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const loan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan_1',
  borrowerName: 'Kwame',
  principal: 500,
  dateLent: '2026-01-01T00:00:00.000Z',
  expectedRepaymentDate: null,
  note: null,
  sourceAccountId: 'acc_1',
  settledAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const loanPayment = (overrides: Partial<LoanPayment> = {}): LoanPayment => ({
  id: 'pay_1',
  loanId: 'loan_1',
  amount: 100,
  date: '2026-01-05T00:00:00.000Z',
  destinationAccountId: 'acc_1',
  note: null,
  createdAt: '2026-01-05T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const budget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 'budget_1',
  categoryId: 'cat_1',
  month: '2026-01',
  plannedAmount: 200,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const appData = (overrides: Partial<SyncedAppData> = {}): SyncedAppData => ({
  accounts: [],
  categories: [],
  transactions: [],
  disciplineState: disciplineState(),
  loans: [],
  loanPayments: [],
  budgets: [],
  ...overrides,
});

const emptyPayload = {
  accounts: [],
  categories: [],
  transactions: [],
  disciplineState: null,
  loans: [],
  loanPayments: [],
  budgets: [],
};

describe('collectDirtyRecords', () => {
  it('includes only records with syncedAt: null', () => {
    const dirtyAccount = account({ id: 'acc_dirty', syncedAt: null });
    const cleanAccount = account({ id: 'acc_clean', syncedAt: '2026-01-05T00:00:00.000Z' });

    const payload = collectDirtyRecords(
      appData({ accounts: [dirtyAccount, cleanAccount] }),
    );

    expect(payload.accounts).toEqual([dirtyAccount]);
  });

  it('filters each of the six collections independently', () => {
    const data = appData({
      accounts: [account({ syncedAt: null })],
      categories: [category({ syncedAt: '2026-01-05T00:00:00.000Z' })],
      transactions: [transaction({ syncedAt: null }), transaction({ id: 'tx_2', syncedAt: '2026-01-05T00:00:00.000Z' })],
      disciplineState: disciplineState({ syncedAt: '2026-01-05T00:00:00.000Z' }),
      loans: [loan({ syncedAt: null })],
      loanPayments: [loanPayment({ syncedAt: '2026-01-05T00:00:00.000Z' })],
    });

    const payload = collectDirtyRecords(data);

    expect(payload.accounts).toHaveLength(1);
    expect(payload.categories).toHaveLength(0);
    expect(payload.transactions).toHaveLength(1);
    expect(payload.disciplineState).toBeNull();
    expect(payload.loans).toHaveLength(1);
    expect(payload.loanPayments).toHaveLength(0);
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

    expect(payload).toEqual(emptyPayload);
  });
});

describe('hasDirtyRecords', () => {
  it('is false for an entirely empty payload', () => {
    expect(hasDirtyRecords(emptyPayload)).toBe(false);
  });

  it('is true when any single collection has an entry', () => {
    expect(hasDirtyRecords({ ...emptyPayload, accounts: [account()] })).toBe(true);
  });

  it('is true when only disciplineState is dirty', () => {
    expect(hasDirtyRecords({ ...emptyPayload, disciplineState: disciplineState() })).toBe(true);
  });

  it('is true when only loans has an entry', () => {
    expect(hasDirtyRecords({ ...emptyPayload, loans: [loan()] })).toBe(true);
  });

  it('is true when only loanPayments has an entry', () => {
    expect(hasDirtyRecords({ ...emptyPayload, loanPayments: [loanPayment()] })).toBe(true);
  });

  it('is true when only budgets has an entry', () => {
    expect(hasDirtyRecords({ ...emptyPayload, budgets: [budget()] })).toBe(true);
  });
});

describe('isEmptyPullResult', () => {
  it('is true for an entirely empty pull (a genuinely blank server)', () => {
    expect(isEmptyPullResult(emptyPayload)).toBe(true);
  });

  it('is false when the server has at least one account', () => {
    expect(isEmptyPullResult({ ...emptyPayload, accounts: [account()] })).toBe(false);
  });

  it('is false when the server has at least one category', () => {
    expect(isEmptyPullResult({ ...emptyPayload, categories: [category()] })).toBe(false);
  });

  it('is false when the server has disciplineState but nothing else', () => {
    expect(isEmptyPullResult({ ...emptyPayload, disciplineState: disciplineState() })).toBe(false);
  });
});

describe('applyPushResult', () => {
  const syncedAt = '2026-01-10T00:00:00.000Z';

  it('marks pushed, non-deleted records as synced', () => {
    const dirty = account({ id: 'acc_dirty', syncedAt: null });
    const data = appData({ accounts: [dirty] });
    const pushed = { ...emptyPayload, accounts: [dirty] };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.accounts).toEqual([{ ...dirty, syncedAt }]);
  });

  it('purges pushed, deleted (tombstoned) records entirely', () => {
    const tombstoned = category({ id: 'cat_gone', syncedAt: null, deletedAt: '2026-01-09T00:00:00.000Z' });
    const data = appData({ categories: [tombstoned] });
    const pushed = { ...emptyPayload, categories: [tombstoned] };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.categories).toEqual([]);
  });

  it('leaves records that were not part of the push untouched', () => {
    const pushedRecord = account({ id: 'acc_pushed', syncedAt: null });
    const untouchedRecord = account({ id: 'acc_untouched', syncedAt: null });
    const data = appData({ accounts: [pushedRecord, untouchedRecord] });
    const pushed = { ...emptyPayload, accounts: [pushedRecord] };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.accounts).toEqual([
      { ...pushedRecord, syncedAt },
      untouchedRecord,
    ]);
  });

  it('marks disciplineState synced when it was part of the push', () => {
    const dirty = disciplineState({ syncedAt: null });
    const data = appData({ disciplineState: dirty });
    const pushed = { ...emptyPayload, disciplineState: dirty };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.disciplineState).toEqual({ ...dirty, syncedAt });
  });

  it('leaves disciplineState untouched when it was not part of the push', () => {
    const clean = disciplineState({ syncedAt: '2026-01-01T00:00:00.000Z' });
    const data = appData({ disciplineState: clean });
    const pushed = { ...emptyPayload, disciplineState: null };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.disciplineState).toEqual(clean);
  });

  it('handles a mix: some pushed-and-synced, some pushed-and-deleted, some untouched', () => {
    const synced = account({ id: 'acc_synced', syncedAt: null });
    const deleted = account({ id: 'acc_deleted', syncedAt: null, deletedAt: '2026-01-09T00:00:00.000Z' });
    const untouched = account({ id: 'acc_untouched', syncedAt: null });
    const data = appData({ accounts: [synced, deleted, untouched] });
    const pushed = { ...emptyPayload, accounts: [synced, deleted] };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.accounts).toEqual([{ ...synced, syncedAt }, untouched]);
  });

  it('marks a pushed loan as synced', () => {
    const dirty = loan({ id: 'loan_dirty', syncedAt: null });
    const data = appData({ loans: [dirty] });
    const pushed = { ...emptyPayload, loans: [dirty] };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.loans).toEqual([{ ...dirty, syncedAt }]);
  });

  it('purges a pushed, tombstoned loan entirely', () => {
    const tombstoned = loan({ id: 'loan_gone', syncedAt: null, deletedAt: '2026-01-09T00:00:00.000Z' });
    const data = appData({ loans: [tombstoned] });
    const pushed = { ...emptyPayload, loans: [tombstoned] };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.loans).toEqual([]);
  });

  it('marks a pushed loan payment as synced', () => {
    const dirty = loanPayment({ id: 'pay_dirty', syncedAt: null });
    const data = appData({ loanPayments: [dirty] });
    const pushed = { ...emptyPayload, loanPayments: [dirty] };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.loanPayments).toEqual([{ ...dirty, syncedAt }]);
  });

  it('marks a pushed budget as synced', () => {
    const dirty = budget({ id: 'budget_dirty', syncedAt: null });
    const data = appData({ budgets: [dirty] });
    const pushed = { ...emptyPayload, budgets: [dirty] };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.budgets).toEqual([{ ...dirty, syncedAt }]);
  });

  it('purges a pushed, tombstoned budget entirely', () => {
    const tombstoned = budget({ id: 'budget_gone', syncedAt: null, deletedAt: '2026-01-09T00:00:00.000Z' });
    const data = appData({ budgets: [tombstoned] });
    const pushed = { ...emptyPayload, budgets: [tombstoned] };

    const result = applyPushResult(data, pushed, syncedAt);

    expect(result.budgets).toEqual([]);
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
    const pulledLoan = loan({ syncedAt: null });
    const pulledLoanPayment = loanPayment({ syncedAt: null });
    const pulledBudget = budget({ syncedAt: null });

    const result = applyPullResult(
      {
        accounts: [pulledAccount],
        categories: [pulledCategory],
        transactions: [pulledTransaction],
        disciplineState: pulledDisciplineState,
        loans: [pulledLoan],
        loanPayments: [pulledLoanPayment],
        budgets: [pulledBudget],
      },
      syncedAt,
      fallbackDisciplineState,
    );

    expect(result.accounts).toEqual([{ ...pulledAccount, syncedAt }]);
    expect(result.categories).toEqual([{ ...pulledCategory, syncedAt }]);
    expect(result.transactions).toEqual([{ ...pulledTransaction, syncedAt }]);
    expect(result.disciplineState).toEqual({ ...pulledDisciplineState, syncedAt });
    expect(result.loans).toEqual([{ ...pulledLoan, syncedAt }]);
    expect(result.loanPayments).toEqual([{ ...pulledLoanPayment, syncedAt }]);
    expect(result.budgets).toEqual([{ ...pulledBudget, syncedAt }]);
  });

  it('uses the fallback disciplineState (marked synced) when the server has none yet', () => {
    const result = applyPullResult(emptyPayload, syncedAt, fallbackDisciplineState);

    expect(result.disciplineState).toEqual({ ...fallbackDisciplineState, syncedAt });
  });

  it('restores an empty loans/loanPayments array when the server has none', () => {
    const result = applyPullResult(emptyPayload, syncedAt, fallbackDisciplineState);

    expect(result.loans).toEqual([]);
    expect(result.loanPayments).toEqual([]);
  });
});

describe('toWirePayload', () => {
  // syncedAt is purely local bookkeeping — the server's Prisma schema has
  // no such field, and Prisma's strict argument validation rejects unknown
  // fields outright ("Unknown argument `syncedAt`"). Every record sent
  // over the wire must have it stripped first.
  it('strips syncedAt from every account, category, and transaction', () => {
    const wire = toWirePayload({
      ...emptyPayload,
      accounts: [account({ syncedAt: null })],
      categories: [category({ syncedAt: null })],
      transactions: [transaction({ syncedAt: null })],
    });

    expect(wire.accounts[0]).not.toHaveProperty('syncedAt');
    expect(wire.categories[0]).not.toHaveProperty('syncedAt');
    expect(wire.transactions[0]).not.toHaveProperty('syncedAt');
  });

  it('strips syncedAt from disciplineState when present', () => {
    const wire = toWirePayload({ ...emptyPayload, disciplineState: disciplineState({ syncedAt: null }) });

    expect(wire.disciplineState).not.toHaveProperty('syncedAt');
  });

  it('passes disciplineState: null through unchanged', () => {
    const wire = toWirePayload(emptyPayload);

    expect(wire.disciplineState).toBeNull();
  });

  it('strips syncedAt from loans and loan payments', () => {
    const wire = toWirePayload({
      ...emptyPayload,
      loans: [loan({ syncedAt: null })],
      loanPayments: [loanPayment({ syncedAt: null })],
    });

    expect(wire.loans[0]).not.toHaveProperty('syncedAt');
    expect(wire.loanPayments[0]).not.toHaveProperty('syncedAt');
  });

  it('strips syncedAt from budgets', () => {
    const wire = toWirePayload({ ...emptyPayload, budgets: [budget({ syncedAt: null })] });

    expect(wire.budgets[0]).not.toHaveProperty('syncedAt');
  });

  it('preserves every other field, including deletedAt (the server does understand that one)', () => {
    const tombstoned = account({ syncedAt: null, deletedAt: '2026-01-09T00:00:00.000Z' });

    const wire = toWirePayload({ ...emptyPayload, accounts: [tombstoned] });

    const { syncedAt: _omitted, ...expected } = tombstoned;
    expect(wire.accounts[0]).toEqual(expected);
  });
});
