import { describe, expect, it } from 'vitest';
import type { Account, Budget, Category, Loan, LoanPayment, Transaction } from '@/lib/types';
import { calculateSafeToSpendToday, getBudgetPlannedAmount, getLoanOutstanding, getLoansSummary, getMonthSummary, getSafeToSpendStatus, getTransactionReversal, isLoanDueToday, isLoanOverdue } from './calculations';

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

describe('calculateSafeToSpendToday', () => {
  // 2026-01-22: January has 31 days, so 10 days remain (inclusive of today).
  const today = new Date('2026-01-22');

  it('excludes soft-deleted accounts from the usable balance', () => {
    const accounts = [
      account({ id: 'acc_1', balance: 100 }),
      account({ id: 'acc_2', balance: 400, deletedAt: '2026-01-10T00:00:00.000Z' }),
    ];
    const { usableBalance } = calculateSafeToSpendToday(accounts, [], null, today);
    expect(usableBalance).toBe(100);
  });

  it('excludes protected accounts from the usable balance', () => {
    const accounts = [
      account({ id: 'acc_1', balance: 100, type: 'spendable' }),
      account({ id: 'acc_2', balance: 400, type: 'protected' }),
    ];
    const { usableBalance } = calculateSafeToSpendToday(accounts, [], null, today);
    expect(usableBalance).toBe(100);
  });

  it("today's spending doesn't get re-averaged across the rest of the month", () => {
    // Balance already reflects a GHS 100 expense made today.
    const accounts = [account({ id: 'acc_main', balance: 900 })];
    const transactions = [
      reversalTransaction({ date: '2026-01-22T09:00:00.000Z', amount: 100, fromAccountId: 'acc_main' }),
    ];
    const metrics = calculateSafeToSpendToday(accounts, transactions, null, today);
    expect(metrics.dailyBudget).toBe(100); // (900 + 100 reversed) / 10
    expect(metrics.spentToday).toBe(100);
    expect(metrics.safeToSpendToday).toBe(0);
  });

  it('goes negative once spending exceeds the daily budget', () => {
    const accounts = [account({ id: 'acc_main', balance: 850 })];
    const transactions = [
      reversalTransaction({ date: '2026-01-22T09:00:00.000Z', amount: 150, fromAccountId: 'acc_main' }),
    ];
    const metrics = calculateSafeToSpendToday(accounts, transactions, null, today);
    expect(metrics.dailyBudget).toBe(100); // (850 + 150 reversed) / 10
    expect(metrics.spentToday).toBe(150);
    expect(metrics.safeToSpendToday).toBe(-50);
  });

  it("income received today doesn't inflate today's budget", () => {
    // Balance already reflects GHS 100 of income received today.
    const accounts = [account({ id: 'acc_main', balance: 1100 })];
    const transactions = [
      reversalTransaction({
        type: 'income',
        date: '2026-01-22T09:00:00.000Z',
        amount: 100,
        fromAccountId: null,
        toAccountId: 'acc_main',
      }),
    ];
    const metrics = calculateSafeToSpendToday(accounts, transactions, null, today);
    expect(metrics.dailyBudget).toBe(100); // (1100 - 100 reversed) / 10 — income excluded
    expect(metrics.spentToday).toBe(0);
    expect(metrics.safeToSpendToday).toBe(100);
  });

  it("a transfer between two spendable accounts today isn't spending", () => {
    const accounts = [
      account({ id: 'acc_a', balance: 800 }),
      account({ id: 'acc_b', balance: 1200 }),
    ];
    const transactions = [
      reversalTransaction({
        type: 'transfer',
        date: '2026-01-22T09:00:00.000Z',
        amount: 200,
        fromAccountId: 'acc_a',
        toAccountId: 'acc_b',
      }),
    ];
    const metrics = calculateSafeToSpendToday(accounts, transactions, null, today);
    expect(metrics.dailyBudget).toBe(200); // net zero across the two spendable accounts
    expect(metrics.spentToday).toBe(0);
    expect(metrics.safeToSpendToday).toBe(200);
  });

  it('a transfer out to a protected account today counts as spending', () => {
    const accounts = [
      account({ id: 'acc_spend', balance: 700 }),
      account({ id: 'acc_save', type: 'protected', balance: 300 }),
    ];
    const transactions = [
      reversalTransaction({
        type: 'transfer',
        date: '2026-01-22T09:00:00.000Z',
        amount: 300,
        fromAccountId: 'acc_spend',
        toAccountId: 'acc_save',
      }),
    ];
    const metrics = calculateSafeToSpendToday(accounts, transactions, null, today);
    expect(metrics.dailyBudget).toBe(100); // (700 + 300 reversed) / 10
    expect(metrics.spentToday).toBe(300);
    expect(metrics.safeToSpendToday).toBe(-200);
  });

  it("an adjustment today isn't spending, even though it moved the balance", () => {
    const accounts = [account({ id: 'acc_main', balance: 950 })];
    const transactions = [
      reversalTransaction({
        type: 'adjustment',
        date: '2026-01-22T09:00:00.000Z',
        amount: 50,
        fromAccountId: 'acc_main',
      }),
    ];
    const metrics = calculateSafeToSpendToday(accounts, transactions, null, today);
    expect(metrics.dailyBudget).toBe(100); // (950 + 50 reversed) / 10
    expect(metrics.spentToday).toBe(0);
    expect(metrics.safeToSpendToday).toBe(100);
  });

  it("a transaction from a different day doesn't affect today's calculation", () => {
    const accounts = [account({ id: 'acc_main', balance: 1000 })];
    const transactions = [
      reversalTransaction({ date: '2026-01-14T09:00:00.000Z', amount: 500, fromAccountId: 'acc_main' }),
    ];
    const metrics = calculateSafeToSpendToday(accounts, transactions, null, today);
    expect(metrics.dailyBudget).toBe(100);
    expect(metrics.spentToday).toBe(0);
    expect(metrics.safeToSpendToday).toBe(100);
  });

  it("a deleted transaction from today is excluded", () => {
    const accounts = [account({ id: 'acc_main', balance: 1000 })];
    const transactions = [
      reversalTransaction({
        date: '2026-01-22T09:00:00.000Z',
        amount: 100,
        fromAccountId: 'acc_main',
        deletedAt: '2026-01-22T10:00:00.000Z',
      }),
    ];
    const metrics = calculateSafeToSpendToday(accounts, transactions, null, today);
    expect(metrics.dailyBudget).toBe(100);
    expect(metrics.spentToday).toBe(0);
    expect(metrics.safeToSpendToday).toBe(100);
  });

  it('a custom daily budget replaces the calculated figure entirely', () => {
    // Calculated would be 1000 / 10 = 100, but the custom budget overrides it.
    const accounts = [account({ id: 'acc_main', balance: 1000 })];
    const metrics = calculateSafeToSpendToday(accounts, [], 250, today);
    expect(metrics.dailyBudget).toBe(250);
    expect(metrics.safeToSpendToday).toBe(250);
  });

  it('a custom budget of exactly 0 is honored, not treated as unset', () => {
    const accounts = [account({ id: 'acc_main', balance: 1000 })];
    const metrics = calculateSafeToSpendToday(accounts, [], 0, today);
    expect(metrics.dailyBudget).toBe(0);
    expect(metrics.safeToSpendToday).toBe(0);
  });

  it("today's spending still comes off a custom budget the same way", () => {
    const accounts = [account({ id: 'acc_main', balance: 900 })];
    const transactions = [
      reversalTransaction({ date: '2026-01-22T09:00:00.000Z', amount: 30, fromAccountId: 'acc_main' }),
    ];
    const metrics = calculateSafeToSpendToday(accounts, transactions, 80, today);
    expect(metrics.dailyBudget).toBe(80);
    expect(metrics.spentToday).toBe(30);
    expect(metrics.safeToSpendToday).toBe(50);
  });

  it('flags an unsustainable custom budget: spending it every remaining day would exceed the balance', () => {
    // Balance can sustain 100/day for 10 days; asking for 150/day would run out early.
    const accounts = [account({ id: 'acc_main', balance: 1000 })];
    const metrics = calculateSafeToSpendToday(accounts, [], 150, today);
    expect(metrics.budgetUnsustainable).toBe(true);
  });

  it('does not flag a custom budget the balance can sustain for the rest of the month', () => {
    const accounts = [account({ id: 'acc_main', balance: 1000 })];
    const metrics = calculateSafeToSpendToday(accounts, [], 100, today);
    expect(metrics.budgetUnsustainable).toBe(false);
  });

  it('never flags unsustainability when no custom budget is set', () => {
    const accounts = [account({ id: 'acc_main', balance: 10 })];
    const metrics = calculateSafeToSpendToday(accounts, [], null, today);
    expect(metrics.budgetUnsustainable).toBe(false);
  });
});

const reversalTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx_1',
  type: 'expense',
  amount: 20,
  date: '2026-01-05T00:00:00.000Z',
  categoryId: 'cat_food',
  fromAccountId: 'acc_main',
  toAccountId: null,
  note: null,
  reason: null,
  savingsAccountId: null,
  savingsAmount: null,
  countsAsDebtRepayment: false,
  createdAt: '2026-01-05T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

describe('getTransactionReversal', () => {
  it('reverses an expense by crediting the source account back', () => {
    const reversal = getTransactionReversal(
      reversalTransaction({ type: 'expense', amount: 50, fromAccountId: 'acc_main' }),
      [],
    );
    expect(reversal.accountDeltas).toEqual([{ accountId: 'acc_main', delta: 50 }]);
    expect(reversal.disciplineDelta).toEqual({ totalWithdrawnFromSavings: 0, totalExtraSavings: 0 });
  });

  it('reverses income by debiting both the spendable and savings accounts, and the extra-savings credit', () => {
    // amount 100, saved 30 (min is 10) -> spendable got 70, savings got 30, extraSavings +20 at creation
    const reversal = getTransactionReversal(
      reversalTransaction({
        type: 'income',
        amount: 100,
        toAccountId: 'acc_spendable',
        savingsAccountId: 'acc_protected',
        savingsAmount: 30,
      }),
      [],
    );
    expect(reversal.accountDeltas).toEqual([
      { accountId: 'acc_spendable', delta: -70 },
      { accountId: 'acc_protected', delta: -30 },
    ]);
    expect(reversal.disciplineDelta).toEqual({ totalWithdrawnFromSavings: 0, totalExtraSavings: -20 });
  });

  it('reverses income at exactly the minimum savings rate with no extra-savings delta', () => {
    const reversal = getTransactionReversal(
      reversalTransaction({
        type: 'income',
        amount: 100,
        toAccountId: 'acc_spendable',
        savingsAccountId: 'acc_protected',
        savingsAmount: 10,
      }),
      [],
    );
    expect(reversal.disciplineDelta.totalExtraSavings).toBe(0);
  });

  it('reverses a plain transfer between two spendable accounts with no discipline effect', () => {
    const accounts = [
      account({ id: 'acc_a', type: 'spendable' }),
      account({ id: 'acc_b', type: 'spendable' }),
    ];
    const reversal = getTransactionReversal(
      reversalTransaction({ type: 'transfer', amount: 40, fromAccountId: 'acc_a', toAccountId: 'acc_b' }),
      accounts,
    );
    expect(reversal.accountDeltas).toEqual([
      { accountId: 'acc_a', delta: 40 },
      { accountId: 'acc_b', delta: -40 },
    ]);
    expect(reversal.disciplineDelta).toEqual({ totalWithdrawnFromSavings: 0, totalExtraSavings: 0 });
  });

  it('reverses a protected-to-spendable transfer, undoing the discipline debt increase', () => {
    const accounts = [
      account({ id: 'acc_protected', type: 'protected' }),
      account({ id: 'acc_spendable', type: 'spendable' }),
    ];
    const reversal = getTransactionReversal(
      reversalTransaction({ type: 'transfer', amount: 60, fromAccountId: 'acc_protected', toAccountId: 'acc_spendable' }),
      accounts,
    );
    expect(reversal.disciplineDelta).toEqual({ totalWithdrawnFromSavings: -60, totalExtraSavings: 0 });
  });

  it('reverses a spendable-to-protected debt-repayment transfer, undoing the extra-savings credit', () => {
    const accounts = [
      account({ id: 'acc_spendable', type: 'spendable' }),
      account({ id: 'acc_protected', type: 'protected' }),
    ];
    const reversal = getTransactionReversal(
      reversalTransaction({
        type: 'transfer',
        amount: 25,
        fromAccountId: 'acc_spendable',
        toAccountId: 'acc_protected',
        countsAsDebtRepayment: true,
      }),
      accounts,
    );
    expect(reversal.disciplineDelta).toEqual({ totalWithdrawnFromSavings: 0, totalExtraSavings: -25 });
  });

  it('does not touch discipline state for a spendable-to-protected transfer not marked as debt repayment', () => {
    const accounts = [
      account({ id: 'acc_spendable', type: 'spendable' }),
      account({ id: 'acc_protected', type: 'protected' }),
    ];
    const reversal = getTransactionReversal(
      reversalTransaction({
        type: 'transfer',
        amount: 25,
        fromAccountId: 'acc_spendable',
        toAccountId: 'acc_protected',
        countsAsDebtRepayment: false,
      }),
      accounts,
    );
    expect(reversal.disciplineDelta).toEqual({ totalWithdrawnFromSavings: 0, totalExtraSavings: 0 });
  });
});

