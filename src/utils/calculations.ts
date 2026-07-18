import type { Account, Budget, Category, DisciplineState, Loan, LoanPayment, SafeToSpendMetrics, SafeToSpendStatus, Transaction } from '@/lib/types';
import { getDaysRemainingInMonth } from './month';

export interface TransactionReversal {
  accountDeltas: { accountId: string; delta: number }[];
  disciplineDelta: { totalWithdrawnFromSavings: number; totalExtraSavings: number };
}

/**
 * The exact inverse of what `addExpense`/`addIncome`/`addTransfer` applied
 * when the transaction was created — used to undo a transaction before
 * deleting or replacing it (edit = delete old + create new). Account type
 * is locked for life (§5.5), so looking up `accounts` by the transaction's
 * stored account ids always reflects what those accounts were at creation
 * time too — no need to have stored the account types on the transaction
 * itself.
 */
export function getTransactionReversal(transaction: Transaction, accounts: Account[]): TransactionReversal {
  const accountDeltas: { accountId: string; delta: number }[] = [];
  let totalWithdrawnFromSavings = 0;
  let totalExtraSavings = 0;

  if (transaction.type === 'expense') {
    if (transaction.fromAccountId) {
      accountDeltas.push({ accountId: transaction.fromAccountId, delta: transaction.amount });
    }
  } else if (transaction.type === 'income') {
    const savingsAmount = transaction.savingsAmount ?? 0;
    const spendableAmount = transaction.amount - savingsAmount;
    if (transaction.toAccountId) {
      accountDeltas.push({ accountId: transaction.toAccountId, delta: -spendableAmount });
    }
    if (transaction.savingsAccountId) {
      accountDeltas.push({ accountId: transaction.savingsAccountId, delta: -savingsAmount });
    }
    const minimumSavings = transaction.amount * 0.1;
    totalExtraSavings -= Math.max(0, savingsAmount - minimumSavings);
  } else if (transaction.type === 'adjustment') {
    // Single-account correction, same shape as expense (fromAccountId = the
    // adjustment removed money) / income (toAccountId = it added money).
    // Never touches Discipline Debt — it's a correction, not real activity.
    if (transaction.fromAccountId) {
      accountDeltas.push({ accountId: transaction.fromAccountId, delta: transaction.amount });
    }
    if (transaction.toAccountId) {
      accountDeltas.push({ accountId: transaction.toAccountId, delta: -transaction.amount });
    }
  } else {
    if (transaction.fromAccountId) {
      accountDeltas.push({ accountId: transaction.fromAccountId, delta: transaction.amount });
    }
    if (transaction.toAccountId) {
      accountDeltas.push({ accountId: transaction.toAccountId, delta: -transaction.amount });
    }

    const fromAccount = accounts.find((a) => a.id === transaction.fromAccountId);
    const toAccount = accounts.find((a) => a.id === transaction.toAccountId);
    const isProtectedToSpendable = fromAccount?.type === 'protected' && toAccount?.type === 'spendable';
    const isSpendableToProtected = fromAccount?.type === 'spendable' && toAccount?.type === 'protected';

    if (isProtectedToSpendable) {
      totalWithdrawnFromSavings -= transaction.amount;
    } else if (isSpendableToProtected && transaction.countsAsDebtRepayment) {
      totalExtraSavings -= transaction.amount;
    }
  }

  return { accountDeltas, disciplineDelta: { totalWithdrawnFromSavings, totalExtraSavings } };
}

export function calculateSafeToSpendToday(
  accounts: Account[],
  currentDate?: Date
): SafeToSpendMetrics {
  const usableBalance = accounts
    .filter((a) => a.type === 'spendable' && !a.deletedAt)
    .reduce((sum, a) => sum + a.balance, 0);

  const daysRemaining = getDaysRemainingInMonth(currentDate);

  const safeToSpendToday = daysRemaining > 0 ? usableBalance / daysRemaining : 0;

  return { usableBalance, daysRemaining, safeToSpendToday };
}

export function calculateDisciplineDebt(state: DisciplineState): number {
  return Math.max(0, state.totalWithdrawnFromSavings - state.totalExtraSavings);
}

/** Default when a DisciplineState record predates the editable-threshold setting (PRD §5.7). */
export const DEFAULT_SAFE_TO_SPEND_WARNING_THRESHOLD = 50;

