import { describe, expect, it } from 'vitest';
import type { Loan, LoanPayment } from '@/lib/types';
import { getLoanOutstanding, getLoansSummary, isLoanOverdue } from './calculations';

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
});

describe('getLoansSummary', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');

  it('returns zeroes when there are no loans', () => {
    expect(getLoansSummary([], [], now)).toEqual({ totalOutstanding: 0, borrowerCount: 0, overdueCount: 0 });
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
});