describe('getSafeToSpendStatus', () => {
  it('is danger at or below zero, regardless of threshold', () => {
    expect(getSafeToSpendStatus(0)).toBe('danger');
    expect(getSafeToSpendStatus(-5)).toBe('danger');
  });

  it('uses the default 50 threshold when none is given', () => {
    expect(getSafeToSpendStatus(49)).toBe('warning');
    expect(getSafeToSpendStatus(50)).toBe('safe');
  });

  it('respects a custom warning threshold', () => {
    expect(getSafeToSpendStatus(80, 100)).toBe('warning');
    expect(getSafeToSpendStatus(100, 100)).toBe('safe');
  });

  it('is safe once above the threshold', () => {
    expect(getSafeToSpendStatus(200, 100)).toBe('safe');
  });
});

const loan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan_1',
  borrowerName: 'Kwame',
  principal: 500,
  dateLent: '2026-01-01T00:00:00.000Z',
  expectedRepaymentDate: null,
  note: null,
  sourceAccountId: 'acc_1',
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

describe('getLoanOutstanding', () => {
  it('equals principal when no payments have been made', () => {
    expect(getLoanOutstanding(loan(), [])).toBe(500);
  });

  it('subtracts only payments belonging to that loan', () => {
    const payments = [
      payment({ id: 'p1', loanId: 'loan_1', amount: 100 }),
      payment({ id: 'p2', loanId: 'loan_2', amount: 9999 }),
    ];
    expect(getLoanOutstanding(loan({ id: 'loan_1' }), payments)).toBe(400);
  });

  it('sums multiple partial payments', () => {
    const payments = [
      payment({ id: 'p1', amount: 100 }),
      payment({ id: 'p2', amount: 150 }),
    ];
    expect(getLoanOutstanding(loan(), payments)).toBe(250);
  });

  it('can go to zero when fully repaid', () => {
    expect(getLoanOutstanding(loan(), [payment({ amount: 500 })])).toBe(0);
  });

  it('ignores deleted (reversed) payments', () => {
    const payments = [
      payment({ id: 'p1', amount: 100 }),
      payment({ id: 'p2', amount: 150, deletedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    expect(getLoanOutstanding(loan(), payments)).toBe(400);
  });
});

describe('isLoanOverdue', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');

  it('is false when there is no expectedRepaymentDate', () => {
    expect(isLoanOverdue(loan({ expectedRepaymentDate: null }), [], now)).toBe(false);
  });

  it('is false when the expected date is in the future', () => {
    expect(isLoanOverdue(loan({ expectedRepaymentDate: '2026-07-01T00:00:00.000Z' }), [], now)).toBe(false);
  });

  it('is true when the expected date is in the past and balance remains', () => {
    expect(isLoanOverdue(loan({ expectedRepaymentDate: '2026-01-01T00:00:00.000Z' }), [], now)).toBe(true);
  });

  it('is false once the loan is fully repaid, even past its expected date', () => {
    const overdueLoan = loan({ expectedRepaymentDate: '2026-01-01T00:00:00.000Z' });
    expect(isLoanOverdue(overdueLoan, [payment({ amount: 500 })], now)).toBe(false);
  });

  it('is false when the loan has been manually settled, even if past due with a balance', () => {
    const settled = loan({ expectedRepaymentDate: '2026-01-01T00:00:00.000Z', settledAt: '2026-02-01T00:00:00.000Z' });
    expect(isLoanOverdue(settled, [], now)).toBe(false);
  });

  it('is not overdue when the expected date is today, even later in the day', () => {
    const laterToday = new Date('2026-06-15T20:00:00.000Z');
    expect(isLoanOverdue(loan({ expectedRepaymentDate: '2026-06-15T00:00:00.000Z' }), [], laterToday)).toBe(false);
  });
});

describe('isLoanDueToday', () => {
  const now = new Date('2026-06-15T14:30:00.000Z');

  it('is true when the expected date is today, regardless of the time of day', () => {
    expect(isLoanDueToday(loan({ expectedRepaymentDate: '2026-06-15T00:00:00.000Z' }), [], now)).toBe(true);
  });

  it('is false once the expected date has passed', () => {
    expect(isLoanDueToday(loan({ expectedRepaymentDate: '2026-06-14T00:00:00.000Z' }), [], now)).toBe(false);
  });

  it('is false when the expected date is in the future', () => {
    expect(isLoanDueToday(loan({ expectedRepaymentDate: '2026-06-16T00:00:00.000Z' }), [], now)).toBe(false);
  });

  it('is false when there is no expectedRepaymentDate', () => {
    expect(isLoanDueToday(loan({ expectedRepaymentDate: null }), [], now)).toBe(false);
  });

  it('is false once the loan is fully repaid, even if due today', () => {
    const dueToday = loan({ expectedRepaymentDate: '2026-06-15T00:00:00.000Z' });
    expect(isLoanDueToday(dueToday, [payment({ amount: 500 })], now)).toBe(false);
  });
});

describe('getLoansSummary', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');

  it('returns zeroes when there are no loans', () => {
    expect(getLoansSummary([], [], now)).toEqual({ totalOutstanding: 0, borrowerCount: 0, overdueCount: 0, dueTodayCount: 0 });
  });

  it('sums outstanding balances across active loans', () => {
    const loans = [
      loan({ id: 'l1', borrowerName: 'Kwame', principal: 500 }),
      loan({ id: 'l2', borrowerName: 'Ama', principal: 300 }),
    ];
    const summary = getLoansSummary(loans, [], now);
    expect(summary.totalOutstanding).toBe(800);
    expect(summary.borrowerCount).toBe(2);
  });

  it('counts one borrower once even with multiple active loans to them', () => {
    const loans = [
      loan({ id: 'l1', borrowerName: 'Kwame', principal: 500 }),
      loan({ id: 'l2', borrowerName: 'Kwame', principal: 200 }),
    ];
    const summary = getLoansSummary(loans, [], now);
    expect(summary.totalOutstanding).toBe(700);
    expect(summary.borrowerCount).toBe(1);
  });

  it('excludes settled loans from the total and borrower count', () => {
    const loans = [
      loan({ id: 'l1', borrowerName: 'Kwame', principal: 500, settledAt: '2026-02-01T00:00:00.000Z' }),
      loan({ id: 'l2', borrowerName: 'Ama', principal: 300 }),
    ];
    const summary = getLoansSummary(loans, [], now);
    expect(summary.totalOutstanding).toBe(300);
    expect(summary.borrowerCount).toBe(1);
  });

  it('excludes fully-repaid loans from the total and borrower count', () => {
    const loans = [loan({ id: 'l1', borrowerName: 'Kwame', principal: 500 })];
    const payments = [payment({ loanId: 'l1', amount: 500 })];
    const summary = getLoansSummary(loans, payments, now);
    expect(summary.totalOutstanding).toBe(0);
    expect(summary.borrowerCount).toBe(0);
  });

  it('counts overdue active loans', () => {
    const loans = [
      loan({ id: 'l1', borrowerName: 'Kwame', principal: 500, expectedRepaymentDate: '2026-01-01T00:00:00.000Z' }),
      loan({ id: 'l2', borrowerName: 'Ama', principal: 300, expectedRepaymentDate: '2026-12-01T00:00:00.000Z' }),
    ];
    const summary = getLoansSummary(loans, [], now);
    expect(summary.overdueCount).toBe(1);
  });

  it('excludes deleted loans from the total and borrower count', () => {
    const loans = [
      loan({ id: 'l1', borrowerName: 'Kwame', principal: 500 }),
      loan({ id: 'l2', borrowerName: 'Ama', principal: 300, deletedAt: '2026-06-10T00:00:00.000Z' }),
    ];
    const summary = getLoansSummary(loans, [], now);
    expect(summary.totalOutstanding).toBe(500);
    expect(summary.borrowerCount).toBe(1);
  });

  it('counts loans due today separately from overdue loans', () => {
    const laterToday = new Date('2026-06-15T20:00:00.000Z');
    const loans = [
      loan({ id: 'l1', borrowerName: 'Kwame', principal: 500, expectedRepaymentDate: '2026-06-15T00:00:00.000Z' }),
      loan({ id: 'l2', borrowerName: 'Ama', principal: 300, expectedRepaymentDate: '2026-01-01T00:00:00.000Z' }),
    ];
    const summary = getLoansSummary(loans, [], laterToday);
    expect(summary.dueTodayCount).toBe(1);
    expect(summary.overdueCount).toBe(1);
  });
});

const budget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 'budget_1',
  categoryId: 'cat_food',
  month: '2026-01',
  plannedAmount: 200,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

const category = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat_food',
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
  amount: 50,
  date: '2026-01-10T00:00:00.000Z',
  categoryId: 'cat_food',
  fromAccountId: 'acc_1',
  toAccountId: null,
  note: null,
  reason: null,
  savingsAccountId: null,
  savingsAmount: null,
  countsAsDebtRepayment: false,
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
  syncedAt: null,
  deletedAt: null,
  ...overrides,
});

