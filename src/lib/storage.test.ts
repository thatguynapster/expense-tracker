import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, AppData, DisciplineState, Loan, LoanPayment, Transaction } from './types';

const mockGetItem = vi.fn();
const mockSetItem = vi.fn();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: mockGetItem, setItem: mockSetItem },
}));

const { isFirstLaunch, loadAppData, backfillLoanTransactions, backfillAccountStartingBalances } =
  await import('./storage');

describe('isFirstLaunch', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
  });

  it('returns true when nothing has ever been stored', async () => {
    mockGetItem.mockResolvedValue(null);

    expect(await isFirstLaunch()).toBe(true);
  });

  it('returns false once any data has been saved', async () => {
    mockGetItem.mockResolvedValue('{"accounts":[]}');

    expect(await isFirstLaunch()).toBe(false);
  });
});

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc_1',
  name: 'Main',
  type: 'spendable',
  balance: 0,
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
  sourceAccountId: 'acc_cash',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  settledAt: null,
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const payment = (overrides: Partial<LoanPayment> = {}): LoanPayment => ({
  id: 'pay_1',
  loanId: 'loan_1',
  amount: 200,
  date: '2026-01-10T00:00:00.000Z',
  destinationAccountId: 'acc_cash',
  note: null,
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx_1',
  type: 'expense',
  amount: 20,
  date: '2026-01-05T00:00:00.000Z',
  categoryId: 'cat_food',
  fromAccountId: 'acc_cash',
  toAccountId: null,
  note: null,
  reason: null,
  savingsAccountId: null,
  savingsAmount: null,
  countsAsDebtRepayment: false,
  loanId: null,
  loanPaymentId: null,
  createdAt: '2026-01-05T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
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
  // null = the loan-repayment balance correction hasn't run yet — the
  // default for most tests, since that's the scenario being exercised.
  loanRepaymentBalanceCorrectionAppliedAt: null,
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
  loans: [],
  loanPayments: [],
  budgets: [],
  ...overrides,
});

