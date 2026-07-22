export type AccountType = 'spendable' | 'protected';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment' | 'loan_disbursement' | 'loan_repayment';
export type CategoryType = 'income' | 'expense';
export type SafeToSpendStatus = 'safe' | 'warning' | 'danger';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  createdAt: string;
  updatedAt: string;
  /** null = not yet synced to the server; set to the timestamp of the last successful sync. */
  syncedAt: string | null;
  /** null = active; set to a timestamp when soft-deleted (tombstone for delta sync). */
  deletedAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  createdAt: string;
  updatedAt: string;
  /** null = not yet synced to the server; set to the timestamp of the last successful sync. */
  syncedAt: string | null;
  /** null = active; set to a timestamp when soft-deleted (tombstone for delta sync). */
  deletedAt: string | null;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  categoryId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  note?: string | null;
  reason?: string | null;
  savingsAccountId?: string | null;
  savingsAmount?: number | null;
  countsAsDebtRepayment?: boolean;
  /** Set only on a loan's disbursement mirror transaction — links back to the Loan it belongs to. Null everywhere else. Locks the transaction from being edited/deleted directly (see transaction-detail.tsx) — only deleting the Loan reverses it. */
  loanId?: string | null;
  /** Set on a loan repayment's credit transaction and, when the money moved on to a different account, its onward transfer leg — links back to the LoanPayment. Null everywhere else. Same delete lock as loanId. */
  loanPaymentId?: string | null;
  createdAt: string;
  updatedAt: string;
  /** null = not yet synced to the server; set to the timestamp of the last successful sync. */
  syncedAt: string | null;
  /** null = active; set to a timestamp when soft-deleted (tombstone for delta sync). */
  deletedAt: string | null;
}

export interface DisciplineState {
  id: string;
  totalWithdrawnFromSavings: number;
  totalExtraSavings: number;
  /** Below this GHS/day figure, Safe-to-Spend Today shows as "warning" rather than "safe" (PRD §5.7). Lives here rather than a dedicated settings model since this is the app's only global, singleton user preference so far — not semantically a "discipline" metric, just reusing the one synced singleton record that already exists. */
  safeToSpendWarningThreshold: number;
  /** User-set GHS/day target. When set, replaces the automatic balance/days-remaining calculation entirely for "Safe to Spend Today"; null uses the automatic calculation. */
  customDailyBudget: number | null;
  /** Timestamp of the one-time loan-repayment balance correction (storage.ts backfillLoanTransactions), or null if it hasn't run yet. Lives here — synced data — rather than a local-only flag, so a device that pulls already-corrected balances also pulls the fact that they're already corrected, instead of re-applying the correction on top of numbers that don't need it. */
  loanRepaymentBalanceCorrectionAppliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** null = not yet synced to the server; set to the timestamp of the last successful sync. */
  syncedAt: string | null;
  /** null = active; set to a timestamp when soft-deleted (tombstone for delta sync). Not expected to ever be set in practice — no feature deletes discipline state. */
  deletedAt: string | null;
}

export interface Loan {
  id: string;
  borrowerName: string;
  principal: number;
  dateLent: string;
  expectedRepaymentDate?: string | null;
  note?: string | null;
  sourceAccountId: string;
  createdAt: string;
  updatedAt: string;
  /** null = active; set to a timestamp when the lender manually marks the loan settled (independent of whether it's fully repaid). */
  settledAt: string | null;
  /** null = not yet synced to the server; set to the timestamp of the last successful sync. */
  syncedAt: string | null;
  /** null = active; set to a timestamp when soft-deleted (tombstone for delta sync). No UI currently deletes a loan (only marks it settled), but this is front-loaded so a future delete feature doesn't require another sync-layer change. */
  deletedAt: string | null;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  amount: number;
  date: string;
  destinationAccountId: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  /** null = not yet synced to the server; set to the timestamp of the last successful sync. */
  syncedAt: string | null;
  /** null = active; set to a timestamp when soft-deleted (tombstone for delta sync). No UI currently deletes a loan payment. */
  deletedAt: string | null;
}

/** One planned amount for one category in one calendar month (`YYYY-MM`). A category with no Budget record for a given month is treated as planned = 0 for that month — this is how adjusting a future month's budget never touches past months' numbers. */
export interface Budget {
  id: string;
  categoryId: string;
  /** `YYYY-MM`, e.g. "2026-07". */
  month: string;
  plannedAmount: number;
  createdAt: string;
  updatedAt: string;
  /** null = not yet synced to the server; set to the timestamp of the last successful sync. */
  syncedAt: string | null;
  /** null = active; set to a timestamp when soft-deleted (tombstone for delta sync). No UI currently deletes a budget record (only re-sets its plannedAmount), but this is front-loaded per this codebase's established convention. */
  deletedAt: string | null;
}

export interface AppData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  disciplineState: DisciplineState;
  loans: Loan[];
  loanPayments: LoanPayment[];
  budgets: Budget[];
}

export interface SafeToSpendMetrics {
  usableBalance: number;
  daysRemaining: number;
  /** The user's customDailyBudget if set, else this morning's usable balance / daysRemaining — fixed for the whole day, unaffected by today's own spending. */
  dailyBudget: number;
  /** Real spending today only: expenses, and transfers out to a protected account. */
  spentToday: number;
  /** dailyBudget - spentToday. Can go negative once today's spending exceeds the budget. */
  safeToSpendToday: number;
  /** True when a custom daily budget is set and, at that rate, would deplete the usable balance before month end. */
  budgetUnsustainable: boolean;
}