export function getSafeToSpendStatus(
  safeToSpendToday: number,
  warningThreshold: number = DEFAULT_SAFE_TO_SPEND_WARNING_THRESHOLD,
): SafeToSpendStatus {
  if (safeToSpendToday <= 0) return 'danger';
  if (safeToSpendToday < warningThreshold) return 'warning';
  return 'safe';
}

export function getLoanOutstanding(loan: Loan, payments: LoanPayment[]): number {
  const totalPaid = payments
    .filter((p) => p.loanId === loan.id && !p.deletedAt)
    .reduce((sum, p) => sum + p.amount, 0);
  return loan.principal - totalPaid;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** A loan due later today isn't overdue yet — only a calendar day that has fully passed counts. */
export function isLoanOverdue(loan: Loan, payments: LoanPayment[], currentDate: Date = new Date()): boolean {
  if (loan.deletedAt) return false;
  if (loan.settledAt) return false;
  if (!loan.expectedRepaymentDate) return false;
  if (getLoanOutstanding(loan, payments) <= 0) return false;
  return startOfDay(new Date(loan.expectedRepaymentDate)) < startOfDay(currentDate);
}

export function isLoanDueToday(loan: Loan, payments: LoanPayment[], currentDate: Date = new Date()): boolean {
  if (loan.deletedAt) return false;
  if (loan.settledAt) return false;
  if (!loan.expectedRepaymentDate) return false;
  if (getLoanOutstanding(loan, payments) <= 0) return false;
  return startOfDay(new Date(loan.expectedRepaymentDate)).getTime() === startOfDay(currentDate).getTime();
}

export interface LoansSummary {
  totalOutstanding: number;
  borrowerCount: number;
  overdueCount: number;
  dueTodayCount: number;
}

/**
 * Rolls up all active (not settled, not fully repaid) loans for the Home
 * screen's "You are owed GHS X across N borrowers" card. Settled loans and
 * fully-repaid loans are excluded from both the total and the borrower count.
 */
export function getLoansSummary(loans: Loan[], payments: LoanPayment[], currentDate: Date = new Date()): LoansSummary {
  const activeWithBalance = loans.filter(
    (loan) => !loan.deletedAt && !loan.settledAt && getLoanOutstanding(loan, payments) > 0
  );

  const totalOutstanding = activeWithBalance.reduce(
    (sum, loan) => sum + getLoanOutstanding(loan, payments),
    0
  );
  const borrowerCount = new Set(activeWithBalance.map((loan) => loan.borrowerName)).size;
  const overdueCount = activeWithBalance.filter((loan) => isLoanOverdue(loan, payments, currentDate)).length;
  const dueTodayCount = activeWithBalance.filter((loan) => isLoanDueToday(loan, payments, currentDate)).length;

  return { totalOutstanding, borrowerCount, overdueCount, dueTodayCount };
}

/**
 * 0 when no Budget record exists for that category+month — this is the
 * PRD-specified default (§4.6), not an error case. Adjusting a future
 * month's planned amount never touches this or any other past month's
 * record, since each (categoryId, month) pair is its own Budget row.
 */
export function getBudgetPlannedAmount(budgets: Budget[], categoryId: string, month: string): number {
  const match = budgets.find((b) => b.categoryId === categoryId && b.month === month && !b.deletedAt);
  return match?.plannedAmount ?? 0;
}

export interface CategoryPlannedVsActual {
  categoryId: string;
  categoryName: string;
  planned: number;
  actual: number;
}

export interface MonthSummary {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  /** Expense categories only — budgets apply to expenses, not income (PRD §4.6). */
  plannedVsActual: CategoryPlannedVsActual[];
}

/**
 * `month` in `YYYY-MM`. Actuals are always derived from transactions dated
 * within that month — never entered manually (PRD §4.6) — so this can
 * never drift out of sync with the transaction ledger the way a
 * hand-maintained running total could.
 */
export function getMonthSummary(
  month: string,
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[],
): MonthSummary {
  const inMonth = transactions.filter((t) => t.date.startsWith(month) && !t.deletedAt);

  const totalIncome = inMonth.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = inMonth.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncome - totalExpenses;

  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.deletedAt);
  const plannedVsActual: CategoryPlannedVsActual[] = expenseCategories.map((category) => {
    const actual = inMonth
      .filter((t) => t.type === 'expense' && t.categoryId === category.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      categoryId: category.id,
      categoryName: category.name,
      planned: getBudgetPlannedAmount(budgets, category.id, month),
      actual,
    };
  });

  return { totalIncome, totalExpenses, netSavings, plannedVsActual };
}