describe('backfillLoanTransactions', () => {
  it('generates a disbursement transaction and leaves balances untouched', () => {
    const data = appData({
      accounts: [account({ id: 'acc_cash', balance: 300 })],
      loans: [loan({ principal: 500, sourceAccountId: 'acc_cash' })],
    });

    const result = backfillLoanTransactions(data);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      id: 'loan_1_disbursement',
      type: 'loan_disbursement',
      amount: 500,
      fromAccountId: 'acc_cash',
      loanId: 'loan_1',
    });
    expect(result.accounts[0]!.balance).toBe(300);
  });

  it('generates a repayment credit only (no transfer) when destination matches source, and leaves balances untouched', () => {
    const data = appData({
      accounts: [account({ id: 'acc_cash', balance: 300 })],
      loans: [loan({ sourceAccountId: 'acc_cash' })],
      loanPayments: [payment({ amount: 200, destinationAccountId: 'acc_cash' })],
    });

    const result = backfillLoanTransactions(data);

    const generatedTypes = result.transactions.map((t) => t.type);
    expect(generatedTypes).toEqual(['loan_disbursement', 'loan_repayment']);
    expect(result.accounts[0]!.balance).toBe(300);
  });

  it('generates a repayment credit and a transfer, and corrects both account balances, when destination differs from source', () => {
    const data = appData({
      accounts: [
        account({ id: 'acc_cash', balance: 300 }),
        account({ id: 'acc_momo', balance: 100 }),
      ],
      loans: [loan({ sourceAccountId: 'acc_cash' })],
      loanPayments: [payment({ amount: 200, destinationAccountId: 'acc_momo' })],
    });

    const result = backfillLoanTransactions(data);

    const generatedTypes = result.transactions.map((t) => t.type);
    expect(generatedTypes).toEqual(['loan_disbursement', 'loan_repayment', 'transfer']);

    const transfer = result.transactions.find((t) => t.type === 'transfer');
    expect(transfer).toMatchObject({
      id: 'pay_1_transfer',
      fromAccountId: 'acc_cash',
      toAccountId: 'acc_momo',
      amount: 200,
      loanPaymentId: 'pay_1',
    });

    // Old code only ever credited acc_cash on repayment — this backfill
    // corrects that: acc_cash loses the 200 it was never entitled to keep,
    // acc_momo (where the cash actually landed) gains it.
    const cash = result.accounts.find((a) => a.id === 'acc_cash')!;
    const momo = result.accounts.find((a) => a.id === 'acc_momo')!;
    expect(cash.balance).toBe(100); // 300 - 200
    expect(momo.balance).toBe(300); // 100 + 200
    expect(cash.syncedAt).toBeNull();
    expect(momo.syncedAt).toBeNull();
  });

  it('applies the balance correction even when the transfer transaction already exists', () => {
    // Regression test: a device that already ran an earlier version of this
    // backfill (before the balance correction existed) would already have
    // the transfer transaction on disk, without ever having had its balance
    // corrected. The correction must not be gated on "is this transaction
    // newly generated" — only on disciplineState.loanRepaymentBalanceCorrectionAppliedAt.
    const existingTransfer = {
      id: 'pay_1_transfer',
      type: 'transfer' as const,
      amount: 200,
      date: '2026-01-10T00:00:00.000Z',
      fromAccountId: 'acc_cash',
      toAccountId: 'acc_momo',
      categoryId: null,
      note: null,
      reason: null,
      countsAsDebtRepayment: false,
      loanId: null,
      loanPaymentId: 'pay_1',
      createdAt: '2026-01-10T00:00:00.000Z',
      updatedAt: '2026-01-10T00:00:00.000Z',
      syncedAt: '2026-01-11T00:00:00.000Z',
      deletedAt: null,
    };
    const data = appData({
      accounts: [
        account({ id: 'acc_cash', balance: 300 }),
        account({ id: 'acc_momo', balance: 100 }),
      ],
      transactions: [existingTransfer],
      loans: [loan({ sourceAccountId: 'acc_cash' })],
      loanPayments: [payment({ amount: 200, destinationAccountId: 'acc_momo' })],
    });

    const result = backfillLoanTransactions(data);

    // No duplicate transfer generated...
    expect(result.transactions.filter((t) => t.type === 'transfer')).toHaveLength(1);
    // ...but the balance correction still applies.
    const cash = result.accounts.find((a) => a.id === 'acc_cash')!;
    const momo = result.accounts.find((a) => a.id === 'acc_momo')!;
    expect(cash.balance).toBe(100);
    expect(momo.balance).toBe(300);
  });

  it('does not (re)apply the balance correction once disciplineState says it already ran', () => {
    // This is the key scenario the flag has to get right: a device — e.g. a
    // fresh install that pulled its data from the server — where the
    // transfer transaction AND the corrected balances both already exist,
    // because they came from already-corrected pulled data. Re-applying the
    // correction here would double it.
    const data = appData({
      accounts: [
        account({ id: 'acc_cash', balance: 100 }), // already correct (300 - 200)
        account({ id: 'acc_momo', balance: 300 }), // already correct (100 + 200)
      ],
      disciplineState: disciplineState({ loanRepaymentBalanceCorrectionAppliedAt: '2026-01-15T00:00:00.000Z' }),
      loans: [loan({ sourceAccountId: 'acc_cash' })],
      loanPayments: [payment({ amount: 200, destinationAccountId: 'acc_momo' })],
    });

    const result = backfillLoanTransactions(data);

    // Still generates the transfer transaction (ledger visibility)...
    expect(result.transactions.some((t) => t.type === 'transfer')).toBe(true);
    // ...but leaves the already-correct balances untouched.
    const cash = result.accounts.find((a) => a.id === 'acc_cash')!;
    const momo = result.accounts.find((a) => a.id === 'acc_momo')!;
    expect(cash.balance).toBe(100);
    expect(momo.balance).toBe(300);
  });

  it('marks disciplineState.loanRepaymentBalanceCorrectionAppliedAt after running the correction pass', () => {
    const data = appData({
      accounts: [account({ id: 'acc_cash', balance: 300 })],
      loans: [loan({ sourceAccountId: 'acc_cash' })],
    });

    const result = backfillLoanTransactions(data);

    expect(result.disciplineState.loanRepaymentBalanceCorrectionAppliedAt).not.toBeNull();
  });

  it('leaves disciplineState untouched once already marked applied', () => {
    const data = appData({
      disciplineState: disciplineState({ loanRepaymentBalanceCorrectionAppliedAt: '2026-01-15T00:00:00.000Z' }),
    });

    const result = backfillLoanTransactions(data);

    expect(result).toBe(data);
  });

  it('skips deleted loans and deleted payments entirely', () => {
    const data = appData({
      accounts: [account({ id: 'acc_cash', balance: 300 })],
      loans: [
        loan({ id: 'loan_deleted', deletedAt: '2026-02-01T00:00:00.000Z' }),
        loan({ id: 'loan_active' }),
      ],
      loanPayments: [
        payment({ id: 'pay_deleted', loanId: 'loan_active', deletedAt: '2026-02-01T00:00:00.000Z' }),
      ],
    });

    const result = backfillLoanTransactions(data);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]!.id).toBe('loan_active_disbursement');
  });

  it('returns the same data reference when there is nothing to backfill', () => {
    const data = appData({
      accounts: [account({ id: 'acc_cash', balance: 300 })],
      // Already marked applied — otherwise this run would still touch
      // disciplineState even with nothing left to generate (see the
      // dedicated "marks disciplineState..." test for that behavior).
      disciplineState: disciplineState({ loanRepaymentBalanceCorrectionAppliedAt: '2026-01-15T00:00:00.000Z' }),
      transactions: [
        {
          id: 'loan_1_disbursement',
          type: 'loan_disbursement',
          amount: 500,
          date: '2026-01-01T00:00:00.000Z',
          fromAccountId: 'acc_cash',
          toAccountId: null,
          categoryId: null,
          note: null,
          loanId: 'loan_1',
          loanPaymentId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          syncedAt: null,
          deletedAt: null,
        },
      ],
      loans: [loan()],
    });

    const result = backfillLoanTransactions(data);

    expect(result).toBe(data);
  });
});