describe('getBudgetPlannedAmount', () => {
  it('returns 0 when no Budget record exists for that category+month', () => {
    expect(getBudgetPlannedAmount([], 'cat_food', '2026-01')).toBe(0);
  });

  it('returns the plannedAmount for a matching category+month', () => {
    const budgets = [budget({ categoryId: 'cat_food', month: '2026-01', plannedAmount: 300 })];
    expect(getBudgetPlannedAmount(budgets, 'cat_food', '2026-01')).toBe(300);
  });

  it('does not match a different month for the same category', () => {
    const budgets = [budget({ categoryId: 'cat_food', month: '2026-01', plannedAmount: 300 })];
    expect(getBudgetPlannedAmount(budgets, 'cat_food', '2026-02')).toBe(0);
  });

  it('does not match a different category for the same month', () => {
    const budgets = [budget({ categoryId: 'cat_food', month: '2026-01', plannedAmount: 300 })];
    expect(getBudgetPlannedAmount(budgets, 'cat_rent', '2026-01')).toBe(0);
  });

  it('ignores a soft-deleted Budget record', () => {
    const budgets = [budget({ categoryId: 'cat_food', month: '2026-01', deletedAt: '2026-01-15T00:00:00.000Z' })];
    expect(getBudgetPlannedAmount(budgets, 'cat_food', '2026-01')).toBe(0);
  });
});

