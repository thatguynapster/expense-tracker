export type AccountType = 'spendable' | 'protected';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';
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
  safeToSpendToday: number;
}