describe('backfillAccountStartingBalances', () => {
  it('backfills the full balance as an opening adjustment when there are no other transactions', () => {
    const data = appData({
      accounts: [account({ id: 'acc_cash', balance: 683, createdAt: '2026-01-01T00:00:00.000Z' })],
    });

    const result = backfillAccountStartingBalances(data);

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      id: 'acc_cash_opening_balance',
      type: 'adjustment',
      amount: 683,
      fromAccountId: null,
      toAccountId: 'acc_cash',
      note: 'Starting balance',
    });
    // Purely additive — the balance itself is untouched.
    expect(result.accounts[0]!.balance).toBe(683);
  });

  it('reconstructs the opening balance by netting out existing transactions', () => {
    // Started at some balance, then a -20 expense and a +100 income happened;
    // current balance is 300, so the opening balance must have been 220.
    const data = appData({
      accounts: [account({ id: 'acc_cash', balance: 300 })],
      transactions: [
        transaction({ id: 'tx_exp', type: 'expense', amount: 20, fromAccountId: 'acc_cash' }),
        transaction({
          id: 'tx_inc',
          type: 'income',
          amount: 100,
          fromAccountId: null,
          toAccountId: 'acc_cash',
          savingsAccountId: null,
          savingsAmount: 0,
        }),
      ],
    });

    const result = backfillAccountStartingBalances(data);

    const opening = result.transactions.find((t) => t.id === 'acc_cash_opening_balance');
    expect(opening).toMatchObject({ amount: 220, toAccountId: 'acc_cash', fromAccountId: null });
  });

  it('records a negative implied opening balance via fromAccountId, not toAccountId', () => {
    const data = appData({
      accounts: [account({ id: 'acc_cash', balance: -50 })],
    });

    const result = backfillAccountStartingBalances(data);

    expect(result.transactions[0]).toMatchObject({
      amount: 50,
      fromAccountId: 'acc_cash',
      toAccountId: null,
    });
  });

  it('generates nothing once the balance is already fully explained by transactions', () => {
    const data = appData({
      accounts: [account({ id: 'acc_cash', balance: 0 })],
    });

    const result = backfillAccountStartingBalances(data);

    expect(result).toBe(data);
  });

  it('is idempotent: does nothing once the opening-balance transaction already exists', () => {
    const data = appData({
      accounts: [account({ id: 'acc_cash', balance: 683 })],
      transactions: [
        transaction({
          id: 'acc_cash_opening_balance',
          type: 'adjustment',
          amount: 683,
          fromAccountId: null,
          toAccountId: 'acc_cash',
          note: 'Starting balance',
        }),
      ],
    });

    const result = backfillAccountStartingBalances(data);

    expect(result).toBe(data);
  });

  it('skips deleted accounts', () => {
    const data = appData({
      accounts: [account({ id: 'acc_gone', balance: 500, deletedAt: '2026-02-01T00:00:00.000Z' })],
    });

    const result = backfillAccountStartingBalances(data);

    expect(result).toBe(data);
  });

  it('nets out loan-linked transactions the same as any other transaction', () => {
    // Balance already reflects a 500 loan disbursement debit; once that
    // transaction is accounted for, the implied opening balance is 800.
    const data = appData({
      accounts: [account({ id: 'acc_cash', balance: 300 })],
      transactions: [
        transaction({
          id: 'loan_1_disbursement',
          type: 'loan_disbursement',
          amount: 500,
          fromAccountId: 'acc_cash',
          toAccountId: null,
          loanId: 'loan_1',
        }),
      ],
    });

    const result = backfillAccountStartingBalances(data);

    const opening = result.transactions.find((t) => t.id === 'acc_cash_opening_balance');
    expect(opening).toMatchObject({ amount: 800, toAccountId: 'acc_cash' });
  });
});