describe('getMonthSummary', () => {
  it('sums income and expenses within the given month only', () => {
    const transactions = [
      transaction({ id: 't1', type: 'income', amount: 1000, date: '2026-01-05T00:00:00.000Z' }),
      transaction({ id: 't2', type: 'expense', amount: 100, date: '2026-01-10T00:00:00.000Z' }),
      transaction({ id: 't3', type: 'expense', amount: 9999, date: '2026-02-01T00:00:00.000Z' }), // different month
    ];
    const summary = getMonthSummary('2026-01', transactions, [category()], []);
    expect(summary.totalIncome).toBe(1000);
    expect(summary.totalExpenses).toBe(100);
    expect(summary.netSavings).toBe(900);
  });

  it('excludes soft-deleted transactions', () => {
    const transactions = [
      transaction({ type: 'expense', amount: 100, deletedAt: '2026-01-11T00:00:00.000Z' }),
    ];
    const summary = getMonthSummary('2026-01', transactions, [category()], []);
    expect(summary.totalExpenses).toBe(0);
  });

  it('includes every expense category in plannedVsActual, even with zero activity and no budget', () => {
    const summary = getMonthSummary('2026-01', [], [category({ id: 'cat_food' })], []);
    expect(summary.plannedVsActual).toEqual([
      { categoryId: 'cat_food', categoryName: 'Food', planned: 0, actual: 0 },
    ]);
  });

  it('excludes income categories from plannedVsActual', () => {
    const categories = [category({ id: 'cat_food', type: 'expense' }), category({ id: 'cat_salary', name: 'Salary', type: 'income' })];
    const summary = getMonthSummary('2026-01', [], categories, []);
    expect(summary.plannedVsActual.map((p) => p.categoryId)).toEqual(['cat_food']);
  });

  it('pulls planned amount from the matching Budget record', () => {
    const budgets = [budget({ categoryId: 'cat_food', month: '2026-01', plannedAmount: 250 })];
    const summary = getMonthSummary('2026-01', [], [category({ id: 'cat_food' })], budgets);
    expect(summary.plannedVsActual[0]?.planned).toBe(250);
  });

  it('computes actual as the sum of that category\'s expense transactions in the month', () => {
    const transactions = [
      transaction({ id: 't1', categoryId: 'cat_food', amount: 30, date: '2026-01-05T00:00:00.000Z' }),
      transaction({ id: 't2', categoryId: 'cat_food', amount: 20, date: '2026-01-12T00:00:00.000Z' }),
      transaction({ id: 't3', categoryId: 'cat_rent', amount: 999, date: '2026-01-01T00:00:00.000Z' }), // different category
    ];
    const summary = getMonthSummary('2026-01', transactions, [category({ id: 'cat_food' })], []);
    expect(summary.plannedVsActual[0]?.actual).toBe(50);
  });

  it('a budget set for one month never affects a different month\'s planned amount', () => {
    const budgets = [budget({ categoryId: 'cat_food', month: '2026-02', plannedAmount: 500 })];
    const summary = getMonthSummary('2026-01', [], [category({ id: 'cat_food' })], budgets);
    expect(summary.plannedVsActual[0]?.planned).toBe(0);
  });
});
