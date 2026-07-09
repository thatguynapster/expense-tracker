import type { Account, DisciplineState, Loan, LoanPayment, SafeToSpendMetrics, SafeToSpendStatus } from '@/lib/types';
import { getDaysRemainingInMonth } from './month';

export function calculateSafeToSpendToday(
  accounts: Account[],
  currentDate?: Date
): SafeToSpendMetrics {
  const usableBalance = accounts
    .filter((a) => a.type === 'spendable')
    .reduce((sum, a) => sum + a.balance, 0);

  const daysRemaining = getDaysRemainingInMonth(currentDate);

  const safeToSpendToday = daysRemaining > 0 ? usableBalance / daysRemaining : 0;

  return { usableBalance, daysRemaining, safeToSpendToday };
}

export function calculateDisciplineDebt(state: DisciplineState): number {
  return Math.max(0, state.totalWithdrawnFromSavings - state.totalExtraSavings);
}

const WARNING_THRESHOLD = 50;

export function getSafeToSpendStatus(safeToSpendToday: number): SafeToSpendStatus {
  if (safeToSpendToday <= 0) return 'danger';
  if (safeToSpendToday < WARNING_THRESHOLD) return 'warning';
  return 'safe';
}

export function getLoanOutstanding(loan: Loan, payments: LoanPayment[]): number {
  const totalPaid = payments
    .filter((p) => p.loanId === loan.id)
    .reduce((sum, p) => sum + p.amount, 0);
  return loan.principal - totalPaid;
}

export function isLoanOverdue(loan: Loan, payments: LoanPayment[], currentDate: Date = new Date()): boolean {
  if (loan.settledAt) return false;
  if (!loan.expectedRepaymentDate) return false;
  if (getLoanOutstanding(loan, payments) <= 0) return false;
  return new Date(loan.expectedRepaymentDate) < currentDate;
}

export interface LoansSummary {
  totalOutstanding: number;
  borrowerCount: number;
  overdueCount: number;
}

/**
 * Rolls up all active (not settled, not fully repaid) loans for the Home
 * screen's "You are owed GHS X across N borrowers" card. Settled loans and
 * fully-repaid loans are excluded from both the total and the borrower count.
 */
export function getLoansSummary(loans: Loan[], payments: LoanPayment[], currentDate: Date = new Date()): LoansSummary {
  const activeWithBalance = loans.filter(
    (loan) => !loan.settledAt && getLoanOutstanding(loan, payments) > 0
  );

  const totalOutstanding = activeWithBalance.reduce(
    (sum, loan) => sum + getLoanOutstanding(loan, payments),
    0
  );
  const borrowerCount = new Set(activeWithBalance.map((loan) => loan.borrowerName)).size;
  const overdueCount = activeWithBalance.filter((loan) => isLoanOverdue(loan, payments, currentDate)).length;

  return { totalOutstanding, borrowerCount, overdueCount };
}