describe('loadAppData — loan balance correction', () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
  });

  it('applies the correction and durably saves it on first load after upgrading', async () => {
    const stored = appData({
      accounts: [
        account({ id: 'acc_cash', balance: 300 }),
        account({ id: 'acc_momo', balance: 100 }),
      ],
      loans: [loan({ sourceAccountId: 'acc_cash' })],
      loanPayments: [payment({ amount: 200, destinationAccountId: 'acc_momo' })],
    });
    mockGetItem.mockImplementation(async (key: string) =>
      key === '@expense_tracker_v1' ? JSON.stringify(stored) : null,
    );

    const result = await loadAppData();

    const cash = result.accounts.find((a) => a.id === 'acc_cash')!;
    const momo = result.accounts.find((a) => a.id === 'acc_momo')!;
    expect(cash.balance).toBe(100);
    expect(momo.balance).toBe(300);
    expect(result.disciplineState.loanRepaymentBalanceCorrectionAppliedAt).not.toBeNull();

    // Saved immediately (not left to the next unrelated action), so the
    // "already applied" fact survives even if the app closes right away.
    const saveCalls = mockSetItem.mock.calls.filter(([key]) => key === '@expense_tracker_v1');
    expect(saveCalls).toHaveLength(1);
    const saved = JSON.parse(saveCalls[0]![1]) as AppData;
    expect(saved.disciplineState.loanRepaymentBalanceCorrectionAppliedAt).not.toBeNull();
  });

  it('does not reapply the correction once disciplineState already records it', async () => {
    // Same shape a device with already-synced, already-corrected data would
    // have — whether that's the original device on its second load, or a
    // brand-new device that pulled this exact state fresh from the server.
    const stored = appData({
      accounts: [
        account({ id: 'acc_cash', balance: 100 }),
        account({ id: 'acc_momo', balance: 300 }),
      ],
      disciplineState: disciplineState({ loanRepaymentBalanceCorrectionAppliedAt: '2026-01-15T00:00:00.000Z' }),
      loans: [loan({ sourceAccountId: 'acc_cash' })],
      loanPayments: [payment({ amount: 200, destinationAccountId: 'acc_momo' })],
    });
    mockGetItem.mockImplementation(async (key: string) =>
      key === '@expense_tracker_v1' ? JSON.stringify(stored) : null,
    );

    const result = await loadAppData();

    const cash = result.accounts.find((a) => a.id === 'acc_cash')!;
    const momo = result.accounts.find((a) => a.id === 'acc_momo')!;
    expect(cash.balance).toBe(100);
    expect(momo.balance).toBe(300);
  });
});
